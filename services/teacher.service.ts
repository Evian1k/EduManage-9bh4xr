// EduManage — Teacher service
//
// CRUD for the `teachers` table. Every function takes `schoolId` first.

import { getSupabaseClient } from '@/template';
import { ServiceResult } from '@/lib/types';
import { logAuditEvent } from './audit.service';

export interface Teacher {
  id: string;
  school_id: string;
  user_id?: string | null;
  employee_number: string;
  full_name: string;
  gender?: string | null;
  date_of_birth?: string | null;
  national_id?: string | null;
  tsc_number?: string | null;
  department?: string | null;
  qualification?: string | null;
  specialization?: string | null;
  employment_date: string;
  contract_type?: string | null;
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

export async function getTeachers(
  schoolId: string,
  filters: { department?: string; status?: string } = {},
): Promise<ServiceResult<Teacher[]>> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from('teachers')
    .select('*')
    .eq('school_id', schoolId)
    .order('full_name', { ascending: true });
  if (filters.department) q = q.eq('department', filters.department);
  if (filters.status) q = q.eq('status', filters.status);
  const { data, error } = await q;
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as Teacher[], error: null };
}

export async function getTeacherById(
  schoolId: string,
  teacherId: string,
): Promise<ServiceResult<Teacher>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('teachers')
    .select('*')
    .eq('id', teacherId)
    .eq('school_id', schoolId)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: 'Teacher not found' };
  return { data: data as unknown as Teacher, error: null };
}

export interface CreateTeacherInput {
  user_id?: string;
  employee_number: string;
  full_name: string;
  gender?: string;
  date_of_birth?: string;
  national_id?: string;
  tsc_number?: string;
  department?: string;
  qualification?: string;
  specialization?: string;
  employment_date?: string;
  contract_type?: string;
  phone?: string;
  email?: string;
  address?: string;
  photo_url?: string;
}

export async function createTeacher(
  schoolId: string,
  input: CreateTeacherInput,
): Promise<ServiceResult<Teacher>> {
  const supabase = getSupabaseClient();
  if (!input.full_name || !input.employee_number) {
    return { data: null, error: 'full_name and employee_number are required' };
  }
  const { data, error } = await supabase
    .from('teachers')
    .insert({
      school_id: schoolId,
      user_id: input.user_id ?? null,
      employee_number: input.employee_number,
      full_name: input.full_name,
      gender: input.gender ?? null,
      date_of_birth: input.date_of_birth ?? null,
      national_id: input.national_id ?? null,
      tsc_number: input.tsc_number ?? null,
      department: input.department ?? null,
      qualification: input.qualification ?? null,
      specialization: input.specialization ?? null,
      employment_date: input.employment_date ?? new Date().toISOString().split('T')[0],
      contract_type: input.contract_type ?? null,
      status: 'active',
      phone: input.phone ?? null,
      email: input.email ?? null,
      address: input.address ?? null,
      photo_url: input.photo_url ?? null,
    })
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  await logAuditEvent({
    schoolId,
    action: 'user.invited',
    resourceType: 'teacher',
    resourceId: (data as { id: string }).id,
    details: { full_name: input.full_name, employee_number: input.employee_number },
    severity: 'info',
  });
  return { data: data as unknown as Teacher, error: null };
}

export async function updateTeacher(
  schoolId: string,
  teacherId: string,
  updates: Partial<CreateTeacherInput> & { status?: string; termination_date?: string },
): Promise<ServiceResult<Teacher>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('teachers')
    .update(updates)
    .eq('id', teacherId)
    .eq('school_id', schoolId)
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  await logAuditEvent({
    schoolId,
    action: 'user.profile.updated',
    resourceType: 'teacher',
    resourceId: teacherId,
    details: { updated: Object.keys(updates) },
    severity: 'info',
  });
  return { data: data as unknown as Teacher, error: null };
}

// ─── Legacy aliases ──────────────────────────────────────────────────────────

export const getAllStaff = getTeachers;

export async function getSchoolUserById(
  schoolId: string,
  schoolUserId: string,
): Promise<ServiceResult<any>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('school_users')
    .select('*')
    .eq('id', schoolUserId)
    .eq('school_id', schoolId)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

export async function getSchoolUserByUserId(
  schoolId: string,
  userId: string,
): Promise<ServiceResult<any>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('school_users')
    .select('*')
    .eq('user_id', userId)
    .eq('school_id', schoolId)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

export async function addStaffMember(
  schoolId: string,
  userId: string,
  role: string,
  employeeId?: string,
  department?: string,
): Promise<ServiceResult<any>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('school_users')
    .insert({
      school_id: schoolId,
      user_id: userId,
      role,
      metadata: { employee_id: employeeId, department },
      is_active: true,
    })
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

export async function updateStaffRole(
  schoolId: string,
  schoolUserId: string,
  role: string,
): Promise<ServiceResult<any>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('school_users')
    .update({ role })
    .eq('id', schoolUserId)
    .eq('school_id', schoolId)
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

export async function toggleStaffActive(
  schoolId: string,
  schoolUserId: string,
  isActive: boolean,
): Promise<ServiceResult<any>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('school_users')
    .update({ is_active: isActive })
    .eq('id', schoolUserId)
    .eq('school_id', schoolId)
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data, error: null };
}
