// EduManage — Assignment service (legacy compatibility shim)
//
// The full LMS implementation lives in `services/lms.service.ts`. This file
// re-exports the assignment + submission functions under the names that
// older screens still import (`getAssignments`, `createAssignment`,
// `getSubmissions`, `submitAssignment`, `gradeSubmission`).

import { getSupabaseClient } from '@/template';
import { ServiceResult } from '@/lib/types';

export interface AssignmentInput {
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
}

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

export async function getAssignments(
  schoolId: string,
  teacherId?: string,
  classId?: string,
): Promise<ServiceResult<Assignment[]>> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from('assignments')
    .select('*, subjects(name, code), classes(name)')
    .eq('school_id', schoolId)
    .order('assigned_at', { ascending: false });
  if (teacherId) q = q.eq('teacher_id', teacherId);
  if (classId) q = q.eq('class_id', classId);
  const { data, error } = await q;
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as Assignment[], error: null };
}

export async function getAssignmentById(
  schoolId: string,
  assignmentId: string,
): Promise<ServiceResult<Assignment>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('assignments')
    .select('*, subjects(name, code), classes(name)')
    .eq('id', assignmentId)
    .eq('school_id', schoolId)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: 'Assignment not found' };
  return { data: data as unknown as Assignment, error: null };
}

export async function createAssignment(
  schoolId: string,
  input: AssignmentInput,
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

export async function getSubmissions(
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

export async function gradeSubmission(
  schoolId: string,
  input: {
    submission_id: string;
    score: number;
    feedback?: string;
    graded_by: string;
  },
): Promise<ServiceResult<AssignmentSubmission>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('assignment_submissions')
    .update({
      score: input.score,
      feedback: input.feedback ?? null,
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
