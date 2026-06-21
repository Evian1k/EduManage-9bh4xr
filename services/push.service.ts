// EduManage — Push notification service
//
// Wraps the `send-push-notification` Supabase edge function. The edge
// function looks up Expo push tokens from `user_devices.metadata.expo_push_token`
// and dispatches via Expo's HTTP V2 API.

import { getSupabaseClient } from '@/template';
import { ServiceResult } from '@/lib/types';
import { logAuditEvent } from './audit.service';

export interface SendPushInput {
  schoolId: string;
  userIds: string[];
  title: string;
  body?: string;
  data?: Record<string, unknown>;
}

export interface SendPushResult {
  ok: boolean;
  recipients: number;
  sent: number;
  failed: number;
  rate_limited: number;
  errors: string[];
}

/**
 * Send a push notification to one or more users in the school. The edge
 * function verifies that every recipient is an active member of the school
 * before dispatching.
 */
export async function sendPush(input: SendPushInput): Promise<ServiceResult<SendPushResult>> {
  const supabase = getSupabaseClient();
  if (!input.userIds.length) {
    return { data: null, error: 'userIds is required' };
  }
  if (!input.title) {
    return { data: null, error: 'title is required' };
  }

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) {
      return { data: null, error: 'Not authenticated' };
    }

    const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/send-push-notification`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        school_id: input.schoolId,
        user_ids: input.userIds,
        title: input.title,
        body: input.body ?? null,
        data: input.data ?? null,
      }),
    });

    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      recipients?: number;
      sent?: number;
      failed?: number;
      rate_limited?: number;
      errors?: string[];
      error?: string;
    };

    if (!res.ok) {
      return { data: null, error: json.error ?? `Push dispatch failed (${res.status})` };
    }

    const result: SendPushResult = {
      ok: Boolean(json.ok),
      recipients: json.recipients ?? 0,
      sent: json.sent ?? 0,
      failed: json.failed ?? 0,
      rate_limited: json.rate_limited ?? 0,
      errors: json.errors ?? [],
    };

    await logAuditEvent({
      schoolId: input.schoolId,
      action: 'push_notification_sent',
      resourceType: 'notification',
      details: {
        recipients: result.recipients,
        sent: result.sent,
        failed: result.failed,
        title: input.title,
      },
      severity: 'info',
    });

    return { data: result, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Push to all active staff of a school. Loads staff user_ids then delegates
 * to {@link sendPush}.
 */
export async function pushToStaff(
  input: { schoolId: string; title: string; body?: string; data?: Record<string, unknown> },
): Promise<ServiceResult<SendPushResult>> {
  const supabase = getSupabaseClient();
  const { data: staff, error } = await supabase
    .from('school_users')
    .select('user_id')
    .eq('school_id', input.schoolId)
    .eq('is_active', true)
    .neq('role', 'student');
  if (error) return { data: null, error: error.message };
  const userIds = ((staff ?? []) as Array<{ user_id: string }>).map((r) => r.user_id);
  if (userIds.length === 0) {
    return {
      data: { ok: true, recipients: 0, sent: 0, failed: 0, rate_limited: 0, errors: [] },
      error: null,
    };
  }
  return sendPush({ schoolId: input.schoolId, userIds, title: input.title, body: input.body, data: input.data });
}

/**
 * Emergency alert — pushes to ALL active members of the school (students
 * included). The message is tagged with `priority: 'high'` in the data
 * payload so the edge function can mark it as critical.
 */
export async function pushEmergencyAlert(
  input: { schoolId: string; title: string; body: string; data?: Record<string, unknown> },
): Promise<ServiceResult<SendPushResult>> {
  const supabase = getSupabaseClient();
  const { data: users, error } = await supabase
    .from('school_users')
    .select('user_id')
    .eq('school_id', input.schoolId)
    .eq('is_active', true);
  if (error) return { data: null, error: error.message };
  const userIds = ((users ?? []) as Array<{ user_id: string }>).map((r) => r.user_id);
  if (userIds.length === 0) {
    return {
      data: { ok: true, recipients: 0, sent: 0, failed: 0, rate_limited: 0, errors: [] },
      error: null,
    };
  }
  return sendPush({
    schoolId: input.schoolId,
    userIds,
    title: input.title,
    body: input.body,
    data: { ...input.data, priority: 'high', emergency: true },
  });
}
