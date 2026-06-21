// EduManage — Subscription service
//
// Reads from `subscription_plans` (catalogue) and `subscriptions` (per-school
// state). `changePlan` updates both the subscription row and the school's
// plan_tier + limits. `checkUsage` returns current limits vs. consumption.

import { getSupabaseClient } from '@/template';
import { ServiceResult, SubscriptionPlan } from '@/lib/types';
import { logAuditEvent } from './audit.service';

// ─── Plan catalogue ──────────────────────────────────────────────────────────

export interface Plan {
  tier: SubscriptionPlan;
  name: string;
  description?: string | null;
  price_monthly_usd: number;
  price_yearly_usd: number;
  max_students: number;
  max_staff: number;
  max_storage_mb: number;
  ai_usage_limit: number;
  features: Record<string, unknown>;
  is_active: boolean;
}

export async function getPlans(): Promise<ServiceResult<Plan[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('is_active', true)
    .order('price_monthly_usd', { ascending: true });
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as Plan[], error: null };
}

// ─── School subscription ─────────────────────────────────────────────────────

export interface Subscription {
  id: string;
  school_id: string;
  plan_tier: SubscriptionPlan;
  status: string;
  current_period_start: string;
  current_period_end?: string | null;
  trial_ends_at?: string | null;
  canceled_at?: string | null;
  payment_provider?: string | null;
  provider_customer_id?: string | null;
  provider_subscription_id?: string | null;
  amount_usd: number;
  currency: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export async function getSchoolSubscription(
  schoolId: string,
): Promise<ServiceResult<Subscription>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: 'No subscription found for this school' };
  return { data: data as unknown as Subscription, error: null };
}

/**
 * Change a school's plan tier. Updates both the `subscriptions` row and
 * the school's `plan_tier` + limits columns.
 */
export async function changePlan(
  schoolId: string,
  newTier: SubscriptionPlan,
  changedBy: string,
): Promise<ServiceResult<{ subscription: Subscription; schoolId: string }>> {
  const supabase = getSupabaseClient();

  // Fetch the new plan to get the limits
  const { data: plan, error: planErr } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('tier', newTier)
    .maybeSingle();
  if (planErr) return { data: null, error: planErr.message };
  if (!plan) return { data: null, error: `Unknown plan tier: ${newTier}` };
  const planRow = plan as { max_students: number; max_staff: number; max_storage_mb: number; ai_usage_limit: number; price_monthly_usd: number };

  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  // Upsert subscription
  const { data: sub, error: subErr } = await supabase
    .from('subscriptions')
    .upsert(
      {
        school_id: schoolId,
        plan_tier: newTier,
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: periodEnd,
        amount_usd: planRow.price_monthly_usd,
        currency: 'USD',
      },
      { onConflict: 'school_id' },
    )
    .select('*')
    .single();
  if (subErr) return { data: null, error: subErr.message };

  // Update school limits
  const { error: schoolErr } = await supabase
    .from('schools')
    .update({
      plan_tier: newTier,
      plan_status: 'active',
      max_students: planRow.max_students,
      max_staff: planRow.max_staff,
      max_storage_mb: planRow.max_storage_mb,
      ai_usage_limit: planRow.ai_usage_limit,
    })
    .eq('id', schoolId);
  if (schoolErr) return { data: null, error: schoolErr.message };

  await logAuditEvent({
    schoolId,
    userId: changedBy,
    action: 'subscription.plan_changed',
    resourceType: 'subscription',
    resourceId: (sub as { id: string }).id,
    details: { new_tier: newTier },
    severity: 'warning',
  });

  return {
    data: { subscription: sub as unknown as Subscription, schoolId },
    error: null,
  };
}

export async function cancelSubscription(
  schoolId: string,
  canceledBy: string,
): Promise<ServiceResult<{ canceled: boolean }>> {
  const supabase = getSupabaseClient();
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!sub) return { data: null, error: 'No subscription to cancel' };

  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
    })
    .eq('id', (sub as { id: string }).id);
  if (error) return { data: null, error: error.message };

  // Downgrade school to "expired"
  await supabase
    .from('schools')
    .update({ plan_status: 'canceled' })
    .eq('id', schoolId);

  await logAuditEvent({
    schoolId,
    userId: canceledBy,
    action: 'subscription.canceled',
    resourceType: 'subscription',
    resourceId: (sub as { id: string }).id,
    severity: 'critical',
  });

  return { data: { canceled: true }, error: null };
}

// ─── Usage check ─────────────────────────────────────────────────────────────

export interface UsageCheck {
  students: { used: number; limit: number; percent: number; exceeded: boolean };
  staff: { used: number; limit: number; percent: number; exceeded: boolean };
  ai: { used: number; limit: number; percent: number; exceeded: boolean };
}

export async function checkUsage(schoolId: string): Promise<ServiceResult<UsageCheck>> {
  const supabase = getSupabaseClient();
  const [schoolRes, studentsRes, staffRes] = await Promise.all([
    supabase
      .from('schools')
      .select('ai_usage_count, ai_usage_limit, max_students, max_staff')
      .eq('id', schoolId)
      .maybeSingle(),
    supabase
      .from('students')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('status', 'active'),
    supabase
      .from('school_users')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('is_active', true),
  ]);
  if (schoolRes.error) return { data: null, error: schoolRes.error.message };

  const school = schoolRes.data as {
    ai_usage_count: number;
    ai_usage_limit: number;
    max_students: number;
    max_staff: number;
  } | null;

  const studentsUsed = studentsRes.count ?? 0;
  const staffUsed = staffRes.count ?? 0;
  const aiUsed = school?.ai_usage_count ?? 0;
  const studentsLimit = school?.max_students ?? 0;
  const staffLimit = school?.max_staff ?? 0;
  const aiLimit = school?.ai_usage_limit ?? 0;

  const pct = (used: number, limit: number) => (limit > 0 ? Math.round((used / limit) * 100) : 0);

  return {
    data: {
      students: { used: studentsUsed, limit: studentsLimit, percent: pct(studentsUsed, studentsLimit), exceeded: studentsUsed >= studentsLimit },
      staff: { used: staffUsed, limit: staffLimit, percent: pct(staffUsed, staffLimit), exceeded: staffUsed >= staffLimit },
      ai: { used: aiUsed, limit: aiLimit, percent: pct(aiUsed, aiLimit), exceeded: aiUsed >= aiLimit },
    },
    error: null,
  };
}

// ─── Subscription invoices ───────────────────────────────────────────────────

/**
 * Returns the school's subscription history. For now this returns the
 * `subscriptions` table rows (one per plan change) — when a real billing
 * provider is wired up this would query Stripe invoices instead.
 */
export async function getSubscriptionInvoices(
  schoolId: string,
): Promise<ServiceResult<Subscription[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false });
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as Subscription[], error: null };
}
