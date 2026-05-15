import { getSupabaseClient } from '@/template';

export interface AssignmentInput {
  class_id: string;
  subject_id?: string;
  teacher_id: string;
  title: string;
  description?: string;
  due_date?: string;
  max_score?: number;
  assignment_type?: string;
  is_published?: boolean;
}

export async function getAssignments(schoolId: string, teacherId?: string, classId?: string) {
  const supabase = getSupabaseClient();
  let query = supabase
    .from('assignments')
    .select('*, subjects(name), classes(name, grade_level, section)')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false });

  if (teacherId) query = query.eq('teacher_id', teacherId);
  if (classId) query = query.eq('class_id', classId);

  const { data, error } = await query;
  return { data, error };
}

export async function getAssignmentById(assignmentId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('assignments')
    .select('*, subjects(name, code), classes(name, grade_level, section), assignment_submissions(id, student_id, status, score, submitted_at, students(first_name, last_name))')
    .eq('id', assignmentId)
    .single();
  return { data, error };
}

export async function createAssignment(schoolId: string, input: AssignmentInput) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('assignments')
    .insert({ ...input, school_id: schoolId })
    .select('*, subjects(name), classes(name)')
    .single();
  return { data, error };
}

export async function updateAssignment(assignmentId: string, updates: Partial<AssignmentInput>) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('assignments')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', assignmentId)
    .select()
    .single();
  return { data, error };
}

export async function deleteAssignment(assignmentId: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('assignments').delete().eq('id', assignmentId);
  return { error };
}

export async function getSubmissions(assignmentId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('assignment_submissions')
    .select('*, students(first_name, last_name, admission_number)')
    .eq('assignment_id', assignmentId)
    .order('submitted_at', { ascending: false });
  return { data, error };
}

export async function gradeSubmission(
  submissionId: string,
  score: number,
  feedback: string,
  gradedBy: string
) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('assignment_submissions')
    .update({
      score,
      feedback,
      graded_by: gradedBy,
      graded_at: new Date().toISOString(),
      status: 'graded',
    })
    .eq('id', submissionId)
    .select()
    .single();
  return { data, error };
}

export async function toggleAssignmentPublish(assignmentId: string, isPublished: boolean) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('assignments')
    .update({ is_published: isPublished })
    .eq('id', assignmentId)
    .select()
    .single();
  return { data, error };
}
