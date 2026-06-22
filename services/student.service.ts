// EduManage — Student service
//
// CRUD for the `students` table. Every function takes `schoolId` first
// (except where the lookup is by user_id, which is itself tenant-bound).
// `admitStudent` auto-generates an admission number.

import { getSupabaseClient } from '@/template';
import { ServiceResult } from '@/lib/types';
import { logAuditEvent } from './audit.service';

export interface Student {
  id: string;
  school_id: string;
  user_id?: string | null;
  admission_number: string;
  full_name: string;
  gender?: string | null;
  date_of_birth?: string | null;
  national_id?: string | null;
  birth_certificate?: string | null;
  class_id?: string | null;
  stream_id?: string | null;
  enrollment_date: string;
  status: string;
  graduation_date?: string | null;
  transfer_date?: string | null;
  previous_school?: string | null;
  address?: string | null;
  county?: string | null;
  nationality?: string | null;
  blood_group?: string | null;
  photo_url?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface AdmitStudentInput {
  user_id?: string;
  full_name: string;
  admission_number?: string;
  gender?: string;
  date_of_birth?: string;
  national_id?: string;
  birth_certificate?: string;
  class_id?: string;
  stream_id?: string;
  enrollment_date?: string;
  previous_school?: string;
  address?: string;
  county?: string;
  nationality?: string;
  blood_group?: string;
  photo_url?: string;
  metadata?: Record<string, unknown>;
}

function genAdmissionNumber(seed: number): string {
  const year = new Date().getFullYear().toString().slice(-2);
  return `ADM${year}${String(seed).padStart(4, '0')}`;
}

export async function getStudents(
  schoolId: string,
  filters: { classId?: string; streamId?: string; status?: string; search?: string } = {},
): Promise<ServiceResult<Student[]>> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from('students')
    .select('*, classes(name, level), streams(name)')
    .eq('school_id', schoolId)
    .order('full_name', { ascending: true });
  if (filters.classId) q = q.eq('class_id', filters.classId);
  if (filters.streamId) q = q.eq('stream_id', filters.streamId);
  if (filters.status) q = q.eq('status', filters.status);
  if (filters.search) {
    const term = filters.search.replace(/[%_]/g, (m) => '\\' + m);
    q = q.or(`full_name.ilike.%${term}%,admission_number.ilike.%${term}%,national_id.ilike.%${term}%`);
  }
  const { data, error } = await q;
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as Student[], error: null };
}

export async function getStudentById(
  schoolId: string,
  studentId: string,
): Promise<ServiceResult<Student>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('students')
    .select('*, classes(name, level), streams(name)')
    .eq('id', studentId)
    .eq('school_id', schoolId)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: 'Student not found' };
  return { data: data as unknown as Student, error: null };
}

export async function getStudentByUserId(
  schoolId: string,
  userId: string,
): Promise<ServiceResult<Student>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('students')
    .select('*, classes(name, level), streams(name)')
    .eq('user_id', userId)
    .eq('school_id', schoolId)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: 'Student not found' };
  return { data: data as unknown as Student, error: null };
}

export async function admitStudent(
  schoolId: string,
  input: AdmitStudentInput,
): Promise<ServiceResult<Student>> {
  const supabase = getSupabaseClient();
  if (!input.full_name) return { data: null, error: 'full_name is required' };

  let admissionNumber = input.admission_number;
  if (!admissionNumber) {
    const { count } = await supabase
      .from('students')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId);
    admissionNumber = genAdmissionNumber((count ?? 0) + 1);
  }

  const { data, error } = await supabase
    .from('students')
    .insert({
      school_id: schoolId,
      user_id: input.user_id ?? null,
      admission_number: admissionNumber,
      full_name: input.full_name,
      gender: input.gender ?? null,
      date_of_birth: input.date_of_birth ?? null,
      national_id: input.national_id ?? null,
      birth_certificate: input.birth_certificate ?? null,
      class_id: input.class_id ?? null,
      stream_id: input.stream_id ?? null,
      enrollment_date: input.enrollment_date ?? new Date().toISOString().split('T')[0],
      status: 'active',
      previous_school: input.previous_school ?? null,
      address: input.address ?? null,
      county: input.county ?? null,
      nationality: input.nationality ?? null,
      blood_group: input.blood_group ?? null,
      photo_url: input.photo_url ?? null,
      metadata: input.metadata ?? {},
    })
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };

  await logAuditEvent({
    schoolId,
    action: 'student.admitted',
    resourceType: 'student',
    resourceId: (data as { id: string }).id,
    details: { full_name: input.full_name, admission_number: admissionNumber },
    severity: 'info',
  });

  return { data: data as unknown as Student, error: null };
}

export async function updateStudent(
  schoolId: string,
  studentId: string,
  updates: Partial<AdmitStudentInput>,
): Promise<ServiceResult<Student>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('students')
    .update(updates)
    .eq('id', studentId)
    .eq('school_id', schoolId)
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  await logAuditEvent({
    schoolId,
    action: 'student.updated',
    resourceType: 'student',
    resourceId: studentId,
    severity: 'info',
  });
  return { data: data as unknown as Student, error: null };
}

export async function transferStudent(
  schoolId: string,
  studentId: string,
  info: { newSchoolName?: string; reason?: string; transferDate?: string },
): Promise<ServiceResult<{ transferred: boolean }>> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('students')
    .update({
      status: 'transferred',
      transfer_date: info.transferDate ?? new Date().toISOString().split('T')[0],
    })
    .eq('id', studentId)
    .eq('school_id', schoolId);
  if (error) return { data: null, error: error.message };
  await logAuditEvent({
    schoolId,
    action: 'student.transferred',
    resourceType: 'student',
    resourceId: studentId,
    details: { new_school_name: info.newSchoolName, reason: info.reason },
    severity: 'info',
  });
  return { data: { transferred: true }, error: null };
}

export async function graduateStudents(
  schoolId: string,
  studentIds: string[],
): Promise<ServiceResult<{ graduated: number }>> {
  const supabase = getSupabaseClient();
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('students')
    .update({ status: 'graduated', graduation_date: today })
    .in('id', studentIds)
    .eq('school_id', schoolId)
    .select('id');
  if (error) return { data: null, error: error.message };
  await logAuditEvent({
    schoolId,
    action: 'student.updated',
    details: { graduated: data?.length ?? 0 },
    severity: 'info',
  });
  return { data: { graduated: data?.length ?? 0 }, error: null };
}

export async function suspendStudent(
  schoolId: string,
  studentId: string,
  reason?: string,
): Promise<ServiceResult<Student>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('students')
    .update({ status: 'suspended', metadata: { suspension_reason: reason } })
    .eq('id', studentId)
    .eq('school_id', schoolId)
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  await logAuditEvent({
    schoolId,
    action: 'student.suspended',
    resourceType: 'student',
    resourceId: studentId,
    details: { reason },
    severity: 'warning',
  });
  return { data: data as unknown as Student, error: null };
}

export async function deleteStudent(
  schoolId: string,
  studentId: string,
): Promise<ServiceResult<{ deleted: boolean }>> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('students')
    .delete()
    .eq('id', studentId)
    .eq('school_id', schoolId);
  if (error) return { data: null, error: error.message };
  await logAuditEvent({
    schoolId,
    action: 'data.delete',
    resourceType: 'student',
    resourceId: studentId,
    severity: 'warning',
  });
  return { data: { deleted: true }, error: null };
}

export interface StudentStats {
  total: number;
  active: number;
  graduated: number;
  transferred: number;
  suspended: number;
  byGender: Record<string, number>;
  byClass: Array<{ class_id: string; class_name: string; count: number }>;
}

export async function getStudentStats(schoolId: string): Promise<ServiceResult<StudentStats>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('students')
    .select('id, status, gender, class_id, classes(name)')
    .eq('school_id', schoolId);
  if (error) return { data: null, error: error.message };
  const rows = (data ?? []) as Array<{
    id: string;
    status: string;
    gender?: string | null;
    class_id?: string | null;
    classes: { name: string } | null;
  }>;
  const stats: StudentStats = {
    total: rows.length,
    active: 0,
    graduated: 0,
    transferred: 0,
    suspended: 0,
    byGender: {},
    byClass: [],
  };
  const byClassMap = new Map<string, { class_id: string; class_name: string; count: number }>();
  for (const r of rows) {
    if (r.status === 'active') stats.active += 1;
    else if (r.status === 'graduated') stats.graduated += 1;
    else if (r.status === 'transferred') stats.transferred += 1;
    else if (r.status === 'suspended') stats.suspended += 1;
    if (r.gender) stats.byGender[r.gender] = (stats.byGender[r.gender] ?? 0) + 1;
    if (r.class_id) {
      const ex = byClassMap.get(r.class_id);
      if (ex) ex.count += 1;
      else
        byClassMap.set(r.class_id, {
          class_id: r.class_id,
          class_name: r.classes?.name ?? 'Unknown',
          count: 1,
        });
    }
  }
  stats.byClass = Array.from(byClassMap.values()).sort((a, b) => b.count - a.count);
  return { data: stats, error: null };
}

/**
 * Get all exam_results + report_cards for a student. Alias used by older
 * screens that expected this name.
 */
export async function getStudentGrades(
  schoolId: string,
  studentId: string,
): Promise<ServiceResult<Array<{ id: string; score: number; grade?: string | null; subject_name: string; exam_name: string; term_name: string }>>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('exam_results')
    .select('id, score, grade, subjects(name), exams(name, terms(name))')
    .eq('school_id', schoolId)
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });
  if (error) return { data: null, error: error.message };
  const rows = (data ?? []) as Array<{
    id: string;
    score: number;
    grade?: string | null;
    subjects: { name: string } | null;
    exams: { name: string; terms: { name: string } | null } | null;
  }>;
  return {
    data: rows.map((r) => ({
      id: r.id,
      score: Number(r.score),
      grade: r.grade ?? null,
      subject_name: r.subjects?.name ?? 'Unknown',
      exam_name: r.exams?.name ?? 'Unknown',
      term_name: r.exams?.terms?.name ?? '',
    })),
    error: null,
  };
}
