// EduManage — Push notifications hook
//
// Requests permissions + Expo push token, registers the token with the
// `user_devices` table (via `registerPushToken` from useRealtimeNotifications),
// configures Android notification channels, and unregisters on unmount.
//
// Designed to be mounted once near the root of the app (inside
// <NotificationsProvider>).

import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { useAuth } from '@/template';
import {
  registerPushToken,
  unregisterPushToken,
} from '@/hooks/useRealtimeNotifications';
import { getSupabaseClient } from '@/template';

interface UsePushNotificationsResult {
  /** The Expo push token (or null when permissions were denied). */
  expoPushToken: string | null;
  /** True until the first permission check resolves. */
  loading: boolean;
  /** Human-readable error from the most recent permission / registration attempt. */
  error: string | null;
}

/** Android notification channel ids — kept in sync with the push edge function. */
export const ANDROID_CHANNELS = {
  DEFAULT: 'default',
  ANNOUNCEMENTS: 'announcements',
  MESSAGES: 'messages',
  FINANCE: 'finance',
} as const;

/** Configure how notifications behave while the app is in the foreground. */
export function configureForegroundNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
    handleSuccess: () => {
      /* no-op */
    },
    handleError: (error) => {
      console.warn('[usePushNotifications] foreground handler error:', error);
    },
  });
}

/** Create the four standard Android notification channels. */
async function configureAndroidChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Promise.all([
    Notifications.setNotificationChannelAsync(ANDROID_CHANNELS.DEFAULT, {
      name: 'Default',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    }),
    Notifications.setNotificationChannelAsync(ANDROID_CHANNELS.ANNOUNCEMENTS, {
      name: 'Announcements',
      description: 'School announcements & broadcasts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1E88E5',
    }),
    Notifications.setNotificationChannelAsync(ANDROID_CHANNELS.MESSAGES, {
      name: 'Messages',
      description: 'Direct messages from staff & parents',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#43A047',
    }),
    Notifications.setNotificationChannelAsync(ANDROID_CHANNELS.FINANCE, {
      name: 'Finance',
      description: 'Fee reminders, receipts, invoices',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#FFB300',
    }),
  ]);
}

async function resolveProfileId(authUserId: string): Promise<string | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  if (error || !data) return null;
  return data.id as string;
}

/**
 * Mount in a provider near the root. Requests permissions on mount, fetches
 * the Expo push token, registers it via `registerPushToken`, and removes it
 * again on unmount.
 */
export function usePushNotifications(): UsePushNotificationsResult {
  const { user } = useAuth();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    configureForegroundNotifications();
    void configureAndroidChannels();
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setExpoPushToken(null);
      setLoading(false);
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        if (!Device.isDevice) {
          // Push notifications don't work on simulators / emulators.
          setLoading(false);
          setError('Push notifications require a physical device');
          return;
        }

        const existing = await Notifications.getPermissionsAsync();
        let granted = existing.granted;
        if (!existing.granted && existing.canAskAgain) {
          const req = await Notifications.requestPermissionsAsync({
            ios: {
              allowAlert: true,
              allowBadge: true,
              allowSound: true,
              allowDisplayInCarPlay: true,
              allowCriticalAlerts: false,
            },
            android: {},
          });
          granted = req.granted;
        }
        if (!granted) {
          if (!cancelled) {
            setLoading(false);
            setError('Push notification permission denied');
          }
          return;
        }

        const tokenResponse = await Notifications.getExpoPushTokenAsync({
          projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
        });
        const token = tokenResponse?.data;
        if (!token) {
          if (!cancelled) {
            setLoading(false);
            setError('Failed to obtain Expo push token');
          }
          return;
        }
        tokenRef.current = token;
        if (cancelled) return;
        setExpoPushToken(token);

        const profileId = await resolveProfileId(user.id);
        if (!profileId) {
          if (!cancelled) {
            setLoading(false);
            setError('Profile not found for current user');
          }
          return;
        }

        const result = await registerPushToken(profileId, token);
        if (cancelled) return;
        if (result.error) {
          setError(result.error);
        }
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        console.warn('[usePushNotifications] init error:', msg);
        setError(msg);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      // Best-effort unregister on unmount / re-render so the device doesn't
      // keep receiving pushes it can no longer display.
      const token = tokenRef.current;
      if (token && user?.id) {
        void (async () => {
          const pid = await resolveProfileId(user.id).catch(() => null);
          if (pid) {
            await unregisterPushToken(pid, token);
          }
        })();
      }
    };
  }, [user?.id]);

  return { expoPushToken, loading, error };
}
