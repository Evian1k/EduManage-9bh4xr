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

export default function StudentAttendance() {
  const { school, studentProfile } = useAppContext();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!school || !studentProfile) { setLoading(false); return; }
    const supabase = getSupabaseClient();
    const { data } = await supabase.from('attendance').select('*').eq('school_id', school.id).eq('student_id', studentProfile.id).order('date', { ascending: false }).limit(60);
    setRecords(data || []);
    setLoading(false);
  }, [school, studentProfile]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (!school) return <LoadingScreen />;
  if (loading) return <LoadingScreen message="Loading attendance..." />;

  const present = records.filter(r => r.status === 'present').length;
  const absent = records.filter(r => r.status === 'absent').length;
  const late = records.filter(r => r.status === 'late').length;
  const rate = records.length > 0 ? Math.round((present / records.length) * 100) : 0;

  return (
    <SafeAreaView style={s.flex} edges={['bottom']}>
      <Header title="My Attendance" subtitle={school.name} showBack accentColor={Colors.student} />
      <View style={s.stats}>
        <View style={s.stat}><Text style={s.statVal}>{rate}%</Text><Text style={s.statLbl}>Present</Text></View>
        <View style={s.stat}><Text style={[s.statVal, { color: Colors.success }]}>{present}</Text><Text style={s.statLbl}>Present</Text></View>
        <View style={s.stat}><Text style={[s.statVal, { color: Colors.error }]}>{absent}</Text><Text style={s.statLbl}>Absent</Text></View>
        <View style={s.stat}><Text style={[s.statVal, { color: Colors.warning }]}>{late}</Text><Text style={s.statLbl}>Late</Text></View>
      </View>
      <FlatList data={records} keyExtractor={(item) => item.id} contentContainerStyle={s.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        renderItem={({ item }) => (
          <Card style={s.card}><View style={s.row}><View><Text style={s.date}>{new Date(item.date).toLocaleDateString()}</Text>{item.arrival_time && <Text style={s.time}>Arrived: {item.arrival_time}</Text>}{item.remarks && <Text style={s.remark}>{item.remarks}</Text>}</View><Badge label={item.status} variant={item.status === 'present' ? 'success' : item.status === 'absent' ? 'error' : 'warning'} size="sm" /></View></Card>
        )}
        ListEmptyComponent={<EmptyState icon="fact-check" title="No records" description="Your attendance will appear here" />}
      />
    </SafeAreaView>
  );
}
const s = StyleSheet.create({ flex: { flex: 1, backgroundColor: Colors.background }, stats: { flexDirection: 'row', padding: Spacing.md, gap: 8 }, stat: { flex: 1, alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 8, paddingVertical: 12 }, statVal: { fontSize: 20, fontWeight: FontWeight.bold, color: Colors.textPrimary }, statLbl: { fontSize: 10, color: Colors.textSecondary, marginTop: 4 }, list: { padding: Spacing.md, gap: 8 }, card: { padding: Spacing.md }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, date: { fontSize: 14, fontWeight: FontWeight.bold, color: Colors.textPrimary }, time: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 }, remark: { fontSize: 12, color: Colors.textMuted, marginTop: 2 } });