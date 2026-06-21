// EduManage — HR service
//
// CRUD for staff_records, payroll_runs + payroll_items (auto-PAYE/NSSF/NHIF),
// leave_requests, performance_reviews, disciplinary_records,
// recruitment_applications. All functions take `schoolId` first.

import { getSupabaseClient } from '@/template';
import { ServiceResult } from '@/lib/types';
import { logAuditEvent } from './audit.service';

// ─── Staff records ───────────────────────────────────────────────────────────

export interface StaffRecord {
  id: string;
  school_id: string;
  user_id?: string | null;
  employee_number: string;
  full_name: string;
  gender?: string | null;
  date_of_birth?: string | null;
  national_id?: string | null;
  department?: string | null;
  position?: string | null;
  role: string;
  employment_date: string;
  contract_type?: string | null;
  contract_end_date?: string | null;
  basic_salary: number;
  allowances: number;
  deductions: number;
  status: string;
  termination_date?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  photo_url?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export async function getStaffRecords(
  schoolId: string,
  filters: { department?: string; status?: string } = {},
): Promise<ServiceResult<StaffRecord[]>> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from('staff_records')
    .select('*')
    .eq('school_id', schoolId)
    .order('full_name', { ascending: true });
  if (filters.department) q = q.eq('department', filters.department);
  if (filters.status) q = q.eq('status', filters.status);
  const { data, error } = await q;
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as StaffRecord[], error: null };
}

export interface CreateStaffRecordInput {
  user_id?: string | null;
  employee_number: string;
  full_name: string;
  gender?: string;
  date_of_birth?: string;
  national_id?: string;
  department?: string;
  position?: string;
  role: string;
  employment_date?: string;
  contract_type?: string;
  contract_end_date?: string;
  basic_salary?: number;
  allowances?: number;
  deductions?: number;
  phone?: string;
  email?: string;
  address?: string;
  photo_url?: string;
  metadata?: Record<string, unknown>;
}

export async function createStaffRecord(
  schoolId: string,
  input: CreateStaffRecordInput,
): Promise<ServiceResult<StaffRecord>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('staff_records')
    .insert({
      school_id: schoolId,
      user_id: input.user_id ?? null,
      employee_number: input.employee_number,
      full_name: input.full_name,
      gender: input.gender ?? null,
      date_of_birth: input.date_of_birth ?? null,
      national_id: input.national_id ?? null,
      department: input.department ?? null,
      position: input.position ?? null,
      role: input.role,
      employment_date: input.employment_date ?? new Date().toISOString().split('T')[0],
      contract_type: input.contract_type ?? null,
      contract_end_date: input.contract_end_date ?? null,
      basic_salary: input.basic_salary ?? 0,
      allowances: input.allowances ?? 0,
      deductions: input.deductions ?? 0,
      status: 'active',
      phone: input.phone ?? null,
      email: input.email ?? null,
      address: input.address ?? null,
      photo_url: input.photo_url ?? null,
      metadata: input.metadata ?? {},
    })
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as StaffRecord, error: null };
}

// ─── Payroll ─────────────────────────────────────────────────────────────────

export interface PayrollRun {
  id: string;
  school_id: string;
  period_month: number;
  period_year: number;
  total_gross: number;
  total_deductions: number;
  total_net: number;
  status: string;
  processed_at?: string | null;
  approved_by?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface PayrollItem {
  id: string;
  payroll_run_id: string;
  staff_record_id?: string | null;
  teacher_id?: string | null;
  employee_name: string;
  basic_salary: number;
  allowances: number;
  overtime: number;
  tax_paye: number;
  nssf: number;
  nhif: number;
  other_deductions: number;
  gross_pay: number;
  total_deductions: number;
  net_pay: number;
  paid_at?: string | null;
  payment_ref?: string | null;
}

export async function getPayrollRuns(
  schoolId: string,
  limit = 20,
): Promise<ServiceResult<PayrollRun[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('payroll_runs')
    .select('*')
    .eq('school_id', schoolId)
    .order('period_year', { ascending: false })
    .order('period_month', { ascending: false })
    .limit(limit);
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as PayrollRun[], error: null };
}

export async function getPayrollItems(
  schoolId: string,
  payrollRunId: string,
): Promise<ServiceResult<PayrollItem[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('payroll_items')
    .select('*')
    .eq('school_id', schoolId)
    .eq('payroll_run_id', payrollRunId)
    .order('employee_name');
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as PayrollItem[], error: null };
}

/**
 * Kenya-specific payroll math. Computes PAYE (tiered), NSSF (2024 rates),
 * and NHIF/SHIF contributions for each active staff member and inserts a
 * payroll_run + payroll_items in a single batch.
 *
 * Rates are simplified approximations — for production use you should
 * consult the latest KRA / NSSF / SHIF schedules.
 */
function computeKenyanPayroll(basic: number, allowances: number, overtime: number) {
  const gross = basic + allowances + overtime;

  // NSSF — Tier I (2024): 6% of pensionable earnings up to KES 8,000 ceiling.
  const nssf = Math.min(0.06 * Math.min(basic, 8000), 480);

  // NHIF/SHIF — simplified: 2.75% of gross, capped at KES 1,700.
  const nhif = Math.min(0.0275 * gross, 1700);

  // PAYE — taxable income after NSSF + personal relief (KES 2,400/mo).
  const taxable = Math.max(0, gross - nssf - 2400);
  let paye = 0;
  if (taxable <= 24000) paye = taxable * 0.10;
  else if (taxable <= 32333) paye = 2400 + (taxable - 24000) * 0.25;
  else if (taxable <= 500000) paye = 2400 + (32333 - 24000) * 0.25 + (taxable - 32333) * 0.30;
  else if (taxable <= 800000) paye = 2400 + (32333 - 24000) * 0.25 + (500000 - 32333) * 0.30 + (taxable - 500000) * 0.325;
  else paye = 2400 + (32333 - 24000) * 0.25 + (500000 - 32333) * 0.30 + (800000 - 500000) * 0.325 + (taxable - 800000) * 0.35;

  return { gross, nssf, nhif, tax_paye: Math.round(paye) };
}

export async function generatePayrollRun(
  schoolId: string,
  month: number,
  year: number,
  approvedBy?: string,
): Promise<ServiceResult<{ run: PayrollRun; items: PayrollItem[] }>> {
  const supabase = getSupabaseClient();
  // Fetch all active staff
  const { data: staffRows, error: staffErr } = await supabase
    .from('staff_records')
    .select('id, employee_number, full_name, basic_salary, allowances, deductions, status, teacher_id')
    .eq('school_id', schoolId)
    .eq('status', 'active');
  if (staffErr) return { data: null, error: staffErr.message };
  const staff = (staffRows ?? []) as Array<{
    id: string;
    employee_number: string;
    full_name: string;
    basic_salary: number;
    allowances: number;
    deductions: number;
    teacher_id?: string | null;
  }>;

  // Create the run first
  const { data: runRow, error: runErr } = await supabase
    .from('payroll_runs')
    .insert({
      school_id: schoolId,
      period_month: month,
      period_year: year,
      total_gross: 0,
      total_deductions: 0,
      total_net: 0,
      status: 'draft',
      approved_by: approvedBy ?? null,
    })
    .select('*')
    .single();
  if (runErr || !runRow) return { data: null, error: runErr?.message ?? 'Payroll run insert failed' };
  const run = runRow as unknown as PayrollRun;

  // Build payroll items
  let totalGross = 0;
  let totalDeductions = 0;
  let totalNet = 0;
  const items: PayrollItem[] = [];
  const itemInserts = staff.map((s) => {
    const basic = Number(s.basic_salary ?? 0);
    const allowances = Number(s.allowances ?? 0);
    const overtime = 0;
    const otherDeductions = Number(s.deductions ?? 0);
    const calc = computeKenyanPayroll(basic, allowances, overtime);
    const totalDed = calc.tax_paye + calc.nssf + calc.nhif + otherDeductions;
    const net = calc.gross - totalDed;
    totalGross += calc.gross;
    totalDeductions += totalDed;
    totalNet += net;
    return {
      school_id: schoolId,
      payroll_run_id: run.id,
      staff_record_id: s.id,
      teacher_id: s.teacher_id ?? null,
      employee_name: s.full_name,
      basic_salary: basic,
      allowances,
      overtime,
      tax_paye: calc.tax_paye,
      nssf: calc.nssf,
      nhif: calc.nhif,
      other_deductions: otherDeductions,
    };
  });

  if (itemInserts.length === 0) {
    // Nothing to insert — return the empty run.
    return { data: { run, items: [] }, error: null };
  }

  const { data: insertedItems, error: itemErr } = await supabase
    .from('payroll_items')
    .insert(itemInserts)
    .select('*');
  if (itemErr) {
    // Best-effort cleanup of the orphaned run
    await supabase.from('payroll_runs').delete().eq('id', run.id);
    return { data: null, error: itemErr.message };
  }
  items.push(...((insertedItems ?? []) as unknown as PayrollItem[]));

  // Update run totals
  const { error: updateErr } = await supabase
    .from('payroll_runs')
    .update({
      total_gross: totalGross,
      total_deductions: totalDeductions,
      total_net: totalNet,
      processed_at: new Date().toISOString(),
    })
    .eq('id', run.id);
  if (updateErr) console.warn('[payroll] totals update failed:', updateErr.message);

  return {
    data: {
      run: { ...run, total_gross: totalGross, total_deductions: totalDeductions, total_net: totalNet, processed_at: new Date().toISOString() },
      items,
    },
    error: null,
  };
}

// ─── Leave ───────────────────────────────────────────────────────────────────

export interface LeaveRequest {
  id: string;
  school_id: string;
  staff_record_id?: string | null;
  teacher_id?: string | null;
  leave_type: string;
  start_date: string;
  end_date: string;
  days: number;
  reason?: string | null;
  status: string;
  approved_by?: string | null;
  approved_at?: string | null;
  attachment_url?: string | null;
  created_at: string;
  updated_at: string;
}

export async function getLeaveRequests(
  schoolId: string,
  filters: { staffRecordId?: string; status?: string } = {},
): Promise<ServiceResult<LeaveRequest[]>> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from('leave_requests')
    .select('*')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false });
  if (filters.staffRecordId) q = q.eq('staff_record_id', filters.staffRecordId);
  if (filters.status) q = q.eq('status', filters.status);
  const { data, error } = await q;
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as LeaveRequest[], error: null };
}

export async function requestLeave(
  schoolId: string,
  input: {
    staff_record_id?: string;
    teacher_id?: string;
    leave_type: string;
    start_date: string;
    end_date: string;
    reason?: string;
    attachment_url?: string;
  },
): Promise<ServiceResult<LeaveRequest>> {
  const supabase = getSupabaseClient();
  const start = new Date(input.start_date);
  const end = new Date(input.end_date);
  const days = Math.max(0, Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))) + 1;
  const { data, error } = await supabase
    .from('leave_requests')
    .insert({
      school_id: schoolId,
      staff_record_id: input.staff_record_id ?? null,
      teacher_id: input.teacher_id ?? null,
      leave_type: input.leave_type,
      start_date: input.start_date,
      end_date: input.end_date,
      days,
      reason: input.reason ?? null,
      attachment_url: input.attachment_url ?? null,
      status: 'pending',
    })
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as LeaveRequest, error: null };
}

export async function approveLeave(
  schoolId: string,
  leaveId: string,
  approvedBy: string,
  status: 'approved' | 'rejected',
  notes?: string,
): Promise<ServiceResult<LeaveRequest>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('leave_requests')
    .update({
      status,
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
      metadata: notes ? { notes } : undefined,
    })
    .eq('id', leaveId)
    .eq('school_id', schoolId)
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as LeaveRequest, error: null };
}

// ─── Performance reviews ─────────────────────────────────────────────────────

export interface PerformanceReview {
  id: string;
  school_id: string;
  staff_record_id?: string | null;
  teacher_id?: string | null;
  review_period: string;
  reviewer_id?: string | null;
  score: number;
  strengths?: string | null;
  areas_for_improvement?: string | null;
  goals?: string | null;
  comments?: string | null;
  reviewed_at: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

export async function getPerformanceReviews(
  schoolId: string,
  staffRecordId?: string,
): Promise<ServiceResult<PerformanceReview[]>> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from('performance_reviews')
    .select('*')
    .eq('school_id', schoolId)
    .order('reviewed_at', { ascending: false });
  if (staffRecordId) q = q.eq('staff_record_id', staffRecordId);
  const { data, error } = await q;
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as PerformanceReview[], error: null };
}

export async function createPerformanceReview(
  schoolId: string,
  input: {
    staff_record_id?: string;
    teacher_id?: string;
    review_period: string;
    reviewer_id?: string;
    score: number;
    strengths?: string;
    areas_for_improvement?: string;
    goals?: string;
    comments?: string;
  },
): Promise<ServiceResult<PerformanceReview>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('performance_reviews')
    .insert({
      school_id: schoolId,
      staff_record_id: input.staff_record_id ?? null,
      teacher_id: input.teacher_id ?? null,
      review_period: input.review_period,
      reviewer_id: input.reviewer_id ?? null,
      score: input.score,
      strengths: input.strengths ?? null,
      areas_for_improvement: input.areas_for_improvement ?? null,
      goals: input.goals ?? null,
      comments: input.comments ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as PerformanceReview, error: null };
}

// ─── Disciplinary records ────────────────────────────────────────────────────

export interface DisciplinaryRecord {
  id: string;
  school_id: string;
  staff_record_id?: string | null;
  teacher_id?: string | null;
  student_id?: string | null;
  incident_date: string;
  incident_description: string;
  severity?: string | null;
  action_taken?: string | null;
  recorded_by?: string | null;
  attachment_url?: string | null;
  status: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

export async function getDisciplinaryRecords(
  schoolId: string,
  filters: { staffRecordId?: string; studentId?: string } = {},
): Promise<ServiceResult<DisciplinaryRecord[]>> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from('disciplinary_records')
    .select('*')
    .eq('school_id', schoolId)
    .order('incident_date', { ascending: false });
  if (filters.staffRecordId) q = q.eq('staff_record_id', filters.staffRecordId);
  if (filters.studentId) q = q.eq('student_id', filters.studentId);
  const { data, error } = await q;
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as DisciplinaryRecord[], error: null };
}

// ─── Recruitment ─────────────────────────────────────────────────────────────

export interface RecruitmentApplication {
  id: string;
  school_id: string;
  position: string;
  applicant_name: string;
  applicant_email: string;
  applicant_phone?: string | null;
  cv_url?: string | null;
  cover_letter?: string | null;
  status: string;
  interview_date?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export async function getRecruitmentApplications(
  schoolId: string,
  filters: { position?: string; status?: string } = {},
): Promise<ServiceResult<RecruitmentApplication[]>> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from('recruitment_applications')
    .select('*')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false });
  if (filters.position) q = q.eq('position', filters.position);
  if (filters.status) q = q.eq('status', filters.status);
  const { data, error } = await q;
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as RecruitmentApplication[], error: null };
}

export async function submitApplication(
  schoolId: string,
  input: {
    position: string;
    applicant_name: string;
    applicant_email: string;
    applicant_phone?: string;
    cv_url?: string;
    cover_letter?: string;
  },
): Promise<ServiceResult<RecruitmentApplication>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('recruitment_applications')
    .insert({
      school_id: schoolId,
      position: input.position,
      applicant_name: input.applicant_name,
      applicant_email: input.applicant_email.toLowerCase(),
      applicant_phone: input.applicant_phone ?? null,
      cv_url: input.cv_url ?? null,
      cover_letter: input.cover_letter ?? null,
      status: 'received',
    })
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as RecruitmentApplication, error: null };
}
