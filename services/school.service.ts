import { getSupabaseClient } from '@/template';

export async function getSchoolById(schoolId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('schools')
    .select('*')
    .eq('id', schoolId)
    .single();
  return { data, error };
}

export async function updateSchool(schoolId: string, updates: Record<string, unknown>) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('schools')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', schoolId)
    .select()
    .single();
  return { data, error };
}

export async function getSchoolStats(schoolId: string) {
  const supabase = getSupabaseClient();
  const [studentsRes, teachersRes, classesRes, assignmentsRes] = await Promise.all([
    supabase.from('students').select('id, status', { count: 'exact' }).eq('school_id', schoolId),
    supabase.from('school_users').select('id', { count: 'exact' }).eq('school_id', schoolId).eq('role', 'teacher'),
    supabase.from('classes').select('id', { count: 'exact' }).eq('school_id', schoolId),
    supabase.from('assignments').select('id', { count: 'exact' }).eq('school_id', schoolId),
  ]);

  return {
    totalStudents: studentsRes.count || 0,
    activeStudents: (studentsRes.data || []).filter((s) => s.status === 'active').length,
    totalTeachers: teachersRes.count || 0,
    totalClasses: classesRes.count || 0,
    totalAssignments: assignmentsRes.count || 0,
  };
}

export async function registerSchool(
  schoolName: string,
  subdomain: string,
  email: string,
  userId: string
) {
  const supabase = getSupabaseClient();

  // Create school
  const { data: school, error: schoolError } = await supabase
    .from('schools')
    .insert({
      name: schoolName,
      subdomain: subdomain.toLowerCase().replace(/[^a-z0-9]/g, ''),
      email,
      plan: 'free_trial',
      plan_status: 'trial',
    })
    .select()
    .single();

  if (schoolError) return { data: null, error: schoolError };

  // Create school_user (admin role)
  const { error: userError } = await supabase.from('school_users').insert({
    user_id: userId,
    school_id: school.id,
    role: 'admin',
    is_active: true,
  });

  if (userError) return { data: null, error: userError };

  return { data: school, error: null };
}

export async function getSchoolAnnouncements(schoolId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('announcements')
    .select('*, user_profiles!author_id(username, email)')
    .or(`school_id.eq.${schoolId},is_platform_wide.eq.true`)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false });
  return { data, error };
}

export async function createAnnouncement(
  schoolId: string,
  authorId: string,
  title: string,
  content: string,
  targetRoles: string[]
) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('announcements')
    .insert({ school_id: schoolId, author_id: authorId, title, content, target_roles: targetRoles })
    .select()
    .single();
  return { data, error };
}

export async function getSchoolTickets(schoolId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('support_tickets')
    .select('*, ticket_replies(*)')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false });
  return { data, error };
}

export async function createTicket(
  schoolId: string,
  createdBy: string,
  title: string,
  description: string,
  category: string,
  priority: string
) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('support_tickets')
    .insert({ school_id: schoolId, created_by: createdBy, title, description, category, priority })
    .select()
    .single();
  return { data, error };
}
