// Nurse: Medical visits — log visit modal + FlatList
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Modal, Pressable, ScrollView, TextInput, RefreshControl,
} from 'react-native';
import { useAppContext } from '@/hooks/useAppContext';
import { getMedicalVisits, createMedicalVisit, MedicalVisit } from '@/services/medical.service';
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
import { getSupabaseClient } from '@/template';

export default function NurseVisitsScreen() {
  const { showAlert } = useAlert();
  const { school, profileId } = useAppContext();
  const schoolId = school?.id;
  const [visits, setVisits] = useState<MedicalVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentResults, setStudentResults] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [form, setForm] = useState({
    chief_complaint: '', diagnosis: '', treatment_given: '',
    temperature: '', blood_pressure: '', pulse: '',
    sent_home: false, referred: false, parent_notified: false,
  });

  const load = useCallback(async () => {
    if (!schoolId) return;
    const { data, error } = await getMedicalVisits(schoolId);
    if (error) showAlert('Error', error);
    setVisits(data || []);
    setLoading(false);
    setRefreshing(false);
  }, [schoolId]);

  useEffect(() => { if (schoolId) load(); }, [schoolId]);

  const searchStudents = async (q: string) => {
    setStudentSearch(q);
    if (!q || !schoolId) { setStudentResults([]); return; }
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
  };

  const handleCreate = async () => {
    if (!selectedStudent || !form.chief_complaint.trim() || !schoolId) {
      showAlert('Missing Fields', 'Please select a student and enter the chief complaint.');
      return;
    }
    setSaving(true);
    const { error } = await createMedicalVisit(schoolId, {
      student_id: selectedStudent.id,
      chief_complaint: form.chief_complaint.trim(),
      diagnosis: form.diagnosis.trim() || undefined,
      treatment_given: form.treatment_given.trim() || undefined,
      temperature: form.temperature ? parseFloat(form.temperature) : undefined,
      blood_pressure: form.blood_pressure.trim() || undefined,
      pulse: form.pulse ? parseInt(form.pulse, 10) : undefined,
      sent_home: form.sent_home,
      referred_to_hospital: form.referred,
      parent_notified: form.parent_notified,
      attended_by: profileId || undefined,
    });
    setSaving(false);
    if (error) { showAlert('Error', error); return; }
    setShowModal(false);
    setSelectedStudent(null);
    setStudentSearch('');
    setStudentResults([]);
    setForm({ chief_complaint: '', diagnosis: '', treatment_given: '', temperature: '', blood_pressure: '', pulse: '', sent_home: false, referred: false, parent_notified: false });
    load();
  };

  if (!schoolId) return <LoadingScreen />;
  if (loading) return <LoadingScreen message="Loading medical visits..." />;

  return (
    <View style={s.flex}>
      <Header
        title="Medical Visits"
        subtitle={`${visits.length} logged`}
        showBack
        accentColor="#D32F2F"
        rightAction={{ icon: 'add', onPress: () => setShowModal(true) }}
      />
      <FlatList
        data={visits}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} colors={[Colors.primary]} />}
        ListEmptyComponent={<EmptyState icon="healing" title="No Visits Logged" description="Log your first medical visit." actionLabel="Log Visit" onAction={() => setShowModal(true)} />}
        renderItem={({ item }) => {
          const stu = (item as any).students;
          const name = stu?.full_name || 'Unknown student';
          return (
            <Card style={s.card}>
              <View style={s.row}>
                <View style={[s.icon, { backgroundColor: item.sent_home ? Colors.warningBg : item.referred_to_hospital ? Colors.errorBg : Colors.successBg }]}>
                  <MaterialIcons
                    name={item.referred_to_hospital ? 'local-hospital' : item.sent_home ? 'home' : 'healing'}
                    size={18}
                    color={item.referred_to_hospital ? Colors.error : item.sent_home ? Colors.warning : Colors.success}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{name}</Text>
                  <Text style={s.date}>{new Date(item.visit_date).toLocaleString()}</Text>
                  <Text style={s.complaint}>Chief complaint: {item.chief_complaint || '—'}</Text>
                  {item.diagnosis ? <Text style={s.diagnosis}>Dx: {item.diagnosis}</Text> : null}
                  {item.treatment_given ? <Text style={s.tx}>Rx: {item.treatment_given}</Text> : null}
                  <View style={s.vitalRow}>
                    {item.temperature ? <Text style={s.vital}>🌡 {item.temperature}°C</Text> : null}
                    {item.blood_pressure ? <Text style={s.vital}>💓 {item.blood_pressure}</Text> : null}
                    {item.pulse ? <Text style={s.vital}>❤ {item.pulse} bpm</Text> : null}
                  </View>
                </View>
                <View style={s.rightCol}>
                  {item.sent_home ? <Badge label="Sent home" variant="warning" size="sm" /> : null}
                  {item.referred_to_hospital ? <Badge label="Referred" variant="error" size="sm" /> : null}
                  {item.parent_notified ? <Badge label="Parent notified" variant="success" size="sm" /> : null}
                </View>
              </View>
            </Card>
          );
        }}
      />

      {/* Log visit modal */}
      <Modal visible={showModal} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={s.overlay}>
          <View style={s.modal}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>Log Medical Visit</Text>
              <Pressable onPress={() => setShowModal(false)} hitSlop={8}>
                <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={s.form}>
                {/* Student picker */}
                <Text style={s.label}>Student *</Text>
                <TextInput
                  style={s.input}
                  value={studentSearch}
                  onChangeText={searchStudents}
                  placeholder="Search student name or admission #..."
                  placeholderTextColor={Colors.textMuted}
                />
                {studentSearch && !selectedStudent ? (
                  <View style={s.dropdown}>
                    {studentResults.map((st) => (
                      <Pressable key={st.id} style={s.dropItem} onPress={() => { setSelectedStudent(st); setStudentSearch(`${st.full_name} (${st.admission_number})`); }}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.dropName}>{st.full_name}</Text>
                          <Text style={s.dropAdm}>{st.admission_number} · {st.classes?.name || 'No class'}</Text>
                        </View>
                        <MaterialIcons name="person-add" size={18} color={Colors.primary} />
                      </Pressable>
                    ))}
                    {studentResults.length === 0 ? <Text style={s.emptyText}>No matches.</Text> : null}
                  </View>
                ) : null}
                {selectedStudent ? (
                  <View style={s.selectedStudent}>
                    <MaterialIcons name="check-circle" size={16} color={Colors.success} />
                    <Text style={s.selectedName}>{selectedStudent.full_name}</Text>
                    <Pressable onPress={() => { setSelectedStudent(null); setStudentSearch(''); }}>
                      <MaterialIcons name="close" size={16} color={Colors.textMuted} />
                    </Pressable>
                  </View>
                ) : null}

                <Input label="Chief Complaint *" value={form.chief_complaint} onChangeText={(v) => setForm((f) => ({ ...f, chief_complaint: v }))} placeholder="e.g., Headache, stomach pain..." />
                <Input label="Diagnosis" value={form.diagnosis} onChangeText={(v) => setForm((f) => ({ ...f, diagnosis: v }))} placeholder="Working diagnosis" />
                <Input label="Treatment Given" value={form.treatment_given} onChangeText={(v) => setForm((f) => ({ ...f, treatment_given: v }))} placeholder="e.g., Paracetamol 500mg" />
                <View style={s.row2}>
                  <View style={{ flex: 1 }}>
                    <Input label="Temp (°C)" value={form.temperature} onChangeText={(v) => setForm((f) => ({ ...f, temperature: v }))} keyboardType="numeric" placeholder="36.5" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input label="BP" value={form.blood_pressure} onChangeText={(v) => setForm((f) => ({ ...f, blood_pressure: v }))} placeholder="120/80" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input label="Pulse" value={form.pulse} onChangeText={(v) => setForm((f) => ({ ...f, pulse: v }))} keyboardType="numeric" placeholder="72" />
                  </View>
                </View>

                <Pressable style={s.checkRow} onPress={() => setForm((f) => ({ ...f, sent_home: !f.sent_home }))}>
                  <MaterialIcons name={form.sent_home ? 'check-box' : 'check-box-outline-blank'} size={22} color={form.sent_home ? Colors.warning : Colors.textMuted} />
                  <Text style={s.checkLabel}>Sent home</Text>
                </Pressable>
                <Pressable style={s.checkRow} onPress={() => setForm((f) => ({ ...f, referred: !f.referred }))}>
                  <MaterialIcons name={form.referred ? 'check-box' : 'check-box-outline-blank'} size={22} color={form.referred ? Colors.error : Colors.textMuted} />
                  <Text style={s.checkLabel}>Referred to hospital</Text>
                </Pressable>
                <Pressable style={s.checkRow} onPress={() => setForm((f) => ({ ...f, parent_notified: !f.parent_notified }))}>
                  <MaterialIcons name={form.parent_notified ? 'check-box' : 'check-box-outline-blank'} size={22} color={form.parent_notified ? Colors.success : Colors.textMuted} />
                  <Text style={s.checkLabel}>Parent notified</Text>
                </Pressable>

                <Button label="Log Visit" onPress={handleCreate} fullWidth loading={saving} size="lg" />
              </View>
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
  card: {},
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  date: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  complaint: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4 },
  diagnosis: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  tx: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  vitalRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4, flexWrap: 'wrap' },
  vital: { fontSize: FontSize.xs, color: Colors.textMuted },
  rightCol: { alignItems: 'flex-end', gap: 4, flexShrink: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, maxHeight: '90%' },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  form: { gap: Spacing.md, paddingBottom: Spacing.xl },
  label: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium, marginBottom: 6 },
  input: { backgroundColor: Colors.surface2, borderRadius: BorderRadius.md, padding: Spacing.md, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border, fontSize: FontSize.base },
  dropdown: { backgroundColor: Colors.surface2, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, marginTop: 4, overflow: 'hidden' },
  dropItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  dropName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  dropAdm: { fontSize: FontSize.xs, color: Colors.textSecondary },
  emptyText: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center', padding: Spacing.md },
  selectedStudent: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.successBg, padding: Spacing.sm, borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: `${Colors.success}30` },
  selectedName: { flex: 1, fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  row2: { flexDirection: 'row', gap: Spacing.sm },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  checkLabel: { fontSize: FontSize.base, color: Colors.textPrimary },
});
