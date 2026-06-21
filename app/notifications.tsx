import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAlert } from '@/template';
import { useAppContext } from '@/hooks/useAppContext';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from '@/services/notification.service';
import { Notification } from '@/lib/types';
import { Header } from '@/components/layout/Header';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Badge } from '@/components/ui/Badge';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';

type FilterId = 'all' | 'unread' | 'announcements' | 'messages' | 'finance' | 'alerts';

interface FilterDef {
  id: FilterId;
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}

const FILTERS: FilterDef[] = [
  { id: 'all', label: 'All', icon: 'inbox' },
  { id: 'unread', label: 'Unread', icon: 'mark-chat-unread' },
  { id: 'announcements', label: 'Announcements', icon: 'campaign' },
  { id: 'messages', label: 'Messages', icon: 'chat' },
  { id: 'finance', label: 'Finance', icon: 'payments' },
  { id: 'alerts', label: 'Alerts', icon: 'warning' },
];

function iconForNotification(n: Notification): keyof typeof MaterialIcons.glyphMap {
  const t = (n.type ?? n.category ?? '').toLowerCase();
  if (t.includes('announce') || t.includes('campaign')) return 'campaign';
  if (t.includes('message') || t.includes('chat') || t.includes('sms')) return 'chat';
  if (t.includes('finance') || t.includes('payment') || t.includes('fee') || t.includes('invoice')) return 'payments';
  if (t.includes('alert') || t.includes('warning') || t.includes('critical') || t.includes('security')) return 'warning';
  if (t.includes('assignment') || t.includes('grade')) return 'assignment';
  if (t.includes('attendance')) return 'fact-check';
  if (t.includes('library') || t.includes('book')) return 'menu-book';
  if (t.includes('event') || t.includes('calendar')) return 'event';
  if (t.includes('user') || t.includes('staff') || t.includes('student')) return 'person';
  return 'notifications';
}

function iconColorForNotification(n: Notification): string {
  const t = (n.type ?? n.category ?? '').toLowerCase();
  if (t.includes('alert') || t.includes('warning') || t.includes('critical') || t.includes('security')) return Colors.warning;
  if (t.includes('finance') || t.includes('payment') || t.includes('fee')) return Colors.success;
  if (t.includes('message') || t.includes('chat')) return Colors.primary;
  if (t.includes('announce')) return Colors.secondary;
  return Colors.primary;
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr).getTime();
  if (Number.isNaN(date)) return '';
  const diffMs = Date.now() - date;
  if (diffMs < 0) return 'just now';
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  const wk = Math.floor(day / 7);
  if (wk < 5) return `${wk}w ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  const yr = Math.floor(day / 365);
  return `${yr}y ago`;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { showAlert } = useAlert();
  const { profileId } = useAppContext();

  const [filter, setFilter] = useState<FilterId>('all');
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profileId) {
      setLoading(false);
      return;
    }
    const opts =
      filter === 'unread'
        ? { unreadOnly: true }
        : filter === 'all'
          ? {}
          : { category: filter };
    const res = await getNotifications(profileId, opts);
    if (res.error) {
      setError(res.error);
      setItems([]);
    } else {
      setError(null);
      setItems(res.data ?? []);
    }
    setLoading(false);
    setRefreshing(false);
  }, [profileId, filter]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const handleMarkAllRead = async () => {
    if (!profileId || items.every((n) => n.read_at)) return;
    setMarkingAll(true);
    const { error } = await markAllAsRead(profileId);
    setMarkingAll(false);
    if (error) {
      showAlert('Error', error);
      return;
    }
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })));
  };

  const handleTap = async (n: Notification) => {
    if (n.read_at) return;
    // Optimistic update
    setItems((prev) =>
      prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)),
    );
    const { error } = await markAsRead(n.id);
    if (error) {
      // Rollback
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: null } : x)));
      showAlert('Error', `Could not mark as read: ${error}`);
    }
  };

  const handleLongPress = (n: Notification) => {
    showAlert(
      'Delete Notification',
      `"${n.title}" will be permanently removed from your inbox.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const prev = items;
            setItems((cur) => cur.filter((x) => x.id !== n.id));
            const { error } = await deleteNotification(n.id);
            if (error) {
              setItems(prev);
              showAlert('Error', `Could not delete: ${error}`);
            }
          },
        },
      ],
    );
  };

  const unreadCount = useMemo(() => items.filter((n) => !n.read_at).length, [items]);

  const renderItem = ({ item }: { item: Notification }) => {
    const isUnread = !item.read_at;
    const icon = iconForNotification(item);
    const iconColor = iconColorForNotification(item);
    return (
      <Pressable
        onPress={() => handleTap(item)}
        onLongPress={() => handleLongPress(item)}
        delayLongPress={450}
        style={({ pressed }) => [styles.notifRow, pressed && { opacity: 0.85 }]}
      >
        <View style={[styles.notifIcon, { backgroundColor: `${iconColor}20` }]}>
          <MaterialIcons name={icon} size={22} color={iconColor} />
        </View>
        <View style={styles.notifBody}>
          <View style={styles.notifHeader}>
            <Text
              style={[styles.notifTitle, isUnread && styles.notifTitleUnread]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            <Text style={styles.notifTime}>{timeAgo(item.created_at)}</Text>
          </View>
          {item.body ? (
            <Text style={styles.notifBody2} numberOfLines={2}>
              {item.body}
            </Text>
          ) : null}
          <View style={styles.notifFooter}>
            {item.category ? (
              <Badge label={item.category} size="sm" variant="default" />
            ) : null}
            {isUnread ? <View style={styles.unreadDot} /> : null}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.flex}>
        <Header
          title="Notifications"
          subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          showBack
          rightAction={{
            icon: markingAll ? 'hourglass-top' : 'done-all',
            onPress: handleMarkAllRead,
          }}
          accentColor={Colors.primary}
        />

        {/* Filter chips */}
        <View style={styles.filterRow}>
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => setFilter(f.id)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <MaterialIcons
                  name={f.icon}
                  size={14}
                  color={active ? Colors.textPrimary : Colors.textMuted}
                />
                <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <LoadingScreen message="Loading notifications…" />
        ) : error ? (
          <View style={styles.centerWrap}>
            <EmptyState
              icon="cloud-off"
              title="Couldn't load notifications"
              description={error}
              actionLabel="Retry"
              onAction={load}
            />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.centerWrap}>
            <EmptyState
              icon={filter === 'unread' ? 'mark-email-read' : 'notifications-none'}
              title={filter === 'unread' ? 'No unread notifications' : 'No notifications'}
              description={
                filter === 'unread'
                  ? "You're all caught up. New notifications will appear here."
                  : 'Notifications about announcements, messages, fees, and alerts will appear here.'
              }
              actionLabel={filter !== 'all' ? 'Show all' : undefined}
              onAction={filter !== 'all' ? () => setFilter('all') : undefined}
            />
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={Colors.primary}
                colors={[Colors.primary]}
              />
            }
            ListFooterComponent={
              <View style={styles.listFooter}>
                <Text style={styles.listFooterText}>
                  {items.length} notification{items.length === 1 ? '' : 's'}
                </Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexWrap: 'wrap',
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.surface2, paddingHorizontal: Spacing.sm,
    paddingVertical: 6, borderRadius: BorderRadius.full,
    borderWidth: 1, borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.primary, borderColor: Colors.primary,
  },
  chipLabel: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: FontWeight.medium },
  chipLabelActive: { color: Colors.textPrimary, fontWeight: FontWeight.semibold },

  list: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  separator: { height: 0.5, backgroundColor: Colors.border, marginVertical: 0 },

  notifRow: {
    flexDirection: 'row', gap: Spacing.md,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  notifIcon: {
    width: 44, height: 44, borderRadius: BorderRadius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  notifBody: { flex: 1, gap: 4 },
  notifHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.sm },
  notifTitle: {
    fontSize: FontSize.base, color: Colors.textSecondary, fontWeight: FontWeight.medium, flex: 1,
  },
  notifTitleUnread: { color: Colors.textPrimary, fontWeight: FontWeight.bold },
  notifTime: { fontSize: FontSize.xs, color: Colors.textMuted },
  notifBody2: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 19 },
  notifFooter: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 4 },
  unreadDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary,
  },

  centerWrap: { flex: 1, justifyContent: 'center', padding: Spacing.lg },
  listFooter: { alignItems: 'center', paddingVertical: Spacing.md },
  listFooterText: { fontSize: FontSize.xs, color: Colors.textMuted },
});
