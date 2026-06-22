// EduManage mpesa-callback edge function
//
// Receives Safaricom's STK push callback and finalises the matching payment.
// On success it:
//   - Updates the `payments` row (matched by checkout_request_id) to
//     status='completed' and stores the M-Pesa receipt number.
//   - Generates a `receipts` row (PDF URL left null — generated elsewhere).
//   - Updates the linked `invoices` row's `amount_paid` and recomputes the
//     balance (which is a generated column in the schema, so updating
//     `amount_paid` is enough).
//   - Writes an `audit_logs` entry.
// On failure it:
//   - Marks the payment row as 'failed' with the error description.
//   - Writes an `audit_logs` entry at severity 'warning'.
//
// Safaricom POSTs raw JSON (no auth header) to this endpoint. We do not
// require Bearer authentication here; instead the endpoint URL is intended
// to be private (registered as the CallBackURL on Daraja). Optionally, the
// platform operator may set the MPESA_CALLBACK_KEY env var and configure
// Daraja to send it as a custom header — if set, we enforce it.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import {
  errorResponse,
  getSupabaseAdmin,
  jsonResponse,
} from '../_shared/middleware.ts';

// ---------------------------------------------------------------------------
// Callback payload types
// ---------------------------------------------------------------------------

interface CallbackItem {
  Name?: string;
  Value?: number | string;
}

interface CallbackMetadata {
  Item?: CallbackItem[];
}

interface StkCallback {
  MerchantRequestID?: string;
  CheckoutRequestID?: string;
  ResultCode?: number;
  ResultDesc?: string;
  Amount?: number;
  MpesaReceiptNumber?: string;
  Balance?: string;
  TransactionDate?: number;
  PhoneNumber?: string;
  CallbackMetadata?: CallbackMetadata;
}

interface CallbackBody {
  Body?: { stkCallback?: StkCallback };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readMetadataItem(meta: CallbackMetadata | undefined, name: string): string | null {
  if (!meta?.Item) return null;
  const item = meta.Item.find((i) => i.Name === name);
  if (!item || item.Value === undefined || item.Value === null) return null;
  return String(item.Value);
}

function formatTransactionDate(raw: number | undefined): string | null {
  if (!raw) return null;
  // Safaricom sends a 14-digit YYYYMMDDHHmmss timestamp.
  const s = String(raw);
  if (s.length !== 14) return null;
  const iso = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}Z`;
  return iso;
}

async function insertAudit(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  schoolId: string | null,
  action: string,
  details: Record<string, unknown>,
  severity: 'info' | 'warning' | 'critical' = 'info',
): Promise<void> {
  const { error } = await supabase.from('audit_logs').insert({
    school_id: schoolId,
    action,
    resource_type: 'payment',
    severity,
    details,
  });
  if (error) {
    console.error('mpesa-callback: audit insert failed:', error.message);
  }
}

function generateReceiptNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.floor(Math.random() * 1_000_000)
    .toString(36)
    .toUpperCase()
    .padStart(4, '0');
  return `RCPT-${ts}-${rnd}`;
}

// ---------------------------------------------------------------------------
// Success handling
// ---------------------------------------------------------------------------

async function handleSuccess(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  paymentRow: { id: string; school_id: string; invoice_id: string | null; student_id: string; amount: number; metadata: Record<string, unknown> | null },
  callback: StkCallback,
): Promise<void> {
  const receiptNumber =
    callback.MpesaReceiptNumber ??
    readMetadataItem(callback.CallbackMetadata, 'MpesaReceiptNumber') ??
    null;
  const amountPaid =
    callback.Amount ??
    Number(readMetadataItem(callback.CallbackMetadata, 'Amount') ?? paymentRow.amount);
  const phone =
    callback.PhoneNumber ??
    readMetadataItem(callback.CallbackMetadata, 'PhoneNumber') ??
    null;
  const transactionDate =
    formatTransactionDate(callback.TransactionDate) ??
    readMetadataItem(callback.CallbackMetadata, 'TransactionDate')
      ? formatTransactionDate(Number(readMetadataItem(callback.CallbackMetadata, 'TransactionDate')))
      : new Date().toISOString();

  // 1. Mark payment completed
  const { error: payErr } = await supabase
    .from('payments')
    .update({
      status: 'completed',
      paid_at: transactionDate,
      remarks: `M-Pesa STK — receipt ${receiptNumber ?? 'N/A'}`,
      metadata: {
        ...(paymentRow.metadata ?? {}),
        mpesa_receipt_number: receiptNumber,
        phone,
        transaction_date: transactionDate,
        result_desc: callback.ResultDesc,
      },
    })
    .eq('id', paymentRow.id);
  if (payErr) {
    console.error('mpesa-callback: payment update failed:', payErr.message);
  }

  // 2. Generate receipt
  const { error: receiptErr } = await supabase.from('receipts').insert({
    school_id: paymentRow.school_id,
    receipt_number: generateReceiptNumber(),
    payment_id: paymentRow.id,
    student_id: paymentRow.student_id,
    amount: amountPaid,
    pdf_url: null,
    issued_at: new Date().toISOString(),
    issued_by: null,
    metadata: {
      mpesa_receipt_number: receiptNumber,
      phone,
      transaction_date: transactionDate,
    },
  });
  if (receiptErr) {
    console.error('mpesa-callback: receipt insert failed:', receiptErr.message);
  }

  // 3. Update invoice balance if linked
  if (paymentRow.invoice_id) {
    const { data: invoice } = await supabase
      .from('invoices')
      .select('id, amount_due, amount_paid, balance, status')
      .eq('id', paymentRow.invoice_id)
      .maybeSingle();
    if (invoice) {
      const newAmountPaid = Number(invoice.amount_paid ?? 0) + Number(amountPaid);
      const newBalance = Number(invoice.amount_due ?? 0) - newAmountPaid;
      const newStatus =
        newBalance <= 0.01 ? 'paid' : newAmountPaid > 0 ? 'partial' : invoice.status;
      const { error: invErr } = await supabase
        .from('invoices')
        .update({
          amount_paid: newAmountPaid,
          status: newStatus,
        })
        .eq('id', invoice.id);
      if (invErr) {
        console.error('mpesa-callback: invoice update failed:', invErr.message);
      }
    }
  }

  // 4. Audit log
  await insertAudit(supabase, paymentRow.school_id, 'mpesa_stk_success', {
    payment_id: paymentRow.id,
    invoice_id: paymentRow.invoice_id,
    amount: amountPaid,
    mpesa_receipt_number: receiptNumber,
    phone,
  });
}

async function handleFailure(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  paymentRow: { id: string; school_id: string; invoice_id: string | null; metadata: Record<string, unknown> | null } | null,
  callback: StkCallback,
  checkoutRequestId: string,
): Promise<void> {
  if (paymentRow) {
    const { error } = await supabase
      .from('payments')
      .update({
        status: 'failed',
        remarks: callback.ResultDesc ?? 'M-Pesa STK failed',
        metadata: {
          ...(paymentRow.metadata ?? {}),
          result_code: callback.ResultCode,
          result_desc: callback.ResultDesc,
        },
      })
      .eq('id', paymentRow.id);
    if (error) {
      console.error('mpesa-callback: payment failure update failed:', error.message);
    }
  }
  await insertAudit(
    supabase,
    paymentRow?.school_id ?? null,
    'mpesa_stk_failed',
    {
      payment_id: paymentRow?.id ?? null,
      invoice_id: paymentRow?.invoice_id ?? null,
      checkout_request_id: checkoutRequestId,
      result_code: callback.ResultCode,
      result_desc: callback.ResultDesc,
    },
    'warning',
  );
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

function enforceOptionalCallbackKey(req: Request): boolean {
  const expected = Deno.env.get('MPESA_CALLBACK_KEY');
  if (!expected) return true; // not configured — open
  const provided = req.headers.get('x-callback-key') ?? req.headers.get('x-cron-key');
  return provided === expected;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed. Safaricom posts callbacks as POST.', 405);
  }
  if (!enforceOptionalCallbackKey(req)) {
    return errorResponse('Unauthorized callback source', 401);
  }

  let body: CallbackBody;
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  const callback = body?.Body?.stkCallback;
  if (!callback || !callback.CheckoutRequestID) {
    console.error('mpesa-callback: malformed callback payload', JSON.stringify(body));
    return errorResponse('Malformed callback payload', 400);
  }

  const supabase = getSupabaseAdmin();
  const checkoutRequestId = callback.CheckoutRequestID;
  const resultCode = callback.ResultCode ?? 1;
  const isSuccess = resultCode === 0;

  // Find the matching payment row
  const { data: payment, error: payErr } = await supabase
    .from('payments')
    .select('id, school_id, invoice_id, student_id, amount, metadata')
    .eq('payment_provider_ref', checkoutRequestId)
    .maybeSingle();
  if (payErr) {
    console.error('mpesa-callback: payment lookup failed:', payErr.message);
  }

  if (!payment) {
    console.error(
      'mpesa-callback: no payment row for checkout_request_id',
      checkoutRequestId,
    );
    await insertAudit(
      supabase,
      null,
      'mpesa_stk_orphan_callback',
      {
        checkout_request_id: checkoutRequestId,
        merchant_request_id: callback.MerchantRequestID,
        result_code: resultCode,
        result_desc: callback.ResultDesc,
      },
      'warning',
    );
    return jsonResponse({ ok: true, matched: false, reason: 'no_payment_row' });
  }

  try {
    if (isSuccess) {
      await handleSuccess(
        supabase,
        payment as {
          id: string;
          school_id: string;
          invoice_id: string | null;
          student_id: string;
          amount: number;
          metadata: Record<string, unknown> | null;
        },
        callback,
      );
    } else {
      await handleFailure(
        supabase,
        payment as {
          id: string;
          school_id: string;
          invoice_id: string | null;
          metadata: Record<string, unknown> | null;
        } | null,
        callback,
        checkoutRequestId,
      );
    }
  } catch (err) {
    console.error('mpesa-callback: handler error:', err);
    return errorResponse(
      err instanceof Error ? err.message : 'Callback handler failed',
      500,
    );
  }

  return jsonResponse({
    ok: true,
    matched: true,
    payment_id: payment.id,
    success: isSuccess,
  });
});
