import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { getSupabaseClient } from '@/template';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';

export default function SuperadminAudit() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    const supabase = getSupabaseClient();
    let q = supabase.from('audit_logs').select('*, schools(name), user_profiles(email, full_name)').order('created_at', { ascending: false }).limit(200);
    if (filter !== 'all') q = q.eq('severity', filter);
    const { data } = await q;
    setLogs(data || []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (loading) return <LoadingScreen message="Loading audit logs..." />;

  return (
    <SafeAreaView style={s.flex} edges={['bottom']}>
      <Header title="Platform Audit" subtitle="All Schools" showBack accentColor={Colors.superAdmin} />
      <View style={s.filters}>{['all', 'info', 'warning', 'critical'].map(f => (
        <Pressable key={f} style={[s.chip, filter === f && s.chipActive]} onPress={() => setFilter(f)}><Text style={[s.chipText, filter === f && s.chipTextActive]}>{f.toUpperCase()}</Text></Pressable>
      ))}</View>
      <FlatList data={logs} keyExtractor={(item) => item.id} contentContainerStyle={s.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        renderItem={({ item }) => (
          <Card style={s.card}><View style={s.row}><View style={s.info}><Text style={s.action}>{item.action}</Text>{item.schools?.name && <Text style={s.school}>{item.schools.name}</Text>}{item.user_profiles?.email && <Text style={s.user}>{item.user_profiles.email}</Text>}<Text style={s.time}>{new Date(item.created_at).toLocaleString()}</Text>{item.ip_address && <Text style={s.ip}>IP: {item.ip_address}</Text>}</View><Badge label={item.severity} variant={item.severity === 'critical' ? 'error' : item.severity === 'warning' ? 'warning' : 'default'} size="sm" /></View></Card>
        )}
        ListEmptyComponent={<EmptyState icon="shield" title="No logs" description="Audit logs will appear here" />}
      />
    </SafeAreaView>
  );
}
const s = StyleSheet.create({ flex: { flex: 1, backgroundColor: Colors.background }, filters: { flexDirection: 'row', padding: 8, gap: 6 }, chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: Colors.surface2 }, chipActive: { backgroundColor: Colors.superAdmin }, chipText: { fontSize: 10, color: Colors.textSecondary, fontWeight: FontWeight.bold }, chipTextActive: { color: Colors.background }, list: { padding: Spacing.md, gap: 8 }, card: { padding: Spacing.md }, row: { flexDirection: 'row', justifyContent: 'space-between' }, info: { flex: 1 }, action: { fontSize: 14, fontWeight: FontWeight.bold, color: Colors.textPrimary }, school: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 }, user: { fontSize: 12, color: Colors.textMuted, marginTop: 2 }, time: { fontSize: 11, color: Colors.textMuted, marginTop: 2 }, ip: { fontSize: 10, color: Colors.textMuted, marginTop: 2, fontFamily: 'monospace' } });