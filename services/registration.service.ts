// EduManage — School registration service
//
// Owns the multi-step onboarding flow:
//   1. Create auth user (signUp with email + password)
//   2. Insert user_profiles row (linked to auth user)
//   3. Insert schools row (slug + subdomain derived from school name)
//   4. Insert school_users row (role = school_owner)
//   5. Insert subscriptions row (trial, expires in 14 days)
//   6. Seed default notification_preferences for the user
//   7. Write an audit log entry
//
// Also provides `resolveSchoolByHostname` for tenant resolution at the
// web/email-redirect entrypoint.

import { getSupabaseClient } from '@/template';
import { ServiceResult, SubscriptionPlan } from '@/lib/types';
import { logAuditEvent } from './audit.service';

export interface RegisterSchoolInput {
  schoolName: string;
  subdomain: string;
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  country?: string;
  county?: string;
  city?: string;
  address?: string;
}

const TRIAL_DAYS = 14;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
}

function toSubdomain(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 32);
}

export interface RegisteredSchool {
  schoolId: string;
  profileId: string;
  authUserId: string;
}

/**
 * Register a new school + owner. Wraps the entire onboarding flow in a
 * best-effort transaction — if any step fails after the school is created,
 * the user is told to contact support (we don't roll back automatically
 * because the auth user is already created in Supabase Auth).
 */
export async function registerSchool(
  input: RegisterSchoolInput,
): Promise<ServiceResult<RegisteredSchool>> {
  const supabase = getSupabaseClient();

  try {
    const subdomain = toSubdomain(input.subdomain || input.schoolName);
    if (!subdomain) return { data: null, error: 'Subdomain is required' };

    // 1. Create auth user
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email: input.email.toLowerCase(),
      password: input.password,
      options: {
        data: {
          full_name: input.fullName,
          phone: input.phone,
        },
      },
    });
    if (signUpErr) return { data: null, error: signUpErr.message };
    if (!signUpData.user) {
      return { data: null, error: 'Failed to create user account' };
    }
    const authUserId = signUpData.user.id;

    // 2. Insert user_profiles row
    const { data: profile, error: profileErr } = await supabase
      .from('user_profiles')
      .insert({
        auth_user_id: authUserId,
        email: input.email.toLowerCase(),
        full_name: input.fullName,
        phone: input.phone ?? null,
        email_verified: false,
        status: 'active',
      })
      .select('id')
      .single();
    if (profileErr) {
      return {
        data: null,
        error: `Profile creation failed: ${profileErr.message}. Auth user was created — please contact support.`,
      };
    }
    const profileId = profile.id as string;

    // 3. Insert schools row
    const slug = slugify(input.schoolName);
    const trialEnd = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data: school, error: schoolErr } = await supabase
      .from('schools')
      .insert({
        name: input.schoolName,
        slug,
        subdomain,
        email: input.email.toLowerCase(),
        phone: input.phone ?? null,
        country: input.country ?? null,
        county: input.county ?? null,
        city: input.city ?? null,
        address: input.address ?? null,
        plan_status: 'trialing',
        plan_tier: 'starter',
        trial_ends_at: trialEnd,
        status: 'active',
      })
      .select('id')
      .single();
    if (schoolErr) {
      return {
        data: null,
        error: `School creation failed: ${schoolErr.message}`,
      };
    }
    const schoolId = school.id as string;

    // 4. Insert school_users row (school_owner)
    const { error: suErr } = await supabase.from('school_users').insert({
      school_id: schoolId,
      user_id: profileId,
      role: 'school_owner',
      is_active: true,
      joined_at: new Date().toISOString(),
    });
    if (suErr) {
      return {
        data: null,
        error: `Owner assignment failed: ${suErr.message}`,
      };
    }

    // 5. Insert subscription (trial)
    const { error: subErr } = await supabase.from('subscriptions').insert({
      school_id: schoolId,
      plan_tier: 'starter',
      status: 'trialing',
      current_period_start: new Date().toISOString(),
      current_period_end: trialEnd,
      trial_ends_at: trialEnd,
      amount_usd: 0,
      currency: 'USD',
    });
    if (subErr) {
      // Non-fatal — school still works, just no subscription row
      console.warn('[registration] subscription insert failed:', subErr.message);
    }

    // 6. Seed default notification_preferences (push + email for each category)
    const channels = ['push', 'email', 'sms'];
    const categories = ['announcements', 'messages', 'finance', 'attendance', 'academic', 'system'];
    const prefRows = channels.flatMap((channel) =>
      categories.map((category) => ({
        user_id: profileId,
        channel,
        category,
        enabled: true,
      })),
    );
    const { error: prefErr } = await supabase
      .from('notification_preferences')
      .insert(prefRows);
    if (prefErr) {
      console.warn('[registration] notification_preferences seed failed:', prefErr.message);
    }

    // 7. Audit log
    await logAuditEvent({
      schoolId,
      userId: profileId,
      action: 'school.created',
      resourceType: 'school',
      resourceId: schoolId,
      details: { name: input.schoolName, subdomain, trialEnd },
      severity: 'info',
    });

    return {
      data: { schoolId, profileId, authUserId },
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export interface ResolvedSchool {
  schoolId: string;
  subdomain: string | null;
  domain: string | null;
  name: string;
}

/**
 * Resolve a hostname (e.g. `greenfield.edumanage.app` or `academy.example.com`)
 * to a school record. Checks `custom_domains` first, then falls back to
 * subdomain extraction against the schools table.
 */
export async function resolveSchoolByHostname(
  hostname: string,
): Promise<ServiceResult<ResolvedSchool>> {
  const supabase = getSupabaseClient();
  if (!hostname) return { data: null, error: 'hostname is required' };
  const host = hostname.toLowerCase().replace(/:\d+$/, '');

  try {
    // 1. Custom domain lookup
    const { data: domainRow, error: domainErr } = await supabase
      .from('custom_domains')
      .select('school_id, domain, schools(id, name, subdomain)')
      .eq('domain', host)
      .in('status', ['verified', 'ssl_pending', 'active'])
      .maybeSingle();
    if (domainErr) return { data: null, error: domainErr.message };
    if (domainRow) {
      const school = (domainRow as { schools: { id: string; name: string; subdomain: string } }).schools;
      if (school) {
        return {
          data: {
            schoolId: school.id,
            subdomain: school.subdomain,
            domain: (domainRow as { domain: string }).domain,
            name: school.name,
          },
          error: null,
        };
      }
    }

    // 2. Subdomain fallback — match the first DNS label against schools.subdomain
    const parts = host.split('.');
    if (parts.length < 2) {
      return { data: null, error: 'No matching school for hostname' };
    }
    const label = parts[0];
    const { data: school, error: schoolErr } = await supabase
      .from('schools')
      .select('id, name, subdomain')
      .eq('subdomain', label)
      .maybeSingle();
    if (schoolErr) return { data: null, error: schoolErr.message };
    if (!school) {
      return { data: null, error: 'No matching school for hostname' };
    }
    return {
      data: {
        schoolId: school.id as string,
        subdomain: school.subdomain as string,
        domain: null,
        name: school.name as string,
      },
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Convenience helper used by school.service.ts re-export. */
export function getTrialPlan(): SubscriptionPlan {
  return 'starter';
}

export const TRIAL_LENGTH_DAYS = TRIAL_DAYS;
