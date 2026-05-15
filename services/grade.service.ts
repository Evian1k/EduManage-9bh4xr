import { getSupabaseClient } from '@/template';
import { getGradeLetter } from '@/constants/config';

export async function getGrades(schoolId: string, classId?: string, term?: string) {
  const supabase = getSupabaseClient();
  let query = supabase
    .from('grades')
    .select('*, students(first_name, last_name, admission_number), subjects(name, code), classes(name, grade_level)')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false });

  if (classId) query = query.eq('class_id', classId);
  if (term) query = query.eq('term', term);

  const { data, error } = await query;
  return { data, error };
}

export async function recordGrade(
  schoolId: string,
  studentId: string,
  subjectId: string,
  classId: string,
  term: string,
  academicYear: string,
  score: number,
  recordedBy: string,
  remarks?: string
) {
  const supabase = getSupabaseClient();
  const { letter } = getGradeLetter(score);

  const { data, error } = await supabase
    .from('grades')
    .upsert({
      school_id: schoolId,
      student_id: studentId,
      subject_id: subjectId,
      class_id: classId,
      term,
      academic_year: academicYear,
      score,
      grade_letter: letter,
      remarks: remarks || '',
      recorded_by: recordedBy,
      updated_at: new Date().toISOString(),
    })
    .select('*, students(first_name, last_name), subjects(name)')
    .single();
  return { data, error };
}

export async function bulkRecordGrades(grades: Array<{
  schoolId: string;
  studentId: string;
  subjectId: string;
  classId: string;
  term: string;
  academicYear: string;
  score: number;
  recordedBy: string;
}>) {
  const supabase = getSupabaseClient();
  const records = grades.map((g) => {
    const { letter } = getGradeLetter(g.score);
    return {
      school_id: g.schoolId,
      student_id: g.studentId,
      subject_id: g.subjectId,
      class_id: g.classId,
      term: g.term,
      academic_year: g.academicYear,
      score: g.score,
      grade_letter: letter,
      recorded_by: g.recordedBy,
    };
  });

  const { data, error } = await supabase.from('grades').upsert(records).select();
  return { data, error };
}

export async function getClassGradeReport(classId: string, term: string, academicYear: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('grades')
    .select('*, students(first_name, last_name, admission_number), subjects(name, code)')
    .eq('class_id', classId)
    .eq('term', term)
    .eq('academic_year', academicYear)
    .order('students(first_name)');
  return { data, error };
}
