// EduManage — Flutterwave payment edge function
// Initiates a Flutterwave payment for school fees or marketplace orders.
// Supports: Nigeria, Ghana, Kenya, Uganda, Tanzania, South Africa
//
// POST /functions/v1/flutterwave-charge
// {
//   "school_id": "uuid",
//   "amount": 5000,
//   "currency": "KES",
//   "email": "parent@email.com",
//   "phone": "254712345678",
//   "name": "John Doe",
//   "description": "School fees Term 1 2025"
// }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { authenticate, verifyTenant, jsonResponse, errorResponse, getSupabaseAdmin } from '../_shared/middleware.ts';

const FLW_BASE = 'https://api.flutterwave.com/v3';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseAdmin = getSupabaseAdmin();
  const auth = await authenticate(req, supabaseAdmin);
  if (auth.error) return errorResponse(auth.error, auth.status);

  const secret = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
  if (!secret) return errorResponse('Flutterwave not configured', 503);

  let body: any;
  try { body = await req.json(); } catch { return errorResponse('Invalid JSON', 400); }
  const { school_id, amount, currency, email, phone, name, description, invoice_id } = body;

  if (!school_id || !amount || !email) return errorResponse('Missing required fields', 400);
  if (amount < 100) return errorResponse('Amount must be at least 100', 400);

  const tenant = await verifyTenant(supabaseAdmin, auth.profile.id, school_id);
  if (!tenant.ok) return errorResponse(tenant.error!, tenant.status);

  // Create Flutterwave payment
  const txRef = `EDU-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const res = await fetch(`${FLW_BASE}/payments`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tx_ref: txRef,
      amount: Math.floor(amount),
      currency: currency || 'KES',
      customer: { email, phonenumber: phone || '', name: name || '' },
      customizations: { title: 'EduManage', description: description || 'School payment' },
      meta: { school_id, invoice_id: invoice_id || '', user_id: auth.profile.id },
    }),
  });
  const data = await res.json();
  if (!res.ok || data.status !== 'success') return errorResponse(data.message || 'Flutterwave payment failed', 500);

  // Log pending payment
  await supabaseAdmin.from('payments').insert({
    school_id, payment_number: `FLW-PENDING-${txRef}`,
    student_id: body.student_id, invoice_id: invoice_id,
    amount: Math.floor(amount), payment_method: 'flutterwave',
    payment_provider_ref: txRef, paid_by: auth.profile.id,
    status: 'pending', remarks: description,
  });

  return jsonResponse({ payment_url: data.data.link, tx_ref: txRef });
});
