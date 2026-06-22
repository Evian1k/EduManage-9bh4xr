// Inspections — list + create modal
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Modal, Pressable, ScrollView,
} from 'react-native';
import { useAlert } from '@/template';
import { useAppContext } from '@/hooks/useAppContext';
import {
  getInspections, createInspection, DormitoryInspection, Dormitory,
  getDormitories,
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

export default function InspectionsScreen() {
  const { showAlert } = useAlert();
  const { school, profileId } = useAppContext();
  const schoolId = school?.id;
  const [inspections, setInspections] = useState<DormitoryInspection[]>([]);
  const [dorms, setDorms] = useState<Dormitory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dormPickerOpen, setDormPickerOpen] = useState(false);
  const [form, setForm] = useState({
    dormitory_id: '',
    inspection_date: new Date().toISOString().split('T')[0],
    cleanliness_score: '8',
    discipline_score: '8',
    notes: '',
    follow_up_required: false,
  });

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    const [inspRes, dormRes] = await Promise.all([
      getInspections(schoolId),
      getDormitories(schoolId, true),
    ]);
    if (inspRes.error) showAlert('Error', inspRes.error);
    setInspections(inspRes.data || []);
    setDorms(dormRes.data || []);
    if (!form.dormitory_id && (dormRes.data || []).length > 0) {
      setForm((f) => ({ ...f, dormitory_id: dormRes.data![0].id }));
    }
    setLoading(false);
  }, [schoolId]);

  useEffect(() => { if (schoolId) load(); }, [schoolId]);

  const handleCreate = async () => {
    if (!form.dormitory_id || !schoolId) {
      showAlert('Missing Fields', 'Please select a dormitory.');
      return;
    }
    setSaving(true);
    const { error } = await createInspection(schoolId, {
      dormitory_id: form.dormitory_id,
      inspection_date: form.inspection_date || undefined,
      cleanliness_score: parseFloat(form.cleanliness_score) || undefined,
      discipline_score: parseFloat(form.discipline_score) || undefined,
      notes: form.notes.trim() || undefined,
      follow_up_required: form.follow_up_required,
      inspected_by: profileId || undefined,
    });
    setSaving(false);
    if (error) { showAlert('Error', error); return; }
    setShowModal(false);
    setForm({
      dormitory_id: dorms[0]?.id || '',
      inspection_date: new Date().toISOString().split('T')[0],
      cleanliness_score: '8', discipline_score: '8', notes: '', follow_up_required: false,
    });
    load();
  };

  if (!schoolId) return <LoadingScreen />;
  if (loading) return <LoadingScreen message="Loading inspections..." />;

  const dormName = (id: string) => dorms.find((d) => d.id === id)?.name || (inspections.find((i) => i.dormitory_id === id) as any)?.dormitories?.name || 'Unknown';

  return (
    <View style={s.flex}>
      <Header
        title="Inspections"
        subtitle={`${inspections.length} records`}
        showBack
        accentColor={Colors.secondary}
        rightAction={{ icon: 'add', onPress: () => setShowModal(true) }}
      />
      <FlatList
        data={inspections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="fact-check"
            title="No Inspections"
            description="Log your first dormitory inspection."
            actionLabel="New Inspection"
            onAction={() => setShowModal(true)}
          />
        }
        renderItem={({ item }) => (
          <Card style={s.card}>
            <View style={s.row}>
              <View style={s.icon}>
                <MaterialIcons name="fact-check" size={20} color={Colors.secondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.dormName}>{dormName(item.dormitory_id)}</Text>
                <Text style={s.date}>{new Date(item.inspection_date).toLocaleDateString()}</Text>
              </View>
              {item.follow_up_required ? <Badge label="Follow-up" variant="warning" size="sm" /> : null}
            </View>
            <View style={s.scoresRow}>
              <View style={s.scoreBox}>
                <Text style={s.scoreLabel}>Cleanliness</Text>
                <Text style={[s.scoreValue, { color: (item.cleanliness_score || 0) >= 7 ? Colors.success : Colors.warning }]}>
                  {item.cleanliness_score ?? '—'}/10
                </Text>
              </View>
              <View style={s.scoreBox}>
                <Text style={s.scoreLabel}>Discipline</Text>
                <Text style={[s.scoreValue, { color: (item.discipline_score || 0) >= 7 ? Colors.success : Colors.warning }]}>
                  {item.discipline_score ?? '—'}/10
                </Text>
              </View>
            </View>
            {item.notes ? <Text style={s.notes}>{item.notes}</Text> : null}
          </Card>
        )}
      />

      <Modal visible={showModal} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={s.overlay}>
          <View style={s.modal}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>New Inspection</Text>
              <Pressable onPress={() => setShowModal(false)} hitSlop={8}>
                <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={s.form}>
                <View>
                  <Text style={s.label}>Dormitory *</Text>
                  <Pressable style={s.selectBtn} onPress={() => setDormPickerOpen(true)}>
                    <Text style={s.selectText} numberOfLines={1}>{dormName(form.dormitory_id) || 'Select dormitory'}</Text>
                    <MaterialIcons name="arrow-drop-down" size={20} color={Colors.textSecondary} />
                  </Pressable>
                </View>
                <Input label="Inspection Date" value={form.inspection_date} onChangeText={(v) => setForm((f) => ({ ...f, inspection_date: v }))} placeholder="YYYY-MM-DD" />
                <View style={s.row2}>
                  <View style={{ flex: 1 }}>
                    <Input label="Cleanliness (0-10)" value={form.cleanliness_score} onChangeText={(v) => setForm((f) => ({ ...f, cleanliness_score: v }))} keyboardType="numeric" placeholder="8" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input label="Discipline (0-10)" value={form.discipline_score} onChangeText={(v) => setForm((f) => ({ ...f, discipline_score: v }))} keyboardType="numeric" placeholder="8" />
                  </View>
                </View>
                <Input label="Notes" value={form.notes} onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))} placeholder="Observations..." multiline numberOfLines={3} />
                <Pressable style={s.checkRow} onPress={() => setForm((f) => ({ ...f, follow_up_required: !f.follow_up_required }))}>
                  <MaterialIcons name={form.follow_up_required ? 'check-box' : 'check-box-outline-blank'} size={22} color={form.follow_up_required ? Colors.primary : Colors.textMuted} />
                  <Text style={s.checkLabel}>Follow-up required</Text>
                </Pressable>
                <Button label="Save Inspection" onPress={handleCreate} fullWidth loading={saving} size="lg" />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

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
                  style={[s.pickItem, form.dormitory_id === d.id && s.pickItemActive]}
                  onPress={() => { setForm((f) => ({ ...f, dormitory_id: d.id })); setDormPickerOpen(false); }}
                >
                  <Text style={[s.pickItemText, form.dormitory_id === d.id && s.pickItemTextActive]}>{d.name}</Text>
                  {form.dormitory_id === d.id ? <MaterialIcons name="check" size={20} color={Colors.primary} /> : null}
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
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 100 },
  card: { gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: `${Colors.secondary}20`, alignItems: 'center', justifyContent: 'center' },
  dormName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  date: { fontSize: FontSize.xs, color: Colors.textSecondary },
  scoresRow: { flexDirection: 'row', gap: Spacing.sm },
  scoreBox: { flex: 1, backgroundColor: Colors.surface2, borderRadius: BorderRadius.md, padding: Spacing.sm, alignItems: 'center' },
  scoreLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  scoreValue: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  notes: { fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: 'italic' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, maxHeight: '85%' },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  form: { gap: Spacing.md, paddingBottom: Spacing.xl },
  row2: { flexDirection: 'row', gap: Spacing.sm },
  label: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium, marginBottom: 6 },
  selectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface2, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, minHeight: 48 },
  selectText: { color: Colors.textPrimary, fontSize: FontSize.base, flex: 1 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  checkLabel: { fontSize: FontSize.base, color: Colors.textPrimary },
  pickItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  pickItemActive: { backgroundColor: Colors.infoBg },
  pickItemText: { fontSize: FontSize.base, color: Colors.textPrimary },
  pickItemTextActive: { color: Colors.primary, fontWeight: FontWeight.semibold },
});
