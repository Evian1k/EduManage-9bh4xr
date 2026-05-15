import { getSupabaseClient } from '@/template';

export async function getStudentMedicalRecord(studentId: string) {
  const supabase = getSupabaseClient();
  return supabase
    .from('medical_records')
    .select('*')
    .eq('student_id', studentId)
    .maybeSingle();
}

export async function upsertMedicalRecord(studentId: string, schoolId: string, data: any) {
  const supabase = getSupabaseClient();
  return supabase
    .from('medical_records')
    .upsert({ ...data, student_id: studentId, school_id: schoolId, updated_at: new Date().toISOString() })
    .select()
    .single();
}

export async function getClinicVisits(schoolId: string, studentId?: string) {
  const supabase = getSupabaseClient();
  let query = supabase
    .from('clinic_visits')
    .select('*, students(first_name, last_name, admission_number, classes(name))')
    .eq('school_id', schoolId)
    .order('visited_at', { ascending: false });
  if (studentId) query = query.eq('student_id', studentId);
  return query;
}

export async function createClinicVisit(schoolId: string, data: {
  student_id: string;
  reason: string;
  treatment?: string;
  temperature?: number;
  blood_pressure?: string;
  outcome?: string;
  parent_notified?: boolean;
  referred_to_hospital?: boolean;
  recorded_by?: string;
}) {
  const supabase = getSupabaseClient();
  return supabase
    .from('clinic_visits')
    .insert({ ...data, school_id: schoolId })
    .select('*, students(first_name, last_name)')
    .single();
}

export async function getClinicStats(schoolId: string) {
  const supabase = getSupabaseClient();
  const today = new Date().toISOString().split('T')[0];
  const [todayRes, weekRes, referredRes] = await Promise.all([
    supabase.from('clinic_visits').select('id').eq('school_id', schoolId).gte('visited_at', today),
    supabase.from('clinic_visits').select('id').eq('school_id', schoolId).gte('visited_at', new Date(Date.now() - 7 * 86400000).toISOString()),
    supabase.from('clinic_visits').select('id').eq('school_id', schoolId).eq('referred_to_hospital', true).gte('visited_at', new Date(Date.now() - 30 * 86400000).toISOString()),
  ]);
  return {
    todayVisits: todayRes.data?.length || 0,
    weekVisits: weekRes.data?.length || 0,
    referralsThisMonth: referredRes.data?.length || 0,
  };
}

export async function getStudentsWithMedicalRecords(schoolId: string) {
  const supabase = getSupabaseClient();
  return supabase
    .from('students')
    .select('id, first_name, last_name, admission_number, classes(name), medical_records(id, allergies, chronic_conditions, blood_group)')
    .eq('school_id', schoolId)
    .eq('status', 'active')
    .order('first_name');
}
