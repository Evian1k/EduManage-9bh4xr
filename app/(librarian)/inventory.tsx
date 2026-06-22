import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useAppContext } from '@/hooks/useAppContext';
import { getSupabaseClient } from '@/template';
import { Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';

export default function LibrarianInventory() {
  const { school } = useAppContext();
  const [stats, setStats] = useState({ total: 0, copies: 0, available: 0, borrowed: 0, overdue: 0, lowStock: [] as any[] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!school) { setLoading(false); return; }
    const supabase = getSupabaseClient();
    const [books, borrows] = await Promise.all([
      supabase.from('library_books').select('*').eq('school_id', school.id),
      supabase.from('library_borrows').select('id, due_at, status').eq('school_id', school.id).eq('status', 'borrowed'),
    ]);
    const bookList = books.data || [];
    const totalCopies = bookList.reduce((s, b) => s + (b.total_copies || 0), 0);
    const availableCopies = bookList.reduce((s, b) => s + (b.available_copies || 0), 0);
    const borrowed = (borrows.data || []).length;
    const overdue = (borrows.data || []).filter((b: any) => new Date(b.due_at) < new Date()).length;
    const lowStock = bookList.filter((b: any) => (b.available_copies || 0) < 3 && (b.total_copies || 0) > 0);
    setStats({ total: bookList.length, copies: totalCopies, available: availableCopies, borrowed, overdue, lowStock });
    setLoading(false);
  }, [school]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (!school) return <LoadingScreen />;
  if (loading) return <LoadingScreen message="Loading inventory..." />;

  return (
    <SafeAreaView style={s.flex} edges={['bottom']}>
      <Header title="Inventory" subtitle={school.name} showBack accentColor="#E65100" />
      <ScrollView contentContainerStyle={s.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}>
        <View style={s.grid}>
          <StatCard label="Total Titles" value={stats.total} icon="menu-book" color={Colors.primary} />
          <StatCard label="Total Copies" value={stats.copies} icon="collections-bookmark" color={Colors.success} />
          <StatCard label="Available" value={stats.available} icon="check-circle" color={Colors.secondary} />
          <StatCard label="Borrowed" value={stats.borrowed} icon="import-contacts" color={Colors.warning} />
          <StatCard label="Overdue" value={stats.overdue} icon="schedule" color={Colors.error} />
        </View>
        {stats.lowStock.length > 0 && (
          <Card style={s.card}><Text style={s.cardTitle}>Low Stock ({"<"} 3 copies)</Text>{stats.lowStock.map((b: any, i: number) => (
            <View key={i} style={s.lowStockRow}><Text style={s.bookTitle}>{b.title}</Text><Text style={s.bookStock}>{b.available_copies}/{b.total_copies} available</Text></View>
          ))}</Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({ flex: { flex: 1, backgroundColor: Colors.background }, container: { padding: Spacing.md, gap: Spacing.md }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, card: { padding: Spacing.md, gap: 8 }, cardTitle: { fontSize: 16, fontWeight: FontWeight.bold, color: Colors.textPrimary }, lowStockRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }, bookTitle: { fontSize: 14, color: Colors.textPrimary, flex: 1 }, bookStock: { fontSize: 12, color: Colors.warning } });