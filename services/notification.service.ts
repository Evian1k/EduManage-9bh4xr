// EduManage — Notification service
//
// CRUD for notifications + per-user per-channel per-category preferences.
// The realtime side is handled by `hooks/useRealtimeNotifications.ts` —
// this module is the persistence layer it queries against.

import { getSupabaseClient } from '@/template';
import { Notification, ServiceResult } from '@/lib/types';

export interface ListNotificationsOpts {
  unreadOnly?: boolean;
  category?: string;
  type?: string;
  limit?: number;
  offset?: number;
}

export async function getNotifications(
  userId: string,
  opts: ListNotificationsOpts = {},
): Promise<ServiceResult<Notification[]>> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (opts.unreadOnly) q = q.is('read_at', null);
  if (opts.category) q = q.eq('category', opts.category);
  if (opts.type) q = q.eq('type', opts.type);
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  q = q.range(offset, offset + limit - 1);
  const { data, error } = await q;
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as Notification[], error: null };
}

export async function getUnreadCount(userId: string): Promise<ServiceResult<number>> {
  const supabase = getSupabaseClient();
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);
  if (error) return { data: null, error: error.message };
  return { data: count ?? 0, error: null };
}

export async function markAsRead(
  notificationId: string,
): Promise<ServiceResult<{ updated: boolean }>> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId);
  if (error) return { data: null, error: error.message };
  return { data: { updated: true }, error: null };
}

export async function markAllAsRead(
  userId: string,
): Promise<ServiceResult<{ updated: boolean }>> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);
  if (error) return { data: null, error: error.message };
  return { data: { updated: true }, error: null };
}

export async function deleteNotification(
  notificationId: string,
): Promise<ServiceResult<{ deleted: boolean }>> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('notifications').delete().eq('id', notificationId);
  if (error) return { data: null, error: error.message };
  return { data: { deleted: true }, error: null };
}

// ─── Preferences ─────────────────────────────────────────────────────────────

export interface NotificationPreference {
  id: string;
  user_id: string;
  channel: string; // 'push' | 'email' | 'sms'
  category: string; // 'announcements' | 'messages' | 'finance' | ...
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export async function getNotificationPreferences(
  userId: string,
): Promise<ServiceResult<NotificationPreference[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .order('channel', { ascending: true })
    .order('category', { ascending: true });
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as NotificationPreference[], error: null };
}

export async function updateNotificationPreference(
  userId: string,
  channel: string,
  category: string,
  enabled: boolean,
): Promise<ServiceResult<NotificationPreference>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('notification_preferences')
    .upsert(
      {
        user_id: userId,
        channel,
        category,
        enabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,channel,category' },
    )
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as NotificationPreference, error: null };
}

// ─── Create notification ─────────────────────────────────────────────────────

export interface CreateNotificationInput {
  title: string;
  body?: string;
  type?: string;
  category?: string;
  data?: Record<string, unknown>;
}

export async function createNotification(
  schoolId: string,
  userId: string,
  input: CreateNotificationInput,
): Promise<ServiceResult<Notification>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      school_id: schoolId,
      user_id: userId,
      title: input.title,
      body: input.body ?? null,
      type: input.type ?? null,
      category: input.category ?? null,
      data: input.data ?? {},
    })
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as Notification, error: null };
}
