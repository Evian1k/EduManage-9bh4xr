// EduManage — Staff lifecycle service (legacy compatibility shim)
//
// Wraps the `school_users` lifecycle operations: onboard, status updates,
// and offboard. The audit log goes to `audit_logs` (the schema doesn't have
// a `staff_transfer_log` table — we use the unified `audit_logs` instead).

import { getSupabaseClient } from '@/template';
import { ServiceResult } from '@/lib/types';
import { logAuditEvent } from './audit.service';

export type EmploymentStatus =
  | 'active'
  | 'transferred'
  | 'retired'
  | 'resigned'
  | 'suspended'
  | 'terminated'
  | 'on_leave';

export interface StaffLifecycleUpdate {
  employment_status?: EmploymentStatus;
  employment_end_date?: string | null;
  transfer_status?: string;
  archived?: boolean;
  notes?: string;
  replacement_user_id?: string;
  is_active?: boolean;
}

export interface StaffLifecycleRecord {
  id: string;
  school_id: string;
  user_id: string;
  role: string;
  is_active: boolean;
  metadata?: Record<string, unknown> | null;
  joined_at: string;
  created_at: string;
  updated_at: string;
}

/**
 * Get all staff with their lifecycle status for the admin view.
 */
export async function getStaffLifecycle(
  schoolId: string,
): Promise<ServiceResult<StaffLifecycleRecord[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('school_users')
    .select('*, user_profiles(id, email, full_name)')
    .eq('school_id', schoolId)
    .neq('role', 'student')
    .order('joined_at', { ascending: false });
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as StaffLifecycleRecord[], error: null };
}

/**
 * Onboard (activate) a staff member — sets `is_active = true` and clears
 * any archived flag.
 */
export async function onboardStaff(
  schoolId: string,
  schoolUserId: string,
  performedBy: string,
  notes?: string,
): Promise<ServiceResult<StaffLifecycleRecord>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('school_users')
    .update({
      is_active: true,
      metadata: { onboarding_notes: notes },
    })
    .eq('id', schoolUserId)
    .eq('school_id', schoolId)
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  await logAuditEvent({
    schoolId,
    userId: performedBy,
    action: 'user.activated',
    resourceType: 'school_user',
    resourceId: schoolUserId,
    details: { notes },
    severity: 'info',
  });
  return { data: data as unknown as StaffLifecycleRecord, error: null };
}

/**
 * Update a staff member's lifecycle status (suspend, retire, reinstate, etc).
 * Sets `is_active` based on the new status.
 */
export async function updateStaffStatus(
  schoolId: string,
  schoolUserId: string,
  update: StaffLifecycleUpdate,
  performedBy: string,
  reason?: string,
): Promise<ServiceResult<StaffLifecycleRecord>> {
  const supabase = getSupabaseClient();
  const payload: Record<string, unknown> = { ...update };
  if (update.employment_status && update.employment_status !== 'active') {
    payload.is_active = false;
  }
  if (update.employment_status === 'active') {
    payload.is_active = true;
  }
  const { data, error } = await supabase
    .from('school_users')
    .update(payload)
    .eq('id', schoolUserId)
    .eq('school_id', schoolId)
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };

  const action =
    update.employment_status === 'suspended'
      ? 'user.deactivated'
      : update.employment_status === 'active'
        ? 'user.activated'
        : 'user.role.changed';
  await logAuditEvent({
    schoolId,
    userId: performedBy,
    action,
    resourceType: 'school_user',
    resourceId: schoolUserId,
    details: { update, reason },
    severity: update.employment_status === 'suspended' || update.employment_status === 'terminated' ? 'warning' : 'info',
  });
  return { data: data as unknown as StaffLifecycleRecord, error: null };
}

/**
 * Offboard (deactivate) a staff member — removes login access but
 * preserves all historical data.
 */
export async function offboardStaff(
  schoolId: string,
  schoolUserId: string,
  performedBy: string,
  reason: string,
  status: EmploymentStatus = 'terminated',
): Promise<ServiceResult<StaffLifecycleRecord>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('school_users')
    .update({
      is_active: false,
      metadata: { employment_status: status, offboard_reason: reason, offboarded_at: new Date().toISOString() },
    })
    .eq('id', schoolUserId)
    .eq('school_id', schoolId)
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  await logAuditEvent({
    schoolId,
    userId: performedBy,
    action: 'user.deactivated',
    resourceType: 'school_user',
    resourceId: schoolUserId,
    details: { reason, status },
    severity: 'warning',
  });
  return { data: data as unknown as StaffLifecycleRecord, error: null };
}

// ─── Legacy aliases (older signatures) ───────────────────────────────────────

export const updateStaffLifecycle = updateStaffStatus;

export const reinstateStaff = (
  schoolId: string,
  schoolUserId: string,
  performedBy: string,
) => onboardStaff(schoolId, schoolUserId, performedBy, 'Staff reinstated');

export const initiateTransfer = (
  schoolId: string,
  schoolUserId: string,
  performedBy: string,
  destination?: string,
) =>
  updateStaffStatus(
    schoolId,
    schoolUserId,
    { employment_status: 'transferred', transfer_status: destination ?? 'pending' },
    performedBy,
    `Transfer initiated${destination ? ` to ${destination}` : ''}`,
  );

export const retireStaff = (
  schoolId: string,
  schoolUserId: string,
  performedBy: string,
  replacementUserId?: string,
) =>
  updateStaffStatus(
    schoolId,
    schoolUserId,
    { employment_status: 'retired', replacement_user_id: replacementUserId },
    performedBy,
    'Staff retired',
  );

export const suspendStaff = (
  schoolId: string,
  schoolUserId: string,
  performedBy: string,
  reason: string,
) =>
  updateStaffStatus(
    schoolId,
    schoolUserId,
    { employment_status: 'suspended', notes: reason },
    performedBy,
    reason,
  );

export async function getStaffAuditLog(
  schoolId: string,
  schoolUserId?: string,
): Promise<ServiceResult<any[]>> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from('audit_logs')
    .select('*')
    .eq('school_id', schoolId)
    .in('action', ['user.activated', 'user.deactivated', 'user.role.changed'])
    .order('created_at', { ascending: false })
    .limit(50);
  if (schoolUserId) q = q.eq('resource_id', schoolUserId);
  const { data, error } = await q;
  if (error) return { data: null, error: error.message };
  return { data: data ?? [], error: null };
}

export const getAllStaffWithLifecycle = getStaffLifecycle;

export async function getActiveAdminCount(schoolId: string): Promise<number> {
  const supabase = getSupabaseClient();
  const { count } = await supabase
    .from('school_users')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId)
    .in('role', ['school_owner', 'principal', 'administrator', 'ict_manager'])
    .eq('is_active', true);
  return count ?? 0;
}
