import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useAppContext } from '@/hooks/useAppContext';
import { getSupabaseClient } from '@/template';
import { Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';

export default function LibrarianFines() {
  const { school } = useAppContext();
  const [fines, setFines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!school) { setLoading(false); return; }
    const supabase = getSupabaseClient();
    const { data } = await supabase.from('library_borrows').select('*, library_books(title)').eq('school_id', school.id).gt('fine_amount', 0).order('borrowed_at', { ascending: false });
    setFines(data || []);
    setLoading(false);
  }, [school]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const markPaid = async (id: string) => {
    const supabase = getSupabaseClient();
    await supabase.from('library_borrows').update({ fine_paid: true }).eq('id', id);
    load();
  };

  if (!school) return <LoadingScreen />;
  if (loading) return <LoadingScreen message="Loading fines..." />;

  const totalUnpaid = fines.filter(f => !f.fine_paid).reduce((sum, f) => sum + Number(f.fine_amount), 0);

  return (
    <SafeAreaView style={s.flex} edges={['bottom']}>
      <Header title="Fines" subtitle={school.name} showBack accentColor="#E65100" />
      {totalUnpaid > 0 && <View style={s.summary}><Text style={s.summaryLabel}>Total Unpaid Fines</Text><Text style={s.summaryVal}>KES {totalUnpaid.toLocaleString()}</Text></View>}
      <FlatList data={fines} keyExtractor={(item) => item.id} contentContainerStyle={s.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        renderItem={({ item }) => (
          <Card style={s.card}><Text style={s.title}>{item.library_books?.title || 'Unknown'}</Text><View style={s.row}><Text style={s.amount}>KES {Number(item.fine_amount).toLocaleString()}</Text>{item.fine_paid ? <Badge label="Paid" variant="success" size="sm" /> : <><Badge label="Unpaid" variant="error" size="sm" /><Button label="Mark Paid" size="sm" onPress={() => markPaid(item.id)} /></>}</View></Card>
        )}
        ListEmptyComponent={<EmptyState icon="payments" title="No fines" description="Library fines will appear here" />}
      />
    </SafeAreaView>
  );
}
const s = StyleSheet.create({ flex: { flex: 1, backgroundColor: Colors.background }, summary: { backgroundColor: Colors.surface, margin: Spacing.md, padding: 16, borderRadius: 12, alignItems: 'center' }, summaryLabel: { fontSize: 12, color: Colors.textSecondary }, summaryVal: { fontSize: 24, fontWeight: FontWeight.bold, color: Colors.error, marginTop: 4 }, list: { padding: Spacing.md, gap: 8 }, card: { padding: Spacing.md, gap: 6 }, title: { fontSize: 15, fontWeight: FontWeight.bold, color: Colors.textPrimary }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, amount: { fontSize: 16, fontWeight: FontWeight.bold, color: Colors.error } });