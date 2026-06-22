// EduManage — Audit log service
//
// All sensitive actions in the app call `logAuditEvent` to record what
// happened, who did it, and from where. The `rate_limit_log` table is
// backed here as well via `isRateLimited` and `recordRateLimitedAction` —
// these are the database-backed variants of `lib/rateLimiter.ts` and are
// authoritative (client rate limits can be bypassed by an attacker, DB
// limits cannot).

import { getSupabaseClient } from '@/template';
import { AuditSeverity, ServiceResult } from '@/lib/types';

// ─── Audit actions ───────────────────────────────────────────────────────────

export type AuditAction =
  | 'auth.login.success'
  | 'auth.login.failed'
  | 'auth.logout'
  | 'auth.password_reset.request'
  | 'auth.password_reset.complete'
  | 'auth.email_verification_sent'
  | 'auth.email_verified'
  | 'auth.mfa.enabled'
  | 'auth.mfa.disabled'
  | 'auth.account.locked'
  | 'auth.account.unlocked'
  | 'user.invited'
  | 'user.invitation.accepted'
  | 'user.invitation.revoked'
  | 'user.role.changed'
  | 'user.activated'
  | 'user.deactivated'
  | 'user.profile.updated'
  | 'school.created'
  | 'school.updated'
  | 'school.suspended'
  | 'school.activated'
  | 'subscription.plan_changed'
  | 'subscription.canceled'
  | 'subscription.trial_started'
  | 'domain.added'
  | 'domain.verified'
  | 'domain.removed'
  | 'domain.primary_changed'
  | 'student.admitted'
  | 'student.updated'
  | 'student.transferred'
  | 'student.suspended'
  | 'student.terminated'
  | 'finance.invoice_created'
  | 'finance.payment_recorded'
  | 'finance.scholarship_awarded'
  | 'finance.fine_issued'
  | 'lms.assignment_created'
  | 'lms.submission_graded'
  | 'ai.request'
  | 'ai.usage_limit_exceeded'
  | 'push_notification_sent'
  | 'sms_sent'
  | 'email_sent'
  | 'data.export'
  | 'data.delete'
  | 'settings.updated';

export interface LogAuditParams {
  schoolId?: string | null;
  userId?: string | null;
  action: AuditAction | string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  severity?: AuditSeverity;
}

/**
 * Append a row to the partitioned `audit_logs` table. The RLS policy
 * `audit_logs_insert` allows any authenticated user to insert, so this
 * works for both admin and non-admin callers.
 */
export async function logAuditEvent(
  params: LogAuditParams,
): Promise<ServiceResult<{ inserted: boolean }>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('audit_logs').insert({
    school_id: params.schoolId ?? null,
    user_id: params.userId ?? null,
    action: params.action,
    resource_type: params.resourceType ?? null,
    resource_id: params.resourceId ?? null,
    details: params.details ?? {},
    ip_address: params.ipAddress ?? null,
    user_agent: params.userAgent ?? null,
    severity: params.severity ?? 'info',
  });
  if (error) return { data: null, error: error.message };
  return { data: { inserted: true }, error: null };
}

// ─── DB-backed rate limiting ─────────────────────────────────────────────────

export interface IsRateLimitedParams {
  identifier: string;
  action: string;
  maxCount: number;
  windowSeconds: number;
}

/**
 * Check whether the (identifier, action) pair has exceeded `maxCount` hits in
 * the last `windowSeconds` seconds. Reads from `rate_limit_log`. RLS denies
 * all client access to this table (`rate_limit_deny_all` policy), so this
 * function will fail with a permission error when called from the client.
 *
 * Use this from edge functions or server-side code where the service-role
 * key is available. For client-side rate limiting use `lib/rateLimiter.ts`.
 */
export async function isRateLimited(
  supabaseClient: ReturnType<typeof getSupabaseClient>,
  params: IsRateLimitedParams,
): Promise<ServiceResult<{ limited: boolean; count: number }>> {
  const since = new Date(Date.now() - params.windowSeconds * 1000).toISOString();
  const { count, error } = await supabaseClient
    .from('rate_limit_log')
    .select('id', { count: 'exact', head: true })
    .eq('identifier', params.identifier)
    .eq('action', params.action)
    .gte('created_at', since);
  if (error) return { data: null, error: error.message };
  const c = count ?? 0;
  return { data: { limited: c >= params.maxCount, count: c }, error: null };
}

/**
 * Record a hit in the `rate_limit_log` table. Like {@link isRateLimited},
 * this requires service-role credentials — RLS denies client access.
 */
export async function recordRateLimitedAction(
  supabaseClient: ReturnType<typeof getSupabaseClient>,
  params: { identifier: string; action: string },
): Promise<ServiceResult<{ inserted: boolean }>> {
  const { error } = await supabaseClient.from('rate_limit_log').insert({
    identifier: params.identifier,
    action: params.action,
  });
  if (error) return { data: null, error: error.message };
  return { data: { inserted: true }, error: null };
}

// ─── Query helpers ───────────────────────────────────────────────────────────

export interface ListAuditLogsOpts {
  action?: string;
  severity?: AuditSeverity;
  resourceType?: string;
  resourceId?: string;
  limit?: number;
  offset?: number;
  startDate?: string;
  endDate?: string;
}

/**
 * List audit log entries for a school, newest first. Requires admin role
 * (RLS policy `audit_logs_select` only exposes rows for school admins /
 * ICT / platform admins / rows owned by the calling user).
 */
export async function listAuditLogs(
  schoolId: string,
  opts: ListAuditLogsOpts = {},
): Promise<ServiceResult<any[]>> {
  const supabase = getSupabaseClient();
  let query = supabase
    .from('audit_logs')
    .select('*')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false });
  if (opts.action) query = query.eq('action', opts.action);
  if (opts.severity) query = query.eq('severity', opts.severity);
  if (opts.resourceType) query = query.eq('resource_type', opts.resourceType);
  if (opts.resourceId) query = query.eq('resource_id', opts.resourceId);
  if (opts.startDate) query = query.gte('created_at', opts.startDate);
  if (opts.endDate) query = query.lte('created_at', opts.endDate);
  query = query.limit(opts.limit ?? 100).range(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 100) - 1);
  const { data, error } = await query;
  if (error) return { data: null, error: error.message };
  return { data: data ?? [], error: null };
}
