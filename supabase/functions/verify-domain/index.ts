// EduManage verify-domain edge function
//
// Polls the `custom_domains` table for rows with status = 'pending' and
// verifies the DNS TXT record using Google's DNS-over-HTTPS API:
//   GET https://dns.google/resolve?name=<host>&type=TXT
//
// The TXT record we look for has the form:
//   edumanage-domain-verify=<verification_token>
// at the host `_edumanage-verify.<domain>` (or just `<domain>` for the apex).
//
// On success: status -> 'verified', verified_at set, ssl_status -> 'ssl_pending'.
// On failure: status -> 'failed' (after the lookup has been attempted).
//
// Authentication: x-cron-key OR Authorization: Bearer <CRON_API_KEY>.
// A school admin may also POST { domain_id } to verify a single domain.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import {
  authenticate,
  errorResponse,
  getSupabaseAdmin,
  jsonResponse,
  verifyTenant,
} from '../_shared/middleware.ts';

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function authenticateCron(req: Request): boolean {
  const expected = Deno.env.get('CRON_API_KEY');
  if (!expected) return false;
  const cronKey = req.headers.get('x-cron-key');
  if (cronKey && cronKey === expected) return true;
  const authHeader = req.headers.get('Authorization') ?? '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim() === expected;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Google DNS-over-HTTPS
// ---------------------------------------------------------------------------

interface GoogleDnsResponse {
  Status?: number;
  Answer?: { name: string; type: number; data: string }[];
}

const TXT_TYPE = 16;

async function lookupTxtRecords(host: string): Promise<string[]> {
  const url = `https://dns.google/resolve?name=${encodeURIComponent(host)}&type=TXT`;
  const res = await fetch(url, {
    headers: { Accept: 'application/dns-json' },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google DNS ${res.status}: ${text}`);
  }
  const data = (await res.json()) as GoogleDnsResponse;
  return (data.Answer ?? [])
    .filter((a) => a.type === TXT_TYPE)
    .map((a) => a.data.replace(/^"|"$/g, '').replace(/"\s+"/g, ''));
}

// ---------------------------------------------------------------------------
// Verification logic
// ---------------------------------------------------------------------------

interface DomainRow {
  id: string;
  school_id: string;
  domain: string;
  verification_token: string | null;
  verification_method: string | null;
  status: string;
}

interface VerifyOutcome {
  id: string;
  domain: string;
  status: 'verified' | 'failed';
  reason: string;
}

async function verifyOne(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  row: DomainRow,
): Promise<VerifyOutcome> {
  const token = row.verification_token?.trim();
  if (!token) {
    await supabase
      .from('custom_domains')
      .update({
        status: 'failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);
    return {
      id: row.id,
      domain: row.domain,
      status: 'failed',
      reason: 'no verification_token set',
    };
  }

  // Look for the TXT record on both the apex domain and the conventional
  // _edumanage-verify.<domain> subdomain.
  const expectedValue = `edumanage-domain-verify=${token}`;
  const candidateHosts = [
    `_edumanage-verify.${row.domain}`,
    row.domain,
  ];

  let matched = false;
  let lastError: string | null = null;
  for (const host of candidateHosts) {
    try {
      const records = await lookupTxtRecords(host);
      if (records.some((r) => r.trim() === expectedValue)) {
        matched = true;
        break;
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  if (matched) {
    await supabase
      .from('custom_domains')
      .update({
        status: 'verified',
        verified_at: new Date().toISOString(),
        ssl_status: 'ssl_pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);
    // Audit log
    await supabase.from('audit_logs').insert({
      school_id: row.school_id,
      action: 'domain_verified',
      resource_type: 'custom_domain',
      resource_id: row.id,
      severity: 'info',
      details: { domain: row.domain },
    });
    return {
      id: row.id,
      domain: row.domain,
      status: 'verified',
      reason: 'TXT record matched',
    };
  }

  await supabase
    .from('custom_domains')
    .update({
      status: 'failed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id);
  return {
    id: row.id,
    domain: row.domain,
    status: 'failed',
    reason: lastError ?? 'TXT record not found',
  };
}

async function drainPending(
  supabase: ReturnType<typeof getSupabaseAdmin>,
): Promise<VerifyOutcome[]> {
  const { data, error } = await supabase
    .from('custom_domains')
    .select(
      'id, school_id, domain, verification_token, verification_method, status',
    )
    .eq('status', 'pending')
    .limit(50);
  if (error) {
    console.error('verify-domain: select failed:', error.message);
    return [];
  }
  if (!data || data.length === 0) return [];

  const rows = data as DomainRow[];
  const outcomes: VerifyOutcome[] = [];
  for (const row of rows) {
    try {
      outcomes.push(await verifyOne(supabase, row));
    } catch (err) {
      console.error(`verify-domain: row ${row.id} failed:`, err);
      outcomes.push({
        id: row.id,
        domain: row.domain,
        status: 'failed',
        reason: err instanceof Error ? err.message : 'unknown',
      });
    }
  }
  return outcomes;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = getSupabaseAdmin();

  // Path A: cron-driven full drain
  if (authenticateCron(req)) {
    try {
      const outcomes = await drainPending(supabase);
      return jsonResponse({
        ok: true,
        checked: outcomes.length,
        verified: outcomes.filter((o) => o.status === 'verified').length,
        failed: outcomes.filter((o) => o.status === 'failed').length,
        outcomes,
        ts: new Date().toISOString(),
      });
    } catch (err) {
      console.error('verify-domain cron error:', err);
      return errorResponse(
        err instanceof Error ? err.message : 'Internal server error',
        500,
      );
    }
  }

  // Path B: authenticated single-domain verify
  const auth = await authenticate(req, supabase);
  if (auth.error || !auth.profile) {
    return errorResponse(auth.error ?? 'Unauthorized', auth.status ?? 401);
  }

  let body: { domain_id?: string; school_id?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }
  const { domain_id, school_id } = body ?? {};
  if (!domain_id || !school_id) {
    return errorResponse('domain_id and school_id are required', 400);
  }

  const tenant = await verifyTenant(supabase, auth.profile.id, school_id);
  if (!tenant.ok) {
    return errorResponse(tenant.error ?? 'Tenant verification failed', tenant.status ?? 403);
  }

  const { data: domainRow, error: domainErr } = await supabase
    .from('custom_domains')
    .select(
      'id, school_id, domain, verification_token, verification_method, status',
    )
    .eq('id', domain_id)
    .eq('school_id', school_id)
    .maybeSingle();
  if (domainErr) {
    console.error('verify-domain: lookup failed:', domainErr.message);
    return errorResponse('Domain lookup failed', 500);
  }
  if (!domainRow) {
    return errorResponse('Domain not found in this school', 404);
  }

  try {
    const outcome = await verifyOne(supabase, domainRow as DomainRow);
    return jsonResponse({ ok: true, outcome });
  } catch (err) {
    console.error('verify-domain single error:', err);
    return errorResponse(
      err instanceof Error ? err.message : 'Verification failed',
      500,
    );
  }
});
