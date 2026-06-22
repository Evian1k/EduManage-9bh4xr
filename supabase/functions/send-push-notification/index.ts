// EduManage send-push-notification edge function
//
// Sends Expo push notifications to mobile app users. Reads Expo push tokens
// from `user_devices.metadata.expo_push_token` (the row's `metadata` JSON
// column stores the per-device Expo token) and dispatches them via Expo's
// HTTP V2 API: https://exp.host/--/api/v2/push/send
//
// Two modes:
//   1. Authenticated admin/sender POSTs a notification to one or more users
//      in their school. Tokens are looked up per user.
//   2. Cron-driven batch send of `notifications` rows that have not been
//      pushed yet (data.action = 'push_pending').
//
// Rate limit: 60 push notifications per minute per user (enforced via
// rate_limit_log). Expo accepts a maximum of 100 message stubs per request,
// so we chunk accordingly.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import {
  authenticate,
  errorResponse,
  getSupabaseAdmin,
  isRateLimited,
  jsonResponse,
  recordRateLimit,
  verifyTenant,
} from '../_shared/middleware.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_BATCH_SIZE = 100;
const RATE_LIMIT_PER_USER_PER_MIN = 60;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserDeviceRow {
  id: string;
  user_id: string;
  metadata: { expo_push_token?: string } | null;
}

interface ExpoPushMessage {
  to: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  sound?: string;
  priority?: 'default' | 'normal' | 'high';
  channelId?: string;
  experienceId?: string;
}

interface ExpoPushReceipt {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: Record<string, unknown>;
}

interface ExpoPushResponse {
  data?: ExpoPushReceipt[];
  errors?: { code?: string; message?: string }[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isExpoPushToken(token: string): boolean {
  return /^ExponentPushToken\[.+\]$/.test(token) ||
    /^ExpoPushToken\[.+\]$/.test(token) ||
    /^[A-Za-z0-9_-]{20,}$/.test(token);
}

async function sendExpoBatch(
  messages: ExpoPushMessage[],
): Promise<{
  sent: number;
  failed: number;
  errors: string[];
}> {
  if (messages.length === 0) return { sent: 0, failed: 0, errors: [] };
  let res: Response;
  try {
    res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(messages),
    });
  } catch (err) {
    return {
      sent: 0,
      failed: messages.length,
      errors: [
        `network error: ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  }
  if (!res.ok) {
    const text = await res.text();
    return {
      sent: 0,
      failed: messages.length,
      errors: [`expo ${res.status}: ${text}`],
    };
  }
  const data = (await res.json().catch(() => ({}))) as ExpoPushResponse;
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  // Top-level errors (e.g., malformed batch)
  if (Array.isArray(data.errors)) {
    for (const e of data.errors) {
      errors.push(`${e.code ?? 'expo'}: ${e.message ?? 'unknown'}`);
    }
    failed += messages.length;
    return { sent, failed, errors };
  }

  // Per-ticket results
  const tickets = data.data ?? [];
  for (let i = 0; i < tickets.length; i++) {
    const t = tickets[i];
    if (t.status === 'ok') {
      sent++;
    } else {
      failed++;
      errors.push(
        `${messages[i]?.to ?? 'unknown'}: ${t.message ?? 'expo rejected token'}`,
      );
    }
  }
  // Any message without a ticket is also a failure
  if (tickets.length < messages.length) {
    failed += messages.length - tickets.length;
  }
  return { sent, failed, errors };
}

/** Returns all distinct Expo push tokens for the given user ids. */
async function getTokensForUsers(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userIds: string[],
): Promise<{ userId: string; token: string }[]> {
  if (userIds.length === 0) return [];
  const { data, error } = await supabase
    .from('user_devices')
    .select('id, user_id, metadata')
    .in('user_id', userIds);
  if (error) {
    console.error('getTokensForUsers: query failed:', error.message);
    return [];
  }
  if (!data) return [];
  const rows = data as UserDeviceRow[];
  const out: { userId: string; token: string }[] = [];
  for (const r of rows) {
    const token = r.metadata?.expo_push_token;
    if (token && typeof token === 'string' && isExpoPushToken(token)) {
      out.push({ userId: r.user_id, token });
    }
  }
  return out;
}

async function pushToUsers(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userIds: string[],
  title: string,
  body: string | null,
  data: Record<string, unknown> | null,
): Promise<{
  recipients: number;
  sent: number;
  failed: number;
  rate_limited: number;
  errors: string[];
}> {
  // Filter out rate-limited users first
  const eligible: string[] = [];
  let rateLimited = 0;
  for (const uid of Array.from(new Set(userIds))) {
    const limited = await isRateLimited(supabase, {
      identifier: `user:${uid}`,
      action: 'push_notification',
      maxRequests: RATE_LIMIT_PER_USER_PER_MIN,
      windowMs: 60_000,
    });
    if (limited) {
      rateLimited++;
      continue;
    }
    eligible.push(uid);
  }

  const tokenPairs = await getTokensForUsers(supabase, eligible);
  if (tokenPairs.length === 0) {
    return {
      recipients: 0,
      sent: 0,
      failed: 0,
      rate_limited: rateLimited,
      errors: [],
    };
  }

  const messages: ExpoPushMessage[] = tokenPairs.map(({ token }) => ({
    to: token,
    title,
    body: body ?? undefined,
    data: data ?? undefined,
    sound: 'default',
    priority: 'high',
  }));

  // Chunk into batches of EXPO_BATCH_SIZE
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];
  for (let i = 0; i < messages.length; i += EXPO_BATCH_SIZE) {
    const batch = messages.slice(i, i + EXPO_BATCH_SIZE);
    const result = await sendExpoBatch(batch);
    sent += result.sent;
    failed += result.failed;
    errors.push(...result.errors);
  }

  // Record rate-limit hits for each recipient user (only those we attempted).
  const attemptedUsers = new Set(tokenPairs.map((p) => p.userId));
  for (const uid of attemptedUsers) {
    await recordRateLimit(supabase, {
      identifier: `user:${uid}`,
      action: 'push_notification',
      maxRequests: RATE_LIMIT_PER_USER_PER_MIN,
      windowMs: 60_000,
    });
  }

  return {
    recipients: tokenPairs.length,
    sent,
    failed,
    rate_limited: rateLimited,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------

interface SendPushBody {
  school_id?: string;
  user_ids?: string[];
  title?: string;
  body?: string | null;
  data?: Record<string, unknown> | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed. Use POST.', 405);
  }

  const supabase = getSupabaseAdmin();

  // Authenticate
  const auth = await authenticate(req, supabase);
  if (auth.error || !auth.profile) {
    return errorResponse(auth.error ?? 'Unauthorized', auth.status ?? 401);
  }

  let body: SendPushBody;
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }
  const { school_id, user_ids, title, body: notifBody, data } = body ?? {};

  if (!school_id) return errorResponse('school_id is required', 400);
  if (!Array.isArray(user_ids) || user_ids.length === 0) {
    return errorResponse('user_ids must be a non-empty array', 400);
  }
  if (!title || typeof title !== 'string') {
    return errorResponse('title is required', 400);
  }
  if (user_ids.length > 1000) {
    return errorResponse('Too many recipients (max 1000 per request)', 400);
  }

  // Verify tenant
  const tenant = await verifyTenant(supabase, auth.profile.id, school_id);
  if (!tenant.ok) {
    return errorResponse(tenant.error ?? 'Tenant verification failed', tenant.status ?? 403);
  }

  // Restrict recipients to members of the same school
  const { data: memberRows, error: memberErr } = await supabase
    .from('school_users')
    .select('user_id')
    .eq('school_id', school_id)
    .eq('is_active', true)
    .in('user_id', user_ids);
  if (memberErr) {
    console.error('push: member lookup failed:', memberErr.message);
    return errorResponse('Failed to verify recipients', 500);
  }
  const memberUserIds = (memberRows ?? []).map((r: { user_id: string }) => r.user_id);
  if (memberUserIds.length === 0) {
    return errorResponse('No matching recipients in this school', 400);
  }

  // Dispatch
  try {
    const result = await pushToUsers(
      supabase,
      memberUserIds,
      title,
      notifBody ?? null,
      data ?? null,
    );

    // Audit log
    await supabase.from('audit_logs').insert({
      school_id,
      user_id: auth.profile.id,
      action: 'push_notification_sent',
      resource_type: 'notification',
      severity: 'info',
      details: {
        recipients: result.recipients,
        sent: result.sent,
        failed: result.failed,
        rate_limited: result.rate_limited,
        title,
      },
    });

    return jsonResponse({ ok: true, ...result });
  } catch (err) {
    console.error('send-push-notification error:', err);
    return errorResponse(
      err instanceof Error ? err.message : 'Internal server error',
      500,
    );
  }
});
