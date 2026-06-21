// EduManage — Attendance service
//
// CRUD for the `attendance` table. `markAttendance` supports both single
// and bulk upserts. `getAttendanceStats` returns the present rate for a
// class/term range.

import { getSupabaseClient } from '@/template';
import { ServiceResult } from '@/lib/types';

export interface AttendanceRecord {
  id: string;
  school_id: string;
  student_id: string;
  class_id?: string | null;
  date: string;
  status: string;
  arrival_time?: string | null;
  remarks?: string | null;
  marked_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface GetAttendanceOpts {
  classId?: string;
  studentId?: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  limit?: number;
}

export async function getAttendance(
  schoolId: string,
  opts: GetAttendanceOpts = {},
): Promise<ServiceResult<AttendanceRecord[]>> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from('attendance')
    .select('*, students(full_name, admission_number)')
    .eq('school_id', schoolId)
    .order('date', { ascending: false });
  if (opts.classId) q = q.eq('class_id', opts.classId);
  if (opts.studentId) q = q.eq('student_id', opts.studentId);
  if (opts.date) q = q.eq('date', opts.date);
  if (opts.startDate) q = q.gte('date', opts.startDate);
  if (opts.endDate) q = q.lte('date', opts.endDate);
  if (opts.status) q = q.eq('status', opts.status);
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as AttendanceRecord[], error: null };
}

export interface MarkAttendanceInput {
  student_id: string;
  class_id?: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  arrival_time?: string;
  remarks?: string;
  marked_by?: string;
}

export async function markAttendance(
  schoolId: string,
  input: MarkAttendanceInput,
): Promise<ServiceResult<AttendanceRecord>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('attendance')
    .upsert(
      {
        school_id: schoolId,
        student_id: input.student_id,
        class_id: input.class_id ?? null,
        date: input.date,
        status: input.status,
        arrival_time: input.arrival_time ?? null,
        remarks: input.remarks ?? null,
        marked_by: input.marked_by ?? null,
      },
      { onConflict: 'school_id,student_id,date' },
    )
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as AttendanceRecord, error: null };
}

export async function bulkMarkAttendance(
  schoolId: string,
  records: MarkAttendanceInput[],
): Promise<ServiceResult<AttendanceRecord[]>> {
  const supabase = getSupabaseClient();
  if (records.length === 0) return { data: [], error: null };
  const inserts = records.map((r) => ({
    school_id: schoolId,
    student_id: r.student_id,
    class_id: r.class_id ?? null,
    date: r.date,
    status: r.status,
    arrival_time: r.arrival_time ?? null,
    remarks: r.remarks ?? null,
    marked_by: r.marked_by ?? null,
  }));
  const { data, error } = await supabase
    .from('attendance')
    .upsert(inserts, { onConflict: 'school_id,student_id,date' })
    .select('*');
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as AttendanceRecord[], error: null };
}

export interface AttendanceStats {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  rate: number;
  byStudent?: Array<{ student_id: string; student_name: string; present: number; total: number; rate: number }>;
}

export async function getAttendanceStats(
  schoolId: string,
  opts: { classId?: string; studentId?: string; startDate?: string; endDate?: string } = {},
): Promise<ServiceResult<AttendanceStats>> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from('attendance')
    .select('student_id, status, students(full_name)')
    .eq('school_id', schoolId);
  if (opts.classId) q = q.eq('class_id', opts.classId);
  if (opts.studentId) q = q.eq('student_id', opts.studentId);
  if (opts.startDate) q = q.gte('date', opts.startDate);
  if (opts.endDate) q = q.lte('date', opts.endDate);
  const { data, error } = await q;
  if (error) return { data: null, error: error.message };
  const rows = (data ?? []) as Array<{
    student_id: string;
    status: string;
    students: { full_name: string } | null;
  }>;

  const totals = { total: rows.length, present: 0, absent: 0, late: 0, excused: 0 };
  const byStudentMap = new Map<string, { student_id: string; student_name: string; present: number; total: number }>();
  for (const r of rows) {
    const s = (r.status ?? '').toLowerCase();
    if (s in totals) (totals as Record<string, number>)[s] += 1;
    const ex = byStudentMap.get(r.student_id);
    if (ex) {
      ex.total += 1;
      if (s === 'present') ex.present += 1;
    } else {
      byStudentMap.set(r.student_id, {
        student_id: r.student_id,
        student_name: r.students?.full_name ?? 'Unknown',
        present: s === 'present' ? 1 : 0,
        total: 1,
      });
    }
  }

  return {
    data: {
      ...totals,
      rate: totals.total > 0 ? Math.round((totals.present / totals.total) * 100) : 0,
      byStudent: Array.from(byStudentMap.values()).map((s) => ({
        ...s,
        rate: s.total > 0 ? Math.round((s.present / s.total) * 100) : 0,
      })),
    },
    error: null,
  };
}

// ─── Legacy aliases used by older screens ────────────────────────────────────

export const getAttendanceByDate = (schoolId: string, classId: string, date: string) =>
  getAttendance(schoolId, { classId, date });

export const recordAttendance = (
  schoolId: string,
  classId: string,
  studentId: string,
  date: string,
  status: string,
  recordedBy: string,
  notes?: string,
) =>
  markAttendance(schoolId, {
    student_id: studentId,
    class_id: classId,
    date,
    status: status as MarkAttendanceInput['status'],
    marked_by: recordedBy,
    remarks: notes,
  });

export const getStudentAttendanceSummary = async (
  schoolId: string,
  studentId: string,
) => {
  const res = await getAttendance(schoolId, { studentId });
  if (res.error || !res.data) return res;
  const records = res.data;
  const present = records.filter((a) => a.status === 'present').length;
  const absent = records.filter((a) => a.status === 'absent').length;
  const late = records.filter((a) => a.status === 'late').length;
  const excused = records.filter((a) => a.status === 'excused').length;
  const total = records.length;
  const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
  return {
    data: { total, present, absent, late, excused, percentage },
    error: null,
  };
};
