// EduManage stripe-webhook edge function
//
// Receives Stripe webhook events, verifies the signature using the
// STRIPE_WEBHOOK_SECRET env var, and handles:
//
//   - checkout.session.completed
//   - customer.subscription.updated
//   - customer.subscription.deleted
//   - invoice.payment_failed
//
// Updates the local `subscriptions` table to mirror Stripe's state and
// writes an `audit_logs` entry per event.
//
// Configure the webhook endpoint in the Stripe Dashboard with these four
// events. The endpoint URL is:
//   https://YOUR-PROJECT.supabase.co/functions/v1/stripe-webhook
//
// Stripe posts raw JSON (no Bearer token) so this function is NOT behind
// the standard authenticate() middleware; instead it verifies the
// Stripe-Signature header.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import {
  errorResponse,
  getSupabaseAdmin,
  jsonResponse,
} from '../_shared/middleware.ts';

// ---------------------------------------------------------------------------
// Stripe signature verification
// ---------------------------------------------------------------------------

const STRIPE_API_BASE = 'https://api.stripe.com/v1';

async function importStripeKey(): Promise<CryptoKey> {
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET env var is not set');
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

async function computeSignature(
  payload: string,
  timestamp: number,
): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(`${timestamp}.${payload}`);
  const key = await importStripeKey();
  const sig = await crypto.subtle.sign('HMAC', key, data);
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function parseStripeSignature(header: string): {
  timestamp: number;
  signatures: string[];
} | null {
  const parts = header.split(',').map((s) => s.trim());
  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of parts) {
    const [k, v] = part.split('=');
    if (k === 't') {
      const n = Number(v);
      if (!Number.isNaN(n)) timestamp = n;
    } else if (k === 'v1') {
      signatures.push(v);
    }
  }
  if (timestamp === null) return null;
  return { timestamp, signatures };
}

async function verifyStripeSignature(
  req: Request,
  rawBody: string,
): Promise<{ ok: boolean; reason?: string }> {
  const sigHeader = req.headers.get('Stripe-Signature');
  if (!sigHeader) return { ok: false, reason: 'missing Stripe-Signature header' };
  const parsed = parseStripeSignature(sigHeader);
  if (!parsed) return { ok: false, reason: 'malformed Stripe-Signature header' };

  // Reject stale timestamps (older than 5 minutes)
  const skew = Math.abs(Date.now() / 1000 - parsed.timestamp);
  if (skew > 300) return { ok: false, reason: 'timestamp skew too large' };

  const expected = await computeSignature(rawBody, parsed.timestamp);
  if (!parsed.signatures.includes(expected)) {
    return { ok: false, reason: 'signature mismatch' };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Stripe API helpers (used to fetch the full event/object if needed)
// ---------------------------------------------------------------------------

function stripeAuthHeader(): string {
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) throw new Error('STRIPE_SECRET_KEY env var is not set');
  return `Bearer ${key}`;
}

async function fetchStripeObject(path: string): Promise<any> {
  const res = await fetch(`${STRIPE_API_BASE}${path}`, {
    headers: { Authorization: stripeAuthHeader() },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stripe GET ${path} ${res.status}: ${text}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Subscription sync helpers
// ---------------------------------------------------------------------------

type PlanTier = 'starter' | 'professional' | 'enterprise';
type SubStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'expired';

function mapStripeStatus(stripeStatus: string): SubStatus {
  switch (stripeStatus) {
    case 'trialing':
      return 'trialing';
    case 'active':
      return 'active';
    case 'past_due':
    case 'unpaid':
      return 'past_due';
    case 'canceled':
      return 'canceled';
    case 'incomplete':
    case 'incomplete_expired':
      return 'expired';
    default:
      return 'active';
  }
}

function inferPlanTier(metadata: Record<string, unknown> | null): PlanTier | null {
  if (!metadata) return null;
  const t = String(metadata.plan_tier ?? '').toLowerCase();
  if (t === 'starter' || t === 'professional' || t === 'enterprise') return t;
  return null;
}

async function upsertSubscription(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  schoolId: string,
  fields: {
    plan_tier: PlanTier;
    status: SubStatus;
    provider_customer_id: string | null;
    provider_subscription_id: string;
    current_period_start: string;
    current_period_end: string;
    trial_ends_at: string | null;
    canceled_at: string | null;
    amount_usd: number;
    currency: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await supabase
    .from('subscriptions')
    .upsert(
      {
        school_id: schoolId,
        plan_tier: fields.plan_tier,
        status: fields.status,
        payment_provider: 'stripe',
        provider_customer_id: fields.provider_customer_id,
        provider_subscription_id: fields.provider_subscription_id,
        current_period_start: fields.current_period_start,
        current_period_end: fields.current_period_end,
        trial_ends_at: fields.trial_ends_at,
        canceled_at: fields.canceled_at,
        amount_usd: fields.amount_usd,
        currency: fields.currency,
        metadata: fields.metadata ?? {},
      },
      { onConflict: 'school_id,provider_subscription_id' },
    );
  if (error) {
    console.error('stripe-webhook: subscription upsert failed:', error.message);
  }

  // Mirror plan_status + plan_tier on the schools row.
  const { error: schoolErr } = await supabase
    .from('schools')
    .update({
      plan_status: fields.status,
      plan_tier: fields.plan_tier,
      plan_renews_at: fields.current_period_end,
      trial_ends_at: fields.trial_ends_at,
    })
    .eq('id', schoolId);
  if (schoolErr) {
    console.error('stripe-webhook: school update failed:', schoolErr.message);
  }
}

async function insertAudit(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  schoolId: string | null,
  action: string,
  details: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.from('audit_logs').insert({
    school_id: schoolId,
    action,
    resource_type: 'subscription',
    severity: action.includes('failed') ? 'warning' : 'info',
    details,
  });
  if (error) {
    console.error('stripe-webhook: audit insert failed:', error.message);
  }
}

async function resolveSchoolFromCustomer(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  customerId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('subscriptions')
    .select('school_id')
    .eq('provider_customer_id', customerId)
    .limit(1)
    .maybeSingle();
  return data?.school_id ?? null;
}

async function resolveSchoolFromSubscription(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  subscriptionId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('subscriptions')
    .select('school_id')
    .eq('provider_subscription_id', subscriptionId)
    .limit(1)
    .maybeSingle();
  return data?.school_id ?? null;
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleCheckoutCompleted(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  object: any,
): Promise<void> {
  const schoolId =
    (object.client_reference_id as string) ||
    (object.metadata?.school_id as string) ||
    null;
  if (!schoolId) {
    console.error('stripe-webhook: checkout.session.completed missing school_id');
    return;
  }
  const subscriptionId = object.subscription as string | undefined;
  const customerId = object.customer as string | undefined;
  const planTier = inferPlanTier(object.metadata ?? null) ?? 'starter';

  if (!subscriptionId || !customerId) {
    console.error('stripe-webhook: checkout.session.completed missing subscription/customer');
    return;
  }

  // Fetch full subscription to get period + amount
  let sub: any = null;
  try {
    sub = await fetchStripeObject(`/subscriptions/${subscriptionId}`);
  } catch (err) {
    console.error('stripe-webhook: failed to fetch subscription:', err);
  }

  await upsertSubscription(supabase, schoolId, {
    plan_tier: planTier,
    status: mapStripeStatus(sub?.status ?? 'active'),
    provider_customer_id: customerId,
    provider_subscription_id: subscriptionId,
    current_period_start: sub
      ? new Date(sub.current_period_start * 1000).toISOString()
      : new Date().toISOString(),
    current_period_end: sub
      ? new Date(sub.current_period_end * 1000).toISOString()
      : new Date(Date.now() + 30 * 86400_000).toISOString(),
    trial_ends_at: sub?.trial_end
      ? new Date(sub.trial_end * 1000).toISOString()
      : null,
    canceled_at: sub?.canceled_at
      ? new Date(sub.canceled_at * 1000).toISOString()
      : null,
    amount_usd: sub
      ? Number(sub.plan?.amount ?? 0) / 100
      : Number(object.amount_total ?? 0) / 100,
    currency: (sub?.plan?.currency ?? object.currency ?? 'usd').toUpperCase(),
    metadata: {
      checkout_session_id: object.id,
      plan_tier: planTier,
      mode: object.mode,
    },
  });

  await insertAudit(supabase, schoolId, 'stripe_checkout_completed', {
    checkout_session_id: object.id,
    subscription_id: subscriptionId,
    customer_id: customerId,
    plan_tier: planTier,
    amount_total: object.amount_total,
    currency: object.currency,
  });
}

async function handleSubscriptionUpdated(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  object: any,
): Promise<void> {
  const subscriptionId = object.id;
  const customerId = object.customer;
  let schoolId =
    (await resolveSchoolFromSubscription(supabase, subscriptionId)) ??
    (await resolveSchoolFromCustomer(supabase, customerId)) ??
    (object.metadata?.school_id as string) ??
    null;

  if (!schoolId) {
    console.error('stripe-webhook: subscription.updated unable to resolve school');
    return;
  }

  const planTier = inferPlanTier(object.metadata ?? null) ?? 'starter';
  await upsertSubscription(supabase, schoolId, {
    plan_tier: planTier,
    status: mapStripeStatus(object.status),
    provider_customer_id: customerId,
    provider_subscription_id: subscriptionId,
    current_period_start: new Date(object.current_period_start * 1000).toISOString(),
    current_period_end: new Date(object.current_period_end * 1000).toISOString(),
    trial_ends_at: object.trial_end
      ? new Date(object.trial_end * 1000).toISOString()
      : null,
    canceled_at: object.canceled_at
      ? new Date(object.canceled_at * 1000).toISOString()
      : null,
    amount_usd: Number(object.plan?.amount ?? 0) / 100,
    currency: (object.plan?.currency ?? 'usd').toUpperCase(),
    metadata: {
      stripe_event: 'customer.subscription.updated',
      previous_attributes: object.previous_attributes ?? null,
    },
  });

  await insertAudit(supabase, schoolId, 'stripe_subscription_updated', {
    subscription_id: subscriptionId,
    customer_id: customerId,
    status: object.status,
    plan_tier: planTier,
  });
}

async function handleSubscriptionDeleted(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  object: any,
): Promise<void> {
  const subscriptionId = object.id;
  const schoolId =
    (await resolveSchoolFromSubscription(supabase, subscriptionId)) ??
    (object.metadata?.school_id as string) ??
    null;
  if (!schoolId) {
    console.error('stripe-webhook: subscription.deleted unable to resolve school');
    return;
  }

  const planTier = inferPlanTier(object.metadata ?? null) ?? 'starter';
  await upsertSubscription(supabase, schoolId, {
    plan_tier: planTier,
    status: 'canceled',
    provider_customer_id: object.customer,
    provider_subscription_id: subscriptionId,
    current_period_start: new Date(object.current_period_start * 1000).toISOString(),
    current_period_end: object.ended_at
      ? new Date(object.ended_at * 1000).toISOString()
      : new Date().toISOString(),
    trial_ends_at: object.trial_end
      ? new Date(object.trial_end * 1000).toISOString()
      : null,
    canceled_at: object.canceled_at
      ? new Date(object.canceled_at * 1000).toISOString()
      : new Date().toISOString(),
    amount_usd: 0,
    currency: (object.plan?.currency ?? 'usd').toUpperCase(),
    metadata: { stripe_event: 'customer.subscription.deleted' },
  });

  // Downgrade school to 'expired' so feature gates kick in.
  await supabase
    .from('schools')
    .update({ plan_status: 'canceled' })
    .eq('id', schoolId);

  await insertAudit(supabase, schoolId, 'stripe_subscription_deleted', {
    subscription_id: subscriptionId,
    customer_id: object.customer,
    plan_tier: planTier,
  });
}

async function handleInvoicePaymentFailed(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  object: any,
): Promise<void> {
  const customerId = object.customer;
  const subscriptionId = object.subscription;
  const schoolId =
    (subscriptionId
      ? await resolveSchoolFromSubscription(supabase, subscriptionId)
      : null) ??
    (await resolveSchoolFromCustomer(supabase, customerId)) ??
    null;
  if (!schoolId) {
    console.error('stripe-webhook: invoice.payment_failed unable to resolve school');
    return;
  }

  // Mark the subscription as past_due
  if (subscriptionId) {
    const { data: existing } = await supabase
      .from('subscriptions')
      .select('plan_tier, provider_customer_id, current_period_start, current_period_end, trial_ends_at, amount_usd, currency')
      .eq('provider_subscription_id', subscriptionId)
      .maybeSingle();
    if (existing) {
      await upsertSubscription(supabase, schoolId, {
        plan_tier: (existing.plan_tier as PlanTier) ?? 'starter',
        status: 'past_due',
        provider_customer_id: existing.provider_customer_id ?? customerId,
        provider_subscription_id: subscriptionId,
        current_period_start: existing.current_period_start ?? new Date().toISOString(),
        current_period_end: existing.current_period_end ?? new Date().toISOString(),
        trial_ends_at: existing.trial_ends_at,
        canceled_at: null,
        amount_usd: Number(existing.amount_usd ?? 0),
        currency: existing.currency ?? 'usd',
        metadata: {
          stripe_event: 'invoice.payment_failed',
          invoice_id: object.id,
          attempt_count: object.attempt_count,
        },
      });
    }
  }

  // Mark the school as past_due so the UI can warn the user.
  await supabase
    .from('schools')
    .update({ plan_status: 'past_due' })
    .eq('id', schoolId);

  await insertAudit(supabase, schoolId, 'stripe_invoice_payment_failed', {
    invoice_id: object.id,
    subscription_id: subscriptionId,
    customer_id: customerId,
    attempt_count: object.attempt_count,
    next_payment_attempt: object.next_payment_attempt,
  });
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed. Stripe posts webhooks as POST.', 405);
  }

  const rawBody = await req.text();

  const sig = await verifyStripeSignature(req, rawBody);
  if (!sig.ok) {
    console.error('stripe-webhook: signature verification failed:', sig.reason);
    return errorResponse(`Invalid signature: ${sig.reason}`, 400);
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  const supabase = getSupabaseAdmin();
  const type: string = event.type ?? '';
  const object = event.data?.object ?? {};

  try {
    switch (type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(supabase, object);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(supabase, object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(supabase, object);
        break;
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(supabase, object);
        break;
      default:
        // Acknowledge unhandled events so Stripe doesn't retry.
        return jsonResponse({ received: true, ignored: true, type });
    }
    return jsonResponse({ received: true, processed: true, type });
  } catch (err) {
    console.error(`stripe-webhook: handler for ${type} failed:`, err);
    // Return 500 so Stripe retries.
    return errorResponse(
      err instanceof Error ? err.message : 'Webhook handler failed',
      500,
    );
  }
});
