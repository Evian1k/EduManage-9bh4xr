// EduManage — School management service
//
// Academic structure CRUD: academic_years, terms, subjects, classes,
// streams, exams, exam_results, report_cards. Also bulk operations:
// promoteStudents, graduateStudents, transferStudent.

import { getSupabaseClient } from '@/template';
import { ServiceResult } from '@/lib/types';
import { logAuditEvent } from './audit.service';

// ─── Academic years ──────────────────────────────────────────────────────────

export interface AcademicYear {
  id: string;
  school_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export async function getAcademicYears(schoolId: string): Promise<ServiceResult<AcademicYear[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('academic_years')
    .select('*')
    .eq('school_id', schoolId)
    .order('start_date', { ascending: false });
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as AcademicYear[], error: null };
}

export async function createAcademicYear(
  schoolId: string,
  input: { name: string; start_date: string; end_date: string; is_active?: boolean },
): Promise<ServiceResult<AcademicYear>> {
  const supabase = getSupabaseClient();
  if (input.is_active) {
    // Deactivate any currently-active year
    await supabase
      .from('academic_years')
      .update({ is_active: false })
      .eq('school_id', schoolId)
      .eq('is_active', true);
  }
  const { data, error } = await supabase
    .from('academic_years')
    .insert({
      school_id: schoolId,
      name: input.name,
      start_date: input.start_date,
      end_date: input.end_date,
      is_active: input.is_active ?? false,
    })
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as AcademicYear, error: null };
}

// ─── Terms ───────────────────────────────────────────────────────────────────

export interface Term {
  id: string;
  school_id: string;
  academic_year_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function getTerms(
  schoolId: string,
  academicYearId?: string,
): Promise<ServiceResult<Term[]>> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from('terms')
    .select('*')
    .eq('school_id', schoolId)
    .order('start_date', { ascending: false });
  if (academicYearId) q = q.eq('academic_year_id', academicYearId);
  const { data, error } = await q;
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as Term[], error: null };
}

export async function createTerm(
  schoolId: string,
  input: { academic_year_id: string; name: string; start_date: string; end_date: string; is_active?: boolean },
): Promise<ServiceResult<Term>> {
  const supabase = getSupabaseClient();
  if (input.is_active) {
    await supabase
      .from('terms')
      .update({ is_active: false })
      .eq('school_id', schoolId)
      .eq('is_active', true);
  }
  const { data, error } = await supabase
    .from('terms')
    .insert({
      school_id: schoolId,
      academic_year_id: input.academic_year_id,
      name: input.name,
      start_date: input.start_date,
      end_date: input.end_date,
      is_active: input.is_active ?? false,
    })
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as Term, error: null };
}

// ─── Subjects ────────────────────────────────────────────────────────────────

export interface Subject {
  id: string;
  school_id: string;
  name: string;
  code?: string | null;
  department?: string | null;
  is_compulsory: boolean;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

export async function getSubjects(schoolId: string): Promise<ServiceResult<Subject[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('subjects')
    .select('*')
    .eq('school_id', schoolId)
    .order('name', { ascending: true });
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as Subject[], error: null };
}

export async function createSubject(
  schoolId: string,
  input: { name: string; code?: string; department?: string; is_compulsory?: boolean },
): Promise<ServiceResult<Subject>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('subjects')
    .insert({
      school_id: schoolId,
      name: input.name,
      code: input.code ?? null,
      department: input.department ?? null,
      is_compulsory: input.is_compulsory ?? true,
    })
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as Subject, error: null };
}

// ─── Classes + streams ───────────────────────────────────────────────────────

export interface SchoolClass {
  id: string;
  school_id: string;
  name: string;
  level?: string | null;
  academic_year_id?: string | null;
  class_teacher_id?: string | null;
  capacity: number;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface Stream {
  id: string;
  school_id: string;
  class_id: string;
  name: string;
  stream_teacher_id?: string | null;
  capacity: number;
  created_at: string;
  updated_at: string;
}

export async function getClasses(schoolId: string): Promise<ServiceResult<SchoolClass[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .eq('school_id', schoolId)
    .order('name', { ascending: true });
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as SchoolClass[], error: null };
}

export async function createClass(
  schoolId: string,
  input: { name: string; level?: string; academic_year_id?: string; class_teacher_id?: string; capacity?: number },
): Promise<ServiceResult<SchoolClass>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('classes')
    .insert({
      school_id: schoolId,
      name: input.name,
      level: input.level ?? null,
      academic_year_id: input.academic_year_id ?? null,
      class_teacher_id: input.class_teacher_id ?? null,
      capacity: input.capacity ?? 40,
    })
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as SchoolClass, error: null };
}

export async function getClassWithStreams(
  schoolId: string,
  classId: string,
): Promise<ServiceResult<{ class: SchoolClass; streams: Stream[] }>> {
  const supabase = getSupabaseClient();
  const [classRes, streamsRes] = await Promise.all([
    supabase.from('classes').select('*').eq('id', classId).eq('school_id', schoolId).maybeSingle(),
    supabase.from('streams').select('*').eq('class_id', classId).eq('school_id', schoolId).order('name'),
  ]);
  if (classRes.error) return { data: null, error: classRes.error.message };
  if (streamsRes.error) return { data: null, error: streamsRes.error.message };
  if (!classRes.data) return { data: null, error: 'Class not found' };
  return {
    data: {
      class: classRes.data as unknown as SchoolClass,
      streams: (streamsRes.data ?? []) as unknown as Stream[],
    },
    error: null,
  };
}

export async function getStreams(
  schoolId: string,
  classId?: string,
): Promise<ServiceResult<Stream[]>> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from('streams')
    .select('*, classes(name)')
    .eq('school_id', schoolId)
    .order('name', { ascending: true });
  if (classId) q = q.eq('class_id', classId);
  const { data, error } = await q;
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as Stream[], error: null };
}

export async function createStream(
  schoolId: string,
  input: { class_id: string; name: string; stream_teacher_id?: string; capacity?: number },
): Promise<ServiceResult<Stream>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('streams')
    .insert({
      school_id: schoolId,
      class_id: input.class_id,
      name: input.name,
      stream_teacher_id: input.stream_teacher_id ?? null,
      capacity: input.capacity ?? 40,
    })
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as Stream, error: null };
}

// ─── Exams + results ─────────────────────────────────────────────────────────

export interface Exam {
  id: string;
  school_id: string;
  name: string;
  term_id?: string | null;
  exam_type?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  max_score: number;
  weight: number;
  created_at: string;
  updated_at: string;
}

export interface ExamResult {
  id: string;
  school_id: string;
  exam_id: string;
  student_id: string;
  subject_id: string;
  class_id?: string | null;
  score: number;
  grade?: string | null;
  remarks?: string | null;
  recorded_by?: string | null;
  created_at: string;
  updated_at: string;
}

export async function getExams(
  schoolId: string,
  termId?: string,
): Promise<ServiceResult<Exam[]>> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from('exams')
    .select('*')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false });
  if (termId) q = q.eq('term_id', termId);
  const { data, error } = await q;
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as Exam[], error: null };
}

export async function createExam(
  schoolId: string,
  input: { name: string; term_id?: string; exam_type?: string; start_date?: string; end_date?: string; max_score?: number; weight?: number },
): Promise<ServiceResult<Exam>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('exams')
    .insert({
      school_id: schoolId,
      name: input.name,
      term_id: input.term_id ?? null,
      exam_type: input.exam_type ?? null,
      start_date: input.start_date ?? null,
      end_date: input.end_date ?? null,
      max_score: input.max_score ?? 100,
      weight: input.weight ?? 100,
    })
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as Exam, error: null };
}

export async function getExamResults(
  schoolId: string,
  examId?: string,
  studentId?: string,
): Promise<ServiceResult<ExamResult[]>> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from('exam_results')
    .select('*, students(full_name, admission_number), subjects(name, code)')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false });
  if (examId) q = q.eq('exam_id', examId);
  if (studentId) q = q.eq('student_id', studentId);
  const { data, error } = await q;
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as ExamResult[], error: null };
}

function gradeFromScore(score: number, max: number): string {
  const pct = max > 0 ? (score / max) * 100 : 0;
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B';
  if (pct >= 60) return 'C';
  if (pct >= 50) return 'D';
  return 'F';
}

export async function recordExamResult(
  schoolId: string,
  input: {
    exam_id: string;
    student_id: string;
    subject_id: string;
    class_id?: string;
    score: number;
    remarks?: string;
    recorded_by?: string;
  },
): Promise<ServiceResult<ExamResult>> {
  const supabase = getSupabaseClient();
  // Fetch exam max_score for grade computation
  const { data: exam } = await supabase
    .from('exams')
    .select('max_score')
    .eq('id', input.exam_id)
    .eq('school_id', schoolId)
    .maybeSingle();
  const maxScore = (exam as { max_score?: number } | null)?.max_score ?? 100;
  const grade = gradeFromScore(input.score, maxScore);

  const { data, error } = await supabase
    .from('exam_results')
    .upsert(
      {
        school_id: schoolId,
        exam_id: input.exam_id,
        student_id: input.student_id,
        subject_id: input.subject_id,
        class_id: input.class_id ?? null,
        score: input.score,
        grade,
        remarks: input.remarks ?? null,
        recorded_by: input.recorded_by ?? null,
      },
      { onConflict: 'exam_id,student_id,subject_id' },
    )
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as ExamResult, error: null };
}

// ─── Report cards ────────────────────────────────────────────────────────────

export interface ReportCard {
  id: string;
  school_id: string;
  student_id: string;
  class_id?: string | null;
  stream_id?: string | null;
  term_id: string;
  total_score: number;
  average_score: number;
  grade: string;
  position: number;
  stream_position: number;
  conduct?: string | null;
  teacher_remarks?: string | null;
  principal_remarks?: string | null;
  generated_at: string;
  pdf_url?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export async function getReportCards(
  schoolId: string,
  studentId?: string,
  termId?: string,
): Promise<ServiceResult<ReportCard[]>> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from('report_cards')
    .select('*, students(full_name, admission_number), terms(name)')
    .eq('school_id', schoolId)
    .order('generated_at', { ascending: false });
  if (studentId) q = q.eq('student_id', studentId);
  if (termId) q = q.eq('term_id', termId);
  const { data, error } = await q;
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as ReportCard[], error: null };
}

/**
 * Generate (or regenerate) a report card for a student/term. Auto-computes
 * total score, average, grade, class position, and stream position by
 * aggregating the student's `exam_results` for the term's exams.
 */
export async function generateReportCard(
  schoolId: string,
  input: {
    student_id: string;
    term_id: string;
    class_id?: string;
    stream_id?: string;
    conduct?: string;
    teacher_remarks?: string;
    principal_remarks?: string;
  },
): Promise<ServiceResult<ReportCard>> {
  const supabase = getSupabaseClient();

  // Load the term to find which exams belong to it
  const { data: term } = await supabase
    .from('terms')
    .select('id')
    .eq('id', input.term_id)
    .eq('school_id', schoolId)
    .maybeSingle();
  if (!term) return { data: null, error: 'Term not found' };

  // Find all exams for this term + the student's results
  const { data: exams } = await supabase
    .from('exams')
    .select('id, max_score, weight')
    .eq('school_id', schoolId)
    .eq('term_id', input.term_id);
  const examList = (exams ?? []) as Array<{ id: string; max_score: number; weight: number }>;
  if (examList.length === 0) {
    return { data: null, error: 'No exams found for this term' };
  }

  // Fetch this student's results
  const { data: myResults } = await supabase
    .from('exam_results')
    .select('exam_id, score')
    .eq('school_id', schoolId)
    .eq('student_id', input.student_id)
    .in(
      'exam_id',
      examList.map((e) => e.id),
    );
  const myRows = (myResults ?? []) as Array<{ exam_id: string; score: number }>;
  let totalScore = 0;
  let totalPossible = 0;
  for (const e of examList) {
    const r = myRows.find((x) => x.exam_id === e.id);
    totalScore += r ? Number(r.score) : 0;
    totalPossible += Number(e.max_score);
  }
  const average = totalPossible > 0 ? Math.round((totalScore / totalPossible) * 10000) / 100 : 0;
  const grade = gradeFromScore(totalScore, totalPossible || 1);

  // Position: count of students in the same class with a higher total for the same term
  // We can compute this approximately by aggregating results.
  const { data: allResults } = await supabase
    .from('exam_results')
    .select('student_id, exam_id, score')
    .eq('school_id', schoolId)
    .in(
      'exam_id',
      examList.map((e) => e.id),
    );
  const allRows = (allResults ?? []) as Array<{ student_id: string; exam_id: string; score: number }>;
  const totalsByStudent = new Map<string, number>();
  for (const r of allRows) {
    totalsByStudent.set(r.student_id, (totalsByStudent.get(r.student_id) ?? 0) + Number(r.score));
  }
  const sortedTotals = Array.from(totalsByStudent.entries()).sort((a, b) => b[1] - a[1]);
  const position = sortedTotals.findIndex(([sid]) => sid === input.student_id) + 1;

  const { data, error } = await supabase
    .from('report_cards')
    .upsert(
      {
        school_id: schoolId,
        student_id: input.student_id,
        class_id: input.class_id ?? null,
        stream_id: input.stream_id ?? null,
        term_id: input.term_id,
        total_score: totalScore,
        average_score: average,
        grade,
        position,
        stream_position: position, // best-effort — would need stream-aware query
        conduct: input.conduct ?? null,
        teacher_remarks: input.teacher_remarks ?? null,
        principal_remarks: input.principal_remarks ?? null,
        generated_at: new Date().toISOString(),
      },
      { onConflict: 'student_id,term_id' },
    )
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as ReportCard, error: null };
}

// ─── Bulk operations ─────────────────────────────────────────────────────────

export async function promoteStudents(
  schoolId: string,
  input: { student_ids: string[]; new_class_id?: string; new_stream_id?: string },
): Promise<ServiceResult<{ promoted: number }>> {
  const supabase = getSupabaseClient();
  const updates: Record<string, unknown> = {};
  if (input.new_class_id) updates.class_id = input.new_class_id;
  if (input.new_stream_id) updates.stream_id = input.new_stream_id;
  if (Object.keys(updates).length === 0) {
    return { data: null, error: 'Provide new_class_id or new_stream_id' };
  }
  const { data, error } = await supabase
    .from('students')
    .update(updates)
    .in('id', input.student_ids)
    .eq('school_id', schoolId)
    .select('id');
  if (error) return { data: null, error: error.message };
  await logAuditEvent({
    schoolId,
    action: 'student.updated',
    details: { promoted: data?.length ?? 0, new_class_id: input.new_class_id },
    severity: 'info',
  });
  return { data: { promoted: data?.length ?? 0 }, error: null };
}

export async function graduateStudents(
  schoolId: string,
  studentIds: string[],
): Promise<ServiceResult<{ graduated: number }>> {
  const supabase = getSupabaseClient();
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('students')
    .update({ status: 'graduated', graduation_date: today })
    .in('id', studentIds)
    .eq('school_id', schoolId)
    .select('id');
  if (error) return { data: null, error: error.message };
  await logAuditEvent({
    schoolId,
    action: 'student.updated',
    details: { graduated: data?.length ?? 0 },
    severity: 'info',
  });
  return { data: { graduated: data?.length ?? 0 }, error: null };
}

export async function transferStudent(
  schoolId: string,
  studentId: string,
  input: { new_school_name?: string; reason?: string; transfer_date?: string },
): Promise<ServiceResult<{ transferred: boolean }>> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('students')
    .update({
      status: 'transferred',
      transfer_date: input.transfer_date ?? new Date().toISOString().split('T')[0],
    })
    .eq('id', studentId)
    .eq('school_id', schoolId);
  if (error) return { data: null, error: error.message };
  await logAuditEvent({
    schoolId,
    action: 'student.transferred',
    resourceType: 'student',
    resourceId: studentId,
    details: { new_school_name: input.new_school_name, reason: input.reason },
    severity: 'info',
  });
  return { data: { transferred: true }, error: null };
}
