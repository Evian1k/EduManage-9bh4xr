import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { getSupabaseClient } from '@/template';
import { Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';

export default function SuperadminSubscriptions() {
  const [schools, setSchools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const supabase = getSupabaseClient();
    const { data } = await supabase.from('schools').select('id, name, subdomain, plan_tier, plan_status, ai_usage_count, ai_usage_limit, max_students, max_staff, created_at').order('created_at', { ascending: false });
    setSchools(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (loading) return <LoadingScreen message="Loading subscriptions..." />;

  const byTier = { starter: 0, professional: 0, enterprise: 0, government: 0, university: 0, custom: 0 };
  schools.forEach(s => { if (byTier[s.plan_tier] !== undefined) byTier[s.plan_tier]++; });
  const trialing = schools.filter(s => s.plan_status === 'trialing').length;
  const active = schools.filter(s => s.plan_status === 'active').length;

  return (
    <SafeAreaView style={s.flex} edges={['bottom']}>
      <Header title="All Subscriptions" subtitle="Platform-wide" showBack accentColor={Colors.superAdmin} />
      <View style={s.stats}>
        <StatCard label="Total Schools" value={schools.length} icon="school" color={Colors.primary} />
        <StatCard label="Active" value={active} icon="verified" color={Colors.success} />
        <StatCard label="Trialing" value={trialing} icon="schedule" color={Colors.warning} />
      </View>
      <View style={s.tiersRow}>{Object.entries(byTier).map(([tier, count]) => (
        <View key={tier} style={s.tierBox}><Text style={s.tierCount}>{count}</Text><Text style={s.tierName}>{tier}</Text></View>
      ))}</View>
      <FlatList data={schools} keyExtractor={(item) => item.id} contentContainerStyle={s.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        renderItem={({ item }) => (
          <Card style={s.card}><View style={s.row}><View style={s.info}><Text style={s.name}>{item.name}</Text><Text style={s.sub}>{item.subdomain}.edumanage.com</Text><Text style={s.ai}>AI: {item.ai_usage_count}/{item.ai_usage_limit}</Text></View><View style={s.badges}><Badge label={item.plan_tier} variant="primary" size="sm" /><Badge label={item.plan_status} variant={item.plan_status === 'active' ? 'success' : 'warning'} size="sm" /></View></View></Card>
        )}
        ListEmptyComponent={<EmptyState icon="school" title="No schools" description="Schools will appear here once they register" />}
      />
    </SafeAreaView>
  );
}
const s = StyleSheet.create({ flex: { flex: 1, backgroundColor: Colors.background }, stats: { flexDirection: 'row', padding: Spacing.md, gap: 8 }, tiersRow: { flexDirection: 'row', paddingHorizontal: Spacing.md, gap: 6, flexWrap: 'wrap', marginBottom: 8 }, tierBox: { backgroundColor: Colors.surface, borderRadius: 8, padding: 8, alignItems: 'center', minWidth: 70 }, tierCount: { fontSize: 18, fontWeight: FontWeight.bold, color: Colors.textPrimary }, tierName: { fontSize: 10, color: Colors.textSecondary, marginTop: 2 }, list: { padding: Spacing.md, gap: 8 }, card: { padding: Spacing.md }, row: { flexDirection: 'row', justifyContent: 'space-between' }, info: { flex: 1 }, name: { fontSize: 15, fontWeight: FontWeight.bold, color: Colors.textPrimary }, sub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 }, ai: { fontSize: 11, color: Colors.textMuted, marginTop: 2 }, badges: { gap: 4, alignItems: 'flex-end' } });