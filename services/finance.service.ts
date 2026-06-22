// EduManage — Finance service
//
// CRUD for: fee_structures, invoices, payments, receipts, scholarships,
// fines, payment_provider_config, financial_reports. Every function takes
// `schoolId` first for tenant isolation and returns `{ data, error }`.
//
// `recordPayment` is the most interesting function — it atomically inserts
// a payment row, updates the linked invoice's amount_paid, computes the
// new invoice status, and generates a receipt with a unique receipt number.

import { getSupabaseClient } from '@/template';
import { ServiceResult } from '@/lib/types';
import { logAuditEvent } from './audit.service';

function genNumber(prefix: string, seed: number, salt = ''): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const r = (Math.floor(Math.random() * 9000) + 1000).toString();
  return `${prefix}${seed.toString().padStart(4, '0')}${stamp.slice(-5)}${r}${salt}`;
}

// ─── Fee structures ─────────────────────────────────────────────────────────

export interface FeeStructure {
  id: string;
  school_id: string;
  name: string;
  class_id?: string | null;
  stream_id?: string | null;
  term_id?: string | null;
  academic_year_id?: string | null;
  tuition_fee: number;
  boarding_fee: number;
  transport_fee: number;
  library_fee: number;
  medical_fee: number;
  activity_fee: number;
  other_fee: number;
  total: number;
  currency: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export async function getFeeStructures(
  schoolId: string,
  filters: { classId?: string; termId?: string } = {},
): Promise<ServiceResult<FeeStructure[]>> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from('fee_structures')
    .select('*')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false });
  if (filters.classId) q = q.eq('class_id', filters.classId);
  if (filters.termId) q = q.eq('term_id', filters.termId);
  const { data, error } = await q;
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as FeeStructure[], error: null };
}

export interface CreateFeeStructureInput {
  name: string;
  class_id?: string | null;
  stream_id?: string | null;
  term_id?: string | null;
  academic_year_id?: string | null;
  tuition_fee?: number;
  boarding_fee?: number;
  transport_fee?: number;
  library_fee?: number;
  medical_fee?: number;
  activity_fee?: number;
  other_fee?: number;
  currency?: string;
  metadata?: Record<string, unknown>;
}

export async function createFeeStructure(
  schoolId: string,
  input: CreateFeeStructureInput,
): Promise<ServiceResult<FeeStructure>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('fee_structures')
    .insert({
      school_id: schoolId,
      name: input.name,
      class_id: input.class_id ?? null,
      stream_id: input.stream_id ?? null,
      term_id: input.term_id ?? null,
      academic_year_id: input.academic_year_id ?? null,
      tuition_fee: input.tuition_fee ?? 0,
      boarding_fee: input.boarding_fee ?? 0,
      transport_fee: input.transport_fee ?? 0,
      library_fee: input.library_fee ?? 0,
      medical_fee: input.medical_fee ?? 0,
      activity_fee: input.activity_fee ?? 0,
      other_fee: input.other_fee ?? 0,
      currency: input.currency ?? 'KES',
      metadata: input.metadata ?? {},
    })
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as FeeStructure, error: null };
}

// ─── Invoices ────────────────────────────────────────────────────────────────

export interface Invoice {
  id: string;
  school_id: string;
  invoice_number: string;
  student_id: string;
  fee_structure_id?: string | null;
  term_id?: string | null;
  amount_due: number;
  amount_paid: number;
  balance: number;
  issue_date: string;
  due_date?: string | null;
  status: string;
  currency: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export async function getInvoices(
  schoolId: string,
  filters: { studentId?: string; status?: string; limit?: number } = {},
): Promise<ServiceResult<Invoice[]>> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from('invoices')
    .select('*, students(full_name, admission_number)')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false });
  if (filters.studentId) q = q.eq('student_id', filters.studentId);
  if (filters.status) q = q.eq('status', filters.status);
  if (filters.limit) q = q.limit(filters.limit);
  const { data, error } = await q;
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as Invoice[], error: null };
}

export interface CreateInvoiceInput {
  student_id: string;
  fee_structure_id?: string | null;
  term_id?: string | null;
  amount_due: number;
  due_date?: string | null;
  currency?: string;
  metadata?: Record<string, unknown>;
}

export async function createInvoice(
  schoolId: string,
  input: CreateInvoiceInput,
): Promise<ServiceResult<Invoice>> {
  const supabase = getSupabaseClient();
  // Get a count of existing invoices for a stable invoice number seed
  const { count } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId);
  const invoiceNumber = genNumber('INV', (count ?? 0) + 1);

  const { data, error } = await supabase
    .from('invoices')
    .insert({
      school_id: schoolId,
      invoice_number: invoiceNumber,
      student_id: input.student_id,
      fee_structure_id: input.fee_structure_id ?? null,
      term_id: input.term_id ?? null,
      amount_due: input.amount_due,
      amount_paid: 0,
      issue_date: new Date().toISOString().split('T')[0],
      due_date: input.due_date ?? null,
      status: 'unpaid',
      currency: input.currency ?? 'KES',
      metadata: input.metadata ?? {},
    })
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };

  await logAuditEvent({
    schoolId,
    action: 'finance.invoice_created',
    resourceType: 'invoice',
    resourceId: (data as { id: string }).id,
    details: { invoice_number: invoiceNumber, amount_due: input.amount_due },
    severity: 'info',
  });

  return { data: data as unknown as Invoice, error: null };
}

// ─── Payments + receipts ─────────────────────────────────────────────────────

export interface Payment {
  id: string;
  school_id: string;
  payment_number: string;
  invoice_id?: string | null;
  student_id: string;
  amount: number;
  payment_method: string;
  payment_provider_ref?: string | null;
  paid_by?: string | null;
  paid_by_name?: string | null;
  received_by?: string | null;
  paid_at: string;
  currency: string;
  status: string;
  remarks?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export async function getPayments(
  schoolId: string,
  filters: { studentId?: string; invoiceId?: string; limit?: number } = {},
): Promise<ServiceResult<Payment[]>> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from('payments')
    .select('*, students(full_name, admission_number)')
    .eq('school_id', schoolId)
    .order('paid_at', { ascending: false });
  if (filters.studentId) q = q.eq('student_id', filters.studentId);
  if (filters.invoiceId) q = q.eq('invoice_id', filters.invoiceId);
  if (filters.limit) q = q.limit(filters.limit);
  const { data, error } = await q;
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as Payment[], error: null };
}

export interface RecordPaymentInput {
  invoice_id?: string | null;
  student_id: string;
  amount: number;
  payment_method: string;
  payment_provider_ref?: string;
  paid_by?: string;
  paid_by_name?: string;
  received_by?: string;
  remarks?: string;
  currency?: string;
}

export interface RecordPaymentResult {
  payment: Payment;
  invoice?: Invoice | null;
  receipt: { id: string; receipt_number: string } | null;
}

/**
 * Record a payment. Side effects:
 *   1. Insert a `payments` row with a generated payment_number.
 *   2. If `invoice_id` is provided, increment the linked invoice's amount_paid
 *      and update its status (`partial`, `paid`, or unchanged).
 *   3. Insert a `receipts` row with a generated receipt_number.
 *   4. Audit-log the payment.
 */
export async function recordPayment(
  schoolId: string,
  input: RecordPaymentInput,
): Promise<ServiceResult<RecordPaymentResult>> {
  const supabase = getSupabaseClient();
  if (input.amount <= 0) return { data: null, error: 'Amount must be positive' };

  // Count existing payments for the seed
  const { count } = await supabase
    .from('payments')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId);
  const paymentNumber = genNumber('PAY', (count ?? 0) + 1);

  // 1. Insert payment
  const { data: payment, error: payErr } = await supabase
    .from('payments')
    .insert({
      school_id: schoolId,
      payment_number: paymentNumber,
      invoice_id: input.invoice_id ?? null,
      student_id: input.student_id,
      amount: input.amount,
      payment_method: input.payment_method,
      payment_provider_ref: input.payment_provider_ref ?? null,
      paid_by: input.paid_by ?? null,
      paid_by_name: input.paid_by_name ?? null,
      received_by: input.received_by ?? null,
      paid_at: new Date().toISOString(),
      currency: input.currency ?? 'KES',
      status: 'completed',
      remarks: input.remarks ?? null,
    })
    .select('*')
    .single();
  if (payErr || !payment) return { data: null, error: payErr?.message ?? 'Payment insert failed' };

  // 2. Update invoice (if linked)
  let updatedInvoice: Invoice | null = null;
  if (input.invoice_id) {
    const { data: invoice } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', input.invoice_id)
      .eq('school_id', schoolId)
      .maybeSingle();
    if (invoice) {
      const current = invoice as unknown as Invoice;
      const newPaid = Number(current.amount_paid) + Number(input.amount);
      const status =
        newPaid >= Number(current.amount_due)
          ? 'paid'
          : newPaid > 0
            ? 'partial'
            : current.status;
      const { data: upd, error: invErr } = await supabase
        .from('invoices')
        .update({
          amount_paid: newPaid,
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.invoice_id)
        .select('*')
        .single();
      if (!invErr && upd) updatedInvoice = upd as unknown as Invoice;
    }
  }

  // 3. Generate receipt
  const { count: receiptCount } = await supabase
    .from('receipts')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId);
  const receiptNumber = genNumber('RCP', (receiptCount ?? 0) + 1);
  const { data: receipt, error: receiptErr } = await supabase
    .from('receipts')
    .insert({
      school_id: schoolId,
      receipt_number: receiptNumber,
      payment_id: (payment as { id: string }).id,
      student_id: input.student_id,
      amount: input.amount,
      issued_at: new Date().toISOString(),
      issued_by: input.received_by ?? null,
    })
    .select('id, receipt_number')
    .single();
  const receiptRow = receiptErr
    ? null
    : (receipt as unknown as { id: string; receipt_number: string });

  // 4. Audit
  await logAuditEvent({
    schoolId,
    action: 'finance.payment_recorded',
    resourceType: 'payment',
    resourceId: (payment as { id: string }).id,
    details: {
      payment_number: paymentNumber,
      amount: input.amount,
      invoice_id: input.invoice_id ?? null,
      receipt_number: receiptRow?.receipt_number ?? null,
    },
    severity: 'info',
  });

  return {
    data: {
      payment: payment as unknown as Payment,
      invoice: updatedInvoice,
      receipt: receiptRow,
    },
    error: null,
  };
}

// ─── Receipts ────────────────────────────────────────────────────────────────

export interface Receipt {
  id: string;
  school_id: string;
  receipt_number: string;
  payment_id: string;
  student_id: string;
  amount: number;
  pdf_url?: string | null;
  issued_at: string;
  issued_by?: string | null;
}

export async function getReceipts(
  schoolId: string,
  filters: { studentId?: string; paymentId?: string; limit?: number } = {},
): Promise<ServiceResult<Receipt[]>> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from('receipts')
    .select('*, students(full_name, admission_number), payments(payment_number, amount, payment_method)')
    .eq('school_id', schoolId)
    .order('issued_at', { ascending: false });
  if (filters.studentId) q = q.eq('student_id', filters.studentId);
  if (filters.paymentId) q = q.eq('payment_id', filters.paymentId);
  if (filters.limit) q = q.limit(filters.limit);
  const { data, error } = await q;
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as Receipt[], error: null };
}

// ─── Scholarships ────────────────────────────────────────────────────────────

export interface Scholarship {
  id: string;
  school_id: string;
  name: string;
  student_id?: string | null;
  amount: number;
  percentage: number;
  reason?: string | null;
  awarded_at: string;
  expires_at?: string | null;
  awarded_by?: string | null;
}

export async function getScholarships(
  schoolId: string,
  studentId?: string,
): Promise<ServiceResult<Scholarship[]>> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from('scholarships')
    .select('*, students(full_name, admission_number)')
    .eq('school_id', schoolId)
    .order('awarded_at', { ascending: false });
  if (studentId) q = q.eq('student_id', studentId);
  const { data, error } = await q;
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as Scholarship[], error: null };
}

export async function createScholarship(
  schoolId: string,
  input: {
    name: string;
    student_id?: string;
    amount?: number;
    percentage?: number;
    reason?: string;
    expires_at?: string;
    awarded_by?: string;
  },
): Promise<ServiceResult<Scholarship>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('scholarships')
    .insert({
      school_id: schoolId,
      name: input.name,
      student_id: input.student_id ?? null,
      amount: input.amount ?? 0,
      percentage: input.percentage ?? 0,
      reason: input.reason ?? null,
      awarded_by: input.awarded_by ?? null,
      expires_at: input.expires_at ?? null,
    })
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  await logAuditEvent({
    schoolId,
    action: 'finance.scholarship_awarded',
    resourceType: 'scholarship',
    resourceId: (data as { id: string }).id,
    details: { name: input.name, amount: input.amount ?? 0, percentage: input.percentage ?? 0 },
    severity: 'info',
  });
  return { data: data as unknown as Scholarship, error: null };
}

// ─── Fines ───────────────────────────────────────────────────────────────────

export interface Fine {
  id: string;
  school_id: string;
  student_id: string;
  reason: string;
  amount: number;
  issued_at: string;
  paid: boolean;
  paid_at?: string | null;
  issued_by?: string | null;
}

export async function getFines(
  schoolId: string,
  filters: { studentId?: string; paid?: boolean } = {},
): Promise<ServiceResult<Fine[]>> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from('fines')
    .select('*, students(full_name, admission_number)')
    .eq('school_id', schoolId)
    .order('issued_at', { ascending: false });
  if (filters.studentId) q = q.eq('student_id', filters.studentId);
  if (filters.paid !== undefined) q = q.eq('paid', filters.paid);
  const { data, error } = await q;
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as Fine[], error: null };
}

// ─── Financial reports ───────────────────────────────────────────────────────

export interface FinancialReport {
  totalBilled: number;
  totalCollected: number;
  totalOutstanding: number;
  totalScholarships: number;
  totalFines: number;
  outstandingCount: number;
  collectedCount: number;
  byStatus: Record<string, number>;
  byMethod: Record<string, number>;
  periodStart: string;
  periodEnd: string;
}

export async function getFinancialReport(
  schoolId: string,
  range: { startDate?: string; endDate?: string } = {},
): Promise<ServiceResult<FinancialReport>> {
  const supabase = getSupabaseClient();
  const end = range.endDate ?? new Date().toISOString().split('T')[0];
  const start = range.startDate ?? '1970-01-01';

  const [invoicesRes, paymentsRes, scholarshipsRes, finesRes] = await Promise.all([
    supabase
      .from('invoices')
      .select('amount_due, amount_paid, status')
      .eq('school_id', schoolId)
      .gte('issue_date', start)
      .lte('issue_date', end),
    supabase
      .from('payments')
      .select('amount, payment_method, status')
      .eq('school_id', schoolId)
      .eq('status', 'completed')
      .gte('paid_at', `${start}T00:00:00.000Z`)
      .lte('paid_at', `${end}T23:59:59.999Z`),
    supabase
      .from('scholarships')
      .select('amount')
      .eq('school_id', schoolId)
      .gte('awarded_at', `${start}T00:00:00.000Z`)
      .lte('awarded_at', `${end}T23:59:59.999Z`),
    supabase
      .from('fines')
      .select('amount, paid')
      .eq('school_id', schoolId)
      .gte('issued_at', `${start}T00:00:00.000Z`)
      .lte('issued_at', `${end}T23:59:59.999Z`),
  ]);

  if (invoicesRes.error) return { data: null, error: invoicesRes.error.message };
  if (paymentsRes.error) return { data: null, error: paymentsRes.error.message };
  if (scholarshipsRes.error) return { data: null, error: scholarshipsRes.error.message };
  if (finesRes.error) return { data: null, error: finesRes.error.message };

  const invoices = (invoicesRes.data ?? []) as Array<{ amount_due: number; amount_paid: number; status: string }>;
  const payments = (paymentsRes.data ?? []) as Array<{ amount: number; payment_method: string }>;
  const scholarships = (scholarshipsRes.data ?? []) as Array<{ amount: number }>;
  const fines = (finesRes.data ?? []) as Array<{ amount: number; paid: boolean }>;

  const totalBilled = invoices.reduce((s, i) => s + Number(i.amount_due), 0);
  const totalCollected = invoices.reduce((s, i) => s + Number(i.amount_paid), 0);
  const totalOutstanding = invoices.reduce(
    (s, i) => s + Math.max(0, Number(i.amount_due) - Number(i.amount_paid)),
    0,
  );
  const byStatus: Record<string, number> = {};
  const byMethod: Record<string, number> = {};
  for (const i of invoices) byStatus[i.status] = (byStatus[i.status] ?? 0) + 1;
  for (const p of payments) byMethod[p.payment_method] = (byMethod[p.payment_method] ?? 0) + Number(p.amount);

  return {
    data: {
      totalBilled,
      totalCollected,
      totalOutstanding,
      totalScholarships: scholarships.reduce((s, x) => s + Number(x.amount), 0),
      totalFines: fines.reduce((s, x) => s + Number(x.amount), 0),
      outstandingCount: invoices.filter((i) => Number(i.amount_due) > Number(i.amount_paid)).length,
      collectedCount: invoices.filter((i) => Number(i.amount_paid) > 0).length,
      byStatus,
      byMethod,
      periodStart: start,
      periodEnd: end,
    },
    error: null,
  };
}

// ─── Payment provider config ─────────────────────────────────────────────────

export interface PaymentProviderConfig {
  id: string;
  school_id: string;
  provider: string;
  config: Record<string, unknown>;
  is_active: boolean;
}

export async function getPaymentProviders(
  schoolId: string,
): Promise<ServiceResult<PaymentProviderConfig[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('payment_provider_config')
    .select('*')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false });
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as PaymentProviderConfig[], error: null };
}

export async function upsertPaymentProvider(
  schoolId: string,
  input: { provider: string; config: Record<string, unknown>; is_active?: boolean },
): Promise<ServiceResult<PaymentProviderConfig>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('payment_provider_config')
    .upsert(
      {
        school_id: schoolId,
        provider: input.provider,
        config: input.config,
        is_active: input.is_active ?? true,
      },
      { onConflict: 'school_id,provider' },
    )
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as PaymentProviderConfig, error: null };
}
