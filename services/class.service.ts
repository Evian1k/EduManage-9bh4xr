// EduManage — Class service (legacy compatibility shim)
//
// Re-exports the academic-structure functions from
// `services/school_management.service.ts` under the names that older
// screens still import (`getClasses`, `createClass`, `getStreams`,
// `createStream`, `getSubjects`, `createSubject`).

import { getSupabaseClient } from '@/template';
import { ServiceResult } from '@/lib/types';
import {
  getClasses as mgmtGetClasses,
  createClass as mgmtCreateClass,
  getStreams as mgmtGetStreams,
  createStream as mgmtCreateStream,
  getSubjects as mgmtGetSubjects,
  createSubject as mgmtCreateSubject,
  SchoolClass,
  Stream,
  Subject,
} from './school_management.service';

export interface { SchoolClass, Stream, Subject };

export const getClasses = mgmtGetClasses;

export function createClass(
  schoolId: string,
  name: string,
  level?: string,
  academicYearId?: string,
  capacity?: number,
  classTeacherId?: string,
): Promise<ServiceResult<SchoolClass>> {
  return mgmtCreateClass(schoolId, {
    name,
    level,
    academic_year_id: academicYearId,
    capacity,
    class_teacher_id: classTeacherId,
  });
}

export const getStreams = mgmtGetStreams;
export const createStream = mgmtCreateStream;
export const getSubjects = mgmtGetSubjects;
export const createSubject = mgmtCreateSubject;

// ─── Extra helpers (not in school_management.service) ────────────────────────

export async function getClassById(
  schoolId: string,
  classId: string,
): Promise<ServiceResult<SchoolClass>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .eq('id', classId)
    .eq('school_id', schoolId)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: 'Class not found' };
  return { data: data as unknown as SchoolClass, error: null };
}

export async function updateClass(
  schoolId: string,
  classId: string,
  updates: Partial<SchoolClass>,
): Promise<ServiceResult<SchoolClass>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('classes')
    .update(updates)
    .eq('id', classId)
    .eq('school_id', schoolId)
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as SchoolClass, error: null };
}

export async function deleteClass(
  schoolId: string,
  classId: string,
): Promise<ServiceResult<{ deleted: boolean }>> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('classes')
    .delete()
    .eq('id', classId)
    .eq('school_id', schoolId);
  if (error) return { data: null, error: error.message };
  return { data: { deleted: true }, error: null };
}
