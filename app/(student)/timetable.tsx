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

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function StudentTimetable() {
  const { school, studentProfile } = useAppContext();
  const [slots, setSlots] = useState<any[]>([]);
  const [day, setDay] = useState(new Date().getDay());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!school || !studentProfile?.class_id) { setLoading(false); return; }
    const supabase = getSupabaseClient();
    const { data } = await supabase.from('timetable_slots').select('*, subjects(name, code), teachers(full_name)').eq('school_id', school.id).eq('class_id', studentProfile.class_id).eq('day_of_week', day).order('start_time');
    setSlots(data || []);
    setLoading(false);
  }, [school, studentProfile, day]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (!school) return <LoadingScreen />;
  if (loading) return <LoadingScreen message="Loading timetable..." />;

  return (
    <SafeAreaView style={s.flex} edges={['bottom']}>
      <Header title="My Timetable" subtitle={school.name} showBack accentColor={Colors.student} />
      <View style={s.dayRow}>{DAYS.map((d, i) => (<View key={d}><Text style={[s.dayText, i === day && s.dayActive]} onPress={() => setDay(i)}>{d.slice(0, 3)}</Text>{i === day && <View style={s.dayUnderline} />}</View>))}</View>
      <FlatList data={slots} keyExtractor={(item) => item.id} contentContainerStyle={s.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        renderItem={({ item }) => (
          <Card style={s.card}><View style={s.row}><View style={s.timeCol}><Text style={s.startTime}>{item.start_time?.slice(0, 5)}</Text><Text style={s.endTime}>{item.end_time?.slice(0, 5)}</Text></View><View style={s.info}><Text style={s.subject}>{item.subjects?.name || 'Unknown'}</Text>{item.teachers?.full_name && <Text style={s.teacher}>{item.teachers.full_name}</Text>}{item.room && <Text style={s.room}>Room: {item.room}</Text>}</View></View></Card>
        )}
        ListEmptyComponent={<EmptyState icon="schedule" title="No classes" description={`No timetable for ${DAYS[day]}`} />}
      />
    </SafeAreaView>
  );
}
const s = StyleSheet.create({ flex: { flex: 1, backgroundColor: Colors.background }, dayRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12, backgroundColor: Colors.surface }, dayText: { fontSize: 12, color: Colors.textSecondary, fontWeight: FontWeight.bold }, dayActive: { color: Colors.primary }, dayUnderline: { height: 2, backgroundColor: Colors.primary, marginTop: 4, borderRadius: 1 }, list: { padding: Spacing.md, gap: 8 }, card: { padding: Spacing.md }, row: { flexDirection: 'row', gap: 12 }, timeCol: { width: 50 }, startTime: { fontSize: 14, fontWeight: FontWeight.bold, color: Colors.textPrimary }, endTime: { fontSize: 12, color: Colors.textSecondary }, info: { flex: 1 }, subject: { fontSize: 16, fontWeight: FontWeight.bold, color: Colors.textPrimary }, teacher: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 }, room: { fontSize: 12, color: Colors.textMuted, marginTop: 2 } });