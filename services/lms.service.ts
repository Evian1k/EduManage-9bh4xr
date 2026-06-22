// EduManage — LMS service
//
// CRUD for assignments, submissions, lessons, quizzes, quiz questions,
// attempts (auto-marked), learning resources, and student progress.

import { getSupabaseClient } from '@/template';
import { ServiceResult } from '@/lib/types';
import { aiGradeSubmission } from './ai.service';

// ─── Assignments ─────────────────────────────────────────────────────────────

export interface Assignment {
  id: string;
  school_id: string;
  title: string;
  description?: string | null;
  subject_id?: string | null;
  class_id?: string | null;
  stream_id?: string | null;
  teacher_id?: string | null;
  term_id?: string | null;
  assigned_at: string;
  due_at?: string | null;
  max_score: number;
  attachment_url?: string | null;
  created_at: string;
  updated_at: string;
}

export async function getAssignments(
  schoolId: string,
  filters: { classId?: string; teacherId?: string; subjectId?: string } = {},
): Promise<ServiceResult<Assignment[]>> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from('assignments')
    .select('*, subjects(name, code), classes(name)')
    .eq('school_id', schoolId)
    .order('assigned_at', { ascending: false });
  if (filters.classId) q = q.eq('class_id', filters.classId);
  if (filters.teacherId) q = q.eq('teacher_id', filters.teacherId);
  if (filters.subjectId) q = q.eq('subject_id', filters.subjectId);
  const { data, error } = await q;
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as Assignment[], error: null };
}

export async function createAssignment(
  schoolId: string,
  input: {
    title: string;
    description?: string;
    subject_id?: string;
    class_id?: string;
    stream_id?: string;
    teacher_id?: string;
    term_id?: string;
    due_at?: string;
    max_score?: number;
    attachment_url?: string;
  },
): Promise<ServiceResult<Assignment>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('assignments')
    .insert({
      school_id: schoolId,
      title: input.title,
      description: input.description ?? null,
      subject_id: input.subject_id ?? null,
      class_id: input.class_id ?? null,
      stream_id: input.stream_id ?? null,
      teacher_id: input.teacher_id ?? null,
      term_id: input.term_id ?? null,
      due_at: input.due_at ?? null,
      max_score: input.max_score ?? 100,
      attachment_url: input.attachment_url ?? null,
    })
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as Assignment, error: null };
}

// ─── Submissions ─────────────────────────────────────────────────────────────

export interface AssignmentSubmission {
  id: string;
  school_id: string;
  assignment_id: string;
  student_id: string;
  submitted_at: string;
  submission_url?: string | null;
  submission_text?: string | null;
  score?: number | null;
  graded_by?: string | null;
  graded_at?: string | null;
  feedback?: string | null;
  ai_feedback?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export async function getAssignmentSubmissions(
  schoolId: string,
  assignmentId: string,
): Promise<ServiceResult<AssignmentSubmission[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('assignment_submissions')
    .select('*, students(full_name, admission_number)')
    .eq('school_id', schoolId)
    .eq('assignment_id', assignmentId)
    .order('submitted_at', { ascending: false });
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as AssignmentSubmission[], error: null };
}

export async function submitAssignment(
  schoolId: string,
  input: {
    assignment_id: string;
    student_id: string;
    submission_text?: string;
    submission_url?: string;
  },
): Promise<ServiceResult<AssignmentSubmission>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('assignment_submissions')
    .upsert(
      {
        school_id: schoolId,
        assignment_id: input.assignment_id,
        student_id: input.student_id,
        submission_text: input.submission_text ?? null,
        submission_url: input.submission_url ?? null,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: 'assignment_id,student_id' },
    )
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as AssignmentSubmission, error: null };
}

export interface GradeSubmissionInput {
  submission_id: string;
  score: number;
  feedback?: string;
  graded_by: string;
  aiGrade?: boolean; // if true, ignore score and let the AI edge fn grade
  assignment?: {
    title: string;
    description?: string;
    rubric?: string;
    maxScore?: number;
  };
}

export async function gradeSubmission(
  schoolId: string,
  input: GradeSubmissionInput,
): Promise<ServiceResult<AssignmentSubmission>> {
  const supabase = getSupabaseClient();
  let score = input.score;
  let feedback = input.feedback ?? null;
  let aiFeedback: string | null = null;

  if (input.aiGrade && input.assignment) {
    const submissionRes = await supabase
      .from('assignment_submissions')
      .select('submission_text, submission_url')
      .eq('id', input.submission_id)
      .maybeSingle();
    const text =
      (submissionRes.data as { submission_text?: string } | null)?.submission_text ?? '';
    const ai = await aiGradeSubmission(schoolId, {
      assignmentTitle: input.assignment.title,
      assignmentDescription: input.assignment.description ?? '',
      rubric: input.assignment.rubric ?? '',
      submissionText: text,
      maxScore: input.assignment.maxScore ?? 100,
    });
    if (ai.data) {
      aiFeedback = ai.data;
      feedback = feedback ? `${feedback}\n\n[AI Feedback]\n${aiFeedback}` : aiFeedback;
      // Naive score extraction: search for "Score:" in AI output
      const m = ai.data.match(/Score:\s*(\d+)/i);
      if (m) score = parseInt(m[1], 10);
    }
  }

  const { data, error } = await supabase
    .from('assignment_submissions')
    .update({
      score,
      feedback,
      ai_feedback: aiFeedback,
      graded_by: input.graded_by,
      graded_at: new Date().toISOString(),
    })
    .eq('id', input.submission_id)
    .eq('school_id', schoolId)
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as AssignmentSubmission, error: null };
}

// ─── Lessons ─────────────────────────────────────────────────────────────────

export interface Lesson {
  id: string;
  school_id: string;
  title: string;
  description?: string | null;
  subject_id?: string | null;
  class_id?: string | null;
  teacher_id?: string | null;
  content_url?: string | null;
  notes?: string | null;
  scheduled_at?: string | null;
  duration_minutes: number;
  created_at: string;
  updated_at: string;
}

export async function getLessons(
  schoolId: string,
  filters: { classId?: string; subjectId?: string; teacherId?: string } = {},
): Promise<ServiceResult<Lesson[]>> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from('lessons')
    .select('*')
    .eq('school_id', schoolId)
    .order('scheduled_at', { ascending: false });
  if (filters.classId) q = q.eq('class_id', filters.classId);
  if (filters.subjectId) q = q.eq('subject_id', filters.subjectId);
  if (filters.teacherId) q = q.eq('teacher_id', filters.teacherId);
  const { data, error } = await q;
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as Lesson[], error: null };
}

export async function createLesson(
  schoolId: string,
  input: {
    title: string;
    description?: string;
    subject_id?: string;
    class_id?: string;
    teacher_id?: string;
    content_url?: string;
    notes?: string;
    scheduled_at?: string;
    duration_minutes?: number;
  },
): Promise<ServiceResult<Lesson>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('lessons')
    .insert({
      school_id: schoolId,
      title: input.title,
      description: input.description ?? null,
      subject_id: input.subject_id ?? null,
      class_id: input.class_id ?? null,
      teacher_id: input.teacher_id ?? null,
      content_url: input.content_url ?? null,
      notes: input.notes ?? null,
      scheduled_at: input.scheduled_at ?? null,
      duration_minutes: input.duration_minutes ?? 40,
    })
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as Lesson, error: null };
}

// ─── Quizzes ─────────────────────────────────────────────────────────────────

export interface Quiz {
  id: string;
  school_id: string;
  title: string;
  description?: string | null;
  subject_id?: string | null;
  class_id?: string | null;
  teacher_id?: string | null;
  total_marks: number;
  pass_mark: number;
  duration_minutes: number;
  start_at?: string | null;
  end_at?: string | null;
  is_auto_marked: boolean;
  created_at: string;
  updated_at: string;
}

export async function getQuizzes(
  schoolId: string,
  filters: { classId?: string; subjectId?: string } = {},
): Promise<ServiceResult<Quiz[]>> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from('quizzes')
    .select('*')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false });
  if (filters.classId) q = q.eq('class_id', filters.classId);
  if (filters.subjectId) q = q.eq('subject_id', filters.subjectId);
  const { data, error } = await q;
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as Quiz[], error: null };
}

export async function createQuiz(
  schoolId: string,
  input: {
    title: string;
    description?: string;
    subject_id?: string;
    class_id?: string;
    teacher_id?: string;
    total_marks?: number;
    pass_mark?: number;
    duration_minutes?: number;
    start_at?: string;
    end_at?: string;
    is_auto_marked?: boolean;
  },
): Promise<ServiceResult<Quiz>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('quizzes')
    .insert({
      school_id: schoolId,
      title: input.title,
      description: input.description ?? null,
      subject_id: input.subject_id ?? null,
      class_id: input.class_id ?? null,
      teacher_id: input.teacher_id ?? null,
      total_marks: input.total_marks ?? 100,
      pass_mark: input.pass_mark ?? 50,
      duration_minutes: input.duration_minutes ?? 60,
      start_at: input.start_at ?? null,
      end_at: input.end_at ?? null,
      is_auto_marked: input.is_auto_marked ?? true,
    })
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as Quiz, error: null };
}

export interface QuizQuestion {
  id: string;
  quiz_id: string;
  question_text: string;
  question_type: string;
  options?: unknown;
  correct_answer?: string | null;
  marks: number;
  explanation?: string | null;
  position: number;
}

export async function addQuizQuestion(
  schoolId: string,
  input: {
    quiz_id: string;
    question_text: string;
    question_type: string;
    options?: string[];
    correct_answer?: string;
    marks?: number;
    explanation?: string;
    position?: number;
  },
): Promise<ServiceResult<QuizQuestion>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('quiz_questions')
    .insert({
      school_id: schoolId,
      quiz_id: input.quiz_id,
      question_text: input.question_text,
      question_type: input.question_type,
      options: input.options ?? null,
      correct_answer: input.correct_answer ?? null,
      marks: input.marks ?? 1,
      explanation: input.explanation ?? null,
      position: input.position ?? 0,
    })
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as QuizQuestion, error: null };
}

export async function getQuizQuestions(
  schoolId: string,
  quizId: string,
): Promise<ServiceResult<QuizQuestion[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('quiz_questions')
    .select('*')
    .eq('school_id', schoolId)
    .eq('quiz_id', quizId)
    .order('position', { ascending: true });
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as QuizQuestion[], error: null };
}

// ─── Quiz attempts (auto-marked) ─────────────────────────────────────────────

export interface QuizAttempt {
  id: string;
  school_id: string;
  quiz_id: string;
  student_id: string;
  answers: Record<string, string>;
  score: number;
  total_marks: number;
  started_at: string;
  submitted_at?: string | null;
  passed: boolean;
  created_at: string;
}

export async function submitQuizAttempt(
  schoolId: string,
  input: {
    quiz_id: string;
    student_id: string;
    answers: Record<string, string>; // question_id → answer
  },
): Promise<ServiceResult<QuizAttempt>> {
  const supabase = getSupabaseClient();
  // Load the quiz + questions to auto-mark
  const [quizRes, questionsRes] = await Promise.all([
    supabase.from('quizzes').select('*').eq('id', input.quiz_id).eq('school_id', schoolId).maybeSingle(),
    supabase
      .from('quiz_questions')
      .select('id, correct_answer, marks')
      .eq('quiz_id', input.quiz_id)
      .eq('school_id', schoolId),
  ]);
  if (quizRes.error) return { data: null, error: quizRes.error.message };
  if (questionsRes.error) return { data: null, error: questionsRes.error.message };
  const quiz = quizRes.data as { total_marks?: number; pass_mark?: number; is_auto_marked?: boolean } | null;
  const questions = (questionsRes.data ?? []) as Array<{ id: string; correct_answer?: string | null; marks: number }>;

  let score = 0;
  let totalMarks = 0;
  for (const q of questions) {
    totalMarks += Number(q.marks ?? 0);
    const ans = input.answers[q.id];
    if (ans && q.correct_answer && String(ans).trim().toLowerCase() === String(q.correct_answer).trim().toLowerCase()) {
      score += Number(q.marks ?? 0);
    }
  }
  // If the quiz had a configured total_marks that differs from the sum, use the configured value
  if (quiz?.total_marks && quiz.total_marks !== totalMarks) {
    totalMarks = quiz.total_marks;
  }
  const passed = score >= (quiz?.pass_mark ?? 50);

  const { data, error } = await supabase
    .from('quiz_attempts')
    .insert({
      school_id: schoolId,
      quiz_id: input.quiz_id,
      student_id: input.student_id,
      answers: input.answers,
      score,
      total_marks: totalMarks,
      started_at: new Date().toISOString(),
      submitted_at: new Date().toISOString(),
      passed,
    })
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as QuizAttempt, error: null };
}

export async function getStudentQuizAttempts(
  schoolId: string,
  studentId: string,
  quizId?: string,
): Promise<ServiceResult<QuizAttempt[]>> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from('quiz_attempts')
    .select('*, quizzes(title)')
    .eq('school_id', schoolId)
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });
  if (quizId) q = q.eq('quiz_id', quizId);
  const { data, error } = await q;
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as QuizAttempt[], error: null };
}

// ─── Learning resources ──────────────────────────────────────────────────────

export interface LearningResource {
  id: string;
  school_id: string;
  title: string;
  description?: string | null;
  resource_type?: string | null;
  url?: string | null;
  subject_id?: string | null;
  class_id?: string | null;
  uploaded_by?: string | null;
  is_public: boolean;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

export async function getLearningResources(
  schoolId: string,
  filters: { subjectId?: string; classId?: string; resourceType?: string } = {},
): Promise<ServiceResult<LearningResource[]>> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from('learning_resources')
    .select('*')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false });
  if (filters.subjectId) q = q.eq('subject_id', filters.subjectId);
  if (filters.classId) q = q.eq('class_id', filters.classId);
  if (filters.resourceType) q = q.eq('resource_type', filters.resourceType);
  const { data, error } = await q;
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as LearningResource[], error: null };
}

export async function uploadLearningResource(
  schoolId: string,
  input: {
    title: string;
    description?: string;
    resource_type?: string;
    url?: string;
    subject_id?: string;
    class_id?: string;
    uploaded_by?: string;
    is_public?: boolean;
  },
): Promise<ServiceResult<LearningResource>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('learning_resources')
    .insert({
      school_id: schoolId,
      title: input.title,
      description: input.description ?? null,
      resource_type: input.resource_type ?? null,
      url: input.url ?? null,
      subject_id: input.subject_id ?? null,
      class_id: input.class_id ?? null,
      uploaded_by: input.uploaded_by ?? null,
      is_public: input.is_public ?? false,
    })
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as LearningResource, error: null };
}

// ─── Student progress ────────────────────────────────────────────────────────

export interface StudentProgress {
  id: string;
  school_id: string;
  student_id: string;
  subject_id?: string | null;
  metric: string;
  value: number;
  recorded_at: string;
  metadata?: Record<string, unknown> | null;
}

export async function getStudentProgress(
  schoolId: string,
  studentId: string,
  subjectId?: string,
): Promise<ServiceResult<StudentProgress[]>> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from('student_progress')
    .select('*')
    .eq('school_id', schoolId)
    .eq('student_id', studentId)
    .order('recorded_at', { ascending: false });
  if (subjectId) q = q.eq('subject_id', subjectId);
  const { data, error } = await q;
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as StudentProgress[], error: null };
}

export async function recordProgress(
  schoolId: string,
  input: {
    student_id: string;
    subject_id?: string;
    metric: string;
    value: number;
  },
): Promise<ServiceResult<StudentProgress>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('student_progress')
    .insert({
      school_id: schoolId,
      student_id: input.student_id,
      subject_id: input.subject_id ?? null,
      metric: input.metric,
      value: input.value,
      recorded_at: new Date().toISOString(),
    })
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as StudentProgress, error: null };
}
