// Beds for a dormitory — list, add, assign/unassign students
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Modal, Pressable, ScrollView, TextInput, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAlert } from '@/template';
import { useAppContext } from '@/hooks/useAppContext';
import {
  getBeds, addBed, assignBed, DormitoryBed,
} from '@/services/boarding.service';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { getSupabaseClient } from '@/template';

export default function BedsScreen() {
  const router = useRouter();
  const { showAlert } = useAlert();
  const { dormId, dormName } = useLocalSearchParams<{ dormId: string; dormName: string }>();
  const { school } = useAppContext();
  const schoolId = school?.id;
  const [beds, setBeds] = useState<DormitoryBed[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ bed_number: '', room_number: '' });
  // student picker modal
  const [assignFor, setAssignFor] = useState<DormitoryBed | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentResults, setStudentResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    if (!schoolId || !dormId) return;
    setLoading(true);
    const { data, error } = await getBeds(schoolId, { dormitoryId: dormId });
    if (error) { showAlert('Error', error); setLoading(false); return; }
    setBeds(data || []);
    setLoading(false);
  }, [schoolId, dormId]);

  useEffect(() => { if (schoolId && dormId) load(); }, [schoolId, dormId]);

  const handleAdd = async () => {
    if (!form.bed_number.trim() || !schoolId || !dormId) {
      showAlert('Missing Fields', 'Bed number is required.');
      return;
    }
    setSaving(true);
    const { error } = await addBed(schoolId, { dormitory_id: dormId, bed_number: form.bed_number.trim(), room_number: form.room_number.trim() || undefined });
    setSaving(false);
    if (error) { showAlert('Error', error); return; }
    setShowModal(false);
    setForm({ bed_number: '', room_number: '' });
    load();
  };

  const searchStudents = async (q: string) => {
    setStudentSearch(q);
    if (!q || !schoolId) { setStudentResults([]); return; }
    setSearching(true);
    const supabase = getSupabaseClient();
    const term = q.replace(/[%_]/g, (m) => '\\' + m);
    const { data } = await supabase
      .from('students')
      .select('id, full_name, admission_number, classes(name)')
      .eq('school_id', schoolId)
      .eq('status', 'active')
      .or(`full_name.ilike.%${term}%,admission_number.ilike.%${term}%`)
      .limit(10);
    setStudentResults(data || []);
    setSearching(false);
  };

  const handleAssign = async (studentId: string) => {
    if (!schoolId || !assignFor) return;
    setSaving(true);
    const { error } = await assignBed(schoolId, assignFor.id, studentId);
    setSaving(false);
    if (error) { showAlert('Error', error); return; }
    setAssignFor(null);
    setStudentSearch('');
    setStudentResults([]);
    load();
  };

  const handleUnassign = (bed: DormitoryBed) => {
    const studentName = (bed as any).students?.full_name || 'this student';
    showAlert('Unassign Bed', `Remove ${studentName} from bed ${bed.bed_number}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Unassign', style: 'destructive', onPress: async () => {
        if (!schoolId) return;
        const supabase = getSupabaseClient();
        await supabase.from('dormitory_beds').update({
          is_occupied: false, assigned_student_id: null, assigned_at: null,
        }).eq('id', bed.id).eq('school_id', schoolId);
        load();
      } },
    ]);
  };

  if (!schoolId || !dormId) return <LoadingScreen />;
  if (loading) return <LoadingScreen message="Loading beds..." />;

  return (
    <View style={s.flex}>
      <Header
        title={dormName || 'Beds'}
        subtitle={`${beds.length} beds · ${beds.filter((b) => b.is_occupied).length} occupied`}
        showBack
        accentColor={Colors.secondary}
        rightAction={{ icon: 'add', onPress: () => setShowModal(true) }}
      />
      <FlatList
        data={beds}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="single-bed"
            title="No Beds"
            description="Add beds to this dormitory."
            actionLabel="Add Bed"
            onAction={() => setShowModal(true)}
          />
        }
        renderItem={({ item }) => {
          const stu = (item as any).students;
          return (
            <Card style={s.bedCard}>
              <View style={s.bedRow}>
                <View style={[s.bedIcon, { backgroundColor: item.is_occupied ? Colors.successBg : Colors.surface2 }]}>
                  <MaterialIcons name="single-bed" size={20} color={item.is_occupied ? Colors.success : Colors.textMuted} />
                </View>
                <View style={s.bedInfo}>
                  <Text style={s.bedNumber}>Bed {item.bed_number}</Text>
                  <Text style={s.bedRoom}>Room {item.room_number || '—'}</Text>
                  {item.is_occupied && stu ? (
                    <Text style={s.bedStudent}>{stu.full_name} · {stu.admission_number}</Text>
                  ) : null}
                </View>
                {item.is_occupied ? (
                  <Badge label="Occupied" variant="success" size="sm" />
                ) : (
                  <Badge label="Available" variant="default" size="sm" />
                )}
              </View>
              <View style={s.actionRow}>
                {item.is_occupied ? (
                  <Button label="Unassign" variant="danger" size="sm" onPress={() => handleUnassign(item)} />
                ) : (
                  <Button label="Assign Student" variant="primary" size="sm" onPress={() => setAssignFor(item)} />
                )}
              </View>
            </Card>
          );
        }}
      />

      {/* Add bed modal */}
      <Modal visible={showModal} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={s.overlay}>
          <View style={s.modal}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>Add Bed</Text>
              <Pressable onPress={() => setShowModal(false)} hitSlop={8}>
                <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
              </Pressable>
            </View>
            <View style={s.form}>
              <Input label="Bed Number *" value={form.bed_number} onChangeText={(v) => setForm((f) => ({ ...f, bed_number: v }))} placeholder="e.g. B-12" />
              <Input label="Room Number" value={form.room_number} onChangeText={(v) => setForm((f) => ({ ...f, room_number: v }))} placeholder="e.g. 101" />
              <Button label="Add Bed" onPress={handleAdd} fullWidth loading={saving} size="lg" />
            </View>
          </View>
        </View>
      </Modal>

      {/* Student picker modal */}
      <Modal visible={!!assignFor} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={s.overlay}>
          <View style={s.modal}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>Assign Student to Bed {assignFor?.bed_number}</Text>
              <Pressable onPress={() => { setAssignFor(null); setStudentSearch(''); setStudentResults([]); }} hitSlop={8}>
                <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
              </Pressable>
            </View>
            <View style={s.searchBox}>
              <MaterialIcons name="search" size={18} color={Colors.textMuted} />
              <TextInput
                style={s.searchInput}
                value={studentSearch}
                onChangeText={searchStudents}
                placeholder="Search by name or admission #..."
                placeholderTextColor={Colors.textMuted}
                autoFocus
              />
              {searching ? <ActivityIndicator color={Colors.primary} /> : null}
            </View>
            <ScrollView style={{ maxHeight: 400 }}>
              {studentResults.map((st) => (
                <Pressable key={st.id} style={s.dropItem} onPress={() => handleAssign(st.id)}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.dropName}>{st.full_name}</Text>
                    <Text style={s.dropAdm}>{st.admission_number} · {st.classes?.name || 'No class'}</Text>
                  </View>
                  <MaterialIcons name="person-add" size={20} color={Colors.primary} />
                </Pressable>
              ))}
              {studentResults.length === 0 && studentSearch ? (
                <Text style={s.emptyText}>No students match.</Text>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 100 },
  bedCard: { gap: Spacing.sm },
  bedRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  bedIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  bedInfo: { flex: 1 },
  bedNumber: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  bedRoom: { fontSize: FontSize.xs, color: Colors.textSecondary },
  bedStudent: { fontSize: FontSize.xs, color: Colors.success, marginTop: 2 },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, maxHeight: '85%' },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  form: { gap: Spacing.md, paddingBottom: Spacing.xl },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface2, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.sm, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.md },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: FontSize.base },
  dropItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  dropName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  dropAdm: { fontSize: FontSize.xs, color: Colors.textSecondary },
  emptyText: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center', padding: Spacing.md },
});
