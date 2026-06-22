// EduManage — Auth security service
//
// Wraps `auth.signInWithPassword` with account-lockout tracking, password
// reset (using Supabase's `resetPasswordForEmail`), email verification,
// MFA (TOTP) secret storage, and session-timeout policy.
//
// All state lives in the `user_profiles` table — `failed_login_count`,
// `locked_until`, `last_login_at`, `last_login_ip`,
// `last_device_fingerprint`, `mfa_enabled`, `mfa_secret`, `email_verified`.

import { getSupabaseClient } from '@/template';
import { ServiceResult } from '@/lib/types';
import { logAuditEvent } from './audit.service';

export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MINUTES = 15;
export const SESSION_TIMEOUT_REMEMBER_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const SESSION_TIMEOUT_DEFAULT_MS = 8 * 60 * 60 * 1000; // 8 hours

interface AuthSecurityResult<T = unknown> extends ServiceResult<T> {}

function errMsg(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return error instanceof Error ? error.message : String(error);
}

async function fetchProfileByEmail(email: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, auth_user_id, email, failed_login_count, locked_until, status, full_name')
    .eq('email', email.toLowerCase())
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function fetchProfileByAuthId(authUserId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, auth_user_id, email, full_name')
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Record a failed login attempt for the given email and bump the
 * `failed_login_count`. Locks the account when the count exceeds
 * {@link MAX_FAILED_LOGINS}.
 */
export async function recordFailedLogin(
  email: string,
  ip?: string,
): Promise<AuthSecurityResult<{ locked: boolean; attempts: number }>> {
  const supabase = getSupabaseClient();
  try {
    const profile = await fetchProfileByEmail(email);
    if (!profile) {
      // Don't leak whether the email exists — just record an audit entry.
      await logAuditEvent({
        action: 'auth.login.failed',
        details: { email, reason: 'no_such_user' },
        ipAddress: ip,
        severity: 'warning',
      });
      return { data: { locked: false, attempts: 0 }, error: null };
    }
    const nextCount = (profile.failed_login_count ?? 0) + 1;
    const shouldLock = nextCount >= MAX_FAILED_LOGINS;
    const lockedUntil = shouldLock
      ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString()
      : null;

    const { error } = await supabase
      .from('user_profiles')
      .update({
        failed_login_count: shouldLock ? 0 : nextCount,
        locked_until: lockedUntil,
      })
      .eq('id', profile.id);
    if (error) return { data: null, error: error.message };

    await logAuditEvent({
      userId: profile.id,
      action: shouldLock ? 'auth.account.locked' : 'auth.login.failed',
      details: { email, attempts: nextCount, locked: shouldLock },
      ipAddress: ip,
      severity: shouldLock ? 'critical' : 'warning',
    });

    return { data: { locked: shouldLock, attempts: shouldLock ? 0 : nextCount }, error: null };
  } catch (err) {
    return { data: null, error: errMsg(err) };
  }
}

/**
 * Record a successful login — reset the failed-attempt counter, update the
 * last-login metadata, and log the audit event.
 */
export async function recordSuccessfulLogin(
  profileId: string,
  ip?: string,
  fingerprint?: string,
  name?: string,
  platform?: string,
): Promise<AuthSecurityResult<{ recorded: boolean }>> {
  const supabase = getSupabaseClient();
  try {
    const { error } = await supabase
      .from('user_profiles')
      .update({
        failed_login_count: 0,
        locked_until: null,
        last_login_at: new Date().toISOString(),
        last_login_ip: ip ?? null,
        last_device_fingerprint: fingerprint ?? null,
      })
      .eq('id', profileId);
    if (error) return { data: null, error: error.message };

    // Upsert a device row (used for trusted-device tracking + push tokens)
    if (fingerprint) {
      await supabase.from('user_devices').upsert(
        {
          user_id: profileId,
          device_fingerprint: fingerprint,
          device_name: name ?? null,
          platform: platform ?? null,
          last_ip: ip ?? null,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,device_fingerprint' },
      );
    }

    await logAuditEvent({
      userId: profileId,
      action: 'auth.login.success',
      details: { ip, fingerprint, name, platform },
      ipAddress: ip,
      severity: 'info',
    });

    return { data: { recorded: true }, error: null };
  } catch (err) {
    return { data: null, error: errMsg(err) };
  }
}

/**
 * Check whether the account is currently locked. Returns true if the
 * `locked_until` timestamp is in the future.
 */
export async function isAccountLocked(
  email: string,
): Promise<AuthSecurityResult<{ locked: boolean; lockedUntil: string | null; remainingMs: number }>> {
  const supabase = getSupabaseClient();
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('locked_until')
      .eq('email', email.toLowerCase())
      .maybeSingle();
    if (error) return { data: null, error: error.message };
    if (!data) return { data: { locked: false, lockedUntil: null, remainingMs: 0 }, error: null };
    const until = data.locked_until ? new Date(data.locked_until).getTime() : 0;
    const now = Date.now();
    const locked = until > now;
    return {
      data: { locked, lockedUntil: data.locked_until ?? null, remainingMs: locked ? until - now : 0 },
      error: null,
    };
  } catch (err) {
    return { data: null, error: errMsg(err) };
  }
}

/**
 * Trigger a password reset email via Supabase Auth. The reset link redirects
 * the user back to the app where `completePasswordReset` is invoked after
 * they enter a new password.
 */
export async function requestPasswordReset(
  email: string,
  redirectTo?: string,
): Promise<AuthSecurityResult<{ sent: boolean }>> {
  const supabase = getSupabaseClient();
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase(), {
      redirectTo,
    });
    if (error) return { data: null, error: error.message };
    await logAuditEvent({
      action: 'auth.password_reset.request',
      details: { email },
      severity: 'warning',
    });
    return { data: { sent: true }, error: null };
  } catch (err) {
    return { data: null, error: errMsg(err) };
  }
}

/**
 * Complete a password reset by calling `auth.updateUser` (the user must have
 * arrived at this code from the reset-link redirect, so a session already
 * exists).
 */
export async function completePasswordReset(
  newPassword: string,
): Promise<AuthSecurityResult<{ updated: boolean }>> {
  const supabase = getSupabaseClient();
  try {
    const { data: userData, error } = await supabase.auth.getUser();
    if (error) return { data: null, error: error.message };
    const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
    if (updateErr) return { data: null, error: updateErr.message };
    const profile = userData.user ? await fetchProfileByAuthId(userData.user.id) : null;
    await logAuditEvent({
      userId: profile?.id,
      action: 'auth.password_reset.complete',
      severity: 'warning',
    });
    return { data: { updated: true }, error: null };
  } catch (err) {
    return { data: null, error: errMsg(err) };
  }
}

/**
 * Send an email verification OTP via Supabase. Used at signup or when the
 * user requests a fresh verification email.
 */
export async function sendEmailVerification(): Promise<AuthSecurityResult<{ sent: boolean }>> {
  const supabase = getSupabaseClient();
  try {
    const { data: userData, error } = await supabase.auth.getUser();
    if (error || !userData.user?.email) {
      return { data: null, error: error?.message ?? 'No authenticated user' };
    }
    const { error: sendErr } = await supabase.auth.signInWithOtp({
      email: userData.user.email,
      options: { shouldCreateUser: false },
    });
    if (sendErr) return { data: null, error: sendErr.message };
    await logAuditEvent({
      action: 'auth.email_verification_sent',
      severity: 'info',
    });
    return { data: { sent: true }, error: null };
  } catch (err) {
    return { data: null, error: errMsg(err) };
  }
}

/**
 * Mark a profile's email as verified. Called after a successful OTP
 * verification flow.
 */
export async function markEmailVerified(
  profileId: string,
): Promise<AuthSecurityResult<{ updated: boolean }>> {
  const supabase = getSupabaseClient();
  try {
    const { error } = await supabase
      .from('user_profiles')
      .update({ email_verified: true })
      .eq('id', profileId);
    if (error) return { data: null, error: error.message };
    await logAuditEvent({
      userId: profileId,
      action: 'auth.email_verified',
      severity: 'info',
    });
    return { data: { updated: true }, error: null };
  } catch (err) {
    return { data: null, error: errMsg(err) };
  }
}

/**
 * Enable MFA for a profile by storing the TOTP secret. The caller is
 * responsible for verifying that the user can produce a valid code from
 * the secret before enabling — see `lib/totp.ts#verifyTOTP`.
 */
export async function enableMfa(
  profileId: string,
  secret: string,
): Promise<AuthSecurityResult<{ enabled: boolean }>> {
  const supabase = getSupabaseClient();
  try {
    const { error } = await supabase
      .from('user_profiles')
      .update({ mfa_enabled: true, mfa_secret: secret })
      .eq('id', profileId);
    if (error) return { data: null, error: error.message };
    await logAuditEvent({
      userId: profileId,
      action: 'auth.mfa.enabled',
      severity: 'warning',
    });
    return { data: { enabled: true }, error: null };
  } catch (err) {
    return { data: null, error: errMsg(err) };
  }
}

/**
 * Disable MFA — clears the stored secret.
 */
export async function disableMfa(
  profileId: string,
): Promise<AuthSecurityResult<{ disabled: boolean }>> {
  const supabase = getSupabaseClient();
  try {
    const { error } = await supabase
      .from('user_profiles')
      .update({ mfa_enabled: false, mfa_secret: null })
      .eq('id', profileId);
    if (error) return { data: null, error: error.message };
    await logAuditEvent({
      userId: profileId,
      action: 'auth.mfa.disabled',
      severity: 'warning',
    });
    return { data: { disabled: true }, error: null };
  } catch (err) {
    return { data: null, error: errMsg(err) };
  }
}

/**
 * Return the session timeout in milliseconds for the given `rememberMe`
 * preference. Useful for setting the auth `autoRefreshToken` cadence or
 * for displaying a "your session will expire in…" countdown.
 */
export function getSessionTimeoutMs(rememberMe: boolean): number {
  return rememberMe ? SESSION_TIMEOUT_REMEMBER_MS : SESSION_TIMEOUT_DEFAULT_MS;
}

export interface SignInWithLockoutOpts {
  ip?: string;
  fingerprint?: string;
  deviceName?: string;
  platform?: string;
  rememberMe?: boolean;
}

/**
 * Sign-in helper that combines Supabase `signInWithPassword` with our
 * account-lockout bookkeeping. Returns the standard service result envelope
 * with the Supabase session user when successful.
 *
 * On a wrong-password error this calls {@link recordFailedLogin}; on success
 * it calls {@link recordSuccessfulLogin}.
 */
export async function signInWithLockout(
  email: string,
  password: string,
  opts: SignInWithLockoutOpts = {},
): Promise<
  AuthSecurityResult<{
    user: { id: string; email?: string } | null;
    profileId: string | null;
    locked: boolean;
  }>
> {
  const supabase = getSupabaseClient();

  // Pre-flight lock check
  const lockCheck = await isAccountLocked(email);
  if (lockCheck.error) return { data: null, error: lockCheck.error };
  if (lockCheck.data?.locked) {
    return {
      data: null,
      error: `Account locked. Try again in ${Math.ceil(lockCheck.data.remainingMs / 60_000)} minutes.`,
    };
  }

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: email.toLowerCase(),
    password,
  });

  if (authError || !authData?.user) {
    // Record failure against the email so we can lock after N attempts
    const failed = await recordFailedLogin(email, opts.ip);
    if (failed.error) {
      return { data: null, error: `${authError?.message ?? 'Sign in failed'}; ${failed.error}` };
    }
    if (failed.data?.locked) {
      return {
        data: null,
        error: `Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes.`,
      };
    }
    return { data: null, error: authError?.message ?? 'Invalid credentials' };
  }

  // Success — look up profile and record login metadata
  try {
    const profile = await fetchProfileByAuthId(authData.user.id);
    const profileId = profile?.id ?? null;
    if (profileId) {
      await recordSuccessfulLogin(
        profileId,
        opts.ip,
        opts.fingerprint,
        opts.deviceName,
        opts.platform,
      );
    }
    return {
      data: {
        user: { id: authData.user.id, email: authData.user.email ?? undefined },
        profileId,
        locked: false,
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: errMsg(err) };
  }
}
