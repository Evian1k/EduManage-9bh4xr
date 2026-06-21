// EduManage — Notification context
//
// Provides the global unread-notification count and the latest notification
// exposed to the UI via `useNotificationCount` and `useLatestNotification`.

import React, { createContext, useContext, ReactNode } from 'react';
import { Notification } from '@/lib/types';

export interface NotificationContextValue {
  unreadCount: number;
  latestNotification: Notification | null;
  refresh: () => Promise<void>;
}

export const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export function NotificationContextProvider({
  value,
  children,
}: {
  value: NotificationContextValue;
  children: ReactNode;
}) {
  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

/** Read the entire notification context (count + latest + refresh). */
export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return ctx;
}

/** Convenience: just the unread count (re-renders only when count changes). */
export function useNotificationCount(): number {
  const ctx = useContext(NotificationContext);
  return ctx?.unreadCount ?? 0;
}

/** Convenience: just the latest notification (for toast / banner rendering). */
export function useLatestNotification(): Notification | null {
  const ctx = useContext(NotificationContext);
  return ctx?.latestNotification ?? null;
}
