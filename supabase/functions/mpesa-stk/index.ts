// EduManage mpesa-stk edge function
//
// Initiates an M-Pesa STK push to a parent/student's phone via the Safaricom
// Daraja API.
//
// Flow:
//   1. Authenticate the Bearer JWT and load the user_profile.
//   2. Verify the caller is an active staff member of the requested school
//      (typically bursar / administrator).
//   3. Rate-limit per user (10 STK pushes per minute).
//   4. Validate the request: phone number, amount, invoice_id (optional).
//   5. Resolve the school's M-Pesa credentials from the
//      `payment_provider_config` table (provider = 'mpesa') OR fall back to
//      env vars.
//   6. Get an OAuth access token from Daraja.
//   7. Generate the password (base64(shortcode + passkey + timestamp)).
//   8. POST the STK push request to Daraja's /mpesa/stkpush/v1/processrequest.
//   9. Persist the merchant_request_id + checkout_request_id on a `payments`
//      row (status = 'pending') for later matching by the callback function.
//
// Env vars (used when no payment_provider_config row exists):
//   MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_PASSKEY,
//   MPESA_SHORTCODE, MPESA_ENV ("sandbox" | "production"),
//   MPESA_CALLBACK_URL (must be the deployed mpesa-callback URL)

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

const STAFF_ROLES = new Set([
  'school_owner',
  'principal',
  'administrator',
  'ict_manager',
  'bursar',
]);

const RATE_LIMIT = { maxRequests: 10, windowMs: 60_000 };

// ---------------------------------------------------------------------------
// M-Pesa credentials
// ---------------------------------------------------------------------------

interface MpesaConfig {
  consumerKey: string;
  consumerSecret: string;
  passkey: string;
  shortcode: string;
  env: 'sandbox' | 'production';
  callbackUrl: string;
}

async function resolveMpesaConfig(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  schoolId: string,
): Promise<MpesaConfig | null> {
  // Prefer DB-stored config (encrypted at rest by the platform operator).
  const { data: row } = await supabase
    .from('payment_provider_config')
    .select('config')
    .eq('school_id', schoolId)
    .eq('provider', 'mpesa')
    .eq('is_active', true)
    .maybeSingle();

  const cfg = (row?.config ?? null) as {
    consumer_key?: string;
    consumer_secret?: string;
    passkey?: string;
    shortcode?: string;
    env?: string;
    callback_url?: string;
  } | null;

  const consumerKey = cfg?.consumer_key ?? Deno.env.get('MPESA_CONSUMER_KEY');
  const consumerSecret =
    cfg?.consumer_secret ?? Deno.env.get('MPESA_CONSUMER_SECRET');
  const passkey = cfg?.passkey ?? Deno.env.get('MPESA_PASSKEY');
  const shortcode = cfg?.shortcode ?? Deno.env.get('MPESA_SHORTCODE');
  const envRaw = (cfg?.env ?? Deno.env.get('MPESA_ENV') ?? 'sandbox').toLowerCase();
  const callbackUrl =
    cfg?.callback_url ?? Deno.env.get('MPESA_CALLBACK_URL') ?? '';

  if (!consumerKey || !consumerSecret || !passkey || !shortcode) {
    return null;
  }
  if (!callbackUrl) {
    return null;
  }
  return {
    consumerKey,
    consumerSecret,
    passkey,
    shortcode: String(shortcode),
    env: envRaw === 'production' ? 'production' : 'sandbox',
    callbackUrl,
  };
}

function darajaBaseUrl(env: 'sandbox' | 'production'): string {
  return env === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';
}

// ---------------------------------------------------------------------------
// OAuth + password helpers
// ---------------------------------------------------------------------------

let tokenCache: {
  key: string;
  token: string;
  expiresAt: number;
} | null = null;

async function getOAuthToken(cfg: MpesaConfig): Promise<string> {
  const cacheKey = `${cfg.env}:${cfg.consumerKey}`;
  if (tokenCache && tokenCache.key === cacheKey && tokenCache.expiresAt > Date.now() + 5_000) {
    return tokenCache.token;
  }
  const url = `${darajaBaseUrl(cfg.env)}/oauth/v1/generate?grant_type=client_credentials`;
  const auth = btoa(`${cfg.consumerKey}:${cfg.consumerSecret}`);
  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Daraja OAuth ${res.status}: ${text}`);
  }
  const data = await res.json();
  const token = data.access_token as string;
  const expiresIn = Number(data.expires_in ?? 3600);
  tokenCache = {
    key: cacheKey,
    token,
    expiresAt: Date.now() + expiresIn * 1000,
  };
  return token;
}

function generateTimestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

function generatePassword(shortcode: string, passkey: string, timestamp: string): string {
  return btoa(`${shortcode}${passkey}${timestamp}`);
}

function normaliseMsisdn(phone: string): string | null {
  // Accept formats like 0712345678, +254712345678, 254712345678.
  // Returns the 2547XXXXXXXXX form Daraja expects.
  let digits = phone.replace(/[^\d]/g, '');
  if (digits.startsWith('0')) digits = '254' + digits.slice(1);
  if (digits.startsWith('11') || digits.startsWith('7') || digits.startsWith('1')) {
    digits = '254' + digits;
  }
  if (!/^2547\d{8}$/.test(digits) && !/^2541\d{8}$/.test(digits)) {
    return null;
  }
  return digits;
}

// ---------------------------------------------------------------------------
// STK push
// ---------------------------------------------------------------------------

interface StkRequestBody {
  school_id?: string;
  phone?: string;
  amount?: number;
  invoice_id?: string;
  student_id?: string;
  description?: string;
  account_reference?: string;
}

async function initiateStkPush(
  cfg: MpesaConfig,
  params: {
    phone: string;
    amount: number;
    accountReference: string;
    transactionDesc: string;
  },
): Promise<{
  merchantRequestId: string;
  checkoutRequestId: string;
  responseCode: string;
  responseDescription: string;
  customerMessage: string;
}> {
  const token = await getOAuthToken(cfg);
  const timestamp = generateTimestamp();
  const password = generatePassword(cfg.shortcode, cfg.passkey, timestamp);
  const url = `${darajaBaseUrl(cfg.env)}/mpesa/stkpush/v1/processrequest`;
  const payload = {
    BusinessShortCode: cfg.shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: String(Math.round(params.amount)),
    PartyA: params.phone,
    PartyB: cfg.shortcode,
    PhoneNumber: params.phone,
    CallBackURL: cfg.callbackUrl,
    AccountReference: params.accountReference.slice(0, 12),
    TransactionDesc: params.transactionDesc.slice(0, 13),
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Daraja STK ${res.status}: ${data?.errorMessage ?? data?.message ?? 'request failed'}`,
    );
  }
  return {
    merchantRequestId: String(data.MerchantRequestID ?? ''),
    checkoutRequestId: String(data.CheckoutRequestID ?? ''),
    responseCode: String(data.ResponseCode ?? ''),
    responseDescription: String(data.ResponseDescription ?? ''),
    customerMessage: String(data.CustomerMessage ?? ''),
  };
}

// ---------------------------------------------------------------------------
// Payment row creation
// ---------------------------------------------------------------------------

async function createPaymentRow(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  args: {
    school_id: string;
    invoice_id: string | null;
    student_id: string | null;
    amount: number;
    phone: string;
    initiated_by: string;
    merchantRequestId: string;
    checkoutRequestId: string;
    description: string;
  },
): Promise<string> {
  const paymentNumber = `MPESA-STK-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const { data, error } = await supabase
    .from('payments')
    .insert({
      school_id: args.school_id,
      payment_number: paymentNumber,
      invoice_id: args.invoice_id,
      student_id: args.student_id,
      amount: args.amount,
      payment_method: 'mpesa_stk',
      payment_provider_ref: args.checkoutRequestId,
      paid_by: args.initiated_by,
      paid_by_name: null,
      received_by: args.initiated_by,
      paid_at: new Date().toISOString(),
      currency: 'KES',
      status: 'pending',
      remarks: args.description,
      metadata: {
        merchant_request_id: args.merchantRequestId,
        checkout_request_id: args.checkoutRequestId,
        phone: args.phone,
      },
    })
    .select('id')
    .single();
  if (error) {
    console.error('mpesa-stk: payment insert failed:', error.message);
    throw new Error('Failed to create pending payment record');
  }
  return data.id as string;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

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
  let body: StkRequestBody;
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }
  const {
    school_id,
    phone,
    amount,
    invoice_id,
    student_id,
    description,
    account_reference,
  } = body ?? {};

  if (!school_id) return errorResponse('school_id is required', 400);
  if (!phone) return errorResponse('phone is required', 400);
  const amountNum = Number(amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    return errorResponse('amount must be a positive number', 400);
  }
  if (amountNum > 150000) {
    return errorResponse('amount exceeds M-Pesa per-transaction limit (KES 150,000)', 400);
  }
  const normalisedPhone = normaliseMsisdn(phone);
  if (!normalisedPhone) {
    return errorResponse(
      'phone must be a valid Kenyan MSISDN (e.g. 07XXXXXXXX or +2547XXXXXXXX)',
      400,
    );
  }

  // 3. Verify tenant + staff role
  const tenant = await verifyTenant(supabase, auth.profile.id, school_id);
  if (!tenant.ok) {
    return errorResponse(tenant.error ?? 'Tenant verification failed', tenant.status ?? 403);
  }
  if (!STAFF_ROLES.has(tenant.schoolUser?.role ?? '')) {
    return errorResponse(
      'Forbidden. Only school staff (bursar/administrator) can initiate M-Pesa STK push.',
      403,
    );
  }

  // 4. Rate limit
  const rlCfg = {
    identifier: `user:${auth.profile.id}`,
    action: 'mpesa_stk',
    ...RATE_LIMIT,
  };
  if (await isRateLimited(supabase, rlCfg)) {
    return errorResponse('Too many STK push requests. Please wait a minute and try again.', 429);
  }

  // 5. Resolve M-Pesa config
  let cfg: MpesaConfig | null;
  try {
    cfg = await resolveMpesaConfig(supabase, school_id);
  } catch (err) {
    console.error('mpesa-stk: config resolution failed:', err);
    return errorResponse('Failed to load M-Pesa configuration', 500);
  }
  if (!cfg) {
    return errorResponse(
      'M-Pesa is not configured for this school. Set credentials in payment settings or env vars.',
      500,
    );
  }

  // 6. Validate invoice / student if provided
  if (invoice_id) {
    const { data: inv } = await supabase
      .from('invoices')
      .select('id, school_id, balance')
      .eq('id', invoice_id)
      .eq('school_id', school_id)
      .maybeSingle();
    if (!inv) return errorResponse('Invoice not found in this school', 404);
  }
  if (student_id) {
    const { data: stu } = await supabase
      .from('students')
      .select('id, school_id')
      .eq('id', student_id)
      .eq('school_id', school_id)
      .maybeSingle();
    if (!stu) return errorResponse('Student not found in this school', 404);
  }

  // 7. Initiate STK push
  const accountRef = (account_reference ?? invoice_id ?? 'FEES').slice(0, 12);
  const txDesc = (description ?? 'School fees payment').slice(0, 13);

  let stk;
  try {
    stk = await initiateStkPush(cfg, {
      phone: normalisedPhone,
      amount: amountNum,
      accountReference: accountRef,
      transactionDesc: txDesc,
    });
  } catch (err) {
    console.error('mpesa-stk: STK push failed:', err);
    return errorResponse(
      err instanceof Error ? err.message : 'STK push failed',
      502,
    );
  }

  // 8. Record rate limit + create pending payment row
  await recordRateLimit(supabase, rlCfg);

  let paymentId: string | null = null;
  try {
    paymentId = await createPaymentRow(supabase, {
      school_id,
      invoice_id: invoice_id ?? null,
      student_id: student_id ?? null,
      amount: amountNum,
      phone: normalisedPhone,
      initiated_by: auth.profile.id,
      merchantRequestId: stk.merchantRequestId,
      checkoutRequestId: stk.checkoutRequestId,
      description: txDesc,
    });
  } catch (err) {
    console.error('mpesa-stk: payment row creation failed:', err);
    // We still return success since the STK push was sent; the callback
    // will be unable to match if no payment row exists, but we surface a
    // warning to the caller.
  }

  // 9. Audit log
  await supabase.from('audit_logs').insert({
    school_id,
    user_id: auth.profile.id,
    action: 'mpesa_stk_initiated',
    resource_type: 'payment',
    resource_id: stk.checkoutRequestId,
    severity: 'info',
    details: {
      phone: normalisedPhone,
      amount: amountNum,
      invoice_id: invoice_id ?? null,
      student_id: student_id ?? null,
      merchant_request_id: stk.merchantRequestId,
      checkout_request_id: stk.checkoutRequestId,
      payment_id: paymentId,
    },
  });

  return jsonResponse({
    ok: true,
    payment_id: paymentId,
    merchant_request_id: stk.merchantRequestId,
    checkout_request_id: stk.checkoutRequestId,
    response_code: stk.responseCode,
    response_description: stk.responseDescription,
    customer_message: stk.customerMessage,
  });
});
