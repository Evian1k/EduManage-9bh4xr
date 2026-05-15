import { getSupabaseClient } from '@/template';

export async function getAttendanceByDate(classId: string, date: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('attendance')
    .select('*, students(first_name, last_name, admission_number)')
    .eq('class_id', classId)
    .eq('date', date)
    .order('students(first_name)');
  return { data, error };
}

export async function recordAttendance(
  schoolId: string,
  classId: string,
  studentId: string,
  date: string,
  status: string,
  recordedBy: string,
  notes?: string
) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('attendance')
    .upsert({
      school_id: schoolId,
      class_id: classId,
      student_id: studentId,
      date,
      status,
      recorded_by: recordedBy,
      notes: notes || '',
    })
    .select()
    .single();
  return { data, error };
}

export async function bulkRecordAttendance(records: Array<{
  schoolId: string;
  classId: string;
  studentId: string;
  date: string;
  status: string;
  recordedBy: string;
}>) {
  const supabase = getSupabaseClient();
  const inserts = records.map((r) => ({
    school_id: r.schoolId,
    class_id: r.classId,
    student_id: r.studentId,
    date: r.date,
    status: r.status,
    recorded_by: r.recordedBy,
  }));

  const { data, error } = await supabase
    .from('attendance')
    .upsert(inserts)
    .select();
  return { data, error };
}

export async function getStudentAttendanceSummary(studentId: string, classId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('attendance')
    .select('status, date')
    .eq('student_id', studentId)
    .eq('class_id', classId)
    .order('date', { ascending: false });

  if (error || !data) return { summary: null, data: [], error };

  const total = data.length;
  const present = data.filter((a) => a.status === 'present').length;
  const absent = data.filter((a) => a.status === 'absent').length;
  const late = data.filter((a) => a.status === 'late').length;
  const excused = data.filter((a) => a.status === 'excused').length;
  const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

  return {
    summary: { total, present, absent, late, excused, percentage },
    data,
    error: null,
  };
}

export async function getClassAttendanceSummary(classId: string, startDate: string, endDate: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('attendance')
    .select('student_id, status, date, students(first_name, last_name)')
    .eq('class_id', classId)
    .gte('date', startDate)
    .lte('date', endDate);
  return { data, error };
}
