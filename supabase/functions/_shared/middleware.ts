// Shared middleware for EduManage edge functions.
//
// Provides:
//   - getSupabaseAdmin()  — service-role Supabase client (bypasses RLS).
//   - authenticate(req, supabase) — verifies the Bearer JWT and loads the user_profile row.
//   - verifyTenant(supabase, profileId, schoolId) — checks school_users membership; logs cross-tenant attempts.
//   - isRateLimited(supabase, cfg) / recordRateLimit(supabase, cfg) — sliding-window rate limiting via rate_limit_log.
//   - jsonResponse(data, status) / errorResponse(error, status) — JSON helpers with CORS headers.
//
// All functions assume the `public.rate_limit_log`, `public.user_profiles`,
// `public.school_users`, and `public.audit_logs` tables exist (see migrations).

import {
  createClient,
  type SupabaseClient,
} from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from './cors.ts';

export { corsHeaders };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal shape of a Supabase auth user (avoids importing the full User type). */
export interface AuthUser {
  id: string;
  email?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
  aud?: string;
  created_at?: string;
  [key: string]: unknown;
}

export interface UserProfile {
  id: string;
  auth_user_id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  default_school_id: string | null;
  status: string | null;
  metadata: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface SchoolUser {
  id: string;
  school_id: string;
  user_id: string;
  role: string;
  is_active: boolean;
  [key: string]: unknown;
}

export interface AuthResult {
  user: AuthUser | null;
  profile: UserProfile | null;
  error?: string;
  status?: number;
}

export interface TenantResult {
  ok: boolean;
  schoolUser?: SchoolUser;
  error?: string;
  status?: number;
}

export interface RateLimitConfig {
  /** Stable identifier (user id, IP, phone, ...). */
  identifier: string;
  /** Logical action being rate limited (e.g. "ai:chat"). */
  action: string;
  /** Maximum requests permitted inside the window. */
  maxRequests: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

// ---------------------------------------------------------------------------
// Supabase admin client (service role — bypasses RLS)
// ---------------------------------------------------------------------------

let cachedAdmin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cachedAdmin) return cachedAdmin;
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env var');
  }
  cachedAdmin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedAdmin;
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

/**
 * Verifies the `Authorization: Bearer <jwt>` header and loads the matching
 * `user_profiles` row (joined by `auth_user_id`).
 *
 * Returns `{ user, profile }` on success, or `{ error, status }` on failure.
 */
export async function authenticate(
  req: Request,
  supabase: SupabaseClient,
): Promise<AuthResult> {
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return {
      user: null,
      profile: null,
      error: 'Missing or malformed Authorization header. Expected: Bearer <jwt>',
      status: 401,
    };
  }
  const token = authHeader.slice(7).trim();
  if (!token) {
    return { user: null, profile: null, error: 'Empty bearer token', status: 401 };
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return {
      user: null,
      profile: null,
      error: error?.message ?? 'Invalid or expired token',
      status: 401,
    };
  }

  // Load profile row (admin client bypasses RLS).
  const { data: profile, error: profileErr } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('auth_user_id', data.user.id)
    .maybeSingle();

  if (profileErr) {
    console.error('authenticate: profile lookup failed:', profileErr.message);
    return {
      user: data.user,
      profile: null,
      error: 'Failed to load user profile',
      status: 500,
    };
  }
  if (!profile) {
    return {
      user: data.user,
      profile: null,
      error: 'User profile not found. Please contact an administrator.',
      status: 403,
    };
  }
  if (profile.status && profile.status !== 'active') {
    return {
      user: data.user,
      profile,
      error: `Account is ${profile.status}. Contact your administrator.`,
      status: 403,
    };
  }

  return { user: data.user, profile: profile as UserProfile };
}

// ---------------------------------------------------------------------------
// Tenant verification
// ---------------------------------------------------------------------------

/**
 * Confirms that `profileId` is an active member of `schoolId` via the
 * `school_users` table. On failure, logs a `cross_tenant_attempt` audit
 * entry (severity: warning) so platform admins can detect probing.
 */
export async function verifyTenant(
  supabase: SupabaseClient,
  profileId: string,
  schoolId: string,
): Promise<TenantResult> {
  if (!profileId || !schoolId) {
    return { ok: false, error: 'profileId and schoolId are required', status: 400 };
  }

  const { data: schoolUser, error } = await supabase
    .from('school_users')
    .select('*')
    .eq('school_id', schoolId)
    .eq('user_id', profileId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('verifyTenant: query failed:', error.message);
    return {
      ok: false,
      error: 'Unable to verify tenant membership',
      status: 500,
    };
  }

  if (!schoolUser) {
    // Log the cross-tenant attempt. Best-effort — never blocks the response.
    const { error: logErr } = await supabase.from('audit_logs').insert({
      user_id: profileId,
      school_id: schoolId,
      action: 'cross_tenant_attempt',
      resource_type: 'school',
      resource_id: schoolId,
      severity: 'warning',
      details: { reason: 'not_member_or_inactive' },
    });
    if (logErr) {
      console.error('verifyTenant: failed to log attempt:', logErr.message);
    }
    return {
      ok: false,
      error: 'Access denied: you are not a member of this school.',
      status: 403,
    };
  }

  return { ok: true, schoolUser: schoolUser as SchoolUser };
}

/**
 * Convenience: returns true if the profile has one of the admin roles for
 * the given school. Requires a prior `verifyTenant` result.
 */
export function isAdminRole(schoolUser: SchoolUser | undefined): boolean {
  if (!schoolUser) return false;
  return [
    'school_owner',
    'principal',
    'deputy_principal',
    'administrator',
    'ict_manager',
    'bursar',
  ].includes(schoolUser.role);
}

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

/**
 * Returns true when the identifier has hit `maxRequests` within the trailing
 * `windowMs` window. Fails open (returns false) when the lookup errors so
 * we never block legitimate traffic due to an infra hiccup.
 */
export async function isRateLimited(
  supabase: SupabaseClient,
  cfg: RateLimitConfig,
): Promise<boolean> {
  const since = new Date(Date.now() - cfg.windowMs).toISOString();
  const { count, error } = await supabase
    .from('rate_limit_log')
    .select('id', { count: 'exact', head: true })
    .eq('identifier', cfg.identifier)
    .eq('action', cfg.action)
    .gte('created_at', since);
  if (error) {
    console.error('isRateLimited: query failed:', error.message);
    return false;
  }
  return (count ?? 0) >= cfg.maxRequests;
}

/** Inserts a rate_limit_log row. Best-effort — logs but never throws. */
export async function recordRateLimit(
  supabase: SupabaseClient,
  cfg: RateLimitConfig,
): Promise<void> {
  const { error } = await supabase.from('rate_limit_log').insert({
    identifier: cfg.identifier,
    action: cfg.action,
  });
  if (error) {
    console.error('recordRateLimit: insert failed:', error.message);
  }
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function errorResponse(
  error: string | { error: string } | { message: string },
  status = 400,
): Response {
  const message =
    typeof error === 'string'
      ? error
      : 'error' in error
        ? error.error
        : error.message;
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ---------------------------------------------------------------------------
// Misc helpers
// ---------------------------------------------------------------------------

/** Returns the request IP from common proxy headers or an empty string. */
export function getRequestIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    ''
  );
}

export function getUserAgent(req: Request): string {
  return req.headers.get('user-agent') ?? '';
}

/** Validates a UUID v4 string. */
export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
