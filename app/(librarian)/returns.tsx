import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useAppContext } from '@/hooks/useAppContext';
import { getSupabaseClient } from '@/template';
import { Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';

export default function LibrarianReturns() {
  const { school } = useAppContext();
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!school) { setLoading(false); return; }
    const supabase = getSupabaseClient();
    const { data } = await supabase.from('library_borrows').select('*, library_books(title, author)').eq('school_id', school.id).not('returned_at', 'is', null).order('returned_at', { ascending: false });
    setReturns(data || []);
    setLoading(false);
  }, [school]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (!school) return <LoadingScreen />;
  if (loading) return <LoadingScreen message="Loading returns..." />;

  return (
    <SafeAreaView style={s.flex} edges={['bottom']}>
      <Header title="Returns" subtitle={school.name} showBack accentColor="#E65100" />
      <FlatList data={returns} keyExtractor={(item) => item.id} contentContainerStyle={s.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        renderItem={({ item }) => (
          <Card style={s.card}><Text style={s.title}>{item.library_books?.title || 'Unknown'}</Text>{item.library_books?.author && <Text style={s.author}>{item.library_books.author}</Text>}<View style={s.row}><Text style={s.date}>Returned: {item.returned_at ? new Date(item.returned_at).toLocaleDateString() : 'N/A'}</Text>{item.fine_amount > 0 ? <Badge label={`Fine: KES ${item.fine_amount}`} variant={item.fine_paid ? 'success' : 'error'} size="sm" /> : <Badge label="No fine" variant="success" size="sm" />}</View></Card>
        )}
        ListEmptyComponent={<EmptyState icon="keyboard-return" title="No returns" description="Returned books will appear here" />}
      />
    </SafeAreaView>
  );
}
const s = StyleSheet.create({ flex: { flex: 1, backgroundColor: Colors.background }, list: { padding: Spacing.md, gap: 8 }, card: { padding: Spacing.md, gap: 4 }, title: { fontSize: 15, fontWeight: FontWeight.bold, color: Colors.textPrimary }, author: { fontSize: 12, color: Colors.textSecondary }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }, date: { fontSize: 12, color: Colors.textMuted } });