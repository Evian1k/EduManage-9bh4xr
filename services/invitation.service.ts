// EduManage — Staff invitation service
//
// Admins invite staff by email. The flow:
//   1. sendInvitation → inserts a row with a random token + 7-day expiry
//   2. Email is dispatched (via the email service) containing a deep link
//   3. getInvitationByToken (public, no schoolId required — the token IS the auth)
//   4. acceptInvitation → creates auth user + profile + school_users row,
//      marks invitation accepted, writes audit log

import { getSupabaseClient } from '@/template';
import { ServiceResult, UserRole } from '@/lib/types';
import { logAuditEvent } from './audit.service';

/**
 * All staff roles that can be invited. Mirrors the `user_role` Postgres enum
 * minus `student`/`parent`/`platform_admin` (those are admitted/linked, not
 * invited via this flow).
 */
export const ALL_STAFF_ROLES: UserRole[] = [
  'school_owner',
  'principal',
  'deputy_principal',
  'administrator',
  'teacher',
  'secretary',
  'bursar',
  'librarian',
  'nurse',
  'ict_manager',
  'driver',
  'groundskeeper',
  'counselor',
  'boarding_master',
  'boarding_mistress',
];

const INVITATION_EXPIRY_DAYS = 7;

function generateToken(): string {
  // 32 bytes of randomness → 64 hex chars. Sufficient entropy for an
  // unguessable single-use invitation link.
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback (should never trigger in RN/browser)
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export interface SendInvitationInput {
  schoolId: string;
  email: string;
  role: UserRole;
  invitedBy: string; // profile id of the inviter
  metadata?: Record<string, unknown>;
}

export interface SchoolInvitationRow {
  id: string;
  school_id: string;
  email: string;
  role: UserRole;
  token: string;
  invited_by: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expires_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

/**
 * Create a new pending invitation. If an invitation already exists for the
 * same (email, school) pair, we issue a fresh token and re-arm the expiry.
 */
export async function sendInvitation(
  input: SendInvitationInput,
): Promise<ServiceResult<SchoolInvitationRow>> {
  const supabase = getSupabaseClient();
  if (!ALL_STAFF_ROLES.includes(input.role)) {
    return { data: null, error: `Role ${input.role} is not invitable` };
  }
  const email = input.email.toLowerCase().trim();
  const expiresAt = new Date(
    Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const token = generateToken();

  // Look for existing pending invitation to overwrite
  const { data: existing } = await supabase
    .from('school_invitations')
    .select('id')
    .eq('school_id', input.schoolId)
    .eq('email', email)
    .eq('status', 'pending')
    .maybeSingle();

  const payload = {
    school_id: input.schoolId,
    email,
    role: input.role,
    token,
    invited_by: input.invitedBy,
    status: 'pending' as const,
    expires_at: expiresAt,
    metadata: input.metadata ?? {},
  };

  let data: SchoolInvitationRow | null = null;
  let error: string | null = null;

  if (existing?.id) {
    const { data: updated, error: updErr } = await supabase
      .from('school_invitations')
      .update(payload)
      .eq('id', existing.id)
      .select('*')
      .single();
    data = updated as unknown as SchoolInvitationRow;
    error = updErr?.message ?? null;
  } else {
    const { data: inserted, error: insErr } = await supabase
      .from('school_invitations')
      .insert(payload)
      .select('*')
      .single();
    data = inserted as unknown as SchoolInvitationRow;
    error = insErr?.message ?? null;
  }

  if (error) return { data: null, error };
  if (!data) return { data: null, error: 'Failed to create invitation' };

  await logAuditEvent({
    schoolId: input.schoolId,
    userId: input.invitedBy,
    action: 'user.invited',
    resourceType: 'invitation',
    resourceId: data.id,
    details: { email, role: input.role },
    severity: 'info',
  });

  return { data, error: null };
}

/**
 * Public lookup by token — used by the accept-invitation landing screen.
 * No schoolId required: the token itself authenticates the request.
 */
export async function getInvitationByToken(
  token: string,
): Promise<ServiceResult<SchoolInvitationRow & { schools: { name: string; subdomain: string } }>> {
  const supabase = getSupabaseClient();
  if (!token) return { data: null, error: 'Token is required' };
  const { data, error } = await supabase
    .from('school_invitations')
    .select('*, schools(name, subdomain)')
    .eq('token', token)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: 'Invitation not found' };
  const row = data as SchoolInvitationRow & { schools: { name: string; subdomain: string } };
  if (row.status !== 'pending') {
    return { data: null, error: `Invitation is ${row.status}` };
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    // mark expired
    await supabase
      .from('school_invitations')
      .update({ status: 'expired' })
      .eq('id', row.id);
    return { data: null, error: 'Invitation has expired' };
  }
  return { data: row, error: null };
}

/**
 * List all pending invitations for a school, newest first.
 */
export async function listPendingInvitations(
  schoolId: string,
): Promise<ServiceResult<SchoolInvitationRow[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('school_invitations')
    .select('*')
    .eq('school_id', schoolId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as SchoolInvitationRow[], error: null };
}

/**
 * Revoke (cancel) a pending invitation.
 */
export async function revokeInvitation(
  schoolId: string,
  invitationId: string,
  revokedBy: string,
): Promise<ServiceResult<{ revoked: boolean }>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('school_invitations')
    .update({ status: 'revoked' })
    .eq('id', invitationId)
    .eq('school_id', schoolId)
    .eq('status', 'pending')
    .select('id')
    .single();
  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: 'Invitation not found or already processed' };

  await logAuditEvent({
    schoolId,
    userId: revokedBy,
    action: 'user.invitation.revoked',
    resourceType: 'invitation',
    resourceId: invitationId,
    severity: 'warning',
  });

  return { data: { revoked: true }, error: null };
}

export interface AcceptInvitationInput {
  token: string;
  fullName: string;
  password: string;
  phone?: string;
}

/**
 * Accept an invitation: creates an auth user + profile + school_users row,
 * marks the invitation as accepted, and writes an audit entry.
 *
 * The school is derived from the invitation — the caller never passes a
 * schoolId, so this function bypasses the usual "schoolId first" convention.
 */
export async function acceptInvitation(
  input: AcceptInvitationInput,
): Promise<
  ServiceResult<{
    schoolId: string;
    profileId: string;
    authUserId: string;
    role: UserRole;
  }>
> {
  const supabase = getSupabaseClient();

  // 1. Validate token
  const inviteRes = await getInvitationByToken(input.token);
  if (inviteRes.error || !inviteRes.data) {
    return { data: null, error: inviteRes.error ?? 'Invitation not found' };
  }
  const invite = inviteRes.data;
  const email = invite.email;

  // 2. Create auth user
  const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: { data: { full_name: input.fullName, phone: input.phone } },
  });
  if (signUpErr) return { data: null, error: signUpErr.message };
  if (!signUpData.user) return { data: null, error: 'Failed to create user account' };
  const authUserId = signUpData.user.id;

  // 3. Insert user_profiles
  const { data: profile, error: profileErr } = await supabase
    .from('user_profiles')
    .insert({
      auth_user_id: authUserId,
      email,
      full_name: input.fullName,
      phone: input.phone ?? null,
      email_verified: false,
      status: 'active',
    })
    .select('id')
    .single();
  if (profileErr) return { data: null, error: `Profile creation failed: ${profileErr.message}` };
  const profileId = profile.id as string;

  // 4. Insert school_users
  const { error: suErr } = await supabase.from('school_users').insert({
    school_id: invite.school_id,
    user_id: profileId,
    role: invite.role,
    is_active: true,
    invited_by: invite.invited_by,
    joined_at: new Date().toISOString(),
  });
  if (suErr) return { data: null, error: `Staff assignment failed: ${suErr.message}` };

  // 5. Mark invitation accepted
  const { error: updErr } = await supabase
    .from('school_invitations')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      accepted_by: profileId,
    })
    .eq('id', invite.id);
  if (updErr) console.warn('[invitation] accept mark failed:', updErr.message);

  // 6. Audit log
  await logAuditEvent({
    schoolId: invite.school_id,
    userId: profileId,
    action: 'user.invitation.accepted',
    resourceType: 'invitation',
    resourceId: invite.id,
    details: { email, role: invite.role },
    severity: 'info',
  });

  return {
    data: { schoolId: invite.school_id, profileId, authUserId, role: invite.role },
    error: null,
  };
}
