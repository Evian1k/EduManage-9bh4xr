// EduManage — Analytics service
//
// Aggregation queries across the modules: school overview, students,
// academics, finance, attendance, AI usage. Plus a platform-level
// revenue analytics function for the superadmin dashboards.

import { getSupabaseClient } from '@/template';
import { ServiceResult } from '@/lib/types';

// ─── School overview ─────────────────────────────────────────────────────────

export interface SchoolOverview {
  totalStudents: number;
  activeStudents: number;
  totalStaff: number;
  totalTeachers: number;
  totalClasses: number;
  totalStreams: number;
  totalSubjects: number;
  totalInvoices: number;
  outstandingBalance: number;
  aiUsageCount: number;
  aiUsageLimit: number;
}

export async function getSchoolOverview(schoolId: string): Promise<ServiceResult<SchoolOverview>> {
  const supabase = getSupabaseClient();
  const [
    studentsRes,
    activeStudentsRes,
    staffRes,
    teachersRes,
    classesRes,
    streamsRes,
    subjectsRes,
    invoicesRes,
    aiRes,
  ] = await Promise.all([
    supabase.from('students').select('id', { count: 'exact', head: true }).eq('school_id', schoolId),
    supabase.from('students').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('status', 'active'),
    supabase.from('school_users').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('is_active', true),
    supabase.from('teachers').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('status', 'active'),
    supabase.from('classes').select('id', { count: 'exact', head: true }).eq('school_id', schoolId),
    supabase.from('streams').select('id', { count: 'exact', head: true }).eq('school_id', schoolId),
    supabase.from('subjects').select('id', { count: 'exact', head: true }).eq('school_id', schoolId),
    supabase.from('invoices').select('amount_due, amount_paid').eq('school_id', schoolId),
    supabase.from('schools').select('ai_usage_count, ai_usage_limit').eq('id', schoolId).maybeSingle(),
  ]);

  const errs = [studentsRes, activeStudentsRes, staffRes, teachersRes, classesRes, streamsRes, subjectsRes, invoicesRes, aiRes].find((r) => r.error);
  if (errs?.error) return { data: null, error: errs.error.message };

  const invoices = (invoicesRes.data ?? []) as Array<{ amount_due: number; amount_paid: number }>;
  const outstanding = invoices.reduce(
    (s, i) => s + Math.max(0, Number(i.amount_due) - Number(i.amount_paid)),
    0,
  );
  const aiRow = aiRes.data as { ai_usage_count: number; ai_usage_limit: number } | null;

  return {
    data: {
      totalStudents: studentsRes.count ?? 0,
      activeStudents: activeStudentsRes.count ?? 0,
      totalStaff: staffRes.count ?? 0,
      totalTeachers: teachersRes.count ?? 0,
      totalClasses: classesRes.count ?? 0,
      totalStreams: streamsRes.count ?? 0,
      totalSubjects: subjectsRes.count ?? 0,
      totalInvoices: invoices.length,
      outstandingBalance: outstanding,
      aiUsageCount: aiRow?.ai_usage_count ?? 0,
      aiUsageLimit: aiRow?.ai_usage_limit ?? 0,
    },
    error: null,
  };
}

// ─── Student analytics ───────────────────────────────────────────────────────

export interface StudentAnalytics {
  total: number;
  byStatus: Record<string, number>;
  byGender: Record<string, number>;
  byClass: Array<{ class_id: string; class_name: string; count: number }>;
  newThisMonth: number;
}

export async function getStudentAnalytics(
  schoolId: string,
  opts: { startDate?: string; endDate?: string } = {},
): Promise<ServiceResult<StudentAnalytics>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('students')
    .select('id, status, gender, class_id, created_at, classes(name)')
    .eq('school_id', schoolId);
  if (error) return { data: null, error: error.message };
  const rows = (data ?? []) as Array<{
    id: string;
    status: string;
    gender?: string | null;
    class_id?: string | null;
    created_at: string;
    classes: { name: string } | null;
  }>;

  const byStatus: Record<string, number> = {};
  const byGender: Record<string, number> = {};
  const byClassMap = new Map<string, { class_id: string; class_name: string; count: number }>();
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  let newThisMonth = 0;

  const startMs = opts.startDate ? new Date(opts.startDate).getTime() : null;
  const endMs = opts.endDate ? new Date(opts.endDate).getTime() : null;

  for (const r of rows) {
    const createdMs = new Date(r.created_at).getTime();
    if (startMs && createdMs < startMs) continue;
    if (endMs && createdMs > endMs) continue;

    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    if (r.gender) byGender[r.gender] = (byGender[r.gender] ?? 0) + 1;
    if (r.class_id) {
      const existing = byClassMap.get(r.class_id);
      if (existing) existing.count += 1;
      else
        byClassMap.set(r.class_id, {
          class_id: r.class_id,
          class_name: r.classes?.name ?? 'Unknown',
          count: 1,
        });
    }
    if (createdMs >= new Date(monthAgo).getTime()) newThisMonth += 1;
  }

  return {
    data: {
      total: rows.length,
      byStatus,
      byGender,
      byClass: Array.from(byClassMap.values()).sort((a, b) => b.count - a.count),
      newThisMonth,
    },
    error: null,
  };
}

// ─── Academic analytics ──────────────────────────────────────────────────────

export interface AcademicAnalytics {
  totalExams: number;
  totalAssignments: number;
  totalQuizzes: number;
  averageScore: number;
  bySubject: Array<{ subject_id: string; subject_name: string; average: number; count: number }>;
  topStudents: Array<{ student_id: string; student_name: string; average: number }>;
}

export async function getAcademicAnalytics(
  schoolId: string,
  termId?: string,
): Promise<ServiceResult<AcademicAnalytics>> {
  const supabase = getSupabaseClient();
  const [examsRes, assignmentsRes, quizzesRes, resultsRes] = await Promise.all([
    supabase.from('exams').select('id', { count: 'exact', head: true }).eq('school_id', schoolId),
    supabase.from('assignments').select('id', { count: 'exact', head: true }).eq('school_id', schoolId),
    supabase.from('quizzes').select('id', { count: 'exact', head: true }).eq('school_id', schoolId),
    supabase
      .from('exam_results')
      .select('score, student_id, subject_id, students(full_name), subjects(name)')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(2000),
  ]);
  const errs = [examsRes, assignmentsRes, quizzesRes, resultsRes].find((r) => r.error);
  if (errs?.error) return { data: null, error: errs.error.message };

  const results = (resultsRes.data ?? []) as Array<{
    score: number;
    student_id: string;
    subject_id: string;
    students: { full_name: string } | null;
    subjects: { name: string } | null;
  }>;

  const bySubjectMap = new Map<string, { subject_id: string; subject_name: string; sum: number; count: number }>();
  const byStudentMap = new Map<string, { student_id: string; student_name: string; sum: number; count: number }>();
  let totalScore = 0;
  let totalCount = 0;

  for (const r of results) {
    const score = Number(r.score);
    totalScore += score;
    totalCount += 1;
    if (r.subject_id) {
      const existing = bySubjectMap.get(r.subject_id);
      if (existing) {
        existing.sum += score;
        existing.count += 1;
      } else {
        bySubjectMap.set(r.subject_id, {
          subject_id: r.subject_id,
          subject_name: r.subjects?.name ?? 'Unknown',
          sum: score,
          count: 1,
        });
      }
    }
    if (r.student_id) {
      const existing = byStudentMap.get(r.student_id);
      if (existing) {
        existing.sum += score;
        existing.count += 1;
      } else {
        byStudentMap.set(r.student_id, {
          student_id: r.student_id,
          student_name: r.students?.full_name ?? 'Unknown',
          sum: score,
          count: 1,
        });
      }
    }
  }

  return {
    data: {
      totalExams: examsRes.count ?? 0,
      totalAssignments: assignmentsRes.count ?? 0,
      totalQuizzes: quizzesRes.count ?? 0,
      averageScore: totalCount > 0 ? Math.round((totalScore / totalCount) * 100) / 100 : 0,
      bySubject: Array.from(bySubjectMap.values()).map((s) => ({
        subject_id: s.subject_id,
        subject_name: s.subject_name,
        average: s.count > 0 ? Math.round((s.sum / s.count) * 100) / 100 : 0,
        count: s.count,
      })),
      topStudents: Array.from(byStudentMap.values())
        .map((s) => ({
          student_id: s.student_id,
          student_name: s.student_name,
          average: s.count > 0 ? Math.round((s.sum / s.count) * 100) / 100 : 0,
        }))
        .sort((a, b) => b.average - a.average)
        .slice(0, 10),
    },
    error: null,
  };
}

// ─── Finance analytics ───────────────────────────────────────────────────────

export interface FinanceAnalytics {
  totalBilled: number;
  totalCollected: number;
  totalOutstanding: number;
  collectionRate: number;
  byStatus: Record<string, number>;
  byMethod: Record<string, number>;
  monthly: Array<{ month: string; collected: number }>;
}

export async function getFinanceAnalytics(
  schoolId: string,
  opts: { startDate?: string; endDate?: string } = {},
): Promise<ServiceResult<FinanceAnalytics>> {
  const supabase = getSupabaseClient();
  const end = opts.endDate ?? new Date().toISOString().split('T')[0];
  const start = opts.startDate ?? new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [invRes, payRes] = await Promise.all([
    supabase
      .from('invoices')
      .select('amount_due, amount_paid, status, issue_date')
      .eq('school_id', schoolId)
      .gte('issue_date', start)
      .lte('issue_date', end),
    supabase
      .from('payments')
      .select('amount, payment_method, paid_at')
      .eq('school_id', schoolId)
      .eq('status', 'completed')
      .gte('paid_at', `${start}T00:00:00.000Z`)
      .lte('paid_at', `${end}T23:59:59.999Z`),
  ]);
  if (invRes.error) return { data: null, error: invRes.error.message };
  if (payRes.error) return { data: null, error: payRes.error.message };

  const invoices = (invRes.data ?? []) as Array<{ amount_due: number; amount_paid: number; status: string }>;
  const payments = (payRes.data ?? []) as Array<{ amount: number; payment_method: string; paid_at: string }>;

  const totalBilled = invoices.reduce((s, i) => s + Number(i.amount_due), 0);
  const totalCollected = invoices.reduce((s, i) => s + Number(i.amount_paid), 0);
  const totalOutstanding = invoices.reduce((s, i) => s + Math.max(0, Number(i.amount_due) - Number(i.amount_paid)), 0);
  const byStatus: Record<string, number> = {};
  for (const i of invoices) byStatus[i.status] = (byStatus[i.status] ?? 0) + 1;
  const byMethod: Record<string, number> = {};
  const monthlyMap = new Map<string, number>();
  for (const p of payments) {
    byMethod[p.payment_method] = (byMethod[p.payment_method] ?? 0) + Number(p.amount);
    const month = (p.paid_at ?? '').slice(0, 7);
    monthlyMap.set(month, (monthlyMap.get(month) ?? 0) + Number(p.amount));
  }

  return {
    data: {
      totalBilled,
      totalCollected,
      totalOutstanding,
      collectionRate: totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0,
      byStatus,
      byMethod,
      monthly: Array.from(monthlyMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, collected]) => ({ month, collected })),
    },
    error: null,
  };
}

// ─── Attendance analytics ────────────────────────────────────────────────────

export interface AttendanceAnalytics {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  rate: number;
  byClass: Array<{ class_id: string; class_name: string; rate: number; total: number }>;
}

export async function getAttendanceAnalytics(
  schoolId: string,
  opts: { startDate?: string; endDate?: string } = {},
): Promise<ServiceResult<AttendanceAnalytics>> {
  const supabase = getSupabaseClient();
  const end = opts.endDate ?? new Date().toISOString().split('T')[0];
  const start = opts.startDate ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('attendance')
    .select('status, class_id, classes(name)')
    .eq('school_id', schoolId)
    .gte('date', start)
    .lte('date', end);
  if (error) return { data: null, error: error.message };

  const rows = (data ?? []) as Array<{ status: string; class_id?: string | null; classes: { name: string } | null }>;
  const totals = { total: rows.length, present: 0, absent: 0, late: 0, excused: 0 };
  const byClassMap = new Map<string, { class_id: string; class_name: string; present: number; total: number }>();
  for (const r of rows) {
    const s = (r.status ?? '').toLowerCase();
    if (s in totals) (totals as Record<string, number>)[s] += 1;
    if (r.class_id) {
      const ex = byClassMap.get(r.class_id);
      if (ex) {
        ex.total += 1;
        if (s === 'present') ex.present += 1;
      } else {
        byClassMap.set(r.class_id, {
          class_id: r.class_id,
          class_name: r.classes?.name ?? 'Unknown',
          present: s === 'present' ? 1 : 0,
          total: 1,
        });
      }
    }
  }

  return {
    data: {
      ...totals,
      rate: totals.total > 0 ? Math.round((totals.present / totals.total) * 100) : 0,
      byClass: Array.from(byClassMap.values()).map((c) => ({
        class_id: c.class_id,
        class_name: c.class_name,
        rate: c.total > 0 ? Math.round((c.present / c.total) * 100) : 0,
        total: c.total,
      })),
    },
    error: null,
  };
}

// ─── AI analytics ────────────────────────────────────────────────────────────

export interface AIAnalytics {
  totalRequests: number;
  totalTokens: number;
  totalCostUsd: number;
  byFeature: Record<string, { count: number; tokens: number }>;
  byUser: Array<{ userId: string; count: number; tokens: number }>;
  usagePercent: number;
}

export async function getAIAnalytics(schoolId: string): Promise<ServiceResult<AIAnalytics>> {
  const supabase = getSupabaseClient();
  const [logsRes, schoolRes] = await Promise.all([
    supabase
      .from('ai_usage_logs')
      .select('feature, user_id, tokens_used, cost_usd')
      .eq('school_id', schoolId),
    supabase.from('schools').select('ai_usage_count, ai_usage_limit').eq('id', schoolId).maybeSingle(),
  ]);
  if (logsRes.error) return { data: null, error: logsRes.error.message };
  if (schoolRes.error) return { data: null, error: schoolRes.error.message };

  const rows = (logsRes.data ?? []) as Array<{
    feature: string;
    user_id: string;
    tokens_used: number;
    cost_usd: number;
  }>;
  const school = schoolRes.data as { ai_usage_count: number; ai_usage_limit: number } | null;

  const byFeature: Record<string, { count: number; tokens: number }> = {};
  const byUserMap: Record<string, { count: number; tokens: number }> = {};
  let totalTokens = 0;
  let totalCost = 0;
  for (const r of rows) {
    const f = r.feature ?? 'unknown';
    if (!byFeature[f]) byFeature[f] = { count: 0, tokens: 0 };
    byFeature[f].count += 1;
    byFeature[f].tokens += r.tokens_used ?? 0;
    totalTokens += r.tokens_used ?? 0;
    totalCost += Number(r.cost_usd ?? 0);
    const u = r.user_id;
    if (!byUserMap[u]) byUserMap[u] = { count: 0, tokens: 0 };
    byUserMap[u].count += 1;
    byUserMap[u].tokens += r.tokens_used ?? 0;
  }

  const usageCount = school?.ai_usage_count ?? 0;
  const usageLimit = school?.ai_usage_limit ?? 0;

  return {
    data: {
      totalRequests: rows.length,
      totalTokens,
      totalCostUsd: totalCost,
      byFeature,
      byUser: Object.entries(byUserMap)
        .map(([userId, v]) => ({ userId, ...v }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20),
      usagePercent: usageLimit > 0 ? Math.round((usageCount / usageLimit) * 100) : 0,
    },
    error: null,
  };
}

// ─── Platform-level revenue analytics ────────────────────────────────────────

export interface RevenueAnalytics {
  totalSchools: number;
  activeSchools: number;
  trialSchools: number;
  byPlanTier: Record<string, number>;
  estimatedMonthlyRevenueUsd: number;
  totalStudents: number;
  totalStaff: number;
  totalAiRequests: number;
}

export async function getRevenueAnalytics(): Promise<ServiceResult<RevenueAnalytics>> {
  const supabase = getSupabaseClient();
  const [schoolsRes, studentsRes, staffRes, aiRes, plansRes] = await Promise.all([
    supabase.from('schools').select('id, plan_tier, plan_status, status'),
    supabase.from('students').select('id', { count: 'exact', head: true }),
    supabase.from('school_users').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('ai_usage_logs').select('id', { count: 'exact', head: true }),
    supabase.from('subscription_plans').select('tier, price_monthly_usd'),
  ]);
  if (schoolsRes.error) return { data: null, error: schoolsRes.error.message };

  const schools = (schoolsRes.data ?? []) as Array<{
    id: string;
    plan_tier: string;
    plan_status: string;
    status: string;
  }>;
  const plans = (plansRes.data ?? []) as Array<{ tier: string; price_monthly_usd: number }>;
  const priceByTier = new Map<string, number>();
  for (const p of plans) priceByTier.set(p.tier, Number(p.price_monthly_usd));

  const byPlanTier: Record<string, number> = {};
  let monthlyRevenue = 0;
  for (const s of schools) {
    byPlanTier[s.plan_tier] = (byPlanTier[s.plan_tier] ?? 0) + 1;
    if (s.plan_status === 'active' || s.plan_status === 'trialing') {
      monthlyRevenue += priceByTier.get(s.plan_tier) ?? 0;
    }
  }

  return {
    data: {
      totalSchools: schools.length,
      activeSchools: schools.filter((s) => s.status === 'active').length,
      trialSchools: schools.filter((s) => s.plan_status === 'trialing').length,
      byPlanTier,
      estimatedMonthlyRevenueUsd: monthlyRevenue,
      totalStudents: studentsRes.count ?? 0,
      totalStaff: staffRes.count ?? 0,
      totalAiRequests: aiRes.count ?? 0,
    },
    error: null,
  };
}
