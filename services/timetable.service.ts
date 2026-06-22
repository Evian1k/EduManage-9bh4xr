// EduManage — Timetable service
//
// CRUD for `timetable_slots`. Provides lookup-by-class, lookup-by-teacher,
// and a conflict-checker that finds slots overlapping a (class, day, time)
// range.

import { getSupabaseClient } from '@/template';
import { ServiceResult } from '@/lib/types';

export interface TimetableSlot {
  id: string;
  school_id: string;
  class_id: string;
  stream_id?: string | null;
  subject_id?: string | null;
  teacher_id?: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room?: string | null;
  term_id?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function getDayName(day: number): string {
  return DAYS[day] ?? 'Unknown';
}

export interface GetTimetableOpts {
  classId?: string;
  streamId?: string;
  teacherId?: string;
  termId?: string;
  dayOfWeek?: number;
}

export async function getTimetable(
  schoolId: string,
  opts: GetTimetableOpts = {},
): Promise<ServiceResult<TimetableSlot[]>> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from('timetable_slots')
    .select('*, classes(name, level), streams(name), subjects(name, code)')
    .eq('school_id', schoolId)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true });
  if (opts.classId) q = q.eq('class_id', opts.classId);
  if (opts.streamId) q = q.eq('stream_id', opts.streamId);
  if (opts.teacherId) q = q.eq('teacher_id', opts.teacherId);
  if (opts.termId) q = q.eq('term_id', opts.termId);
  if (opts.dayOfWeek !== undefined) q = q.eq('day_of_week', opts.dayOfWeek);
  const { data, error } = await q;
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as TimetableSlot[], error: null };
}

export const getTimetableForClass = (
  schoolId: string,
  classId: string,
) => getTimetable(schoolId, { classId });

export const getTimetableForTeacher = (
  schoolId: string,
  teacherId: string,
) => getTimetable(schoolId, { teacherId });

export const getAllTimetableSlots = (schoolId: string) => getTimetable(schoolId);

export interface CreateSlotInput {
  class_id: string;
  stream_id?: string;
  subject_id?: string;
  teacher_id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room?: string;
  term_id?: string;
}

export async function createSlot(
  schoolId: string,
  input: CreateSlotInput,
): Promise<ServiceResult<TimetableSlot>> {
  const supabase = getSupabaseClient();
  if (input.day_of_week < 0 || input.day_of_week > 6) {
    return { data: null, error: 'day_of_week must be 0-6 (Sun-Sat)' };
  }
  const { data, error } = await supabase
    .from('timetable_slots')
    .insert({
      school_id: schoolId,
      class_id: input.class_id,
      stream_id: input.stream_id ?? null,
      subject_id: input.subject_id ?? null,
      teacher_id: input.teacher_id ?? null,
      day_of_week: input.day_of_week,
      start_time: input.start_time,
      end_time: input.end_time,
      room: input.room ?? null,
      term_id: input.term_id ?? null,
    })
    .select('*, classes(name), subjects(name)')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as TimetableSlot, error: null };
}

export const createTimetableSlot = createSlot;

export async function updateSlot(
  schoolId: string,
  slotId: string,
  updates: Partial<CreateSlotInput>,
): Promise<ServiceResult<TimetableSlot>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('timetable_slots')
    .update(updates)
    .eq('id', slotId)
    .eq('school_id', schoolId)
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as TimetableSlot, error: null };
}

export const updateTimetableSlot = updateSlot;

export async function deleteSlot(
  schoolId: string,
  slotId: string,
): Promise<ServiceResult<{ deleted: boolean }>> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('timetable_slots')
    .delete()
    .eq('id', slotId)
    .eq('school_id', schoolId);
  if (error) return { data: null, error: error.message };
  return { data: { deleted: true }, error: null };
}

export const deleteTimetableSlot = deleteSlot;

export interface ConflictCheckInput {
  class_id: string;
  teacher_id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  exclude_id?: string;
}

/**
 * Check for timetable conflicts (overlapping slots on the same day for the
 * same class or teacher). Returns the list of conflicting slots — empty
 * means no conflicts.
 */
export async function checkConflict(
  schoolId: string,
  input: ConflictCheckInput,
): Promise<ServiceResult<TimetableSlot[]>> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from('timetable_slots')
    .select('*, classes(name), subjects(name)')
    .eq('school_id', schoolId)
    .eq('day_of_week', input.day_of_week)
    .or(`class_id.eq.${input.class_id}${input.teacher_id ? `,teacher_id.eq.${input.teacher_id}` : ''}`);
  if (input.exclude_id) q = q.neq('id', input.exclude_id);
  const { data, error } = await q;
  if (error) return { data: null, error: error.message };
  const slots = (data ?? []) as Array<{ start_time: string; end_time: string } & TimetableSlot>;
  const conflicts = slots.filter(
    (s) => s.start_time < input.end_time && s.end_time > input.start_time,
  );
  return { data: conflicts as TimetableSlot[], error: null };
}
