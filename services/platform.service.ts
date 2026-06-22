// EduManage — Platform service (superadmin)
//
// Platform-level operations: aggregate stats across all schools,
// list/suspend/activate schools. These functions don't take a schoolId —
// they're platform-scope.

import { getSupabaseClient } from '@/template';
import { ServiceResult } from '@/lib/types';
import { logAuditEvent } from './audit.service';

export interface PlatformStats {
  totalSchools: number;
  activeSchools: number;
  trialSchools: number;
  paidSchools: number;
  totalStudents: number;
  totalTeachers: number;
  totalStaff: number;
  totalAiTokens: number;
  byPlanTier: Record<string, number>;
}

export async function getPlatformStats(): Promise<ServiceResult<PlatformStats>> {
  const supabase = getSupabaseClient();
  const [schoolsRes, studentsRes, teachersRes, staffRes, aiRes] = await Promise.all([
    supabase.from('schools').select('id, plan_tier, plan_status, status'),
    supabase.from('students').select('id', { count: 'exact', head: true }),
    supabase.from('teachers').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('school_users').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('ai_usage_logs').select('tokens_used'),
  ]);

  const errs = [schoolsRes, studentsRes, teachersRes, staffRes, aiRes].find((r) => r.error);
  if (errs?.error) return { data: null, error: errs.error.message };

  const schools = (schoolsRes.data ?? []) as Array<{
    id: string;
    plan_tier: string;
    plan_status: string;
    status: string;
  }>;
  const aiLogs = (aiRes.data ?? []) as Array<{ tokens_used: number }>;
  const byPlanTier: Record<string, number> = {};

  for (const s of schools) {
    byPlanTier[s.plan_tier] = (byPlanTier[s.plan_tier] ?? 0) + 1;
  }

  return {
    data: {
      totalSchools: schools.length,
      activeSchools: schools.filter((s) => s.status === 'active').length,
      trialSchools: schools.filter((s) => s.plan_status === 'trialing').length,
      paidSchools: schools.filter((s) => s.plan_status === 'active').length,
      totalStudents: studentsRes.count ?? 0,
      totalTeachers: teachersRes.count ?? 0,
      totalStaff: staffRes.count ?? 0,
      totalAiTokens: aiLogs.reduce((sum, l) => sum + (l.tokens_used ?? 0), 0),
      byPlanTier,
    },
    error: null,
  };
}

export interface PlatformSchool {
  id: string;
  name: string;
  subdomain: string;
  plan_tier: string;
  plan_status: string;
  status: string;
  trial_ends_at?: string | null;
  created_at: string;
}

export async function getAllSchools(): Promise<ServiceResult<PlatformSchool[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('schools')
    .select('id, name, subdomain, plan_tier, plan_status, status, trial_ends_at, created_at')
    .order('created_at', { ascending: false });
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as PlatformSchool[], error: null };
}

export async function suspendSchool(
  schoolId: string,
  suspendedBy?: string,
): Promise<ServiceResult<{ suspended: boolean }>> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('schools')
    .update({ status: 'suspended' })
    .eq('id', schoolId);
  if (error) return { data: null, error: error.message };
  await logAuditEvent({
    schoolId,
    userId: suspendedBy,
    action: 'school.suspended',
    resourceType: 'school',
    resourceId: schoolId,
    severity: 'critical',
  });
  return { data: { suspended: true }, error: null };
}

export async function activateSchool(
  schoolId: string,
  activatedBy?: string,
): Promise<ServiceResult<{ activated: boolean }>> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('schools')
    .update({ status: 'active' })
    .eq('id', schoolId);
  if (error) return { data: null, error: error.message };
  await logAuditEvent({
    schoolId,
    userId: activatedBy,
    action: 'school.activated',
    resourceType: 'school',
    resourceId: schoolId,
    severity: 'info',
  });
  return { data: { activated: true }, error: null };
}

// ─── Legacy aliases ──────────────────────────────────────────────────────────

export const toggleSchoolStatus = async (
  schoolId: string,
  isActive: boolean,
): Promise<ServiceResult<{ updated: boolean }>> => {
  const res = isActive ? await activateSchool(schoolId) : await suspendSchool(schoolId);
  if (res.error) return { data: null, error: res.error };
  return { data: { updated: true }, error: null };
};
