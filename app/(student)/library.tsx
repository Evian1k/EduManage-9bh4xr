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

export default function StudentLibrary() {
  const { school, profileId } = useAppContext();
  const [borrows, setBorrows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!school || !profileId) { setLoading(false); return; }
    const supabase = getSupabaseClient();
    const { data } = await supabase.from('library_borrows').select('*, library_books(title, author)').eq('school_id', school.id).eq('borrower_user_id', profileId).order('borrowed_at', { ascending: false });
    setBorrows(data || []);
    setLoading(false);
  }, [school, profileId]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (!school) return <LoadingScreen />;
  if (loading) return <LoadingScreen message="Loading library..." />;

  return (
    <SafeAreaView style={s.flex} edges={['bottom']}>
      <Header title="Library" subtitle={school.name} showBack accentColor={Colors.student} />
      <FlatList data={borrows} keyExtractor={(item) => item.id} contentContainerStyle={s.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        renderItem={({ item }) => (
          <Card style={s.card}><Text style={s.title}>{item.library_books?.title || 'Unknown'}</Text>{item.library_books?.author && <Text style={s.author}>{item.library_books.author}</Text>}<View style={s.row}><Text style={s.date}>Borrowed: {new Date(item.borrowed_at).toLocaleDateString()}</Text><Text style={s.due}>Due: {new Date(item.due_at).toLocaleDateString()}</Text></View><View style={s.badgeRow}>{item.returned_at ? <Badge label="Returned" variant="success" size="sm" /> : new Date(item.due_at) < new Date() ? <Badge label="Overdue" variant="error" size="sm" /> : <Badge label="Active" variant="warning" size="sm" />}{item.fine_amount > 0 && <Badge label={`Fine: KES ${item.fine_amount}`} variant="error" size="sm" />}</View></Card>
        )}
        ListEmptyComponent={<EmptyState icon="menu-book" title="No borrows" description="Your borrowed books will appear here" />}
      />
    </SafeAreaView>
  );
}
const s = StyleSheet.create({ flex: { flex: 1, backgroundColor: Colors.background }, list: { padding: Spacing.md, gap: 8 }, card: { padding: Spacing.md, gap: 4 }, title: { fontSize: 16, fontWeight: FontWeight.bold, color: Colors.textPrimary }, author: { fontSize: 12, color: Colors.textSecondary }, row: { flexDirection: 'row', gap: 16, marginTop: 4 }, date: { fontSize: 12, color: Colors.textMuted }, due: { fontSize: 12, color: Colors.textMuted }, badgeRow: { flexDirection: 'row', gap: 6, marginTop: 8 } });