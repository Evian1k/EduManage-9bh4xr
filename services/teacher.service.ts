import { getSupabaseClient } from '@/template';

export async function getTeachers(schoolId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('school_users')
    .select('*, user_profiles!user_id(username, email)')
    .eq('school_id', schoolId)
    .in('role', ['teacher', 'ict_manager', 'accountant', 'clerk'])
    .order('created_at', { ascending: false });
  return { data, error };
}

export async function getAllStaff(schoolId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('school_users')
    .select('*, user_profiles!user_id(username, email)')
    .eq('school_id', schoolId)
    .neq('role', 'student')
    .order('role');
  return { data, error };
}

export async function getSchoolUserById(schoolUserId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('school_users')
    .select('*, user_profiles!user_id(username, email)')
    .eq('id', schoolUserId)
    .single();
  return { data, error };
}

export async function getSchoolUserByUserId(userId: string, schoolId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('school_users')
    .select('*')
    .eq('user_id', userId)
    .eq('school_id', schoolId)
    .single();
  return { data, error };
}

export async function addStaffMember(
  schoolId: string,
  userId: string,
  role: string,
  employeeId?: string,
  department?: string
) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('school_users')
    .insert({ school_id: schoolId, user_id: userId, role, employee_id: employeeId, department })
    .select()
    .single();
  return { data, error };
}

export async function updateStaffRole(schoolUserId: string, role: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('school_users')
    .update({ role })
    .eq('id', schoolUserId)
    .select()
    .single();
  return { data, error };
}

export async function toggleStaffActive(schoolUserId: string, isActive: boolean) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('school_users')
    .update({ is_active: isActive })
    .eq('id', schoolUserId)
    .select()
    .single();
  return { data, error };
}

export async function getTeacherDashboardStats(teacherSchoolUserId: string, schoolId: string) {
  const supabase = getSupabaseClient();
  const [classSubjectsRes, assignmentsRes, submissionsRes] = await Promise.all([
    supabase.from('class_subjects').select('class_id', { count: 'exact' }).eq('teacher_id', teacherSchoolUserId),
    supabase.from('assignments').select('id', { count: 'exact' }).eq('teacher_id', teacherSchoolUserId).eq('school_id', schoolId),
    supabase.from('assignment_submissions').select('id, status', { count: 'exact' }).eq('school_id', schoolId),
  ]);

  const classIds = [...new Set((classSubjectsRes.data || []).map((cs) => cs.class_id))];

  let studentCount = 0;
  if (classIds.length > 0) {
    const { count } = await supabase
      .from('students')
      .select('id', { count: 'exact', head: true })
      .in('class_id', classIds)
      .eq('school_id', schoolId);
    studentCount = count || 0;
  }

  const submissions = submissionsRes.data || [];
  return {
    totalClasses: classIds.length,
    totalStudents: studentCount,
    totalAssignments: assignmentsRes.count || 0,
    pendingGrading: submissions.filter((s) => s.status === 'submitted').length,
  };
}
