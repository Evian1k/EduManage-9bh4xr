import { getSupabaseClient } from '@/template';

export interface TimetableSlot {
  id: string;
  school_id: string;
  class_id: string;
  subject_id?: string;
  teacher_id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room_number?: string;
  classes?: { name: string; grade_level: string };
  subjects?: { name: string; code: string };
  school_users?: { employee_id: string; user_profiles?: { username: string } };
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export function getDayName(day: number) {
  return DAYS[day - 1] || 'Unknown';
}

export async function getTimetableForClass(schoolId: string, classId: string) {
  const supabase = getSupabaseClient();
  return supabase
    .from('timetable_slots')
    .select('*, subjects(name, code), school_users(id, employee_id)')
    .eq('school_id', schoolId)
    .eq('class_id', classId)
    .order('day_of_week')
    .order('start_time');
}

export async function getTimetableForTeacher(schoolId: string, teacherId: string) {
  const supabase = getSupabaseClient();
  return supabase
    .from('timetable_slots')
    .select('*, classes(name, grade_level, section), subjects(name, code)')
    .eq('school_id', schoolId)
    .eq('teacher_id', teacherId)
    .order('day_of_week')
    .order('start_time');
}

export async function getAllTimetableSlots(schoolId: string) {
  const supabase = getSupabaseClient();
  return supabase
    .from('timetable_slots')
    .select('*, classes(name, grade_level, section), subjects(name, code), school_users(id)')
    .eq('school_id', schoolId)
    .order('class_id')
    .order('day_of_week')
    .order('start_time');
}

export async function createTimetableSlot(schoolId: string, data: {
  class_id: string;
  subject_id?: string;
  teacher_id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room_number?: string;
}) {
  const supabase = getSupabaseClient();
  return supabase
    .from('timetable_slots')
    .insert({ ...data, school_id: schoolId })
    .select('*, subjects(name), classes(name)')
    .single();
}

export async function updateTimetableSlot(slotId: string, updates: Partial<TimetableSlot>) {
  const supabase = getSupabaseClient();
  return supabase
    .from('timetable_slots')
    .update(updates)
    .eq('id', slotId)
    .select()
    .single();
}

export async function deleteTimetableSlot(slotId: string) {
  const supabase = getSupabaseClient();
  return supabase.from('timetable_slots').delete().eq('id', slotId);
}

export async function checkConflict(schoolId: string, data: {
  class_id: string;
  teacher_id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  exclude_id?: string;
}) {
  const supabase = getSupabaseClient();
  let query = supabase
    .from('timetable_slots')
    .select('id, class_id, teacher_id, start_time, end_time, classes(name), subjects(name)')
    .eq('school_id', schoolId)
    .eq('day_of_week', data.day_of_week)
    .or(`class_id.eq.${data.class_id}${data.teacher_id ? `,teacher_id.eq.${data.teacher_id}` : ''}`);
  if (data.exclude_id) query = query.neq('id', data.exclude_id);
  const { data: existing } = await query;
  const conflicts = (existing || []).filter(slot => {
    return slot.start_time < data.end_time && slot.end_time > data.start_time;
  });
  return conflicts;
}
