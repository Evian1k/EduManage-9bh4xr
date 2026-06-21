// Parent: Announcements — read-only feed
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
} from 'react-native';
import { useAppContext } from '@/hooks/useAppContext';
import { getAnnouncements, Announcement } from '@/services/communication.service';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';

const categoryColor = (cat?: string | null) => {
  const c = (cat || '').toLowerCase();
  if (c.includes('urgent')) return 'error' as const;
  if (c.includes('event')) return 'warning' as const;
  if (c.includes('academic')) return 'primary' as const;
  if (c.includes('sport')) return 'success' as const;
  return 'info' as const;
};

export default function ParentAnnouncementsScreen() {
  const { school } = useAppContext();
  const schoolId = school?.id;
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!schoolId) return;
    const { data, error } = await getAnnouncements(schoolId, { audience: 'parents', limit: 100 });
    if (!error) {
      // Also include announcements without audience filter (audience = null means "all")
      const { data: allData } = await getAnnouncements(schoolId, { limit: 200 });
      const all = (allData || []);
      const merged: Announcement[] = [];
      const seen = new Set<string>();
      for (const a of all) {
        if (seen.has(a.id)) continue;
        const aud = (a.audience || '').toLowerCase();
        if (!a.audience || aud === 'all' || aud === 'parents' || aud === 'parent') {
          merged.push(a);
          seen.add(a.id);
        }
      }
      setAnnouncements(merged);
    } else {
      setAnnouncements(data || []);
    }
    setLoading(false);
    setRefreshing(false);
  }, [schoolId]);

  useEffect(() => { if (schoolId) load(); }, [schoolId]);

  if (!schoolId) return <LoadingScreen />;
  if (loading) return <LoadingScreen message="Loading announcements..." />;

  return (
    <View style={s.flex}>
      <Header title="Announcements" subtitle={`${announcements.length} posted`} showBack accentColor="#FF9800" />
      <FlatList
        data={announcements}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} colors={[Colors.primary]} />}
        ListEmptyComponent={<EmptyState icon="campaign" title="No Announcements" description="School-wide announcements will appear here." />}
        renderItem={({ item }) => (
          <Card style={s.card}>
            <View style={s.row}>
              <View style={s.icon}>
                <MaterialIcons name={item.is_pinned ? 'push-pin' : 'campaign'} size={18} color={item.is_pinned ? Colors.warning : Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.title}>{item.title}{item.is_pinned ? ' 📌' : ''}</Text>
                <Text style={s.date}>{new Date(item.published_at || item.created_at).toLocaleString()}</Text>
              </View>
              {item.category ? <Badge label={item.category} variant={categoryColor(item.category)} size="sm" /> : null}
            </View>
            <Text style={s.body}>{item.body}</Text>
            {item.audience ? <Text style={s.audience}>Audience: {item.audience}</Text> : null}
          </Card>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 100 },
  card: { gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.infoBg, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary, flex: 1 },
  date: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  body: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  audience: { fontSize: FontSize.xs, color: Colors.textMuted, fontStyle: 'italic' },
});
