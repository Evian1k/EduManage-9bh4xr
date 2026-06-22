// EduManage stripe-checkout edge function
//
// Creates a Stripe Checkout session for upgrading / subscribing a school.
//
// Flow:
//   1. Authenticate the Bearer JWT and load the user_profile.
//   2. Verify the caller is an active member of the requested school
//      AND holds an admin role (school_owner, principal, administrator,
//      ict_manager, bursar).
//   3. Resolve the plan tier (starter | professional | enterprise) and
//      pick the matching Stripe price ID from env vars:
//        STRIPE_PRICE_STARTER, STRIPE_PRICE_PROFESSIONAL, STRIPE_PRICE_ENTERPRISE
//      plus STRIPE_PRICE_STARTER_YEARLY etc. when billing_interval=yearly.
//   4. Look up an existing Stripe customer for the school (stored on
//      `subscriptions.provider_customer_id`); create one if missing.
//   5. Create the Stripe Checkout session and return its URL.
//
// Env vars:
//   STRIPE_SECRET_KEY                       (required)
//   STRIPE_PRICE_STARTER                    (required for starter monthly)
//   STRIPE_PRICE_PROFESSIONAL               (required for professional monthly)
//   STRIPE_PRICE_ENTERPRISE                 (required for enterprise monthly)
//   STRIPE_PRICE_STARTER_YEARLY             (optional)
//   STRIPE_PRICE_PROFESSIONAL_YEARLY        (optional)
//   STRIPE_PRICE_ENTERPRISE_YEARLY          (optional)
//   APP_BASE_URL                            (required — checkout success/cancel redirect)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import {
  authenticate,
  errorResponse,
  getSupabaseAdmin,
  isAdminRole,
  jsonResponse,
  verifyTenant,
} from '../_shared/middleware.ts';

const STRIPE_API_BASE = 'https://api.stripe.com/v1';

const ADMIN_ROLES = new Set([
  'school_owner',
  'principal',
  'administrator',
  'ict_manager',
  'bursar',
]);

interface CheckoutBody {
  school_id?: string;
  plan_tier?: 'starter' | 'professional' | 'enterprise';
  billing_interval?: 'monthly' | 'yearly';
  success_url?: string;
  cancel_url?: string;
}

function priceIdForPlan(
  plan: string,
  interval: 'monthly' | 'yearly',
): string | null {
  const key =
    interval === 'yearly'
      ? `STRIPE_PRICE_${plan.toUpperCase()}_YEARLY`
      : `STRIPE_PRICE_${plan.toUpperCase()}`;
  return Deno.env.get(key) ?? null;
}

function stripeAuthHeader(): string {
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) throw new Error('STRIPE_SECRET_KEY env var is not set');
  return `Bearer ${key}`;
}

async function stripeRequest(
  path: string,
  params: Record<string, string>,
  method: 'POST' | 'GET' = 'POST',
): Promise<any> {
  const body = new URLSearchParams(params).toString();
  const res = await fetch(`${STRIPE_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: stripeAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: method === 'POST' ? body : undefined,
  });
  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Stripe ${res.status}: ${text}`);
  }
  if (!res.ok) {
    const msg = json?.error?.message ?? text;
    throw new Error(`Stripe ${res.status}: ${msg}`);
  }
  return json;
}

async function findOrCreateCustomer(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  school: { id: string; name: string; email: string | null },
  ownerEmail: string,
  ownerName: string | null,
): Promise<string> {
  // Look up existing customer on subscriptions row
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('provider_customer_id')
    .eq('school_id', school.id)
    .not('provider_customer_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (sub?.provider_customer_id) return sub.provider_customer_id;

  // Otherwise create a new Stripe customer. Stripe expects metadata values
  // as flat strings, so we expand the metadata object into the bracketed
  // form expected by the form-encoded body.
  const created = await stripeRequest('/customers', {
    email: ownerEmail,
    name: `${school.name} (${ownerName ?? ownerEmail})`,
    description: `EduManage school ${school.id}`,
    'metadata[school_id]': school.id,
    'metadata[school_name]': school.name,
    'metadata[platform]': 'edumanage',
  });
  return created.id as string;
}

async function upsertSubscriptionRow(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  payload: {
    school_id: string;
    plan_tier: 'starter' | 'professional' | 'enterprise';
    provider_customer_id: string;
  },
): Promise<void> {
  // Insert a placeholder row; webhook will fill in the subscription_id,
  // current_period_end, status, and amount.
  const { error } = await supabase.from('subscriptions').upsert(
    {
      school_id: payload.school_id,
      plan_tier: payload.plan_tier,
      status: 'trialing',
      payment_provider: 'stripe',
      provider_customer_id: payload.provider_customer_id,
      current_period_start: new Date().toISOString(),
      metadata: { checkout_initiated_at: new Date().toISOString() },
    },
    { onConflict: 'school_id,plan_tier' },
  );
  if (error) {
    console.error('stripe-checkout: subscription upsert failed:', error.message);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed. Use POST.', 405);
  }

  const supabase = getSupabaseAdmin();

  // 1. Authenticate
  const auth = await authenticate(req, supabase);
  if (auth.error || !auth.profile) {
    return errorResponse(auth.error ?? 'Unauthorized', auth.status ?? 401);
  }

  // 2. Parse body
  let body: CheckoutBody;
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }
  const {
    school_id,
    plan_tier,
    billing_interval,
    success_url,
    cancel_url,
  } = body ?? {};

  if (!school_id) return errorResponse('school_id is required', 400);
  if (!plan_tier || !['starter', 'professional', 'enterprise'].includes(plan_tier)) {
    return errorResponse('plan_tier must be starter, professional, or enterprise', 400);
  }
  const interval: 'monthly' | 'yearly' =
    billing_interval === 'yearly' ? 'yearly' : 'monthly';

  // 3. Verify tenant
  const tenant = await verifyTenant(supabase, auth.profile.id, school_id);
  if (!tenant.ok) {
    return errorResponse(tenant.error ?? 'Tenant verification failed', tenant.status ?? 403);
  }
  if (!ADMIN_ROLES.has(tenant.schoolUser?.role ?? '')) {
    return errorResponse(
      'Forbidden. Only school administrators can initiate checkout.',
      403,
    );
  }

  // 4. Resolve the price ID
  const priceId = priceIdForPlan(plan_tier, interval);
  if (!priceId) {
    return errorResponse(
      `No Stripe price configured for plan "${plan_tier}" (${interval}).`,
      500,
    );
  }

  // 5. Resolve redirect URLs
  const appBase = Deno.env.get('APP_BASE_URL');
  if (!appBase) {
    return errorResponse('APP_BASE_URL env var is not set', 500);
  }
  const base = appBase.replace(/\/$/, '');
  const finalSuccessUrl =
    success_url && success_url.startsWith('http')
      ? success_url
      : `${base}/billing/success?session_id={CHECKOUT_SESSION_ID}`;
  const finalCancelUrl =
    cancel_url && cancel_url.startsWith('http')
      ? cancel_url
      : `${base}/billing/cancel`;

  // 6. Load the school
  const { data: school, error: schoolErr } = await supabase
    .from('schools')
    .select('id, name, email')
    .eq('id', school_id)
    .maybeSingle();
  if (schoolErr || !school) {
    return errorResponse('School not found', 404);
  }

  // 7. Find or create Stripe customer
  let customerId: string;
  try {
    customerId = await findOrCreateCustomer(
      supabase,
      school,
      auth.profile.email,
      auth.profile.full_name,
    );
  } catch (err) {
    console.error('stripe-checkout: customer create failed:', err);
    return errorResponse(
      err instanceof Error ? err.message : 'Failed to create Stripe customer',
      502,
    );
  }

  // 8. Create the Checkout session
  let session: any;
  try {
    session = await stripeRequest('/checkout/sessions', {
      mode: 'subscription',
      customer: customerId,
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      success_url: finalSuccessUrl,
      cancel_url: finalCancelUrl,
      client_reference_id: school_id,
      'metadata[school_id]': school_id,
      'metadata[plan_tier]': plan_tier,
      'metadata[billing_interval]': interval,
      'metadata[initiated_by]': auth.profile.id,
      'subscription_data[metadata][school_id]': school_id,
      'subscription_data[metadata][plan_tier]': plan_tier,
      allow_promotion_codes: 'true',
    });
  } catch (err) {
    console.error('stripe-checkout: session create failed:', err);
    return errorResponse(
      err instanceof Error ? err.message : 'Failed to create checkout session',
      502,
    );
  }

  // 9. Upsert a placeholder subscription row
  await upsertSubscriptionRow(supabase, {
    school_id,
    plan_tier: plan_tier as 'starter' | 'professional' | 'enterprise',
    provider_customer_id: customerId,
  });

  // 10. Audit log
  await supabase.from('audit_logs').insert({
    school_id,
    user_id: auth.profile.id,
    action: 'stripe_checkout_created',
    resource_type: 'subscription',
    resource_id: session.id,
    severity: 'info',
    details: {
      plan_tier,
      billing_interval: interval,
      customer_id: customerId,
      price_id: priceId,
    },
  });

  return jsonResponse({
    ok: true,
    url: session.url,
    session_id: session.id,
    customer_id: customerId,
    plan_tier,
    billing_interval: interval,
  });
});
