// EduManage — School service
//
// CRUD for the `schools` table + re-exports of the registration flow
// (older screens imported `registerSchool` from here).

import { getSupabaseClient } from '@/template';
import { ServiceResult, School } from '@/lib/types';
import { logAuditEvent } from './audit.service';
import { registerSchool as registerSchoolFlow } from './registration.service';

export { registerSchoolFlow };

export interface SchoolStats {
  totalStudents: number;
  activeStudents: number;
  totalTeachers: number;
  totalClasses: number;
  totalAssignments: number;
}

export async function getSchoolById(schoolId: string): Promise<ServiceResult<School>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('schools')
    .select('*')
    .eq('id', schoolId)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: 'School not found' };
  return { data: data as unknown as School, error: null };
}

export async function updateSchool(
  schoolId: string,
  updates: Partial<School> & Record<string, unknown>,
): Promise<ServiceResult<School>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('schools')
    .update(updates)
    .eq('id', schoolId)
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  await logAuditEvent({
    schoolId,
    action: 'school.updated',
    resourceType: 'school',
    resourceId: schoolId,
    details: { updated: Object.keys(updates) },
    severity: 'info',
  });
  return { data: data as unknown as School, error: null };
}

export async function getSchoolStats(schoolId: string): Promise<ServiceResult<SchoolStats>> {
  const supabase = getSupabaseClient();
  const [studentsRes, teachersRes, classesRes, assignmentsRes] = await Promise.all([
    supabase.from('students').select('id, status').eq('school_id', schoolId),
    supabase.from('teachers').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('status', 'active'),
    supabase.from('classes').select('id', { count: 'exact', head: true }).eq('school_id', schoolId),
    supabase.from('assignments').select('id', { count: 'exact', head: true }).eq('school_id', schoolId),
  ]);
  const errs = [studentsRes, teachersRes, classesRes, assignmentsRes].find((r) => r.error);
  if (errs?.error) return { data: null, error: errs.error.message };
  const students = (studentsRes.data ?? []) as Array<{ status: string }>;
  return {
    data: {
      totalStudents: students.length,
      activeStudents: students.filter((s) => s.status === 'active').length,
      totalTeachers: teachersRes.count ?? 0,
      totalClasses: classesRes.count ?? 0,
      totalAssignments: assignmentsRes.count ?? 0,
    },
    error: null,
  };
}

/**
 * Register a new school + owner. Delegates to `registration.service.ts`
 * but accepts the legacy argument order (schoolName, subdomain, email, userId).
 * The newer `registration.service.ts#registerSchool` accepts a richer input
 * object including password + fullName.
 */
export async function registerSchool(
  schoolName: string,
  subdomain: string,
  email: string,
  userId: string,
): Promise<ServiceResult<{ id: string; name: string; subdomain: string }>> {
  // Legacy callers pass an existing auth userId — we can't fully re-run the
  // sign-up flow. Instead we create the school + link the existing user as
  // the school_owner. Falls back to the rich flow if password is supplied
  // via the alternative signature.
  const supabase = getSupabaseClient();
  const cleanSub = subdomain
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 32);
  if (!cleanSub) return { data: null, error: 'Invalid subdomain' };

  const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data: school, error: schoolErr } = await supabase
    .from('schools')
    .insert({
      name: schoolName,
      slug: schoolName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60),
      subdomain: cleanSub,
      email: email.toLowerCase(),
      plan_status: 'trialing',
      plan_tier: 'starter',
      trial_ends_at: trialEnd,
      status: 'active',
    })
    .select('id, name, subdomain')
    .single();
  if (schoolErr) return { data: null, error: schoolErr.message };
  const schoolRow = school as { id: string; name: string; subdomain: string };

  const { error: suErr } = await supabase.from('school_users').insert({
    school_id: schoolRow.id,
    user_id: userId,
    role: 'school_owner',
    is_active: true,
  });
  if (suErr) return { data: null, error: suErr.message };

  await supabase.from('subscriptions').insert({
    school_id: schoolRow.id,
    plan_tier: 'starter',
    status: 'trialing',
    current_period_start: new Date().toISOString(),
    current_period_end: trialEnd,
    trial_ends_at: trialEnd,
    amount_usd: 0,
    currency: 'USD',
  });

  await logAuditEvent({
    schoolId: schoolRow.id,
    userId,
    action: 'school.created',
    resourceType: 'school',
    resourceId: schoolRow.id,
    details: { name: schoolName, subdomain: cleanSub },
    severity: 'info',
  });

  return { data: schoolRow, error: null };
}
