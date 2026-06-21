// EduManage — k6 Load Test
// ===========================================================================
// Exercises three traffic profiles against the staging environment:
//   1. realistic_load  — ramp to 10,000 virtual users over 10 min, hitting
//                        the dashboard + a list endpoint per iteration.
//   2. ai_burst        — constant 50 RPS against the ai-assistant function.
//   3. login_storm     — constant 500 RPS against auth.signInWithPassword.
//
// CRITICAL: a custom counter `tenant_isolation_violations` increments
// whenever a response payload contains data belonging to a different
// school than the request targeted. The threshold `count == 0` is
// enforced — a single violation fails the test.
//
// Configuration (env vars, all required):
//   SUPABASE_URL             — e.g. https://abcdefg.supabase.co
//   SUPABASE_ANON_KEY        — anon key
//   TEST_USER_EMAIL          — load test account email
//   TEST_USER_PASSWORD       — load test account password
//   TEST_SCHOOL_ID_A         — caller's school id (allowed)
//   TEST_SCHOOL_ID_B         — foreign school id (should be rejected)
//   AI_FUNCTION_URL          — full URL to ai-assistant function
//
// Usage:
//   k6 run --vus 1000 --duration 10m loadtest/edumanage-loadtest.js
// ===========================================================================

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';
import { fail } from 'k6';

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------

// CRITICAL counter — must remain 0.
export const tenant_isolation_violations = new Counter('tenant_isolation_violations');

// Per-endpoint duration trends.
export const login_duration = new Trend('login_duration', true);
export const dashboard_duration = new Trend('dashboard_duration', true);
export const ai_duration = new Trend('ai_duration', true);

// Error rate trackers.
export const login_error_rate = new Rate('login_error_rate');
export const dashboard_error_rate = new Rate('dashboard_error_rate');
export const ai_error_rate = new Rate('ai_error_rate');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE = __ENV.SUPABASE_URL || 'http://localhost:54321';
const ANON_KEY = __ENV.SUPABASE_ANON_KEY || '';
const FUNCTIONS_BASE = (BASE || '').replace(/\.supabase\.co$/, '.functions.supabase.co');
const AI_URL = __ENV.AI_FUNCTION_URL || `${FUNCTIONS_BASE}/ai-assistant`;
const TEST_EMAIL = __ENV.TEST_USER_EMAIL || '';
const TEST_PASSWORD = __ENV.TEST_USER_PASSWORD || '';
const SCHOOL_A = __ENV.TEST_SCHOOL_ID_A || '';
const SCHOOL_B = __ENV.TEST_SCHOOL_ID_B || '';

const REST_BASE = `${BASE}/rest/v1`;
const AUTH_BASE = `${BASE}/auth/v1`;

const COMMON_HEADERS = {
  'Content-Type': 'application/json',
  apikey: ANON_KEY,
};

// ---------------------------------------------------------------------------
// k6 options — three scenarios
// ---------------------------------------------------------------------------

export const options = {
  scenarios: {
    // 1. Realistic ramp to 10K VUs over 10 minutes (capped at 1000 by the
    //    workflow to keep staging from melting; raise via `--vus` for a
    //    true 10K test).
    realistic_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 200 },
        { duration: '2m', target: 1000 },
        { duration: '3m', target: 5000 },
        { duration: '3m', target: 10000 },
        { duration: '1m', target: 0 },
      ],
      gracefulStop: '30s',
      exec: 'realisticLoad',
    },

    // 2. Sustained 50 RPS against the AI edge function.
    ai_burst: {
      executor: 'constant-arrival-rate',
      rate: 50,
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 100,
      maxVUs: 500,
      exec: 'aiBurst',
    },

    // 3. 500 RPS login storm for 5 minutes.
    login_storm: {
      executor: 'constant-arrival-rate',
      rate: 500,
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 1000,
      maxVUs: 3000,
      exec: 'loginStorm',
    },
  },

  thresholds: {
    // CRITICAL: zero cross-tenant data leakage tolerated.
    tenant_isolation_violations: ['count==0'],

    // SLO: 99% of logins under 2s, error rate under 1%.
    login_duration: ['p(99)<2000'],
    login_error_rate: ['rate<0.01'],

    // SLO: 99% of dashboard loads under 800ms, error rate under 1%.
    dashboard_duration: ['p(99)<800'],
    dashboard_error_rate: ['rate<0.01'],

    // AI function: most unauthenticated requests will 401 — that's fine.
    // Failure = 5xx or 0 (network error).
    ai_error_rate: ['rate<0.05'],

    // Overall HTTP failure rate must stay under 5%.
    http_req_failed: ['rate<0.05'],
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assertNoCrossTenant(payload, expectedSchoolId, where) {
  // Walk the payload looking for `school_id` fields. Any value that
  // doesn't match `expectedSchoolId` is a tenant-isolation violation.
  const walk = (val) => {
    if (!val || typeof val !== 'object') return;
    if (Array.isArray(val)) {
      for (const item of val) walk(item);
      return;
    }
    for (const [k, v] of Object.entries(val)) {
      if (k === 'school_id' && typeof v === 'string' && v !== expectedSchoolId) {
        tenant_isolation_violations.add(1);
        console.error(
          `[VIOLATION] ${where}: payload contains school_id=${v}, expected=${expectedSchoolId}`,
        );
      } else {
        walk(v);
      }
    }
  };
  walk(payload);
}

function login() {
  const res = http.post(
    `${AUTH_BASE}/token?grant_type=password`,
    JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    { headers: COMMON_HEADERS, tags: { name: 'login' } },
  );
  login_duration.add(res.timings.duration);
  const ok = res.status === 200 && res.json('access_token');
  login_error_rate.add(!ok);
  if (!ok) return null;
  return res.json('access_token');
}

function fetchDashboard(token) {
  const res = http.get(`${REST_BASE}/schools?id=eq.${SCHOOL_A}&select=id,name,plan_tier`, {
    headers: { ...COMMON_HEADERS, Authorization: `Bearer ${token}` },
    tags: { name: 'dashboard' },
  });
  dashboard_duration.add(res.timings.duration);
  dashboard_error_rate.add(res.status !== 200);
  if (res.status === 200) {
    try {
      assertNoCrossTenant(res.json(), SCHOOL_A, 'dashboard:schools');
    } catch (e) {
      // Non-JSON response — counts as a dashboard error, not a violation.
    }
  }
}

// ---------------------------------------------------------------------------
// Scenario 1: realistic_load
// ---------------------------------------------------------------------------

export function realisticLoad() {
  // 1. Login once per VU iteration.
  const token = login();
  if (!token) {
    sleep(1);
    return;
  }

  group('dashboard', () => {
    fetchDashboard(token);
  });

  group('cross_tenant_probe', () => {
    // Attempt to fetch School B's rows using School A's token.
    // RLS should return an empty array — never School B's data.
    const res = http.get(`${REST_BASE}/schools?id=eq.${SCHOOL_B}&select=*`, {
      headers: { ...COMMON_HEADERS, Authorization: `Bearer ${token}` },
      tags: { name: 'cross_tenant_probe' },
    });
    if (res.status === 200) {
      try {
        const body = res.json();
        if (Array.isArray(body) && body.length > 0) {
          // Got data for School B with School A's token — hard violation.
          tenant_isolation_violations.add(1);
          console.error(
            `[VIOLATION] cross_tenant_probe: returned ${body.length} rows for foreign school ${SCHOOL_B}`,
          );
        }
      } catch (e) {
        // Non-JSON — not a violation.
      }
    }
  });

  sleep(Math.random() * 2 + 1); // 1-3s think time
}

// ---------------------------------------------------------------------------
// Scenario 2: ai_burst
// ---------------------------------------------------------------------------

export function aiBurst() {
  // No auth token — should get 401. Any 5xx or 000 = error.
  const res = http.post(
    AI_URL,
    JSON.stringify({
      feature: 'chat',
      messages: [{ role: 'user', content: 'load test' }],
      school_id: SCHOOL_A,
    }),
    { headers: COMMON_HEADERS, tags: { name: 'ai_assistant' } },
  );
  ai_duration.add(res.timings.duration);
  const healthy = res.status === 401 || res.status === 400 || res.status === 429;
  ai_error_rate.add(!healthy);

  // 200 with content but no auth would be a serious breach.
  if (res.status === 200) {
    tenant_isolation_violations.add(1);
    console.error('[VIOLATION] ai_assistant returned 200 without auth');
  }
}

// ---------------------------------------------------------------------------
// Scenario 3: login_storm
// ---------------------------------------------------------------------------

export function loginStorm() {
  const res = http.post(
    `${AUTH_BASE}/token?grant_type=password`,
    JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    { headers: COMMON_HEADERS, tags: { name: 'login_storm' } },
  );
  login_duration.add(res.timings.duration);
  login_error_rate.add(res.status !== 200);
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

export function setup() {
  // Validate required configuration before burning VUs.
  const missing = [];
  if (!BASE) missing.push('SUPABASE_URL');
  if (!ANON_KEY) missing.push('SUPABASE_ANON_KEY');
  if (!TEST_EMAIL) missing.push('TEST_USER_EMAIL');
  if (!TEST_PASSWORD) missing.push('TEST_USER_PASSWORD');
  if (!SCHOOL_A) missing.push('TEST_SCHOOL_ID_A');
  if (!SCHOOL_B) missing.push('TEST_SCHOOL_ID_B');
  if (missing.length > 0) {
    fail(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        `See loadtest/edumanage-loadtest.js header for the full list.`,
    );
  }
  return { baseUrl: BASE };
}

export function handleSummary(data) {
  // Emit a JSON summary alongside the standard console output.
  return {
    'loadtest-results/summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data),
  };
}

// Minimal text summary helper (avoids pulling in k6's contrib bundle).
function textSummary(data) {
  const lines = [];
  lines.push('=== EduManage k6 Load Test Summary ===');
  if (data.metrics.tenant_isolation_violations) {
    const v = data.metrics.tenant_isolation_violations.values.count;
    lines.push(`Tenant isolation violations: ${v}  ${v === 0 ? '✅ PASS' : '❌ FAIL'}`);
  }
  if (data.metrics.login_duration) {
    const d = data.metrics.login_duration.values;
    lines.push(`Login p(95): ${Math.round(d['p(95)'])}ms  p(99): ${Math.round(d['p(99)'])}ms`);
  }
  if (data.metrics.dashboard_duration) {
    const d = data.metrics.dashboard_duration.values;
    lines.push(`Dashboard p(95): ${Math.round(d['p(95)'])}ms  p(99): ${Math.round(d['p(99)'])}ms`);
  }
  if (data.metrics.ai_duration) {
    const d = data.metrics.ai_duration.values;
    lines.push(`AI p(95): ${Math.round(d['p(95)'])}ms  p(99): ${Math.round(d['p(99)'])}ms`);
  }
  return lines.join('\n') + '\n';
}
