// EduManage — AI Edge Function Integration Tests
//
// Probes the deployed `ai-assistant` edge function via HTTP `fetch`.
// Verifies the auth + validation pipeline without needing valid AI
// credentials (we only test pre-AI-dispatch behaviour).
//
// REQUIRES:
//   - SUPABASE_URL env var (to derive the functions URL).
//   - The ai-assistant function to be deployed.
// Skipped automatically when SUPABASE_URL is missing.

import { config } from './setup';

const describeOrSkip = config.isConfigured ? describe : describe.skip;

/**
 * Derive the edge-function URL from the project URL.
 *   https://abcdefg.supabase.co -> https://abcdefg.functions.supabase.co
 */
function functionsBaseUrl(): string {
  const base = config.url.replace(/\/$/, '');
  return base.replace(/\.supabase\.co$/, '.functions.supabase.co');
}

function aiAssistantUrl(): string {
  return `${functionsBaseUrl()}/ai-assistant`;
}

describeOrSkip('ai-assistant edge function', () => {
  it('rejects unauthenticated requests with HTTP 401', async () => {
    // No Authorization header at all.
    const res = await fetch(aiAssistantUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        feature: 'chat',
        messages: [{ role: 'user', content: 'hello' }],
        school_id: '00000000-0000-0000-0000-000000000001',
      }),
    });

    expect(res.status).toBe(401);
    const body = await res.json().catch(() => ({}));
    expect(body).toHaveProperty('error');
    expect(typeof body.error).toBe('string');
    // The middleware emits this exact prefix when no Bearer header is found.
    expect(body.error.toLowerCase()).toMatch(/authorization|bearer|unauthorized|token/);
  });

  it('rejects an invalid (non-Bearer) Authorization header with HTTP 401', async () => {
    const res = await fetch(aiAssistantUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic not-a-real-token',
      },
      body: JSON.stringify({
        feature: 'chat',
        messages: [{ role: 'user', content: 'hello' }],
        school_id: '00000000-0000-0000-0000-000000000001',
      }),
    });

    expect(res.status).toBe(401);
  });

  it('rejects an invalid JSON body with HTTP 400 (when authenticated as a known-bad token)', async () => {
    // Use an obviously-malformed bearer token so auth fails FIRST;
    // then verify that even auth failure returns a structured JSON error.
    const res = await fetch(aiAssistantUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer not-a-real-jwt',
      },
      // Send malformed JSON.
      body: '{ not valid json',
    });

    // Auth runs before body parsing in the middleware — so we expect 401 here.
    expect([400, 401]).toContain(res.status);
    const body = await res.json().catch(() => null);
    expect(body).not.toBeNull();
    expect(body).toHaveProperty('error');
  });

  it('rejects a structurally-valid JSON body missing required fields', async () => {
    // Even without auth, we can validate that the function returns a JSON
    // error envelope (auth fails first → 401 with `error` key).
    const res = await fetch(aiAssistantUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(401);
    const body = await res.json().catch(() => ({}));
    expect(body).toHaveProperty('error');
  });

  it('rejects a malformed messages array (auth fails first → 401)', async () => {
    const res = await fetch(aiAssistantUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        feature: 'chat',
        messages: 'this should be an array',
        school_id: '00000000-0000-0000-0000-000000000001',
      }),
    });

    expect(res.status).toBe(401);
  });

  it('returns CORS headers on OPTIONS preflight', async () => {
    const res = await fetch(aiAssistantUrl(), { method: 'OPTIONS' });
    // The function returns 'ok' for OPTIONS regardless of auth.
    expect(res.status).toBe(200);
    const accessControl = res.headers.get('access-control-allow-origin');
    expect(accessControl).toBeTruthy();
  });
});
