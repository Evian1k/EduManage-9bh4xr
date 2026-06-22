// EduManage — PayPal checkout edge function
// Creates a PayPal order for international payments.
//
// POST /functions/v1/paypal-checkout
// {
//   "school_id": "uuid",
//   "amount": 99.00,
//   "currency": "USD",
//   "description": "Professional plan subscription",
//   "return_url": "https://app.edumanage.com/billing/success",
//   "cancel_url": "https://app.edumanage.com/billing/cancel"
// }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { authenticate, verifyTenant, jsonResponse, errorResponse, getSupabaseAdmin } from '../_shared/middleware.ts';

const PAYPAL_BASE = Deno.env.get('PAYPAL_ENVIRONMENT') === 'production' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

async function getPayPalAccessToken(): Promise<string | null> {
  const clientId = Deno.env.get('PAYPAL_CLIENT_ID');
  const clientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET');
  if (!clientId || !clientSecret) return null;
  const auth = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.access_token;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseAdmin = getSupabaseAdmin();
  const auth = await authenticate(req, supabaseAdmin);
  if (auth.error) return errorResponse(auth.error, auth.status);

  const accessToken = await getPayPalAccessToken();
  if (!accessToken) return errorResponse('PayPal not configured', 503);

  let body: any;
  try { body = await req.json(); } catch { return errorResponse('Invalid JSON', 400); }
  const { school_id, amount, currency, description, return_url, cancel_url } = body;

  if (!school_id || !amount || !return_url || !cancel_url) return errorResponse('Missing required fields', 400);

  const tenant = await verifyTenant(supabaseAdmin, auth.profile.id, school_id);
  if (!tenant.ok) return errorResponse(tenant.error!, tenant.status);

  // Create PayPal order
  const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        amount: { currency_code: currency || 'USD', value: amount.toFixed(2) },
        description: description || 'EduManage payment',
        custom_id: `EDU-${school_id}-${Date.now()}`,
      }],
      application_context: {
        return_url, cancel_url,
        brand_name: 'EduManage',
        user_action: 'PAY_NOW',
      },
    }),
  });
  const data = await res.json();
  if (!res.ok) return errorResponse(data.message || 'PayPal order creation failed', 500);

  // Find approval URL
  const approvalUrl = data.links?.find((l: any) => l.rel === 'approve')?.href;

  return jsonResponse({ order_id: data.id, approval_url: approvalUrl });
});
