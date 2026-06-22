import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { getCEOOverview } from '@/services/company.service';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';

export default function CEODashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data: result } = await getCEOOverview();
    setData(result);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (loading) return <LoadingScreen message="Loading CEO dashboard..." />;

  return (
    <SafeAreaView style={s.flex} edges={['bottom']}>
      <Header title="CEO Dashboard" subtitle="Global Overview" showBack accentColor={Colors.superAdmin} />
      <ScrollView contentContainerStyle={s.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}>
        <View style={s.grid}>
          <StatCard label="Total Schools" value={data?.total_schools ?? 0} icon="school" color={Colors.primary} />
          <StatCard label="Active Subs" value={data?.active_subscriptions ?? 0} icon="verified" color={Colors.success} />
          <StatCard label="MRR" value={`$${(data?.mrr ?? 0).toLocaleString()}`} icon="trending-up" color={Colors.warning} />
          <StatCard label="ARR" value={`$${(data?.arr ?? 0).toLocaleString()}`} icon="show-chart" color={Colors.secondary} />
        </View>
        <Card style={s.card}>
          <View style={s.cardHeader}><MaterialIcons name="insights" size={20} color={Colors.primary} /><Text style={s.cardTitle}>Revenue Analytics</Text></View>
          <View style={s.row}><Text style={s.label}>Total Revenue</Text><Text style={s.value}>${(data?.total_revenue ?? 0).toLocaleString()}</Text></View>
          <View style={s.row}><Text style={s.label}>Monthly Recurring</Text><Text style={s.value}>${(data?.mrr ?? 0).toLocaleString()}</Text></View>
          <View style={s.row}><Text style={s.label}>Annual Recurring</Text><Text style={s.value}>${(data?.arr ?? 0).toLocaleString()}</Text></View>
          <View style={s.row}><Text style={s.label}>Growth Rate</Text><Text style={[s.value, { color: Colors.success }]}>{data?.growth_rate ?? 0}%</Text></View>
          <View style={s.row}><Text style={s.label}>Churn Rate</Text><Text style={[s.value, { color: data?.churn_rate > 5 ? Colors.error : Colors.success }]}>{data?.churn_rate ?? 0}%</Text></View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: { padding: Spacing.md, gap: Spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  card: { gap: Spacing.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  cardTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  label: { fontSize: FontSize.sm, color: Colors.textSecondary },
  value: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.bold },
});
