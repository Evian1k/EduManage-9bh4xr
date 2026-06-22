// Nurse: Medical records — search by student + FlatList + tap-to-edit modal
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, TextInput, Modal, ScrollView, RefreshControl,
} from 'react-native';
import { useAppContext } from '@/hooks/useAppContext';
import { getStudentsWithMedicalRecords, upsertMedicalRecord, MedicalRecord } from '@/services/medical.service';
import { useAlert } from '@/template';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';

interface StudentRow {
  id: string;
  full_name: string;
  admission_number: string;
  class_name?: string | null;
  medical_record?: MedicalRecord | null;
}

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'];

export default function NurseRecordsScreen() {
  const { showAlert } = useAlert();
  const { school } = useAppContext();
  const schoolId = school?.id;
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<StudentRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [bloodPickerOpen, setBloodPickerOpen] = useState(false);
  const [form, setForm] = useState({
    blood_group: '',
    height: '',
    weight: '',
    allergies: '',
    conditions: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
  });

  const load = useCallback(async () => {
    if (!schoolId) return;
    const { data, error } = await getStudentsWithMedicalRecords(schoolId);
    if (error) showAlert('Error', error);
    setStudents(data || []);
    setLoading(false);
    setRefreshing(false);
  }, [schoolId]);

  useEffect(() => { if (schoolId) load(); }, [schoolId]);

  const openEdit = (s: StudentRow) => {
    setEditing(s);
    const r = s.medical_record;
    setForm({
      blood_group: r?.blood_group || '',
      height: r?.height ? String(r.height) : '',
      weight: r?.weight ? String(r.weight) : '',
      allergies: Array.isArray(r?.allergies) ? (r!.allergies as any[]).join(', ') : '',
      conditions: Array.isArray(r?.chronic_conditions) ? (r!.chronic_conditions as any[]).join(', ') : '',
      emergency_contact_name: r?.emergency_contact_name || '',
      emergency_contact_phone: r?.emergency_contact_phone || '',
    });
  };

  const handleSave = async () => {
    if (!schoolId || !editing) return;
    setSaving(true);
    const allergies = form.allergies.split(',').map((s) => s.trim()).filter(Boolean);
    const conditions = form.conditions.split(',').map((s) => s.trim()).filter(Boolean);
    const { error } = await upsertMedicalRecord(schoolId, editing.id, {
      blood_group: form.blood_group || null,
      height: form.height ? parseFloat(form.height) : null,
      weight: form.weight ? parseFloat(form.weight) : null,
      allergies,
      chronic_conditions: conditions,
      emergency_contact_name: form.emergency_contact_name || null,
      emergency_contact_phone: form.emergency_contact_phone || null,
    });
    setSaving(false);
    if (error) { showAlert('Error', error); return; }
    setEditing(null);
    load();
  };

  if (!schoolId) return <LoadingScreen />;
  if (loading) return <LoadingScreen message="Loading medical records..." />;

  const filtered = students.filter((s) =>
    !search ||
    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    s.admission_number?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={s.flex}>
      <Header title="Medical Records" subtitle={`${students.length} students`} showBack accentColor="#D32F2F" />
      <View style={s.searchBox}>
        <MaterialIcons name="search" size={18} color={Colors.textMuted} />
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by student name or admission #..."
          placeholderTextColor={Colors.textMuted}
        />
        {search ? (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <MaterialIcons name="close" size={18} color={Colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} colors={[Colors.primary]} />}
        ListEmptyComponent={<EmptyState icon="folder-shared" title="No Students" description="No students match your search." />}
        renderItem={({ item }) => {
          const r = item.medical_record;
          const allergyCount = Array.isArray(r?.allergies) ? r!.allergies.length : 0;
          const condCount = Array.isArray(r?.chronic_conditions) ? r!.chronic_conditions.length : 0;
          return (
            <Card style={s.card} onPress={() => openEdit(item)}>
              <View style={s.row}>
                <Avatar name={item.full_name} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{item.full_name}</Text>
                  <Text style={s.adm}>{item.admission_number} · {item.class_name || 'No class'}</Text>
                  <View style={s.metaRow}>
                    {r?.blood_group ? <Badge label={`Blood: ${r.blood_group}`} variant="error" size="sm" /> : <Badge label="No blood group" variant="default" size="sm" />}
                    <View style={s.countBox}>
                      <MaterialIcons name="warning" size={12} color={allergyCount > 0 ? Colors.warning : Colors.textMuted} />
                      <Text style={s.countText}>{allergyCount} allergies</Text>
                    </View>
                    <View style={s.countBox}>
                      <MaterialIcons name="healing" size={12} color={condCount > 0 ? Colors.error : Colors.textMuted} />
                      <Text style={s.countText}>{condCount} conditions</Text>
                    </View>
                  </View>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={Colors.textMuted} />
              </View>
            </Card>
          );
        }}
      />

      {/* Edit modal */}
      <Modal visible={!!editing} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={s.overlay}>
          <View style={s.modal}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle} numberOfLines={1}>Edit · {editing?.full_name}</Text>
              <Pressable onPress={() => setEditing(null)} hitSlop={8}>
                <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={s.form}>
                <View>
                  <Text style={s.label}>Blood Group</Text>
                  <Pressable style={s.selectBtn} onPress={() => setBloodPickerOpen(true)}>
                    <Text style={s.selectText}>{form.blood_group || 'Select blood group'}</Text>
                    <MaterialIcons name="arrow-drop-down" size={20} color={Colors.textSecondary} />
                  </Pressable>
                </View>
                <View style={s.row2}>
                  <View style={{ flex: 1 }}>
                    <Input label="Height (cm)" value={form.height} onChangeText={(v) => setForm((f) => ({ ...f, height: v }))} keyboardType="numeric" placeholder="150" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input label="Weight (kg)" value={form.weight} onChangeText={(v) => setForm((f) => ({ ...f, weight: v }))} keyboardType="numeric" placeholder="45" />
                  </View>
                </View>
                <Input label="Allergies (comma-separated)" value={form.allergies} onChangeText={(v) => setForm((f) => ({ ...f, allergies: v }))} placeholder="Peanuts, Pollen..." />
                <Input label="Chronic Conditions (comma-separated)" value={form.conditions} onChangeText={(v) => setForm((f) => ({ ...f, conditions: v }))} placeholder="Asthma, Diabetes..." />
                <Input label="Emergency Contact Name" value={form.emergency_contact_name} onChangeText={(v) => setForm((f) => ({ ...f, emergency_contact_name: v }))} placeholder="Parent / Guardian name" />
                <Input label="Emergency Contact Phone" value={form.emergency_contact_phone} onChangeText={(v) => setForm((f) => ({ ...f, emergency_contact_phone: v }))} placeholder="+1 555-0000" keyboardType="phone-pad" />
                <Button label="Save Record" onPress={handleSave} fullWidth loading={saving} size="lg" />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={bloodPickerOpen} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={s.overlay}>
          <View style={s.modal}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>Select Blood Group</Text>
              <Pressable onPress={() => setBloodPickerOpen(false)} hitSlop={8}>
                <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
              </Pressable>
            </View>
            <ScrollView>
              {BLOOD_GROUPS.map((b) => (
                <Pressable
                  key={b}
                  style={[s.pickItem, form.blood_group === b && s.pickItemActive]}
                  onPress={() => { setForm((f) => ({ ...f, blood_group: b })); setBloodPickerOpen(false); }}
                >
                  <Text style={[s.pickItemText, form.blood_group === b && s.pickItemTextActive]}>{b}</Text>
                  {form.blood_group === b ? <MaterialIcons name="check" size={20} color={Colors.primary} /> : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.sm, borderWidth: 1, borderColor: Colors.border, margin: Spacing.md, marginBottom: 0 },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: FontSize.base },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 100 },
  card: {},
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  name: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  adm: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 6, flexWrap: 'wrap' },
  countBox: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.surface2, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  countText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, maxHeight: '88%' },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md, gap: Spacing.sm },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, flex: 1 },
  form: { gap: Spacing.md, paddingBottom: Spacing.xl },
  row2: { flexDirection: 'row', gap: Spacing.sm },
  label: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium, marginBottom: 6 },
  selectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface2, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, minHeight: 48 },
  selectText: { color: Colors.textPrimary, fontSize: FontSize.base, flex: 1 },
  pickItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  pickItemActive: { backgroundColor: Colors.infoBg },
  pickItemText: { fontSize: FontSize.base, color: Colors.textPrimary },
  pickItemTextActive: { color: Colors.primary, fontWeight: FontWeight.semibold },
});
