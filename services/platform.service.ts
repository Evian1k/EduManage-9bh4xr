import { getSupabaseClient } from '@/template';
import { PLAN_LIMITS } from '@/constants/config';

export async function getAllSchools() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('schools')
    .select('*')
    .order('created_at', { ascending: false });
  return { data, error };
}

export async function getPlatformStats() {
  const supabase = getSupabaseClient();
  const [schoolsRes, studentsRes, teachersRes, ticketsRes, aiRes] = await Promise.all([
    supabase.from('schools').select('id, plan, is_active'),
    supabase.from('students').select('id', { count: 'exact', head: true }),
    supabase.from('school_users').select('id', { count: 'exact', head: true }).eq('role', 'teacher'),
    supabase.from('support_tickets').select('id, status'),
    supabase.from('ai_usage_logs').select('tokens_used'),
  ]);

  const schools = schoolsRes.data || [];
  const tickets = ticketsRes.data || [];
  const aiLogs = aiRes.data || [];

  return {
    totalSchools: schools.length,
    activeSchools: schools.filter((s) => s.is_active).length,
    trialSchools: schools.filter((s) => s.plan === 'free_trial').length,
    paidSchools: schools.filter((s) => s.plan !== 'free_trial').length,
    totalStudents: studentsRes.count || 0,
    totalTeachers: teachersRes.count || 0,
    openTickets: tickets.filter((t) => t.status === 'open').length,
    totalAiTokens: aiLogs.reduce((sum, l) => sum + (l.tokens_used || 0), 0),
    planBreakdown: {
      free_trial: schools.filter((s) => s.plan === 'free_trial').length,
      basic: schools.filter((s) => s.plan === 'basic').length,
      pro: schools.filter((s) => s.plan === 'pro').length,
      enterprise: schools.filter((s) => s.plan === 'enterprise').length,
    },
  };
}

export async function updateSchoolPlan(schoolId: string, plan: string) {
  const supabase = getSupabaseClient();
  const limits = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS];
  const { data, error } = await supabase
    .from('schools')
    .update({
      plan,
      plan_status: 'active',
      max_students: limits?.maxStudents || 50,
      max_teachers: limits?.maxTeachers || 5,
      ai_usage_limit: limits?.aiUsageLimit || 100,
    })
    .eq('id', schoolId)
    .select()
    .single();
  return { data, error };
}

export async function toggleSchoolStatus(schoolId: string, isActive: boolean) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('schools')
    .update({ is_active: isActive })
    .eq('id', schoolId)
    .select()
    .single();
  return { data, error };
}

export async function getPlatformAnnouncements() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('announcements')
    .select('*, user_profiles(username, email)')
    .eq('is_platform_wide', true)
    .order('created_at', { ascending: false });
  return { data, error };
}

export async function createPlatformAnnouncement(title: string, content: string, authorId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('announcements')
    .insert({ title, content, is_platform_wide: true, is_pinned: false, author_id: authorId })
    .select()
    .single();
  return { data, error };
}

export async function getAllTickets() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('support_tickets')
    .select('*, schools(name), user_profiles!created_by(username, email)')
    .order('created_at', { ascending: false });
  return { data, error };
}

export async function updateTicketStatus(ticketId: string, status: string, resolvedBy?: string) {
  const supabase = getSupabaseClient();
  const updates: Record<string, unknown> = { status };
  if (status === 'resolved' && resolvedBy) {
    updates.resolved_by = resolvedBy;
    updates.resolved_at = new Date().toISOString();
  }
  const { data, error } = await supabase
    .from('support_tickets')
    .update(updates)
    .eq('id', ticketId)
    .select()
    .single();
  return { data, error };
}

export async function replyToTicket(ticketId: string, authorId: string, content: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('ticket_replies')
    .insert({ ticket_id: ticketId, author_id: authorId, content, is_platform_reply: true })
    .select()
    .single();
  return { data, error };
}

export async function getAiUsageStats() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('ai_usage_logs')
    .select('*, schools(name)')
    .order('created_at', { ascending: false })
    .limit(100);
  return { data, error };
}
