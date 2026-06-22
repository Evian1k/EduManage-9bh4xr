// EduManage seed-demo edge function (platform-admin tenant onboarding)
//
// Provisions a new tenant: creates a school, an owner auth user + profile,
// links the owner to the school via school_users (role = school_owner),
// creates a default 'trialing'/'starter' subscription, and writes an
// audit_logs entry.
//
// Authentication: requires a valid Bearer JWT belonging to a platform_admin
// (verified via the `is_platform_admin()` RPC). Any other caller is rejected.
//
// Request body:
//   {
//     "name":               string   (school display name)
//     "slug":               string   (URL-safe slug, unique)
//     "subdomain":          string   (subdomain, unique)
//     "country":            string?
//     "county":             string?
//     "city":               string?
//     "address":            string?
//     "phone":              string?
//     "email":              string?  (school contact email)
//     "website":            string?
//     "motto":              string?
//     "primary_color":      string?  (hex, default #0B1426)
//     "accent_color":       string?  (hex, default #FFD700)
//     "owner_email":        string   (owner login email)
//     "owner_password":     string   (>= 8 chars)
//     "owner_full_name":    string
//     "owner_phone":        string?
//     "plan_tier":          "starter" | "professional" | "enterprise"? (default starter)
//     "trial_days":         number?  (default 14)
//   }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import {
  authenticate,
  errorResponse,
  getSupabaseAdmin,
  jsonResponse,
} from '../_shared/middleware.ts';

const ALLOWED_PLANS = new Set(['starter', 'professional', 'enterprise']);

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidHex(color: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color);
}

interface OnboardBody {
  name?: string;
  slug?: string;
  subdomain?: string;
  country?: string;
  county?: string;
  city?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  motto?: string;
  primary_color?: string;
  accent_color?: string;
  owner_email?: string;
  owner_password?: string;
  owner_full_name?: string;
  owner_phone?: string;
  plan_tier?: string;
  trial_days?: number;
}

async function requirePlatformAdmin(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  authUserId: string,
): Promise<boolean> {
  // The `is_platform_admin()` RPC reads auth.uid() server-side, so the
  // service-role call may return null. We fall back to a direct lookup
  // against school_users via the user_profiles.id (resolved separately).
  let rpcResult: boolean | null = null;
  try {
    const { data, error } = await supabase.rpc('is_platform_admin');
    if (!error) rpcResult = Boolean(data);
  } catch {
    rpcResult = null;
  }
  if (rpcResult !== null) return rpcResult;

  // Fallback: look up the user_profile by auth_user_id, then check
  // school_users for a platform_admin row.
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  if (!profile?.id) return false;
  const { data: fallback } = await supabase
    .from('school_users')
    .select('id')
    .eq('user_id', profile.id)
    .eq('role', 'platform_admin')
    .eq('is_active', true)
    .maybeSingle();
  return !!fallback;
}

// Resolve the caller's user_profile.id from their auth_user_id.
async function resolveProfileId(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  authUserId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  return data?.id ?? null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed. Use POST.', 405);
  }

  const supabase = getSupabaseAdmin();

  // 1. Authenticate
  const auth = await authenticate(req, supabase);
  if (auth.error || !auth.user || !auth.profile) {
    return errorResponse(auth.error ?? 'Unauthorized', auth.status ?? 401);
  }

  // 2. Authorise: platform_admin only
  const isPlatformAdmin = await requirePlatformAdmin(supabase, auth.user.id);
  if (!isPlatformAdmin) {
    return errorResponse(
      'Forbidden. Only platform administrators may onboard new tenants.',
      403,
    );
  }

  const callerProfileId = await resolveProfileId(supabase, auth.user.id);

  // 3. Parse + validate body
  let body: OnboardBody;
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  const {
    name,
    slug,
    subdomain,
    country,
    county,
    city,
    address,
    phone,
    email,
    website,
    motto,
    primary_color,
    accent_color,
    owner_email,
    owner_password,
    owner_full_name,
    owner_phone,
    plan_tier,
    trial_days,
  } = body ?? {};

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return errorResponse('name is required (min 2 chars)', 400);
  }
  const finalSlug = slugify(slug ?? name);
  if (!finalSlug) {
    return errorResponse('slug must produce a non-empty URL-safe string', 400);
  }
  const finalSubdomain = slugify(subdomain ?? finalSlug);
  if (!finalSubdomain) {
    return errorResponse('subdomain must produce a non-empty URL-safe string', 400);
  }
  if (!owner_email || !isValidEmail(owner_email)) {
    return errorResponse('owner_email must be a valid email', 400);
  }
  if (!owner_password || owner_password.length < 8) {
    return errorResponse('owner_password must be at least 8 characters', 400);
  }
  if (!owner_full_name || owner_full_name.trim().length < 2) {
    return errorResponse('owner_full_name is required', 400);
  }
  const finalPlan = ALLOWED_PLANS.has(plan_tier ?? '') ? plan_tier! : 'starter';
  const trialDays = Math.min(Math.max(Number(trial_days) || 14, 1), 90);
  if (primary_color && !isValidHex(primary_color)) {
    return errorResponse('primary_color must be a valid hex color (e.g. #0B1426)', 400);
  }
  if (accent_color && !isValidHex(accent_color)) {
    return errorResponse('accent_color must be a valid hex color (e.g. #FFD700)', 400);
  }

  // 4. Uniqueness checks (slug / subdomain / owner_email)
  const { data: existingSchool } = await supabase
    .from('schools')
    .select('id, slug, subdomain')
    .or(`slug.eq.${finalSlug},subdomain.eq.${finalSubdomain}`)
    .maybeSingle();
  if (existingSchool) {
    return errorResponse(
      `A school already exists with slug "${finalSlug}" or subdomain "${finalSubdomain}".`,
      409,
    );
  }
  const { data: existingOwner } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('email', owner_email.toLowerCase())
    .maybeSingle();
  if (existingOwner) {
    return errorResponse(
      `An account already exists for ${owner_email}. Use a different email or invite the existing user.`,
      409,
    );
  }

  // 5. Fetch the default plan limits so we can mirror them onto the school row.
  const { data: planRow } = await supabase
    .from('subscription_plans')
    .select('max_students, max_staff, max_storage_mb, ai_usage_limit')
    .eq('tier', finalPlan)
    .maybeSingle();

  const trialEndsAt = new Date(Date.now() + trialDays * 86400_000).toISOString();

  // 6. Create the school
  const { data: school, error: schoolErr } = await supabase
    .from('schools')
    .insert({
      name: name.trim(),
      slug: finalSlug,
      subdomain: finalSubdomain,
      country: country ?? null,
      county: county ?? null,
      city: city ?? null,
      address: address ?? null,
      phone: phone ?? null,
      email: email ?? null,
      website: website ?? null,
      motto: motto ?? null,
      primary_color: primary_color ?? '#0B1426',
      accent_color: accent_color ?? '#FFD700',
      status: 'active',
      plan_status: 'trialing',
      plan_tier: finalPlan,
      trial_ends_at: trialEndsAt,
      plan_renews_at: trialEndsAt,
      max_students: planRow?.max_students ?? 500,
      max_staff: planRow?.max_staff ?? 50,
      max_storage_mb: planRow?.max_storage_mb ?? 1024,
      ai_usage_limit: planRow?.ai_usage_limit ?? 1000,
      ai_usage_count: 0,
    })
    .select()
    .single();
  if (schoolErr || !school) {
    console.error('seed-demo: school insert failed:', schoolErr?.message);
    return errorResponse(
      `Failed to create school: ${schoolErr?.message ?? 'unknown'}`,
      500,
    );
  }

  // 7. Create the owner auth user
  const { data: ownerAuth, error: ownerAuthErr } = await supabase.auth.admin.createUser({
    email: owner_email.toLowerCase(),
    password: owner_password,
    email_confirm: true,
    user_metadata: {
      full_name: owner_full_name,
      phone: owner_phone ?? null,
      default_school_id: school.id,
    },
  });
  if (ownerAuthErr || !ownerAuth.user) {
    // Roll back school creation
    await supabase.from('schools').delete().eq('id', school.id);
    console.error('seed-demo: owner create failed:', ownerAuthErr?.message);
    return errorResponse(
      `Failed to create owner account: ${ownerAuthErr?.message ?? 'unknown'}`,
      500,
    );
  }
  const ownerAuthId = ownerAuth.user.id;

  // 8. Upsert owner user_profile
  const { data: ownerProfile, error: profileErr } = await supabase
    .from('user_profiles')
    .upsert(
      {
        auth_user_id: ownerAuthId,
        email: owner_email.toLowerCase(),
        full_name: owner_full_name,
        phone: owner_phone ?? null,
        default_school_id: school.id,
        email_verified: true,
        status: 'active',
        last_login_at: null,
      },
      { onConflict: 'auth_user_id' },
    )
    .select()
    .single();
  if (profileErr || !ownerProfile) {
    // Roll back
    await supabase.auth.admin.deleteUser(ownerAuthId);
    await supabase.from('schools').delete().eq('id', school.id);
    console.error('seed-demo: owner profile insert failed:', profileErr?.message);
    return errorResponse(
      `Failed to create owner profile: ${profileErr?.message ?? 'unknown'}`,
      500,
    );
  }

  // 9. Link owner to school as school_owner
  const { error: linkErr } = await supabase
    .from('school_users')
    .upsert(
      {
        school_id: school.id,
        user_id: ownerProfile.id,
        role: 'school_owner',
        is_active: true,
        invited_by: callerProfileId ?? null,
      },
      { onConflict: 'school_id,user_id' },
    );
  if (linkErr) {
    console.error('seed-demo: school_users link failed:', linkErr.message);
    // Non-fatal: the owner can still log in, but they won't see the school.
    // We don't roll back; instead we surface a warning in the response.
  }

  // 10. Create default subscription
  const { error: subErr } = await supabase.from('subscriptions').insert({
    school_id: school.id,
    plan_tier: finalPlan,
    status: 'trialing',
    current_period_start: new Date().toISOString(),
    current_period_end: trialEndsAt,
    trial_ends_at: trialEndsAt,
    payment_provider: null,
    provider_customer_id: null,
    provider_subscription_id: null,
    amount_usd: 0,
    currency: 'USD',
    metadata: { source: 'seed-demo', onboarded_by: callerProfileId ?? null },
  });
  if (subErr) {
    console.error('seed-demo: subscription insert failed:', subErr.message);
  }

  // 11. Audit log
  const { error: auditErr } = await supabase.from('audit_logs').insert({
    school_id: school.id,
    user_id: callerProfileId ?? ownerProfile.id,
    action: 'tenant_onboarded',
    resource_type: 'school',
    resource_id: school.id,
    severity: 'info',
    details: {
      school_name: school.name,
      slug: finalSlug,
      subdomain: finalSubdomain,
      plan_tier: finalPlan,
      trial_ends_at: trialEndsAt,
      owner_email: owner_email.toLowerCase(),
      owner_profile_id: ownerProfile.id,
      onboarded_by: callerProfileId ?? null,
    },
  });
  if (auditErr) {
    console.error('seed-demo: audit log insert failed:', auditErr.message);
  }

  return jsonResponse({
    ok: true,
    school: {
      id: school.id,
      name: school.name,
      slug: school.slug,
      subdomain: school.subdomain,
      plan_tier: school.plan_tier,
      plan_status: school.plan_status,
      trial_ends_at: school.trial_ends_at,
    },
    owner: {
      auth_user_id: ownerAuthId,
      profile_id: ownerProfile.id,
      email: ownerProfile.email,
      full_name: ownerProfile.full_name,
      role: 'school_owner',
    },
    subscription: {
      plan_tier: finalPlan,
      status: 'trialing',
      trial_ends_at: trialEndsAt,
    },
    warnings: linkErr ? ['school_users link failed; owner will need to be linked manually.'] : [],
  }, 201);
});
