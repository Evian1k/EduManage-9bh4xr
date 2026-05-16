import { getSupabaseClient } from '@/template';

export type EmploymentStatus =
  | 'active'
  | 'transferred'
  | 'retired'
  | 'resigned'
  | 'suspended'
  | 'terminated'
  | 'on_leave';

export interface StaffLifecycleUpdate {
  employment_status: EmploymentStatus;
  employment_end_date?: string;
  transfer_status?: string;
  archived?: boolean;
  notes?: string;
  replacement_user_id?: string;
}

/**
 * Update a staff member's employment lifecycle status.
 * Creates an audit entry in staff_transfer_log automatically.
 */
export async function updateStaffLifecycle(
  schoolUserId: string,
  schoolId: string,
  update: StaffLifecycleUpdate,
  performedBy: string,
  reason?: string
) {
  const supabase = getSupabaseClient();

  // Fetch current state for audit
  const { data: current } = await supabase
    .from('school_users')
    .select('*')
    .eq('id', schoolUserId)
    .single();

  const payload: any = { ...update };
  if (update.employment_status !== 'active') {
    payload.is_active = false;
    payload.archived = true;
    if (!update.employment_end_date) {
      payload.employment_end_date = new Date().toISOString().split('T')[0];
    }
  } else {
    payload.is_active = true;
    payload.archived = false;
    payload.employment_end_date = null;
  }

  const { data, error } = await supabase
    .from('school_users')
    .update(payload)
    .eq('id', schoolUserId)
    .select()
    .single();

  if (error) return { data: null, error };

  // Write audit log
  await supabase.from('staff_transfer_log').insert({
    school_id: schoolId,
    school_user_id: schoolUserId,
    action: update.employment_status.toUpperCase(),
    performed_by: performedBy,
    old_values: current,
    new_values: data,
    notes: reason,
  });

  return { data, error: null };
}

/**
 * Reinstate a previously inactive staff member.
 */
export async function reinstateStaff(
  schoolUserId: string,
  schoolId: string,
  performedBy: string
) {
  return updateStaffLifecycle(
    schoolUserId,
    schoolId,
    { employment_status: 'active', archived: false },
    performedBy,
    'Staff reinstated'
  );
}

/**
 * Transfer a staff member (removes access from current school, preserves all historical data).
 */
export async function initiateTransfer(
  schoolUserId: string,
  schoolId: string,
  performedBy: string,
  destination?: string
) {
  return updateStaffLifecycle(
    schoolUserId,
    schoolId,
    {
      employment_status: 'transferred',
      transfer_status: destination || 'pending',
      archived: true,
    },
    performedBy,
    `Transfer initiated${destination ? ` to ${destination}` : ''}`
  );
}

/**
 * Retire a staff member — preserves all records, removes login access.
 */
export async function retireStaff(
  schoolUserId: string,
  schoolId: string,
  performedBy: string,
  replacementUserId?: string
) {
  const update: StaffLifecycleUpdate = {
    employment_status: 'retired',
    archived: true,
  };
  if (replacementUserId) update.replacement_user_id = replacementUserId;
  return updateStaffLifecycle(schoolUserId, schoolId, update, performedBy, 'Staff retired');
}

/**
 * Suspend a staff member temporarily.
 */
export async function suspendStaff(
  schoolUserId: string,
  schoolId: string,
  performedBy: string,
  reason: string
) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('school_users')
    .update({ is_active: false, employment_status: 'suspended', notes: reason })
    .eq('id', schoolUserId)
    .select()
    .single();

  if (!error) {
    await supabase.from('staff_transfer_log').insert({
      school_id: schoolId,
      school_user_id: schoolUserId,
      action: 'SUSPENDED',
      performed_by: performedBy,
      new_values: data,
      notes: reason,
    });
  }
  return { data, error };
}

/**
 * Get the staff transfer/lifecycle log for a school or specific staff member.
 */
export async function getStaffAuditLog(schoolId: string, schoolUserId?: string) {
  const supabase = getSupabaseClient();
  let query = supabase
    .from('staff_transfer_log')
    .select(`
      *,
      school_users!school_user_id(
        role, employee_id,
        user_profiles(username, email)
      ),
      user_profiles!performed_by(username, email)
    `)
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false });

  if (schoolUserId) {
    query = query.eq('school_user_id', schoolUserId);
  }

  return query.limit(50);
}

/**
 * Get all staff with their lifecycle status for the admin view.
 */
export async function getAllStaffWithLifecycle(schoolId: string) {
  const supabase = getSupabaseClient();
  return supabase
    .from('school_users')
    .select(`
      *,
      user_profiles(id, username, email)
    `)
    .eq('school_id', schoolId)
    .neq('role', 'student')
    .order('employment_status')
    .order('created_at', { ascending: false });
}

/**
 * Check if a school has at least one active admin.
 * Used to prevent orphaning a school.
 */
export async function getActiveAdminCount(schoolId: string): Promise<number> {
  const supabase = getSupabaseClient();
  const { count } = await supabase
    .from('school_users')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId)
    .eq('role', 'admin')
    .eq('is_active', true);
  return count || 0;
}
