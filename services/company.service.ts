// EduManage — Company platform service
// Used by EduManage employees (CEO, Support, Engineering, Security, Sales, Finance, HR, Marketing, Customer Success, Maintenance)

import { getSupabaseClient } from '@/template';
import { ServiceResult } from '@/lib/types';

// ===== CEO Dashboard =====
export async function getCEOOverview(): Promise<ServiceResult<{
  total_schools: number; active_subscriptions: number; total_revenue: number;
  mrr: number; arr: number; growth_rate: number; churn_rate: number;
}>> {
  const supabase = getSupabaseClient();
  const [schools, subs, revenue] = await Promise.all([
    supabase.from('schools').select('id, status, plan_tier, plan_status, created_at'),
    supabase.from('subscriptions').select('status, amount_usd, plan_tier'),
    supabase.from('revenue_records').select('amount, revenue_type, period_month, period_year').eq('status', 'recognized'),
  ]);
  const totalSchools = schools.data?.length || 0;
  const activeSubs = subs.data?.filter((s: any) => s.status === 'active' || s.status === 'trialing').length || 0;
  const totalRevenue = (revenue.data || []).reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0);
  const now = new Date();
  const mrr = (revenue.data || []).filter((r: any) => r.period_month === now.getMonth() + 1 && r.period_year === now.getFullYear() && r.revenue_type === 'subscription').reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0);
  return { data: { total_schools: totalSchools, active_subscriptions: activeSubs, total_revenue: totalRevenue, mrr, arr: mrr * 12, growth_rate: 0, churn_rate: 0 }, error: null };
}

// ===== Support Tickets =====
export async function getSupportTickets(opts?: { status?: string; priority?: string; schoolId?: string; limit?: number }): Promise<ServiceResult<any[]>> {
  const supabase = getSupabaseClient();
  let q = supabase.from('support_tickets').select('*, schools(name), user_profiles!support_tickets_created_by_fkey(full_name, email)').order('created_at', { ascending: false });
  if (opts?.status) q = q.eq('status', opts.status);
  if (opts?.priority) q = q.eq('priority', opts.priority);
  if (opts?.schoolId) q = q.eq('school_id', opts.schoolId);
  if (opts?.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  return { data, error: error?.message ?? null };
}

export async function createSupportTicket(input: { school_id: string; subject: string; description: string; category?: string; priority?: string; created_by: string }): Promise<ServiceResult<any>> {
  const supabase = getSupabaseClient();
  const ticketNumber = `TKT-${Date.now().toString().slice(-8)}`;
  const { data, error } = await supabase.from('support_tickets').insert({ ...input, ticket_number: ticketNumber }).select().single();
  return { data, error: error?.message ?? null };
}

export async function replyToTicket(ticketId: string, body: string, repliedBy: string, isInternal: boolean = false): Promise<ServiceResult<any>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('support_ticket_replies').insert({ ticket_id: ticketId, body, replied_by: repliedBy, is_internal: isInternal }).select().single();
  return { data, error: error?.message ?? null };
}

export async function resolveTicket(ticketId: string, resolvedBy: string, notes: string): Promise<ServiceResult<any>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('support_tickets').update({ status: 'resolved', resolved_at: new Date().toISOString(), resolved_by: resolvedBy, resolution_notes: notes }).eq('id', ticketId).select().single();
  return { data, error: error?.message ?? null };
}

// ===== Sales Leads =====
export async function getLeads(opts?: { status?: string; assignedTo?: string }): Promise<ServiceResult<any[]>> {
  const supabase = getSupabaseClient();
  let q = supabase.from('sales_leads').select('*').order('created_at', { ascending: false });
  if (opts?.status) q = q.eq('lead_status', opts.status);
  if (opts?.assignedTo) q = q.eq('assigned_to', opts.assignedTo);
  const { data, error } = await q;
  return { data, error: error?.message ?? null };
}

export async function createLead(input: { school_name: string; contact_name: string; contact_email: string; contact_phone?: string; country?: string; lead_source?: string; estimated_value?: number; assigned_to?: string }): Promise<ServiceResult<any>> {
  const supabase = getSupabaseClient();
  const leadNumber = `LEAD-${Date.now().toString().slice(-8)}`;
  const { data, error } = await supabase.from('sales_leads').insert({ ...input, lead_number: leadNumber }).select().single();
  return { data, error: error?.message ?? null };
}

export async function updateLeadStatus(leadId: string, status: string, opts?: { actualValue?: number; lossReason?: string; notes?: string }): Promise<ServiceResult<any>> {
  const supabase = getSupabaseClient();
  const updates: any = { lead_status: status };
  if (opts?.actualValue !== undefined) updates.actual_value = opts.actualValue;
  if (opts?.lossReason) updates.loss_reason = opts.lossReason;
  if (opts?.notes) updates.notes = opts.notes;
  if (status === 'won') updates.converted_at = new Date().toISOString();
  const { data, error } = await supabase.from('sales_leads').update(updates).eq('id', leadId).select().single();
  return { data, error: error?.message ?? null };
}

// ===== Customer Success =====
export async function getCustomerHealthScores(): Promise<ServiceResult<any[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('customer_health_scores').select('*, schools(name, plan_tier)').order('assessed_at', { ascending: false });
  return { data, error: error?.message ?? null };
}

export async function getOnboardingChecklists(schoolId?: string): Promise<ServiceResult<any[]>> {
  const supabase = getSupabaseClient();
  let q = supabase.from('onboarding_checklists').select('*, schools(name)').order('step_order', { ascending: true });
  if (schoolId) q = q.eq('school_id', schoolId);
  const { data, error } = await q;
  return { data, error: error?.message ?? null };
}

// ===== Revenue Analytics =====
export async function getRevenueAnalytics(): Promise<ServiceResult<{
  mrr: number; arr: number; total_revenue: number; marketplace_revenue: number;
  subscription_revenue: number; arps: number; school_count: number;
}>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('revenue_records').select('amount, revenue_type, period_month, period_year, school_id').eq('status', 'recognized');
  if (error) return { data: null, error: error.message };
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const mrr = (data || []).filter((r: any) => r.period_month === currentMonth && r.period_year === currentYear && r.revenue_type === 'subscription').reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
  const totalRevenue = (data || []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
  const marketplaceRevenue = (data || []).filter((r: any) => r.revenue_type === 'marketplace').reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
  const subscriptionRevenue = (data || []).filter((r: any) => r.revenue_type === 'subscription').reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
  const uniqueSchools = new Set((data || []).map((r: any) => r.school_id)).size;
  const arps = uniqueSchools > 0 ? subscriptionRevenue / uniqueSchools : 0;
  return { data: { mrr, arr: mrr * 12, total_revenue: totalRevenue, marketplace_revenue: marketplaceRevenue, subscription_revenue: subscriptionRevenue, arps, school_count: uniqueSchools }, error: null };
}

// ===== System Health =====
export async function getSystemIncidents(): Promise<ServiceResult<any[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('system_incidents').select('*').order('started_at', { ascending: false });
  return { data, error: error?.message ?? null };
}

export async function getHealthChecks(): Promise<ServiceResult<any[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('system_health_checks').select('*').order('checked_at', { ascending: false }).limit(50);
  return { data, error: error?.message ?? null };
}

// ===== Company Employees =====
export async function getCompanyEmployees(): Promise<ServiceResult<any[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('company_employees').select('*').order('full_name');
  return { data, error: error?.message ?? null };
}

// ===== KPIs =====
export async function getKPIs(opts?: { category?: string }): Promise<ServiceResult<any[]>> {
  const supabase = getSupabaseClient();
  let q = supabase.from('company_kpis').select('*').order('period_start', { ascending: false });
  if (opts?.category) q = q.eq('category', opts.category);
  const { data, error } = await q;
  return { data, error: error?.message ?? null };
}
