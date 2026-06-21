// EduManage — Transport service
//
// CRUD for transport_routes, transport_vehicles, transport_drivers,
// transport_assignments (student → route), and transport_logs.

import { getSupabaseClient } from '@/template';
import { ServiceResult } from '@/lib/types';

// ─── Routes ──────────────────────────────────────────────────────────────────

export interface TransportRoute {
  id: string;
  school_id: string;
  route_name: string;
  route_code?: string | null;
  start_point?: string | null;
  end_point?: string | null;
  distance_km?: number | null;
  pickup_time?: string | null;
  drop_time?: string | null;
  fee: number;
  is_active: boolean;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export async function getRoutes(
  schoolId: string,
  activeOnly = false,
): Promise<ServiceResult<TransportRoute[]>> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from('transport_routes')
    .select('*')
    .eq('school_id', schoolId)
    .order('route_name', { ascending: true });
  if (activeOnly) q = q.eq('is_active', true);
  const { data, error } = await q;
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as TransportRoute[], error: null };
}

export async function createRoute(
  schoolId: string,
  input: {
    route_name: string;
    route_code?: string;
    start_point?: string;
    end_point?: string;
    distance_km?: number;
    pickup_time?: string;
    drop_time?: string;
    fee?: number;
    is_active?: boolean;
  },
): Promise<ServiceResult<TransportRoute>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('transport_routes')
    .insert({
      school_id: schoolId,
      route_name: input.route_name,
      route_code: input.route_code ?? null,
      start_point: input.start_point ?? null,
      end_point: input.end_point ?? null,
      distance_km: input.distance_km ?? null,
      pickup_time: input.pickup_time ?? null,
      drop_time: input.drop_time ?? null,
      fee: input.fee ?? 0,
      is_active: input.is_active ?? true,
    })
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as TransportRoute, error: null };
}

export async function updateRoute(
  schoolId: string,
  routeId: string,
  updates: Partial<TransportRoute>,
): Promise<ServiceResult<TransportRoute>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('transport_routes')
    .update(updates)
    .eq('id', routeId)
    .eq('school_id', schoolId)
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as TransportRoute, error: null };
}

// ─── Vehicles ────────────────────────────────────────────────────────────────

export interface TransportVehicle {
  id: string;
  school_id: string;
  registration_number: string;
  vehicle_type?: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  capacity: number;
  color?: string | null;
  insurance_provider?: string | null;
  insurance_expiry?: string | null;
  road_worthiness_expiry?: string | null;
  assigned_route_id?: string | null;
  driver_id?: string | null;
  is_active: boolean;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export async function getVehicles(
  schoolId: string,
  activeOnly = false,
): Promise<ServiceResult<TransportVehicle[]>> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from('transport_vehicles')
    .select('*, transport_routes(route_name)')
    .eq('school_id', schoolId)
    .order('registration_number', { ascending: true });
  if (activeOnly) q = q.eq('is_active', true);
  const { data, error } = await q;
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as TransportVehicle[], error: null };
}

export async function createVehicle(
  schoolId: string,
  input: {
    registration_number: string;
    vehicle_type?: string;
    make?: string;
    model?: string;
    year?: number;
    capacity?: number;
    color?: string;
    insurance_provider?: string;
    insurance_expiry?: string;
    road_worthiness_expiry?: string;
    assigned_route_id?: string;
    driver_id?: string;
  },
): Promise<ServiceResult<TransportVehicle>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('transport_vehicles')
    .insert({
      school_id: schoolId,
      registration_number: input.registration_number,
      vehicle_type: input.vehicle_type ?? null,
      make: input.make ?? null,
      model: input.model ?? null,
      year: input.year ?? null,
      capacity: input.capacity ?? 30,
      color: input.color ?? null,
      insurance_provider: input.insurance_provider ?? null,
      insurance_expiry: input.insurance_expiry ?? null,
      road_worthiness_expiry: input.road_worthiness_expiry ?? null,
      assigned_route_id: input.assigned_route_id ?? null,
      driver_id: input.driver_id ?? null,
      is_active: true,
    })
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as TransportVehicle, error: null };
}

export async function updateVehicle(
  schoolId: string,
  vehicleId: string,
  updates: Partial<TransportVehicle>,
): Promise<ServiceResult<TransportVehicle>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('transport_vehicles')
    .update(updates)
    .eq('id', vehicleId)
    .eq('school_id', schoolId)
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as TransportVehicle, error: null };
}

// ─── Drivers ─────────────────────────────────────────────────────────────────

export interface TransportDriver {
  id: string;
  school_id: string;
  staff_id?: string | null;
  full_name: string;
  license_number?: string | null;
  license_expiry?: string | null;
  phone?: string | null;
  assigned_vehicle_id?: string | null;
  assigned_route_id?: string | null;
  is_active: boolean;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export async function getDrivers(
  schoolId: string,
  activeOnly = false,
): Promise<ServiceResult<TransportDriver[]>> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from('transport_drivers')
    .select('*')
    .eq('school_id', schoolId)
    .order('full_name', { ascending: true });
  if (activeOnly) q = q.eq('is_active', true);
  const { data, error } = await q;
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as TransportDriver[], error: null };
}

export async function createDriver(
  schoolId: string,
  input: {
    staff_id?: string;
    full_name: string;
    license_number?: string;
    license_expiry?: string;
    phone?: string;
    assigned_vehicle_id?: string;
    assigned_route_id?: string;
  },
): Promise<ServiceResult<TransportDriver>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('transport_drivers')
    .insert({
      school_id: schoolId,
      staff_id: input.staff_id ?? null,
      full_name: input.full_name,
      license_number: input.license_number ?? null,
      license_expiry: input.license_expiry ?? null,
      phone: input.phone ?? null,
      assigned_vehicle_id: input.assigned_vehicle_id ?? null,
      assigned_route_id: input.assigned_route_id ?? null,
      is_active: true,
    })
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as TransportDriver, error: null };
}

// ─── Assignments ─────────────────────────────────────────────────────────────

export interface TransportAssignment {
  id: string;
  school_id: string;
  student_id: string;
  route_id: string;
  vehicle_id?: string | null;
  pickup_point?: string | null;
  drop_point?: string | null;
  term_id?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function getAssignments(
  schoolId: string,
  filters: { routeId?: string; studentId?: string } = {},
): Promise<ServiceResult<TransportAssignment[]>> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from('transport_assignments')
    .select('*, students(full_name, admission_number), transport_routes(route_name)')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false });
  if (filters.routeId) q = q.eq('route_id', filters.routeId);
  if (filters.studentId) q = q.eq('student_id', filters.studentId);
  const { data, error } = await q;
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as TransportAssignment[], error: null };
}

export async function assignStudentToRoute(
  schoolId: string,
  input: {
    student_id: string;
    route_id: string;
    vehicle_id?: string;
    pickup_point?: string;
    drop_point?: string;
    term_id?: string;
  },
): Promise<ServiceResult<TransportAssignment>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('transport_assignments')
    .insert({
      school_id: schoolId,
      student_id: input.student_id,
      route_id: input.route_id,
      vehicle_id: input.vehicle_id ?? null,
      pickup_point: input.pickup_point ?? null,
      drop_point: input.drop_point ?? null,
      term_id: input.term_id ?? null,
      is_active: true,
    })
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as TransportAssignment, error: null };
}

// ─── Logs ────────────────────────────────────────────────────────────────────

export interface TransportLog {
  id: string;
  school_id: string;
  vehicle_id: string;
  route_id?: string | null;
  driver_id?: string | null;
  log_type: string;
  log_date: string;
  amount?: number | null;
  odometer_reading?: number | null;
  description?: string | null;
  attachment_url?: string | null;
  recorded_by?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

export async function getTransportLogs(
  schoolId: string,
  filters: { vehicleId?: string; logType?: string; limit?: number } = {},
): Promise<ServiceResult<TransportLog[]>> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from('transport_logs')
    .select('*, transport_vehicles(registration_number)')
    .eq('school_id', schoolId)
    .order('log_date', { ascending: false });
  if (filters.vehicleId) q = q.eq('vehicle_id', filters.vehicleId);
  if (filters.logType) q = q.eq('log_type', filters.logType);
  if (filters.limit) q = q.limit(filters.limit);
  const { data, error } = await q;
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as TransportLog[], error: null };
}

export async function addTransportLog(
  schoolId: string,
  input: {
    vehicle_id: string;
    route_id?: string;
    driver_id?: string;
    log_type: string;
    log_date?: string;
    amount?: number;
    odometer_reading?: number;
    description?: string;
    attachment_url?: string;
    recorded_by?: string;
  },
): Promise<ServiceResult<TransportLog>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('transport_logs')
    .insert({
      school_id: schoolId,
      vehicle_id: input.vehicle_id,
      route_id: input.route_id ?? null,
      driver_id: input.driver_id ?? null,
      log_type: input.log_type,
      log_date: input.log_date ?? new Date().toISOString().split('T')[0],
      amount: input.amount ?? null,
      odometer_reading: input.odometer_reading ?? null,
      description: input.description ?? null,
      attachment_url: input.attachment_url ?? null,
      recorded_by: input.recorded_by ?? null,
    })
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as TransportLog, error: null };
}

// ─── Stats ───────────────────────────────────────────────────────────────────

export interface TransportStats {
  totalRoutes: number;
  activeRoutes: number;
  totalVehicles: number;
  activeVehicles: number;
  totalDrivers: number;
  assignedStudents: number;
  expiringInsuranceSoon: number;
}

export async function getTransportStats(schoolId: string): Promise<ServiceResult<TransportStats>> {
  const supabase = getSupabaseClient();
  const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [routesRes, activeRoutesRes, vehiclesRes, activeVehiclesRes, driversRes, assignmentsRes, insuranceRes] = await Promise.all([
    supabase.from('transport_routes').select('id', { count: 'exact', head: true }).eq('school_id', schoolId),
    supabase.from('transport_routes').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('is_active', true),
    supabase.from('transport_vehicles').select('id', { count: 'exact', head: true }).eq('school_id', schoolId),
    supabase.from('transport_vehicles').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('is_active', true),
    supabase.from('transport_drivers').select('id', { count: 'exact', head: true }).eq('school_id', schoolId),
    supabase.from('transport_assignments').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('is_active', true),
    supabase.from('transport_vehicles').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).lte('insurance_expiry', in30Days),
  ]);

  const errs = [routesRes, activeRoutesRes, vehiclesRes, activeVehiclesRes, driversRes, assignmentsRes, insuranceRes].find((r) => r.error);
  if (errs?.error) return { data: null, error: errs.error.message };

  return {
    data: {
      totalRoutes: routesRes.count ?? 0,
      activeRoutes: activeRoutesRes.count ?? 0,
      totalVehicles: vehiclesRes.count ?? 0,
      activeVehicles: activeVehiclesRes.count ?? 0,
      totalDrivers: driversRes.count ?? 0,
      assignedStudents: assignmentsRes.count ?? 0,
      expiringInsuranceSoon: insuranceRes.count ?? 0,
    },
    error: null,
  };
}
