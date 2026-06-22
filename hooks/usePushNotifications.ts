// EduManage — Push notifications hook
//
// Requests permissions + Expo push token, registers the token with the
// `user_devices` table. Only runs on native (iOS/Android) — skipped on web
// because expo-notifications requires a native runtime.

import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useAuth, getSupabaseClient } from '@/template';
import { registerPushToken, unregisterPushToken } from '@/hooks/useRealtimeNotifications';

interface UsePushNotificationsResult {
  expoPushToken: string | null;
  loading: boolean;
  error: string | null;
}

export function usePushNotifications(): UsePushNotificationsResult {
  const { user } = useAuth();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    // Skip on web — expo-notifications requires a native runtime
    if (Platform.OS === 'web') return;
    if (!user?.id) {
      setExpoPushToken(null);
      return;
    }

    let cancelled = false;

    // Dynamically import expo-notifications so it's never loaded on web
    import('expo-notifications')
      .then(async (Notifications) => {
        try {
          // Configure foreground notification handler
          Notifications.setNotificationHandler({
            handleNotification: async () => ({
              shouldShowAlert: true,
              shouldPlaySound: true,
              shouldSetBadge: true,
            }),
          });

          // Configure Android channels
          if (Platform.OS === 'android') {
            await Promise.all([
              Notifications.setNotificationChannelAsync('default', {
                name: 'Default',
                importance: Notifications.AndroidImportance.DEFAULT,
              }),
              Notifications.setNotificationChannelAsync('announcements', {
                name: 'Announcements',
                importance: Notifications.AndroidImportance.HIGH,
              }),
              Notifications.setNotificationChannelAsync('messages', {
                name: 'Messages',
                importance: Notifications.AndroidImportance.HIGH,
              }),
            ]);
          }

          // Request permission
          const existing = await Notifications.getPermissionsAsync();
          let granted = existing.granted;
          if (!granted && existing.canAskAgain) {
            const req = await Notifications.requestPermissionsAsync();
            granted = req.granted;
          }
          if (!granted) {
            if (!cancelled) setError('Push notification permission denied');
            return;
          }

          // Get push token
          const tokenResponse = await Notifications.getExpoPushTokenAsync();
          const token = tokenResponse?.data;
          if (!token || cancelled) return;

          tokenRef.current = token;
          setExpoPushToken(token);

          // Register with backend
          const supabase = getSupabaseClient();
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('id')
            .eq('auth_user_id', user.id)
            .maybeSingle();
          if (profile?.id) {
            await registerPushToken(profile.id, token);
          }
        } catch (err: any) {
          console.warn('[usePushNotifications] error:', err?.message);
          if (!cancelled) setError(err?.message ?? 'Push notification setup failed');
        }
      })
      .catch((err) => {
        // expo-notifications not available — silently skip (common on web)
        console.warn('[usePushNotifications] module not available:', err?.message);
      });

    return () => {
      cancelled = true;
      const token = tokenRef.current;
      if (token && user?.id) {
        // Best-effort unregister
        import('expo-notifications')
          .then(async () => {
            const supabase = getSupabaseClient();
            const { data: profile } = await supabase
              .from('user_profiles')
              .select('id')
              .eq('auth_user_id', user.id)
              .maybeSingle();
            if (profile?.id) {
              await unregisterPushToken(profile.id, token);
            }
          })
          .catch(() => {});
      }
    };
  }, [user?.id]);

  return { expoPushToken, loading, error };
}
