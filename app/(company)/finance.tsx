import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { getRevenueAnalytics } from '@/services/company.service';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';

export default function FinanceDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => { const { data: r } = await getRevenueAnalytics(); setData(r); setLoading(false); }, []);
  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
  if (loading) return <LoadingScreen message="Loading finance..." />;

  return (
    <SafeAreaView style={s.flex} edges={['bottom']}>
      <Header title="Finance Dashboard" subtitle="Revenue Analytics" showBack accentColor={Colors.warning} />
      <ScrollView contentContainerStyle={s.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}>
        <View style={s.grid}>
          <StatCard label="MRR" value={`$${(data?.mrr ?? 0).toLocaleString()}`} icon="trending-up" color={Colors.success} />
          <StatCard label="ARR" value={`$${(data?.arr ?? 0).toLocaleString()}`} icon="show-chart" color={Colors.primary} />
          <StatCard label="Total Revenue" value={`$${(data?.total_revenue ?? 0).toLocaleString()}`} icon="account-balance-wallet" color={Colors.warning} />
          <StatCard label="Avg Rev/School" value={`$${(data?.arps ?? 0).toFixed(0)}`} icon="school" color={Colors.secondary} />
        </View>
        <Card style={s.card}>
          <View style={s.cardHeader}><MaterialIcons name="pie-chart" size={20} color={Colors.primary} /><Text style={s.cardTitle}>Revenue Breakdown</Text></View>
          <View style={s.row}><Text style={s.label}>Subscription Revenue</Text><Text style={s.value}>${(data?.subscription_revenue ?? 0).toLocaleString()}</Text></View>
          <View style={s.row}><Text style={s.label}>Marketplace Revenue</Text><Text style={s.value}>${(data?.marketplace_revenue ?? 0).toLocaleString()}</Text></View>
          <View style={s.row}><Text style={s.label}>Paying Schools</Text><Text style={s.value}>{data?.school_count ?? 0}</Text></View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({ flex: { flex: 1, backgroundColor: Colors.background }, container: { padding: Spacing.md, gap: Spacing.md }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }, card: { gap: Spacing.sm }, cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }, cardTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary }, row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }, label: { fontSize: FontSize.sm, color: Colors.textSecondary }, value: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.bold } });
