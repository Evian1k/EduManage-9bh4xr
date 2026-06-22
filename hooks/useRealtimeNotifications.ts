// EduManage — Realtime notifications hook
//
// Subscribes to the `notifications` table for the current user via Supabase
// Realtime. Falls back to a 30-second polling loop if Realtime is unavailable.

import { useEffect, useRef, useState, useCallback } from 'react';
import { getSupabaseClient, useAuth } from '@/template';
import { Notification, ServiceResult } from '@/lib/types';

interface UseRealtimeNotificationsResult {
  unreadCount: number;
  latestNotification: Notification | null;
  refresh: () => Promise<void>;
  loading: boolean;
}

const POLL_INTERVAL_MS = 30_000;

export function useRealtimeNotifications(
  profileId?: string,
): UseRealtimeNotificationsResult {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [latestNotification, setLatestNotification] = useState<Notification | null>(null);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<any>(null);
  const pollRef = useRef<any>(null);

  const fetchProfileId = useCallback(async (): Promise<string | null> => {
    if (profileId) return profileId;
    if (!user?.id) return null;
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    if (error || !data) return null;
    return data.id as string;
  }, [profileId, user?.id]);

  const refresh = useCallback(async () => {
    const pid = await fetchProfileId();
    if (!pid) {
      setUnreadCount(0);
      setLatestNotification(null);
      setLoading(false);
      return;
    }
    const supabase = getSupabaseClient();
    const [unreadRes, latestRes] = await Promise.all([
      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', pid)
        .is('read_at', null),
      supabase
        .from('notifications')
        .select('*')
        .eq('user_id', pid)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (unreadRes.error) {
      console.warn('[useRealtimeNotifications] unread query failed:', unreadRes.error.message);
    } else {
      setUnreadCount(unreadRes.count ?? 0);
    }
    if (latestRes.error) {
      console.warn('[useRealtimeNotifications] latest query failed:', latestRes.error.message);
    } else {
      setLatestNotification((latestRes.data as Notification | null) ?? null);
    }
    setLoading(false);
  }, [fetchProfileId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pid = await fetchProfileId();
      if (cancelled || !pid) return;
      await refresh();

      const supabase = getSupabaseClient();
      const channelName = `notifications:${pid}`;
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${pid}` },
          (payload: any) => {
            const n = payload.new as Notification;
            setLatestNotification(n);
            setUnreadCount((c) => c + 1);
          },
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${pid}` },
          () => { void refresh(); },
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'notifications', filter: `user_id=eq.${pid}` },
          () => { void refresh(); },
        )
        .subscribe((status: string) => {
          if (status !== 'SUBSCRIBED') {
            console.warn('[useRealtimeNotifications] realtime status:', status);
          }
        });

      channelRef.current = channel;

      const interval = setInterval(() => { void refresh(); }, POLL_INTERVAL_MS);
      pollRef.current = interval;
    })();

    return () => {
      cancelled = true;
      if (channelRef.current) {
        try { getSupabaseClient().removeChannel(channelRef.current); } catch { /* ignore */ }
        channelRef.current = null;
      }
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, profileId]);

  return { unreadCount, latestNotification, refresh, loading };
}

// ─── Push-token registration helpers ────────────────────────────────────────

interface UserDevice {
  id: string;
  user_id: string;
  device_fingerprint: string;
  metadata: { expo_push_token?: string } | null;
}

async function fetchProfileIdForAuthUser(authUserId: string): Promise<string | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  if (error || !data) return null;
  return data.id as string;
}

export async function registerPushToken(
  profileId: string,
  token: string,
): Promise<ServiceResult<UserDevice>> {
  if (!profileId || !token) return { data: null, error: 'profileId and token are required' };
  const supabase = getSupabaseClient();
  const fingerprint = `expo:${token.slice(-32)}`;
  const { data: existing, error: findErr } = await supabase
    .from('user_devices')
    .select('*')
    .eq('user_id', profileId)
    .eq('device_fingerprint', fingerprint)
    .maybeSingle();
  if (findErr) return { data: null, error: findErr.message };
  const mergedMetadata = {
    ...((existing?.metadata as Record<string, unknown> | null) ?? {}),
    expo_push_token: token,
  };
  const { data, error } = await supabase
    .from('user_devices')
    .upsert(
      { user_id: profileId, device_fingerprint: fingerprint, metadata: mergedMetadata, last_seen_at: new Date().toISOString() },
      { onConflict: 'user_id,device_fingerprint' },
    )
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as UserDevice, error: null };
}

export async function unregisterPushToken(
  profileId: string,
  token: string,
): Promise<ServiceResult<{ deleted: boolean }>> {
  if (!profileId || !token) return { data: null, error: 'profileId and token are required' };
  const supabase = getSupabaseClient();
  const fingerprint = `expo:${token.slice(-32)}`;
  const { error } = await supabase
    .from('user_devices')
    .delete()
    .eq('user_id', profileId)
    .eq('device_fingerprint', fingerprint);
  if (error) return { data: null, error: error.message };
  return { data: { deleted: true }, error: null };
}

export async function registerPushTokenForAuthUser(
  authUserId: string,
  token: string,
): Promise<ServiceResult<UserDevice>> {
  const pid = await fetchProfileIdForAuthUser(authUserId);
  if (!pid) return { data: null, error: 'Profile not found for current user' };
  return registerPushToken(pid, token);
}

export async function unregisterPushTokenForAuthUser(
  authUserId: string,
  token: string,
): Promise<ServiceResult<{ deleted: boolean }>> {
  const pid = await fetchProfileIdForAuthUser(authUserId);
  if (!pid) return { data: null, error: 'Profile not found for current user' };
  return unregisterPushToken(pid, token);
}
