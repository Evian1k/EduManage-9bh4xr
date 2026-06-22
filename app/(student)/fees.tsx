import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useAppContext } from '@/hooks/useAppContext';
import { getSupabaseClient } from '@/template';
import { Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';

export default function StudentFees() {
  const { school, studentProfile } = useAppContext();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!school || !studentProfile) { setLoading(false); return; }
    const supabase = getSupabaseClient();
    const { data } = await supabase.from('invoices').select('*').eq('school_id', school.id).eq('student_id', studentProfile.id).order('created_at', { ascending: false });
    setInvoices(data || []);
    setLoading(false);
  }, [school, studentProfile]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (!school) return <LoadingScreen />;
  if (loading) return <LoadingScreen message="Loading fees..." />;

  const totalDue = invoices.reduce((sum, i) => sum + Number(i.balance || 0), 0);

  return (
    <SafeAreaView style={s.flex} edges={['bottom']}>
      <Header title="My Fees" subtitle={school.name} showBack accentColor={Colors.student} />
      <View style={s.balanceCard}><Text style={s.balanceLabel}>Outstanding Balance</Text><Text style={[s.balanceVal, { color: totalDue > 0 ? Colors.error : Colors.success }]}>KES {totalDue.toLocaleString()}</Text></View>
      <FlatList data={invoices} keyExtractor={(item) => item.id} contentContainerStyle={s.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        renderItem={({ item }) => (
          <Card style={s.card}><View style={s.row}><View><Text style={s.invNum}>{item.invoice_number}</Text><Text style={s.date}>{new Date(item.issue_date).toLocaleDateString()}{item.due_date ? ' - Due: ' + new Date(item.due_date).toLocaleDateString() : ''}</Text></View><View style={s.amounts}><Text style={s.amount}>KES {Number(item.amount_due).toLocaleString()}</Text><Text style={s.balance}>Bal: KES {Number(item.balance).toLocaleString()}</Text><Badge label={item.status} variant={item.status === 'paid' ? 'success' : item.status === 'overdue' ? 'error' : 'warning'} size="sm" /></View></View></Card>
        )}
        ListEmptyComponent={<EmptyState icon="receipt" title="No invoices" description="Your fee invoices will appear here" />}
      />
    </SafeAreaView>
  );
}
const s = StyleSheet.create({ flex: { flex: 1, backgroundColor: Colors.background }, balanceCard: { backgroundColor: Colors.surface, margin: Spacing.md, padding: 20, borderRadius: 12, alignItems: 'center' }, balanceLabel: { fontSize: 12, color: Colors.textSecondary }, balanceVal: { fontSize: 28, fontWeight: FontWeight.bold, marginTop: 8 }, list: { padding: Spacing.md, gap: 8 }, card: { padding: Spacing.md }, row: { flexDirection: 'row', justifyContent: 'space-between' }, invNum: { fontSize: 14, fontWeight: FontWeight.bold, color: Colors.textPrimary }, date: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 }, amounts: { alignItems: 'flex-end', gap: 4 }, amount: { fontSize: 14, color: Colors.textPrimary, fontWeight: FontWeight.bold }, balance: { fontSize: 12, color: Colors.textSecondary } });