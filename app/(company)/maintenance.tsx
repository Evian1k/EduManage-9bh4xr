import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { getSystemIncidents } from '@/services/company.service';
import { Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';

export default function MaintenanceDashboard() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data: r } = await getSystemIncidents();
    setData(r || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (loading) return <LoadingScreen message="Loading..." />;

  return (
    <SafeAreaView style={s.flex} edges={['bottom']}>
      <Header title="{title} Dashboard" subtitle="Company Platform" showBack accentColor={Colors.primary} />
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        renderItem={({ item }) => (
          <Card style={s.card}>
            <Text style={s.title}>{item.title || item.full_name || item.incident_number || item.school_id?.slice(0, 8) || 'Item'}</Text>
            <Text style={s.sub}>{item.description || item.email || item.department || item.status || ''}</Text>
            {item.status && <Badge label={item.status} size="sm" />}
          </Card>
        )}
        ListEmptyComponent={<EmptyState icon="inbox" title="No data" description="Nothing to display yet" />}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.md, gap: Spacing.sm },
  card: { padding: Spacing.md, gap: 4 },
  title: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary },
});
