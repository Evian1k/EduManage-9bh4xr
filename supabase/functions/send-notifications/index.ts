// EduManage send-notifications edge function
//
// Queue drainer for outbound SMS and email. Picks up rows from
// `sms_logs` and `email_logs` with status = 'queued', sends them via the
// configured provider, and updates the row's status + provider_ref.
//
// SMS providers (selected by SMS_PROVIDER env var):
//   - africas_talking  (username + AT_API_KEY)
//   - twilio           (TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_FROM)
//
// Email providers (selected by EMAIL_PROVIDER env var):
//   - sendgrid  (SENDGRID_API_KEY + SENDGRID_FROM_EMAIL)
//   - mailgun   (MAILGUN_API_KEY + MAILGUN_DOMAIN + MAILGUN_FROM_EMAIL)
//
// Authentication:
//   - x-cron-key header matching CRON_API_KEY, OR
//   - Authorization: Bearer <CRON_API_KEY>
//
// This function is intended to be invoked by a Supabase pg_cron schedule
// every minute (see storage_and_extras.sql migration).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import {
  errorResponse,
  getSupabaseAdmin,
  jsonResponse,
} from '../_shared/middleware.ts';

// ---------------------------------------------------------------------------
// Auth (cron-key OR bearer with the same shared secret)
// ---------------------------------------------------------------------------

function authenticateCron(req: Request): boolean {
  const expected = Deno.env.get('CRON_API_KEY');
  if (!expected) return false; // fail closed when no key configured
  const cronKey = req.headers.get('x-cron-key');
  if (cronKey && cronKey === expected) return true;
  const authHeader = req.headers.get('Authorization') ?? '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token === expected) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BATCH_SIZE = 50; // rows per drain cycle per channel
const SEND_TIMEOUT_MS = 15_000;

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = SEND_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

function normalisePhone(phone: string): string {
  // Strip everything but digits and a leading +.
  const trimmed = phone.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/[^\d]/g, '');
  if (!digits) return '';
  return (hasPlus ? '+' : '') + digits;
}

// ---------------------------------------------------------------------------
// SMS providers
// ---------------------------------------------------------------------------

interface SmsSendResult {
  ok: boolean;
  providerRef: string | null;
  error?: string;
}

async function sendSmsAfricasTalking(
  to: string,
  message: string,
): Promise<SmsSendResult> {
  const apiKey =
    Deno.env.get('AT_API_KEY') ??
    Deno.env.get('AFRICAS_TALKING_API_KEY');
  const username =
    Deno.env.get('AT_USERNAME') ??
    Deno.env.get('AFRICAS_TALKING_USERNAME') ??
    'sandbox';
  const sender = Deno.env.get('AT_SENDER_ID') ?? '';
  const baseUrl =
    Deno.env.get('AT_BASE_URL') ?? 'https://api.africastalking.com/version1';
  const isSandbox = username === 'sandbox';
  const url = isSandbox
    ? 'https://api.sandbox.africastalking.com/version1/messaging'
    : `${baseUrl}/messaging`;
  if (!apiKey) return { ok: false, providerRef: null, error: 'AT_API_KEY not set' };

  const form = new URLSearchParams();
  form.set('username', username);
  form.set('to', to);
  form.set('message', message);
  if (sender) form.set('from', sender);

  try {
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        apiKey,
        Accept: 'application/json',
      },
      body: form.toString(),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, providerRef: null, error: `AT ${res.status}: ${text}` };
    }
    const data = await res.json();
    const msg = data?.SMSMessageData?.SMSMessageData;
    if (msg && typeof msg === 'string' && /Sent to|Success/i.test(msg)) {
      const recipients = data?.SMSMessageData?.Recipients;
      const ref =
        Array.isArray(recipients) && recipients[0]?.messageId
          ? String(recipients[0].messageId)
          : null;
      return { ok: true, providerRef: ref };
    }
    return {
      ok: false,
      providerRef: null,
      error: `AT: ${msg ?? 'unknown response'}`,
    };
  } catch (err) {
    return {
      ok: false,
      providerRef: null,
      error: err instanceof Error ? err.message : 'AT fetch failed',
    };
  }
}

async function sendSmsTwilio(
  to: string,
  message: string,
): Promise<SmsSendResult> {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const token = Deno.env.get('TWILIO_AUTH_TOKEN');
  const from = Deno.env.get('TWILIO_FROM');
  if (!sid || !token || !from) {
    return { ok: false, providerRef: null, error: 'TWILIO_* env vars not set' };
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const auth = btoa(`${sid}:${token}`);
  const form = new URLSearchParams();
  form.set('To', to);
  form.set('From', from);
  form.set('Body', message);

  try {
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${auth}`,
      },
      body: form.toString(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        providerRef: null,
        error: `Twilio ${res.status}: ${data?.message ?? 'request failed'}`,
      };
    }
    return { ok: true, providerRef: data.sid ?? null };
  } catch (err) {
    return {
      ok: false,
      providerRef: null,
      error: err instanceof Error ? err.message : 'Twilio fetch failed',
    };
  }
}

async function sendSms(to: string, message: string): Promise<SmsSendResult> {
  const provider = (Deno.env.get('SMS_PROVIDER') ?? '').toLowerCase();
  if (provider === 'twilio') return sendSmsTwilio(to, message);
  if (provider === 'africas_talking' || provider === '') {
    return sendSmsAfricasTalking(to, message);
  }
  return {
    ok: false,
    providerRef: null,
    error: `Unknown SMS_PROVIDER "${provider}"`,
  };
}

// ---------------------------------------------------------------------------
// Email providers
// ---------------------------------------------------------------------------

interface EmailSendResult {
  ok: boolean;
  providerRef: string | null;
  error?: string;
}

async function sendEmailSendGrid(
  to: string,
  subject: string,
  body: string,
  recipientName: string | null,
): Promise<EmailSendResult> {
  const apiKey = Deno.env.get('SENDGRID_API_KEY');
  const fromEmail = Deno.env.get('SENDGRID_FROM_EMAIL');
  if (!apiKey || !fromEmail) {
    return { ok: false, providerRef: null, error: 'SENDGRID_* env vars not set' };
  }
  const payload = {
    personalizations: [
      { to: [{ email: to, name: recipientName ?? undefined }], subject },
    ],
    from: {
      email: fromEmail,
      name: Deno.env.get('SENDGRID_FROM_NAME') ?? 'EduManage',
    },
    content: [{ type: 'text/plain', value: body }],
  };
  try {
    const res = await fetchWithTimeout('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, providerRef: null, error: `SendGrid ${res.status}: ${text}` };
    }
    return { ok: true, providerRef: res.headers.get('x-message-id') };
  } catch (err) {
    return {
      ok: false,
      providerRef: null,
      error: err instanceof Error ? err.message : 'SendGrid fetch failed',
    };
  }
}

async function sendEmailMailgun(
  to: string,
  subject: string,
  body: string,
  recipientName: string | null,
): Promise<EmailSendResult> {
  const apiKey = Deno.env.get('MAILGUN_API_KEY');
  const domain = Deno.env.get('MAILGUN_DOMAIN');
  const fromEmail =
    Deno.env.get('MAILGUN_FROM_EMAIL') ??
    (domain ? `EduManage <postmaster@${domain}>` : null);
  if (!apiKey || !domain || !fromEmail) {
    return { ok: false, providerRef: null, error: 'MAILGUN_* env vars not set' };
  }
  const region = (Deno.env.get('MAILGUN_REGION') ?? 'us').toLowerCase();
  const base =
    region === 'eu' ? 'https://api.eu.mailgun.net' : 'https://api.mailgun.net';
  const url = `${base}/v3/${domain}/messages`;
  const form = new URLSearchParams();
  form.set('from', fromEmail);
  form.set('to', recipientName ? `${recipientName} <${to}>` : to);
  form.set('subject', subject);
  form.set('text', body);

  try {
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${btoa(`api:${apiKey}`)}`,
      },
      body: form.toString(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        providerRef: null,
        error: `Mailgun ${res.status}: ${data?.message ?? 'request failed'}`,
      };
    }
    return { ok: true, providerRef: data.id ?? null };
  } catch (err) {
    return {
      ok: false,
      providerRef: null,
      error: err instanceof Error ? err.message : 'Mailgun fetch failed',
    };
  }
}

async function sendEmail(
  to: string,
  subject: string,
  body: string,
  recipientName: string | null,
): Promise<EmailSendResult> {
  const provider = (Deno.env.get('EMAIL_PROVIDER') ?? '').toLowerCase();
  if (provider === 'mailgun') {
    return sendEmailMailgun(to, subject, body, recipientName);
  }
  if (provider === 'sendgrid' || provider === '') {
    return sendEmailSendGrid(to, subject, body, recipientName);
  }
  return {
    ok: false,
    providerRef: null,
    error: `Unknown EMAIL_PROVIDER "${provider}"`,
  };
}

// ---------------------------------------------------------------------------
// Queue drain
// ---------------------------------------------------------------------------

interface SmsLogRow {
  id: string;
  school_id: string;
  recipient_phone: string;
  recipient_name: string | null;
  message: string;
  provider: string | null;
}

interface EmailLogRow {
  id: string;
  school_id: string;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  body: string | null;
  provider: string | null;
}

async function drainSms(
  supabase: ReturnType<typeof getSupabaseAdmin>,
): Promise<{ picked: number; sent: number; failed: number }> {
  const { data, error } = await supabase
    .from('sms_logs')
    .select(
      'id, school_id, recipient_phone, recipient_name, message, provider',
    )
    .eq('status', 'queued')
    .order('sent_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    console.error('drainSms: select failed:', error.message);
    return { picked: 0, sent: 0, failed: 0 };
  }
  if (!data || data.length === 0) return { picked: 0, sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;
  const rows = data as SmsLogRow[];

  for (const row of rows) {
    const to = normalisePhone(row.recipient_phone);
    if (!to) {
      await supabase
        .from('sms_logs')
        .update({ status: 'failed', metadata: { error: 'invalid_phone' } })
        .eq('id', row.id);
      failed++;
      continue;
    }
    const result = await sendSms(to, row.message);
    if (result.ok) {
      const provider =
        row.provider ?? Deno.env.get('SMS_PROVIDER') ?? 'africas_talking';
      await supabase
        .from('sms_logs')
        .update({
          status: 'sent',
          provider,
          provider_ref: result.providerRef,
          sent_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      sent++;
    } else {
      await supabase
        .from('sms_logs')
        .update({
          status: 'failed',
          metadata: { error: result.error ?? 'unknown' },
        })
        .eq('id', row.id);
      failed++;
    }
  }
  return { picked: rows.length, sent, failed };
}

async function drainEmail(
  supabase: ReturnType<typeof getSupabaseAdmin>,
): Promise<{ picked: number; sent: number; failed: number }> {
  const { data, error } = await supabase
    .from('email_logs')
    .select(
      'id, school_id, recipient_email, recipient_name, subject, body, provider',
    )
    .eq('status', 'queued')
    .order('sent_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    console.error('drainEmail: select failed:', error.message);
    return { picked: 0, sent: 0, failed: 0 };
  }
  if (!data || data.length === 0) return { picked: 0, sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;
  const rows = data as EmailLogRow[];

  for (const row of rows) {
    if (
      !row.recipient_email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.recipient_email)
    ) {
      await supabase
        .from('email_logs')
        .update({ status: 'failed', metadata: { error: 'invalid_email' } })
        .eq('id', row.id);
      failed++;
      continue;
    }
    const result = await sendEmail(
      row.recipient_email,
      row.subject,
      row.body ?? '',
      row.recipient_name,
    );
    if (result.ok) {
      const provider =
        row.provider ?? Deno.env.get('EMAIL_PROVIDER') ?? 'sendgrid';
      await supabase
        .from('email_logs')
        .update({
          status: 'sent',
          provider,
          provider_ref: result.providerRef,
          sent_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      sent++;
    } else {
      await supabase
        .from('email_logs')
        .update({
          status: 'failed',
          metadata: { error: result.error ?? 'unknown' },
        })
        .eq('id', row.id);
      failed++;
    }
  }
  return { picked: rows.length, sent, failed };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!authenticateCron(req)) {
    return errorResponse(
      'Unauthorized. Provide a valid x-cron-key or Bearer token.',
      401,
    );
  }

  try {
    const supabase = getSupabaseAdmin();
    const [sms, email] = await Promise.all([
      drainSms(supabase),
      drainEmail(supabase),
    ]);
    return jsonResponse({ ok: true, sms, email, ts: new Date().toISOString() });
  } catch (err) {
    console.error('send-notifications error:', err);
    return errorResponse(
      err instanceof Error ? err.message : 'Internal server error',
      500,
    );
  }
});
