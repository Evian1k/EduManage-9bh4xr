// EduManage — Grade service (legacy compatibility shim)
//
// The new schema uses `exam_results` (per-exam) + `report_cards` (aggregated
// per term). This module preserves the `grades` vocabulary older screens
// use by delegating to `school_management.service.ts#recordExamResult` and
// `#getExamResults`, plus a convenience `getStudentGrades` helper.

import { getSupabaseClient } from '@/template';
import { ServiceResult } from '@/lib/types';
import { getGradeLetter } from '@/constants/config';
import {
  recordExamResult as mgmtRecordExamResult,
  getExamResults as mgmtGetExamResults,
  ExamResult,
} from './school_management.service';

export { ExamResult };

export interface GradeInput {
  student_id: string;
  subject_id: string;
  class_id?: string;
  exam_id: string;
  score: number;
  remarks?: string;
  recorded_by?: string;
}

export async function getGrades(
  schoolId: string,
  filters: { classId?: string; studentId?: string; examId?: string } = {},
): Promise<ServiceResult<ExamResult[]>> {
  return mgmtGetExamResults(schoolId, filters.examId, filters.studentId);
}

export async function recordGrade(
  schoolId: string,
  input: GradeInput,
): Promise<ServiceResult<ExamResult>> {
  return mgmtRecordExamResult(schoolId, {
    exam_id: input.exam_id,
    student_id: input.student_id,
    subject_id: input.subject_id,
    class_id: input.class_id,
    score: input.score,
    remarks: input.remarks,
    recorded_by: input.recorded_by,
  });
}

export async function bulkRecordGrades(
  schoolId: string,
  grades: GradeInput[],
): Promise<ServiceResult<ExamResult[]>> {
  const results: ExamResult[] = [];
  for (const g of grades) {
    const r = await recordGrade(schoolId, g);
    if (r.error) return { data: null, error: r.error };
    if (r.data) results.push(r.data);
  }
  return { data: results, error: null };
}

export async function getStudentGrades(
  schoolId: string,
  studentId: string,
): Promise<ServiceResult<ExamResult[]>> {
  return mgmtGetExamResults(schoolId, undefined, studentId);
}

export async function getClassGradeReport(
  schoolId: string,
  classId: string,
  _term?: string,
  _academicYear?: string,
): Promise<ServiceResult<ExamResult[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('exam_results')
    .select('*, students(full_name, admission_number), subjects(name, code)')
    .eq('school_id', schoolId)
    .eq('class_id', classId)
    .order('created_at', { ascending: false });
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as ExamResult[], error: null };
}

export { getGradeLetter };
