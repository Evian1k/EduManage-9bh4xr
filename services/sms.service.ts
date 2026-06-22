// EduManage — SMS service
//
// Inserts rows into `sms_logs` (the `send-notifications` edge function
// polls them and dispatches via the configured SMS gateway). Exports
// reusable SMS templates that fit within the standard 160-char limit.

import { getSupabaseClient } from '@/template';
import { ServiceResult } from '@/lib/types';

export interface SendSMSInput {
  to: string | string[];
  message: string;
  sentBy?: string;
  metadata?: Record<string, unknown>;
}

export async function sendSMS(
  schoolId: string,
  input: SendSMSInput,
): Promise<ServiceResult<{ queued: number }>> {
  const supabase = getSupabaseClient();
  const recipients = Array.isArray(input.to) ? input.to : [input.to];
  if (recipients.length === 0) {
    return { data: null, error: 'At least one recipient is required' };
  }
  const rows = recipients.map((phone) => ({
    school_id: schoolId,
    recipient_phone: phone,
    message: input.message,
    status: 'queued',
    sent_by: input.sentBy ?? null,
    sent_at: new Date().toISOString(),
    metadata: input.metadata ?? {},
  }));
  const { data, error } = await supabase.from('sms_logs').insert(rows).select('id');
  if (error) return { data: null, error: error.message };
  return { data: { queued: data?.length ?? 0 }, error: null };
}

export async function sendBulkSMS(
  schoolId: string,
  input: SendSMSInput,
): Promise<ServiceResult<{ queued: number }>> {
  return sendSMS(schoolId, input);
}

export interface SMSStats {
  total: number;
  queued: number;
  delivered: number;
  failed: number;
}

export async function getSMSStats(schoolId: string, days = 30): Promise<ServiceResult<SMSStats>> {
  const supabase = getSupabaseClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('sms_logs')
    .select('status')
    .eq('school_id', schoolId)
    .gte('sent_at', since);
  if (error) return { data: null, error: error.message };
  const rows = (data ?? []) as Array<{ status: string }>;
  const stats: SMSStats = { total: rows.length, queued: 0, delivered: 0, failed: 0 };
  for (const r of rows) {
    if (r.status === 'queued') stats.queued += 1;
    else if (r.status === 'delivered') stats.delivered += 1;
    else if (r.status === 'failed') stats.failed += 1;
  }
  return { data: stats, error: null };
}

// ─── Templates ───────────────────────────────────────────────────────────────

export interface FeeReminderSMSParams {
  schoolName: string;
  studentName: string;
  balance: number;
  dueDate: string;
  currency?: string;
}

export function feeReminderSMS(p: FeeReminderSMSParams): string {
  const currency = p.currency ?? 'KES';
  return `${p.schoolName}: Fee balance of ${currency} ${p.balance.toLocaleString()} for ${p.studentName} is due ${p.dueDate}. Please pay promptly. Reply STOP to opt out.`;
}

export interface AttendanceAlertSMSParams {
  schoolName: string;
  studentName: string;
  date: string;
  status: string;
}

export function attendanceAlertSMS(p: AttendanceAlertSMSParams): string {
  return `${p.schoolName}: ${p.studentName} was marked ${p.status} on ${p.date}. Reply STOP to opt out.`;
}

export interface ExamResultSMSParams {
  schoolName: string;
  studentName: string;
  examName: string;
  totalScore: number;
  grade: string;
  position?: number;
}

export function examResultSMS(p: ExamResultSMSParams): string {
  const pos = p.position ? `, Position ${p.position}` : '';
  return `${p.schoolName}: ${p.studentName} scored ${p.totalScore} (Grade ${p.grade}) in ${p.examName}${pos}. Reply STOP to opt out.`;
}

export interface EmergencyAlertSMSParams {
  schoolName: string;
  message: string;
}

export function emergencyAlertSMS(p: EmergencyAlertSMSParams): string {
  return `EMERGENCY ALERT — ${p.schoolName}: ${p.message}`;
}
