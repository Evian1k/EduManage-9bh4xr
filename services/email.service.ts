// EduManage — Email service
//
// Inserts rows into `email_logs` (the `send-notifications` edge function
// polls them and dispatches via the configured transactional provider).
// Also exports reusable HTML templates for the most common emails.

import { getSupabaseClient } from '@/template';
import { ServiceResult } from '@/lib/types';

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  body: string;
  html?: string;
  sentBy?: string;
  metadata?: Record<string, unknown>;
}

export async function sendEmail(
  schoolId: string,
  input: SendEmailInput,
): Promise<ServiceResult<{ queued: number }>> {
  const supabase = getSupabaseClient();
  const recipients = Array.isArray(input.to) ? input.to : [input.to];
  const rows = recipients.map((email) => ({
    school_id: schoolId,
    recipient_email: email.toLowerCase(),
    subject: input.subject,
    body: input.body,
    status: 'queued',
    sent_by: input.sentBy ?? null,
    sent_at: new Date().toISOString(),
    metadata: { html: input.html, ...input.metadata },
  }));
  const { data, error } = await supabase.from('email_logs').insert(rows).select('id');
  if (error) return { data: null, error: error.message };
  return { data: { queued: data?.length ?? 0 }, error: null };
}

export async function sendBulkEmail(
  schoolId: string,
  input: SendEmailInput,
): Promise<ServiceResult<{ queued: number }>> {
  return sendEmail(schoolId, input);
}

export interface EmailStats {
  total: number;
  queued: number;
  delivered: number;
  failed: number;
}

export async function getEmailStats(schoolId: string, days = 30): Promise<ServiceResult<EmailStats>> {
  const supabase = getSupabaseClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('email_logs')
    .select('status')
    .eq('school_id', schoolId)
    .gte('sent_at', since);
  if (error) return { data: null, error: error.message };
  const rows = (data ?? []) as Array<{ status: string }>;
  const stats: EmailStats = { total: rows.length, queued: 0, delivered: 0, failed: 0 };
  for (const r of rows) {
    if (r.status === 'queued') stats.queued += 1;
    else if (r.status === 'delivered') stats.delivered += 1;
    else if (r.status === 'failed') stats.failed += 1;
  }
  return { data: stats, error: null };
}

// ─── Templates ───────────────────────────────────────────────────────────────

export interface InvitationEmailParams {
  schoolName: string;
  inviterName: string;
  role: string;
  acceptUrl: string;
  expiryDays: number;
}

export function invitationEmailTemplate(p: InvitationEmailParams): {
  subject: string;
  body: string;
  html: string;
} {
  const subject = `You're invited to join ${p.schoolName} on EduManage`;
  const body = `Hello,

${p.inviterName} has invited you to join ${p.schoolName} on EduManage as a ${p.role}.

Click the link below to accept the invitation and set up your account:
${p.acceptUrl}

This invitation expires in ${p.expiryDays} days. If you weren't expecting it, you can safely ignore this email.

— EduManage Team`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #0B1426;">You're invited to join ${p.schoolName}</h2>
      <p style="color: #475569; line-height: 1.6;">${p.inviterName} has invited you to join <strong>${p.schoolName}</strong> on EduManage as a <strong>${p.role}</strong>.</p>
      <p style="margin: 24px 0;">
        <a href="${p.acceptUrl}" style="display: inline-block; background: #2563EB; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Accept Invitation</a>
      </p>
      <p style="color: #64748B; font-size: 13px; line-height: 1.5;">This invitation expires in ${p.expiryDays} days. If you weren't expecting it, you can safely ignore this email.</p>
      <hr style="margin: 32px 0; border: none; border-top: 1px solid #E2E8F0;">
      <p style="color: #94A3B8; font-size: 12px;">— EduManage Team</p>
    </div>
  `.trim();
  return { subject, body, html };
}

export interface PasswordResetEmailParams {
  schoolName?: string;
  resetUrl: string;
  expiryMinutes: number;
}

export function passwordResetEmailTemplate(p: PasswordResetEmailParams): {
  subject: string;
  body: string;
  html: string;
} {
  const subject = 'Reset your EduManage password';
  const body = `Hello,

We received a request to reset your EduManage password${p.schoolName ? ` for ${p.schoolName}` : ''}.

Click the link below to choose a new password:
${p.resetUrl}

This link expires in ${p.expiryMinutes} minutes. If you didn't request a password reset, please ignore this email — your password will not be changed.

— EduManage Team`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #0B1426;">Reset your password</h2>
      <p style="color: #475569; line-height: 1.6;">We received a request to reset your EduManage password${p.schoolName ? ` for <strong>${p.schoolName}</strong>` : ''}.</p>
      <p style="margin: 24px 0;">
        <a href="${p.resetUrl}" style="display: inline-block; background: #DC2626; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Reset Password</a>
      </p>
      <p style="color: #64748B; font-size: 13px; line-height: 1.5;">This link expires in ${p.expiryMinutes} minutes. If you didn't request a password reset, you can safely ignore this email — your password will not be changed.</p>
      <hr style="margin: 32px 0; border: none; border-top: 1px solid #E2E8F0;">
      <p style="color: #94A3B8; font-size: 12px;">— EduManage Team</p>
    </div>
  `.trim();
  return { subject, body, html };
}

export interface FeeReminderEmailParams {
  studentName: string;
  admissionNumber: string;
  invoiceNumber: string;
  amountDue: number;
  balance: number;
  dueDate: string;
  currency?: string;
  schoolName: string;
}

export function feeReminderEmailTemplate(p: FeeReminderEmailParams): {
  subject: string;
  body: string;
  html: string;
} {
  const currency = p.currency ?? 'KES';
  const subject = `Fee reminder — ${p.schoolName}`;
  const body = `Dear Parent/Guardian,

This is a friendly reminder that the following invoice for ${p.studentName} (${p.admissionNumber}) is due ${p.dueDate}:

Invoice: ${p.invoiceNumber}
Amount Due: ${currency} ${p.amountDue.toLocaleString()}
Outstanding Balance: ${currency} ${p.balance.toLocaleString()}
Due Date: ${p.dueDate}

Please make your payment before the due date to avoid disruption of services. If you have already paid, please disregard this email.

— ${p.schoolName} Accounts Office`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #0B1426;">Fee Reminder</h2>
      <p style="color: #475569; line-height: 1.6;">Dear Parent/Guardian,</p>
      <p style="color: #475569; line-height: 1.6;">This is a friendly reminder that the following invoice for <strong>${p.studentName}</strong> (${p.admissionNumber}) is due ${p.dueDate}:</p>
      <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
        <tr><td style="padding: 8px 0; color: #64748B;">Invoice</td><td style="padding: 8px 0; color: #0B1426; font-weight: 600;">${p.invoiceNumber}</td></tr>
        <tr><td style="padding: 8px 0; color: #64748B;">Amount Due</td><td style="padding: 8px 0; color: #0B1426; font-weight: 600;">${currency} ${p.amountDue.toLocaleString()}</td></tr>
        <tr><td style="padding: 8px 0; color: #64748B;">Outstanding Balance</td><td style="padding: 8px 0; color: #DC2626; font-weight: 600;">${currency} ${p.balance.toLocaleString()}</td></tr>
        <tr><td style="padding: 8px 0; color: #64748B;">Due Date</td><td style="padding: 8px 0; color: #0B1426; font-weight: 600;">${p.dueDate}</td></tr>
      </table>
      <p style="color: #64748B; font-size: 13px; line-height: 1.5;">Please make your payment before the due date to avoid disruption of services. If you have already paid, please disregard this email.</p>
      <hr style="margin: 32px 0; border: none; border-top: 1px solid #E2E8F0;">
      <p style="color: #94A3B8; font-size: 12px;">— ${p.schoolName} Accounts Office</p>
    </div>
  `.trim();
  return { subject, body, html };
}
