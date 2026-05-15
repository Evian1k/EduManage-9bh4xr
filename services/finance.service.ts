import { getSupabaseClient } from '@/template';

export interface FeeStructure {
  id: string;
  name: string;
  amount: number;
  term?: string;
  academic_year: string;
  grade_level?: string;
  due_date?: string;
  is_mandatory: boolean;
}

export interface FeePayment {
  id: string;
  student_id: string;
  fee_structure_id?: string;
  amount_due: number;
  amount_paid: number;
  balance: number;
  payment_date?: string;
  payment_method: string;
  reference_number?: string;
  status: string;
  students?: { first_name: string; last_name: string; admission_number: string };
  fee_structures?: { name: string };
}

export async function getFeeStructures(schoolId: string) {
  const supabase = getSupabaseClient();
  return supabase
    .from('fee_structures')
    .select('*')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false });
}

export async function createFeeStructure(schoolId: string, data: Partial<FeeStructure>) {
  const supabase = getSupabaseClient();
  return supabase
    .from('fee_structures')
    .insert({ ...data, school_id: schoolId })
    .select()
    .single();
}

export async function getFeePayments(schoolId: string, filters?: { studentId?: string; status?: string }) {
  const supabase = getSupabaseClient();
  let query = supabase
    .from('fee_payments')
    .select('*, students(first_name, last_name, admission_number, classes(name)), fee_structures(name)')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false });
  if (filters?.studentId) query = query.eq('student_id', filters.studentId);
  if (filters?.status) query = query.eq('status', filters.status);
  return query;
}

export async function recordPayment(schoolId: string, data: {
  student_id: string;
  fee_structure_id?: string;
  amount_due: number;
  amount_paid: number;
  payment_method?: string;
  reference_number?: string;
  recorded_by?: string;
}) {
  const supabase = getSupabaseClient();
  const status = data.amount_paid >= data.amount_due ? 'paid' :
    data.amount_paid > 0 ? 'partial' : 'unpaid';
  return supabase
    .from('fee_payments')
    .insert({
      ...data,
      school_id: schoolId,
      status,
      payment_date: data.amount_paid > 0 ? new Date().toISOString() : null,
    })
    .select()
    .single();
}

export async function updatePayment(paymentId: string, data: { amount_paid: number; payment_method?: string; reference_number?: string }) {
  const supabase = getSupabaseClient();
  const { data: existing } = await supabase.from('fee_payments').select('amount_due').eq('id', paymentId).single();
  const status = existing ? (data.amount_paid >= existing.amount_due ? 'paid' : data.amount_paid > 0 ? 'partial' : 'unpaid') : 'partial';
  return supabase
    .from('fee_payments')
    .update({ ...data, status, payment_date: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', paymentId)
    .select()
    .single();
}

export async function getFinanceStats(schoolId: string) {
  const supabase = getSupabaseClient();
  const [paymentsRes, unpaidRes, partialRes] = await Promise.all([
    supabase.from('fee_payments').select('amount_paid, amount_due').eq('school_id', schoolId).eq('status', 'paid'),
    supabase.from('fee_payments').select('amount_due, amount_paid').eq('school_id', schoolId).eq('status', 'unpaid'),
    supabase.from('fee_payments').select('amount_due, amount_paid').eq('school_id', schoolId).eq('status', 'partial'),
  ]);
  const collected = (paymentsRes.data || []).reduce((s, p) => s + Number(p.amount_paid), 0);
  const outstanding = [...(unpaidRes.data || []), ...(partialRes.data || [])].reduce((s, p) => s + Number(p.amount_due) - Number(p.amount_paid), 0);
  return {
    totalCollected: collected,
    totalOutstanding: outstanding,
    paidCount: paymentsRes.data?.length || 0,
    unpaidCount: unpaidRes.data?.length || 0,
    partialCount: partialRes.data?.length || 0,
  };
}

export async function getVisitorLogs(schoolId: string) {
  const supabase = getSupabaseClient();
  return supabase
    .from('visitor_logs')
    .select('*')
    .eq('school_id', schoolId)
    .order('check_in', { ascending: false })
    .limit(50);
}

export async function logVisitor(schoolId: string, data: {
  visitor_name: string;
  visitor_phone?: string;
  purpose: string;
  host_name?: string;
  badge_number?: string;
  recorded_by?: string;
}) {
  const supabase = getSupabaseClient();
  return supabase
    .from('visitor_logs')
    .insert({ ...data, school_id: schoolId })
    .select()
    .single();
}

export async function checkoutVisitor(visitorId: string) {
  const supabase = getSupabaseClient();
  return supabase
    .from('visitor_logs')
    .update({ check_out: new Date().toISOString() })
    .eq('id', visitorId)
    .select()
    .single();
}

export async function getDisciplineIncidents(schoolId: string, studentId?: string) {
  const supabase = getSupabaseClient();
  let query = supabase
    .from('discipline_incidents')
    .select('*, students(first_name, last_name, admission_number, classes(name))')
    .eq('school_id', schoolId)
    .order('incident_date', { ascending: false });
  if (studentId) query = query.eq('student_id', studentId);
  return query;
}

export async function createIncident(schoolId: string, data: {
  student_id: string;
  incident_type: string;
  description: string;
  incident_date?: string;
  action_taken?: string;
  parent_notified?: boolean;
  reported_by?: string;
}) {
  const supabase = getSupabaseClient();
  return supabase
    .from('discipline_incidents')
    .insert({ ...data, school_id: schoolId })
    .select()
    .single();
}

export async function getSchoolEvents(schoolId: string) {
  const supabase = getSupabaseClient();
  return supabase
    .from('school_events')
    .select('*')
    .eq('school_id', schoolId)
    .order('start_date');
}

export async function createEvent(schoolId: string, createdBy: string, data: {
  title: string;
  description?: string;
  event_type?: string;
  start_date: string;
  end_date?: string;
  location?: string;
  target_roles?: string[];
}) {
  const supabase = getSupabaseClient();
  return supabase
    .from('school_events')
    .insert({ ...data, school_id: schoolId, created_by: createdBy })
    .select()
    .single();
}
