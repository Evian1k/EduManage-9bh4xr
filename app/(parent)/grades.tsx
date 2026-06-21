// Parent: Children's grades — picker to select child + exam_results list
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Modal, Pressable, ScrollView, RefreshControl,
} from 'react-native';
import { useAppContext } from '@/hooks/useAppContext';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { getGradeLetter } from '@/constants/config';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { getSupabaseClient } from '@/template';

interface Child { id: string; full_name: string; admission_number: string; classes?: { name: string } | null; }
interface ExamResultRow {
  id: string;
  score: number;
  grade?: string;
  remarks?: string;
  exam_id: string;
  subjects?: { name: string; code: string } | null;
  exams?: { name: string; max_score: number } | null;
}

const gradeVariant = (g?: string | null) => {
  if (!g) return 'default' as const;
  if (g.startsWith('A')) return 'success' as const;
  if (g.startsWith('B')) return 'primary' as const;
  if (g.startsWith('C')) return 'info' as const;
  if (g.startsWith('D')) return 'warning' as const;
  return 'error' as const;
};

export default function ParentGradesScreen() {
  const { school, profileId } = useAppContext();
  const schoolId = school?.id;
  const [children, setChildren] = useState<Child[]>([]);
  const [selected, setSelected] = useState<Child | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [results, setResults] = useState<ExamResultRow[]>([]);
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

  const loadResults = useCallback(async () => {
    if (!schoolId || !selected) { setLoading(false); return; }
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('exam_results')
      .select('id, score, grade, remarks, exam_id, subjects(name, code), exams(name, max_score)')
      .eq('school_id', schoolId)
      .eq('student_id', selected.id)
      .order('created_at', { ascending: false });
    if (!error) setResults((data || []) as unknown as ExamResultRow[]);
    setLoading(false);
    setRefreshing(false);
  }, [schoolId, selected]);

  useEffect(() => { if (schoolId && profileId) loadChildren(); }, [schoolId, profileId]);
  useEffect(() => { if (selected) { setLoading(true); loadResults(); } }, [selected]);

  if (!schoolId) return <LoadingScreen />;
  if (loading && !selected) return <LoadingScreen message="Loading grades..." />;

  return (
    <View style={s.flex}>
      <Header title="Grades" subtitle={selected?.full_name} showBack accentColor="#FF9800" />
      <View style={s.filterRow}>
        <Text style={s.label}>Child</Text>
        <Pressable style={s.selectBtn} onPress={() => setPickerOpen(true)}>
          <Text style={s.selectText} numberOfLines={1}>{selected?.full_name || 'Select child'}</Text>
          <MaterialIcons name="arrow-drop-down" size={20} color={Colors.textSecondary} />
        </Pressable>
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadResults(); }} tintColor={Colors.primary} colors={[Colors.primary]} />}
        ListEmptyComponent={
          <EmptyState
            icon="school"
            title={selected ? 'No Grades' : 'Select a Child'}
            description={selected ? 'No exam results recorded for this child yet.' : 'Choose a child to view their grades.'}
          />
        }
        renderItem={({ item }) => {
          const max = item.exams?.max_score || 100;
          const grade = item.grade || getGradeLetter(item.score).letter;
          return (
            <Card style={s.card}>
              <View style={s.row}>
                <View style={s.subIcon}>
                  <Text style={s.subCode}>{item.subjects?.code || '—'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.subName}>{item.subjects?.name || 'Subject'}</Text>
                  <Text style={s.examName}>{item.exams?.name || 'Exam'} · {item.score}/{max}</Text>
                  {item.remarks ? <Text style={s.remarks}>{item.remarks}</Text> : null}
                </View>
                <Badge label={grade} variant={gradeVariant(grade)} />
              </View>
            </Card>
          );
        }}
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
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 100 },
  card: {},
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  subIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.infoBg, alignItems: 'center', justifyContent: 'center' },
  subCode: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.primary },
  subName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  examName: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
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
