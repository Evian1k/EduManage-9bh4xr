// EduManage — Medical service
//
// CRUD for medical_records (get-or-create per student), medical_visits,
// and medication_administrations. Also exports the legacy `clinic` aliases
// used by older screens.

import { getSupabaseClient } from '@/template';
import { ServiceResult } from '@/lib/types';

// ─── Medical records ─────────────────────────────────────────────────────────

export interface MedicalRecord {
  id: string;
  school_id: string;
  student_id: string;
  blood_group?: string | null;
  height?: number | null;
  weight?: number | null;
  allergies: unknown[];
  chronic_conditions: unknown[];
  medications: unknown[];
  immunizations: unknown[];
  doctor_name?: string | null;
  doctor_phone?: string | null;
  hospital?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  emergency_contact_relationship?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Get-or-create the medical record for a student. Use this on the nurse's
 * student-detail screen so the form always has a row to edit.
 */
export async function getMedicalRecord(
  schoolId: string,
  studentId: string,
): Promise<ServiceResult<MedicalRecord>> {
  const supabase = getSupabaseClient();
  const { data: existing, error: findErr } = await supabase
    .from('medical_records')
    .select('*')
    .eq('school_id', schoolId)
    .eq('student_id', studentId)
    .maybeSingle();
  if (findErr) return { data: null, error: findErr.message };
  if (existing) {
    return { data: existing as unknown as MedicalRecord, error: null };
  }
  // Create empty record
  const { data: created, error: createErr } = await supabase
    .from('medical_records')
    .insert({
      school_id: schoolId,
      student_id: studentId,
      allergies: [],
      chronic_conditions: [],
      medications: [],
      immunizations: [],
    })
    .select('*')
    .single();
  if (createErr) return { data: null, error: createErr.message };
  return { data: created as unknown as MedicalRecord, error: null };
}

export async function upsertMedicalRecord(
  schoolId: string,
  studentId: string,
  updates: Partial<Omit<MedicalRecord, 'id' | 'school_id' | 'student_id'>>,
): Promise<ServiceResult<MedicalRecord>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('medical_records')
    .upsert(
      {
        school_id: schoolId,
        student_id: studentId,
        ...updates,
      },
      { onConflict: 'school_id,student_id' },
    )
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as MedicalRecord, error: null };
}

// ─── Medical visits ──────────────────────────────────────────────────────────

export interface MedicalVisit {
  id: string;
  school_id: string;
  student_id: string;
  visit_date: string;
  chief_complaint?: string | null;
  diagnosis?: string | null;
  treatment_given?: string | null;
  medication_administered?: string | null;
  temperature?: number | null;
  blood_pressure?: string | null;
  pulse?: number | null;
  notes?: string | null;
  attended_by?: string | null;
  sent_home: boolean;
  referred_to_hospital: boolean;
  parent_notified: boolean;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

export async function getMedicalVisits(
  schoolId: string,
  studentId?: string,
): Promise<ServiceResult<MedicalVisit[]>> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from('medical_visits')
    .select('*, students(full_name, admission_number, classes(name))')
    .eq('school_id', schoolId)
    .order('visit_date', { ascending: false });
  if (studentId) q = q.eq('student_id', studentId);
  const { data, error } = await q;
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as MedicalVisit[], error: null };
}

export async function createMedicalVisit(
  schoolId: string,
  input: {
    student_id: string;
    chief_complaint?: string;
    diagnosis?: string;
    treatment_given?: string;
    medication_administered?: string;
    temperature?: number;
    blood_pressure?: string;
    pulse?: number;
    notes?: string;
    attended_by?: string;
    sent_home?: boolean;
    referred_to_hospital?: boolean;
    parent_notified?: boolean;
  },
): Promise<ServiceResult<MedicalVisit>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('medical_visits')
    .insert({
      school_id: schoolId,
      student_id: input.student_id,
      visit_date: new Date().toISOString(),
      chief_complaint: input.chief_complaint ?? null,
      diagnosis: input.diagnosis ?? null,
      treatment_given: input.treatment_given ?? null,
      medication_administered: input.medication_administered ?? null,
      temperature: input.temperature ?? null,
      blood_pressure: input.blood_pressure ?? null,
      pulse: input.pulse ?? null,
      notes: input.notes ?? null,
      attended_by: input.attended_by ?? null,
      sent_home: input.sent_home ?? false,
      referred_to_hospital: input.referred_to_hospital ?? false,
      parent_notified: input.parent_notified ?? false,
    })
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as MedicalVisit, error: null };
}

// ─── Medication administrations ──────────────────────────────────────────────

export interface MedicationAdministration {
  id: string;
  school_id: string;
  student_id: string;
  medication_name: string;
  dosage?: string | null;
  administered_at: string;
  administered_by?: string | null;
  reason?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

export async function getMedicationAdministrations(
  schoolId: string,
  studentId?: string,
): Promise<ServiceResult<MedicationAdministration[]>> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from('medication_administrations')
    .select('*, students(full_name, admission_number)')
    .eq('school_id', schoolId)
    .order('administered_at', { ascending: false });
  if (studentId) q = q.eq('student_id', studentId);
  const { data, error } = await q;
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as MedicationAdministration[], error: null };
}

export async function administerMedication(
  schoolId: string,
  input: {
    student_id: string;
    medication_name: string;
    dosage?: string;
    administered_by?: string;
    reason?: string;
    notes?: string;
  },
): Promise<ServiceResult<MedicationAdministration>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('medication_administrations')
    .insert({
      school_id: schoolId,
      student_id: input.student_id,
      medication_name: input.medication_name,
      dosage: input.dosage ?? null,
      administered_at: new Date().toISOString(),
      administered_by: input.administered_by ?? null,
      reason: input.reason ?? null,
      notes: input.notes ?? null,
    })
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as MedicationAdministration, error: null };
}

// ─── Stats ───────────────────────────────────────────────────────────────────

export interface MedicalStats {
  todayVisits: number;
  weekVisits: number;
  referralsThisMonth: number;
  studentsWithConditions: number;
}

export async function getMedicalStats(schoolId: string): Promise<ServiceResult<MedicalStats>> {
  const supabase = getSupabaseClient();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [todayRes, weekRes, refRes, condRes] = await Promise.all([
    supabase
      .from('medical_visits')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .gte('visit_date', todayStart),
    supabase
      .from('medical_visits')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .gte('visit_date', weekAgo),
    supabase
      .from('medical_visits')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('referred_to_hospital', true)
      .gte('visit_date', monthAgo),
    supabase
      .from('medical_records')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .neq('chronic_conditions', '[]'),
  ]);

  if (todayRes.error) return { data: null, error: todayRes.error.message };
  if (weekRes.error) return { data: null, error: weekRes.error.message };
  if (refRes.error) return { data: null, error: refRes.error.message };
  if (condRes.error) return { data: null, error: condRes.error.message };

  return {
    data: {
      todayVisits: todayRes.count ?? 0,
      weekVisits: weekRes.count ?? 0,
      referralsThisMonth: refRes.count ?? 0,
      studentsWithConditions: condRes.count ?? 0,
    },
    error: null,
  };
}

// ─── Legacy aliases (used by older screens) ──────────────────────────────────

export const getClinicStats = getMedicalStats;
export const getClinicVisits = getMedicalVisits;
export const createClinicVisit = createMedicalVisit;

export async function getStudentsWithMedicalRecords(
  schoolId: string,
): Promise<ServiceResult<Array<{ id: string; full_name: string; admission_number: string; class_name?: string | null; medical_record?: MedicalRecord | null }>>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('students')
    .select(
      'id, full_name, admission_number, classes(name), medical_records(id, blood_group, allergies, chronic_conditions, medications)',
    )
    .eq('school_id', schoolId)
    .eq('status', 'active')
    .order('full_name', { ascending: true });
  if (error) return { data: null, error: error.message };
  const rows = (data ?? []) as Array<{
    id: string;
    full_name: string;
    admission_number: string;
    classes: { name: string } | null;
    medical_records: MedicalRecord[] | null;
  }>;
  return {
    data: rows.map((r) => ({
      id: r.id,
      full_name: r.full_name,
      admission_number: r.admission_number,
      class_name: r.classes?.name ?? null,
      medical_record: (r.medical_records?.[0] as MedicalRecord) ?? null,
    })),
    error: null,
  };
}
