// EduManage — Boarding service
//
// CRUD for dormitories, dormitory_beds (with assignment + is_occupied flag),
// boarding_attendance, and dormitory_inspections.

import { getSupabaseClient } from '@/template';
import { ServiceResult } from '@/lib/types';

// ─── Dormitories ─────────────────────────────────────────────────────────────

export interface Dormitory {
  id: string;
  school_id: string;
  name: string;
  gender?: string | null;
  capacity: number;
  house_master_id?: string | null;
  location?: string | null;
  is_active: boolean;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export async function getDormitories(
  schoolId: string,
  activeOnly = false,
): Promise<ServiceResult<Dormitory[]>> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from('dormitories')
    .select('*')
    .eq('school_id', schoolId)
    .order('name', { ascending: true });
  if (activeOnly) q = q.eq('is_active', true);
  const { data, error } = await q;
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as Dormitory[], error: null };
}

export async function createDormitory(
  schoolId: string,
  input: {
    name: string;
    gender?: string;
    capacity?: number;
    house_master_id?: string;
    location?: string;
  },
): Promise<ServiceResult<Dormitory>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('dormitories')
    .insert({
      school_id: schoolId,
      name: input.name,
      gender: input.gender ?? null,
      capacity: input.capacity ?? 40,
      house_master_id: input.house_master_id ?? null,
      location: input.location ?? null,
      is_active: true,
    })
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as Dormitory, error: null };
}

export async function updateDormitory(
  schoolId: string,
  dormitoryId: string,
  updates: Partial<Dormitory>,
): Promise<ServiceResult<Dormitory>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('dormitories')
    .update(updates)
    .eq('id', dormitoryId)
    .eq('school_id', schoolId)
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as Dormitory, error: null };
}

// ─── Beds ────────────────────────────────────────────────────────────────────

export interface DormitoryBed {
  id: string;
  school_id: string;
  dormitory_id: string;
  bed_number: string;
  room_number?: string | null;
  is_occupied: boolean;
  assigned_student_id?: string | null;
  assigned_at?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export async function getBeds(
  schoolId: string,
  filters: { dormitoryId?: string; onlyAvailable?: boolean } = {},
): Promise<ServiceResult<DormitoryBed[]>> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from('dormitory_beds')
    .select('*, dormitories(name), students(full_name, admission_number)')
    .eq('school_id', schoolId)
    .order('bed_number', { ascending: true });
  if (filters.dormitoryId) q = q.eq('dormitory_id', filters.dormitoryId);
  if (filters.onlyAvailable) q = q.eq('is_occupied', false);
  const { data, error } = await q;
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as DormitoryBed[], error: null };
}

export async function addBed(
  schoolId: string,
  input: { dormitory_id: string; bed_number: string; room_number?: string },
): Promise<ServiceResult<DormitoryBed>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('dormitory_beds')
    .insert({
      school_id: schoolId,
      dormitory_id: input.dormitory_id,
      bed_number: input.bed_number,
      room_number: input.room_number ?? null,
      is_occupied: false,
    })
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as DormitoryBed, error: null };
}

/**
 * Assign a bed to a student. Sets `is_occupied = true` and records the
 * assignment timestamp. If the bed was already occupied, returns an error.
 */
export async function assignBed(
  schoolId: string,
  bedId: string,
  studentId: string,
): Promise<ServiceResult<DormitoryBed>> {
  const supabase = getSupabaseClient();
  const { data: bed, error: bedErr } = await supabase
    .from('dormitory_beds')
    .select('id, is_occupied')
    .eq('id', bedId)
    .eq('school_id', schoolId)
    .maybeSingle();
  if (bedErr) return { data: null, error: bedErr.message };
  if (!bed) return { data: null, error: 'Bed not found' };
  if ((bed as { is_occupied: boolean }).is_occupied) {
    return { data: null, error: 'Bed is already occupied' };
  }
  const { data, error } = await supabase
    .from('dormitory_beds')
    .update({
      is_occupied: true,
      assigned_student_id: studentId,
      assigned_at: new Date().toISOString(),
    })
    .eq('id', bedId)
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as DormitoryBed, error: null };
}

// ─── Attendance ──────────────────────────────────────────────────────────────

export interface BoardingAttendance {
  id: string;
  school_id: string;
  dormitory_id: string;
  student_id: string;
  date: string;
  status: string;
  check_in_time?: string | null;
  check_out_time?: string | null;
  remarks?: string | null;
  marked_by?: string | null;
  created_at: string;
}

export async function getBoardingAttendance(
  schoolId: string,
  filters: { dormitoryId?: string; studentId?: string; date?: string } = {},
): Promise<ServiceResult<BoardingAttendance[]>> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from('boarding_attendance')
    .select('*, dormitories(name), students(full_name, admission_number)')
    .eq('school_id', schoolId)
    .order('date', { ascending: false });
  if (filters.dormitoryId) q = q.eq('dormitory_id', filters.dormitoryId);
  if (filters.studentId) q = q.eq('student_id', filters.studentId);
  if (filters.date) q = q.eq('date', filters.date);
  const { data, error } = await q;
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as BoardingAttendance[], error: null };
}

export async function markBoardingAttendance(
  schoolId: string,
  input: {
    dormitory_id: string;
    student_id: string;
    date: string;
    status: string;
    check_in_time?: string;
    check_out_time?: string;
    remarks?: string;
    marked_by?: string;
  },
): Promise<ServiceResult<BoardingAttendance>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('boarding_attendance')
    .upsert(
      {
        school_id: schoolId,
        dormitory_id: input.dormitory_id,
        student_id: input.student_id,
        date: input.date,
        status: input.status,
        check_in_time: input.check_in_time ?? null,
        check_out_time: input.check_out_time ?? null,
        remarks: input.remarks ?? null,
        marked_by: input.marked_by ?? null,
      },
      { onConflict: 'school_id,student_id,date' },
    )
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as BoardingAttendance, error: null };
}

// ─── Inspections ─────────────────────────────────────────────────────────────

export interface DormitoryInspection {
  id: string;
  school_id: string;
  dormitory_id: string;
  inspection_date: string;
  inspected_by?: string | null;
  cleanliness_score?: number | null;
  discipline_score?: number | null;
  notes?: string | null;
  follow_up_required: boolean;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

export async function getInspections(
  schoolId: string,
  filters: { dormitoryId?: string; limit?: number } = {},
): Promise<ServiceResult<DormitoryInspection[]>> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from('dormitory_inspections')
    .select('*, dormitories(name)')
    .eq('school_id', schoolId)
    .order('inspection_date', { ascending: false });
  if (filters.dormitoryId) q = q.eq('dormitory_id', filters.dormitoryId);
  if (filters.limit) q = q.limit(filters.limit);
  const { data, error } = await q;
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as DormitoryInspection[], error: null };
}

export async function createInspection(
  schoolId: string,
  input: {
    dormitory_id: string;
    inspection_date?: string;
    inspected_by?: string;
    cleanliness_score?: number;
    discipline_score?: number;
    notes?: string;
    follow_up_required?: boolean;
  },
): Promise<ServiceResult<DormitoryInspection>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('dormitory_inspections')
    .insert({
      school_id: schoolId,
      dormitory_id: input.dormitory_id,
      inspection_date: input.inspection_date ?? new Date().toISOString().split('T')[0],
      inspected_by: input.inspected_by ?? null,
      cleanliness_score: input.cleanliness_score ?? null,
      discipline_score: input.discipline_score ?? null,
      notes: input.notes ?? null,
      follow_up_required: input.follow_up_required ?? false,
    })
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as DormitoryInspection, error: null };
}

// ─── Stats ───────────────────────────────────────────────────────────────────

export interface BoardingStats {
  totalDormitories: number;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  occupancyRate: number;
  pendingInspectionsFollowUp: number;
}

export async function getBoardingStats(schoolId: string): Promise<ServiceResult<BoardingStats>> {
  const supabase = getSupabaseClient();
  const [dormRes, bedsRes, occupiedRes, followUpRes] = await Promise.all([
    supabase.from('dormitories').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('is_active', true),
    supabase.from('dormitory_beds').select('id', { count: 'exact', head: true }).eq('school_id', schoolId),
    supabase.from('dormitory_beds').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('is_occupied', true),
    supabase.from('dormitory_inspections').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('follow_up_required', true),
  ]);
  const errs = [dormRes, bedsRes, occupiedRes, followUpRes].find((r) => r.error);
  if (errs?.error) return { data: null, error: errs.error.message };

  const totalBeds = bedsRes.count ?? 0;
  const occupied = occupiedRes.count ?? 0;
  return {
    data: {
      totalDormitories: dormRes.count ?? 0,
      totalBeds,
      occupiedBeds: occupied,
      availableBeds: Math.max(0, totalBeds - occupied),
      occupancyRate: totalBeds > 0 ? Math.round((occupied / totalBeds) * 100) : 0,
      pendingInspectionsFollowUp: followUpRes.count ?? 0,
    },
    error: null,
  };
}
