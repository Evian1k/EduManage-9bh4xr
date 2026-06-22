// Parent: Children's attendance — picker for child + StatCards + recent list
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Modal, Pressable, ScrollView, RefreshControl,
} from 'react-native';
import { useAppContext } from '@/hooks/useAppContext';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge, getStatusBadgeVariant } from '@/components/ui/Badge';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { getSupabaseClient } from '@/template';

interface Child { id: string; full_name: string; admission_number: string; classes?: { name: string } | null; }
interface AttendanceRow {
  id: string;
  date: string;
  status: string;
  arrival_time?: string | null;
  remarks?: string | null;
}

export default function ParentAttendanceScreen() {
  const { school, profileId } = useAppContext();
  const schoolId = school?.id;
  const [children, setChildren] = useState<Child[]>([]);
  const [selected, setSelected] = useState<Child | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [stats, setStats] = useState({ total: 0, present: 0, absent: 0, late: 0, excused: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadChildren = useCallback(async () => {
    if (!schoolId || !profileId) return;
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('guardians')
      .select('students(id, full_name, admission_number, classes(name))')
      .eq('user_id', profileId);
    const kids: Child[] = (data || []).map((g: any) => g.students).filter(Boolean);
    setChildren(kids);
    if (kids.length > 0 && !selected) setSelected(kids[0]);
    if (kids.length === 0) setLoading(false);
  }, [schoolId, profileId]);

  const loadRecords = useCallback(async () => {
    if (!schoolId || !selected) { setLoading(false); return; }
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('attendance')
      .select('id, date, status, arrival_time, remarks')
      .eq('school_id', schoolId)
      .eq('student_id', selected.id)
      .order('date', { ascending: false })
      .limit(100);
    if (!error) {
      const rows = (data || []) as AttendanceRow[];
      setRecords(rows);
      const s = { total: rows.length, present: 0, absent: 0, late: 0, excused: 0 };
      rows.forEach((r) => {
        const st = (r.status || '').toLowerCase();
        if (st in s) (s as any)[st] += 1;
      });
      setStats(s);
    }
    setLoading(false);
    setRefreshing(false);
  }, [schoolId, selected]);

  useEffect(() => { if (schoolId && profileId) loadChildren(); }, [schoolId, profileId]);
  useEffect(() => { if (selected) { setLoading(true); loadRecords(); } }, [selected]);

  if (!schoolId) return <LoadingScreen />;
  if (loading && !selected) return <LoadingScreen message="Loading attendance..." />;

  const presentPct = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;

  return (
    <View style={s.flex}>
      <Header title="Attendance" subtitle={selected?.full_name} showBack accentColor="#FF9800" />
      <View style={s.filterRow}>
        <Text style={s.label}>Child</Text>
        <Pressable style={s.selectBtn} onPress={() => setPickerOpen(true)}>
          <Text style={s.selectText} numberOfLines={1}>{selected?.full_name || 'Select child'}</Text>
          <MaterialIcons name="arrow-drop-down" size={20} color={Colors.textSecondary} />
        </Pressable>
      </View>

      {selected ? (
        <View style={s.statsRow}>
          <StatCard label="Present" value={`${presentPct}%`} icon="event-available" color={Colors.success} subtitle={`${stats.present} days`} />
          <StatCard label="Absent" value={stats.absent} icon="event-busy" color={Colors.error} />
          <StatCard label="Late" value={stats.late} icon="schedule" color={Colors.warning} />
        </View>
      ) : null}

      <FlatList
        data={records}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadRecords(); }} tintColor={Colors.primary} colors={[Colors.primary]} />}
        ListEmptyComponent={
          <EmptyState icon="event-available" title={selected ? 'No Attendance' : 'Select a Child'} description={selected ? 'No attendance records found for this child.' : 'Choose a child to view attendance.'} />
        }
        renderItem={({ item }) => (
          <Card style={s.card}>
            <View style={s.row}>
              <View style={s.dateBox}>
                <Text style={s.dateDay}>{new Date(item.date).getDate()}</Text>
                <Text style={s.dateMon}>{new Date(item.date).toLocaleDateString([], { month: 'short' })}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.dateFull}>{new Date(item.date).toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</Text>
                {item.arrival_time ? <Text style={s.arrival}>Arrival: {item.arrival_time}</Text> : null}
                {item.remarks ? <Text style={s.remarks}>{item.remarks}</Text> : null}
              </View>
              <Badge label={item.status} variant={getStatusBadgeVariant(item.status)} size="sm" />
            </View>
          </Card>
        )}
      />

      <Modal visible={pickerOpen} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={s.overlay}>
          <View style={s.modal}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>Select Child</Text>
              <Pressable onPress={() => setPickerOpen(false)} hitSlop={8}>
                <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
              </Pressable>
            </View>
            <ScrollView>
              {children.map((c) => (
                <Pressable
                  key={c.id}
                  style={[s.pickItem, selected?.id === c.id && s.pickItemActive]}
                  onPress={() => { setSelected(c); setPickerOpen(false); }}
                >
                  <Text style={[s.pickItemText, selected?.id === c.id && s.pickItemTextActive]}>{c.full_name}</Text>
                  {selected?.id === c.id ? <MaterialIcons name="check" size={20} color={Colors.primary} /> : null}
                </Pressable>
              ))}
              {children.length === 0 ? <Text style={s.emptyText}>No children linked.</Text> : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  filterRow: { padding: Spacing.md, paddingBottom: 0 },
  label: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium, marginBottom: 6 },
  selectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface2, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, minHeight: 48 },
  selectText: { color: Colors.textPrimary, fontSize: FontSize.base, flex: 1 },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.md, paddingBottom: 0 },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 100 },
  card: {},
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  dateBox: { width: 48, height: 48, borderRadius: BorderRadius.md, backgroundColor: Colors.surface2, alignItems: 'center', justifyContent: 'center' },
  dateDay: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  dateMon: { fontSize: FontSize.xs, color: Colors.textSecondary, textTransform: 'uppercase' },
  dateFull: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  arrival: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  remarks: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2, fontStyle: 'italic' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, maxHeight: '70%' },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  pickItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  pickItemActive: { backgroundColor: Colors.infoBg },
  pickItemText: { fontSize: FontSize.base, color: Colors.textPrimary },
  pickItemTextActive: { color: Colors.primary, fontWeight: FontWeight.semibold },
  emptyText: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center', padding: Spacing.md },
});
