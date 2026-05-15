import { getSupabaseClient } from '@/template';

export async function getClasses(schoolId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('classes')
    .select('*, school_users!class_teacher_id(user_id, user_profiles!user_id(username))')
    .eq('school_id', schoolId)
    .order('grade_level')
    .order('name');
  return { data, error };
}

export async function getClassById(classId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('classes')
    .select('*, school_users!class_teacher_id(user_id, user_profiles!user_id(username))')
    .eq('id', classId)
    .single();
  return { data, error };
}

export async function createClass(
  schoolId: string,
  name: string,
  gradeLevel: string,
  section: string,
  academicYear: string,
  capacity: number,
  roomNumber?: string
) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('classes')
    .insert({ school_id: schoolId, name, grade_level: gradeLevel, section, academic_year: academicYear, capacity, room_number: roomNumber })
    .select()
    .single();
  return { data, error };
}

export async function updateClass(classId: string, updates: Record<string, unknown>) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('classes')
    .update(updates)
    .eq('id', classId)
    .select()
    .single();
  return { data, error };
}

export async function deleteClass(classId: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('classes').delete().eq('id', classId);
  return { error };
}

export async function getSubjects(schoolId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('subjects')
    .select('*')
    .eq('school_id', schoolId)
    .order('name');
  return { data, error };
}

export async function createSubject(schoolId: string, name: string, code: string, description?: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('subjects')
    .insert({ school_id: schoolId, name, code, description })
    .select()
    .single();
  return { data, error };
}

export async function getClassSubjects(classId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('class_subjects')
    .select('*, subjects(name, code), school_users!teacher_id(user_id, user_profiles!user_id(username))')
    .eq('class_id', classId);
  return { data, error };
}

export async function assignSubjectToClass(classId: string, subjectId: string, teacherId: string | null, schoolId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('class_subjects')
    .upsert({ class_id: classId, subject_id: subjectId, teacher_id: teacherId, school_id: schoolId })
    .select()
    .single();
  return { data, error };
}

export async function getTeacherClasses(teacherSchoolUserId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('class_subjects')
    .select('*, classes(id, name, grade_level, section, academic_year), subjects(name, code)')
    .eq('teacher_id', teacherSchoolUserId);
  return { data, error };
}

export async function getTimetable(classId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('timetable_slots')
    .select('*, subjects(name), school_users!teacher_id(user_id, user_profiles!user_id(username))')
    .eq('class_id', classId)
    .order('day_of_week')
    .order('start_time');
  return { data, error };
}
