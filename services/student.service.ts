import { getSupabaseClient } from '@/template';

export interface StudentInput {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  date_of_birth?: string;
  gender?: string;
  address?: string;
  parent_name?: string;
  parent_phone?: string;
  parent_email?: string;
  class_id?: string;
}

export async function getStudents(schoolId: string, classId?: string) {
  const supabase = getSupabaseClient();
  let query = supabase
    .from('students')
    .select('*, classes(name, grade_level, section)')
    .eq('school_id', schoolId)
    .order('first_name');

  if (classId) query = query.eq('class_id', classId);

  const { data, error } = await query;
  return { data, error };
}

export async function getStudentById(studentId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('students')
    .select('*, classes(name, grade_level, section)')
    .eq('id', studentId)
    .single();
  return { data, error };
}

export async function getStudentByUserId(userId: string, schoolId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('students')
    .select('*, classes(name, grade_level, section)')
    .eq('user_id', userId)
    .eq('school_id', schoolId)
    .single();
  return { data, error };
}

export async function createStudent(schoolId: string, input: StudentInput) {
  const supabase = getSupabaseClient();

  // Generate admission number
  const year = new Date().getFullYear().toString().slice(-2);
  const { count } = await supabase
    .from('students')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId);
  const num = String((count || 0) + 1).padStart(4, '0');
  const admissionNumber = `STU${year}${num}`;

  const { data, error } = await supabase
    .from('students')
    .insert({ ...input, school_id: schoolId, admission_number: admissionNumber })
    .select('*, classes(name, grade_level, section)')
    .single();
  return { data, error };
}

export async function updateStudent(studentId: string, updates: Partial<StudentInput>) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('students')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', studentId)
    .select('*, classes(name, grade_level, section)')
    .single();
  return { data, error };
}

export async function deleteStudent(studentId: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('students').delete().eq('id', studentId);
  return { error };
}

export async function getStudentGrades(studentId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('grades')
    .select('*, subjects(name, code), classes(name)')
    .eq('student_id', studentId)
    .order('academic_year', { ascending: false })
    .order('term');
  return { data, error };
}

export async function getStudentAttendance(studentId: string, classId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('student_id', studentId)
    .eq('class_id', classId)
    .order('date', { ascending: false });
  return { data, error };
}

export async function getStudentAssignments(classId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('assignments')
    .select('*, subjects(name), school_users!teacher_id(user_id, user_profiles!user_id(username))')
    .eq('class_id', classId)
    .eq('is_published', true)
    .order('due_date');
  return { data, error };
}

export async function submitAssignment(
  assignmentId: string,
  studentId: string,
  schoolId: string,
  content: string
) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('assignment_submissions')
    .upsert({
      assignment_id: assignmentId,
      student_id: studentId,
      school_id: schoolId,
      content,
      submitted_at: new Date().toISOString(),
      status: 'submitted',
    })
    .select()
    .single();
  return { data, error };
}
