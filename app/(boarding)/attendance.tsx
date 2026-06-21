// Boarding Attendance — date picker, dorm picker, per-student status + remarks, save
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Modal, Pressable, ScrollView, TextInput,
} from 'react-native';
import { useAlert } from '@/template';
import { useAppContext } from '@/hooks/useAppContext';
import {
  getDormitories, getBoardingAttendance, markBoardingAttendance, Dormitory,
} from '@/services/boarding.service';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { getSupabaseClient } from '@/template';

const STATUSES = [
  { value: 'present_in_dorm', label: 'Present in Dorm', variant: 'success' as const },
  { value: 'absent', label: 'Absent', variant: 'error' as const },
  { value: 'late_return', label: 'Late Return', variant: 'warning' as const },
  { value: 'excused', label: 'Excused', variant: 'info' as const },
];

const statusVariant = (s: string) => STATUSES.find((x) => x.value === s)?.variant || 'default';

interface StudentRow {
  id: string;
  full_name: string;
  admission_number?: string;
  status: string;
  remarks: string;
}

export default function BoardingAttendanceScreen() {
  const { showAlert } = useAlert();
  const { school, profileId } = useAppContext();
  const schoolId = school?.id;
  const [dorms, setDorms] = useState<Dormitory[]>([]);
  const [dormId, setDormId] = useState('');
  const [dormPickerOpen, setDormPickerOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusPickerFor, setStatusPickerFor] = useState<string | null>(null);

  const loadDorms = useCallback(async () => {
    if (!schoolId) return;
    const { data } = await getDormitories(schoolId, true);
    setDorms(data || []);
    if (data && data.length > 0 && !dormId) setDormId(data[0].id);
    setLoading(false);
  }, [schoolId]);

  useEffect(() => { if (schoolId) loadDorms(); }, [schoolId]);

  const loadStudents = useCallback(async () => {
    if (!schoolId || !dormId) return;
    setLoading(true);
    const supabase = getSupabaseClient();
    // Pull all beds in this dorm with assigned students
    const { data: beds } = await supabase
      .from('dormitory_beds')
      .select('assigned_student_id, students(id, full_name, admission_number)')
      .eq('school_id', schoolId)
      .eq('dormitory_id', dormId)
      .eq('is_occupied', true);
    const assigned = (beds || []).map((b: any) => b.students).filter(Boolean);
    // Pull existing attendance for this dorm/date
    const existing = await getBoardingAttendance(schoolId, { dormitoryId: dormId, date });
    const existingMap: Record<string, any> = {};
    (existing.data || []).forEach((a) => { existingMap[a.student_id] = a; });
    setStudents(assigned.map((st: any) => ({
      id: st.id,
      full_name: st.full_name,
      admission_number: st.admission_number,
      status: existingMap[st.id]?.status || 'present_in_dorm',
      remarks: existingMap[st.id]?.remarks || '',
    })));
    setLoading(false);
  }, [schoolId, dormId, date]);

  useEffect(() => { if (dormId && date) loadStudents(); }, [dormId, date]);

  const updateStudent = (id: string, patch: Partial<StudentRow>) => {
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const handleSave = async () => {
    if (!schoolId || !dormId) return;
    setSaving(true);
    let errors = 0;
    for (const st of students) {
      const { error } = await markBoardingAttendance(schoolId, {
        dormitory_id: dormId,
        student_id: st.id,
        date,
        status: st.status,
        remarks: st.remarks || undefined,
        marked_by: profileId || undefined,
      });
      if (error) errors += 1;
    }
    setSaving(false);
    if (errors > 0) showAlert('Partial Save', `${errors} of ${students.length} records failed to save.`);
    else showAlert('Saved', `Attendance for ${students.length} students saved.`);
  };

  if (!schoolId) return <LoadingScreen />;
  if (loading && students.length === 0) return <LoadingScreen message="Loading attendance..." />;

  const dormName = dorms.find((d) => d.id === dormId)?.name || 'Select dorm';

  return (
    <View style={s.flex}>
      <Header
        title="Boarding Attendance"
        subtitle={dormName}
        showBack
        accentColor={Colors.secondary}
      />
      <View style={s.filters}>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>Dormitory</Text>
          <Pressable style={s.selectBtn} onPress={() => setDormPickerOpen(true)}>
            <Text style={s.selectText} numberOfLines={1}>{dormName}</Text>
            <MaterialIcons name="arrow-drop-down" size={20} color={Colors.textSecondary} />
          </Pressable>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>Date</Text>
          <Pressable style={s.selectBtn} onPress={() => setDatePickerOpen(true)}>
            <MaterialIcons name="event" size={18} color={Colors.textSecondary} />
            <Text style={s.selectText}>{date}</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={students}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Card><Text style={s.emptyText}>No students assigned to beds in this dorm.</Text></Card>
        }
        renderItem={({ item }) => (
          <Card style={s.studentCard}>
            <View style={s.studentRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.studentName}>{item.full_name}</Text>
                <Text style={s.studentAdm}>{item.admission_number || ''}</Text>
              </View>
              <Pressable style={s.statusBtn} onPress={() => setStatusPickerFor(item.id)}>
                <Badge label={STATUSES.find((x) => x.value === item.status)?.label || item.status} variant={statusVariant(item.status)} size="sm" />
                <MaterialIcons name="arrow-drop-down" size={18} color={Colors.textSecondary} />
              </Pressable>
            </View>
            <TextInput
              style={s.remarksInput}
              value={item.remarks}
              onChangeText={(v) => updateStudent(item.id, { remarks: v })}
              placeholder="Remarks (optional)..."
              placeholderTextColor={Colors.textMuted}
            />
          </Card>
        )}
      />

      {students.length > 0 ? (
        <View style={s.saveBar}>
          <Button label={`Save Attendance (${students.length})`} onPress={handleSave} loading={saving} fullWidth size="lg" />
        </View>
      ) : null}

      {/* Dorm picker */}
      <Modal visible={dormPickerOpen} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={s.overlay}>
          <View style={s.modal}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>Select Dormitory</Text>
              <Pressable onPress={() => setDormPickerOpen(false)} hitSlop={8}>
                <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
              </Pressable>
            </View>
            <ScrollView>
              {dorms.map((d) => (
                <Pressable
                  key={d.id}
                  style={[s.pickItem, dormId === d.id && s.pickItemActive]}
                  onPress={() => { setDormId(d.id); setDormPickerOpen(false); }}
                >
                  <Text style={[s.pickItemText, dormId === d.id && s.pickItemTextActive]}>{d.name}</Text>
                  {dormId === d.id ? <MaterialIcons name="check" size={20} color={Colors.primary} /> : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Date picker — simple calendar-like list of next/previous days */}
      <Modal visible={datePickerOpen} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={s.overlay}>
          <View style={s.modal}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>Select Date</Text>
              <Pressable onPress={() => setDatePickerOpen(false)} hitSlop={8}>
                <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
              </Pressable>
            </View>
            <Input
              label="Date (YYYY-MM-DD)"
              value={date}
              onChangeText={setDate}
              placeholder="2025-01-01"
            />
            <ScrollView style={{ maxHeight: 300, marginTop: Spacing.md }}>
              {Array.from({ length: 14 }).map((_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const iso = d.toISOString().split('T')[0];
                return (
                  <Pressable
                    key={iso}
                    style={[s.pickItem, date === iso && s.pickItemActive]}
                    onPress={() => { setDate(iso); setDatePickerOpen(false); }}
                  >
                    <Text style={[s.pickItemText, date === iso && s.pickItemTextActive]}>
                      {d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Status picker */}
      <Modal visible={!!statusPickerFor} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={s.overlay}>
          <View style={s.modal}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>Status</Text>
              <Pressable onPress={() => setStatusPickerFor(null)} hitSlop={8}>
                <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
              </Pressable>
            </View>
            {STATUSES.map((st) => (
              <Pressable
                key={st.value}
                style={s.pickItem}
                onPress={() => {
                  if (statusPickerFor) updateStudent(statusPickerFor, { status: st.value });
                  setStatusPickerFor(null);
                }}
              >
                <Badge label={st.label} variant={st.variant} size="sm" />
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  filters: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.md, paddingBottom: 0 },
  label: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium, marginBottom: 6 },
  selectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface2, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, minHeight: 48, gap: Spacing.sm },
  selectText: { color: Colors.textPrimary, fontSize: FontSize.base, flex: 1 },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 100 },
  studentCard: { gap: Spacing.sm },
  studentRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  studentName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  studentAdm: { fontSize: FontSize.xs, color: Colors.textSecondary },
  statusBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  remarksInput: { backgroundColor: Colors.surface2, borderRadius: BorderRadius.sm, padding: Spacing.sm, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border, fontSize: FontSize.sm },
  saveBar: { padding: Spacing.md, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border },
  emptyText: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center', padding: Spacing.sm },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, maxHeight: '85%' },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  pickItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  pickItemActive: { backgroundColor: Colors.infoBg },
  pickItemText: { fontSize: FontSize.base, color: Colors.textPrimary },
  pickItemTextActive: { color: Colors.primary, fontWeight: FontWeight.semibold },
});
