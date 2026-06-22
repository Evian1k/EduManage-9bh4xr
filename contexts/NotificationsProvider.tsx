// EduManage — Notifications provider
//
// Mount near the root of the app. Combines:
//   • usePushNotifications — requests Expo push token + Android channels
//   • useRealtimeNotifications — subscribes to the `notifications` table
//
// Exposes the unified values through `NotificationContext`.

import React, { ReactNode, useMemo } from 'react';
import {
  NotificationContext,
  NotificationContextProvider,
} from '@/contexts/NotificationContext';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';

export function NotificationsProvider({ children }: { children: ReactNode }) {
  // Initialise push notifications once at the root (configures foreground
  // handler, Android channels, and registers the Expo token).
  usePushNotifications();

  // Subscribe to the notifications table for the current user.
  const { unreadCount, latestNotification, refresh } = useRealtimeNotifications();

  const value = useMemo(
    () => ({ unreadCount, latestNotification, refresh }),
    [unreadCount, latestNotification, refresh],
  );

  return (
    <NotificationContextProvider value={value}>
      {children}
    </NotificationContextProvider>
  );
}

export { NotificationContext };
