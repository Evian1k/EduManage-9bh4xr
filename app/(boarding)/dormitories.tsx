// Dormitory CRUD — list with occupancy bars + create modal
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Modal, Pressable, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAlert } from '@/template';
import { useAppContext } from '@/hooks/useAppContext';
import {
  getDormitories, createDormitory, getBeds, Dormitory,
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

const GENDERS = ['male', 'female', 'mixed'];

export default function DormitoriesScreen() {
  const router = useRouter();
  const { showAlert } = useAlert();
  const { school } = useAppContext();
  const schoolId = school?.id;
  const [dorms, setDorms] = useState<Dormitory[]>([]);
  const [occupiedMap, setOccupiedMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [genderPickerOpen, setGenderPickerOpen] = useState(false);
  const [form, setForm] = useState({ name: '', gender: 'male', capacity: '40', location: '' });

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    const [dormsRes, bedsRes] = await Promise.all([
      getDormitories(schoolId),
      getBeds(schoolId),
    ]);
    if (dormsRes.error) { showAlert('Error', dormsRes.error); setLoading(false); return; }
    const d = dormsRes.data || [];
    setDorms(d);
    const occ: Record<string, number> = {};
    (bedsRes.data || []).forEach((b) => {
      if (b.is_occupied) occ[b.dormitory_id] = (occ[b.dormitory_id] || 0) + 1;
    });
    setOccupiedMap(occ);
    setLoading(false);
  }, [schoolId]);

  useEffect(() => { if (schoolId) load(); }, [schoolId]);

  const handleCreate = async () => {
    if (!form.name.trim() || !schoolId) {
      showAlert('Missing Fields', 'Dormitory name is required.');
      return;
    }
    setSaving(true);
    const { error } = await createDormitory(schoolId, {
      name: form.name.trim(),
      gender: form.gender,
      capacity: parseInt(form.capacity, 10) || 40,
      location: form.location.trim() || undefined,
    });
    setSaving(false);
    if (error) { showAlert('Error', error); return; }
    setShowModal(false);
    setForm({ name: '', gender: 'male', capacity: '40', location: '' });
    load();
  };

  if (!schoolId) return <LoadingScreen />;
  if (loading) return <LoadingScreen message="Loading dormitories..." />;

  return (
    <View style={s.flex}>
      <Header
        title="Dormitories"
        subtitle={`${dorms.length} total`}
        showBack
        accentColor={Colors.secondary}
        rightAction={{ icon: 'add', onPress: () => setShowModal(true) }}
      />
      <FlatList
        data={dorms}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="king-bed"
            title="No Dormitories"
            description="Create your first dormitory to manage beds and boarding."
            actionLabel="New Dormitory"
            onAction={() => setShowModal(true)}
          />
        }
        renderItem={({ item }) => {
          const occupied = occupiedMap[item.id] || 0;
          const pct = item.capacity > 0 ? Math.min(100, Math.round((occupied / item.capacity) * 100)) : 0;
          return (
            <Card style={s.dormCard} onPress={() => router.push({ pathname: '/(boarding)/beds', params: { dormId: item.id, dormName: item.name } })}>
              <View style={s.dormRow}>
                <View style={s.dormIcon}>
                  <MaterialIcons name="king-bed" size={22} color={Colors.secondary} />
                </View>
                <View style={s.dormInfo}>
                  <Text style={s.dormName}>{item.name}</Text>
                  <View style={s.badgeRow}>
                    <Badge label={item.gender || 'mixed'} variant="info" size="sm" />
                    {item.location ? <Text style={s.dormLoc}> · {item.location}</Text> : null}
                  </View>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={Colors.textMuted} />
              </View>
              <View style={s.occRow}>
                <View style={s.occBar}>
                  <View style={[s.occFill, { width: `${pct}%`, backgroundColor: pct >= 90 ? Colors.error : pct >= 60 ? Colors.warning : Colors.success }]} />
                </View>
                <Text style={s.occText}>{occupied}/{item.capacity} occupied</Text>
              </View>
            </Card>
          );
        }}
      />

      <Modal visible={showModal} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={s.overlay}>
          <View style={s.modal}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>New Dormitory</Text>
              <Pressable onPress={() => setShowModal(false)} hitSlop={8}>
                <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={s.form}>
                <Input label="Name *" value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="e.g. Mandela House" />
                <View>
                  <Text style={s.label}>Gender</Text>
                  <Pressable style={s.selectBtn} onPress={() => setGenderPickerOpen(true)}>
                    <Text style={s.selectText}>{form.gender}</Text>
                    <MaterialIcons name="arrow-drop-down" size={20} color={Colors.textSecondary} />
                  </Pressable>
                </View>
                <Input label="Capacity" value={form.capacity} onChangeText={(v) => setForm((f) => ({ ...f, capacity: v }))} keyboardType="numeric" placeholder="40" />
                <Input label="Location" value={form.location} onChangeText={(v) => setForm((f) => ({ ...f, location: v }))} placeholder="e.g. Block A · 1st Floor" />
                <Button label="Create Dormitory" onPress={handleCreate} fullWidth loading={saving} size="lg" />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={genderPickerOpen} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={s.overlay}>
          <View style={s.modal}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>Select Gender</Text>
              <Pressable onPress={() => setGenderPickerOpen(false)} hitSlop={8}>
                <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
              </Pressable>
            </View>
            {GENDERS.map((g) => (
              <Pressable
                key={g}
                style={[s.pickItem, form.gender === g && s.pickItemActive]}
                onPress={() => { setForm((f) => ({ ...f, gender: g })); setGenderPickerOpen(false); }}
              >
                <Text style={[s.pickItemText, form.gender === g && s.pickItemTextActive]}>{g}</Text>
                {form.gender === g ? <MaterialIcons name="check" size={20} color={Colors.primary} /> : null}
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
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 100 },
  dormCard: { gap: Spacing.sm },
  dormRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  dormIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: `${Colors.secondary}20`, alignItems: 'center', justifyContent: 'center' },
  dormInfo: { flex: 1 },
  dormName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  badgeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  dormLoc: { fontSize: FontSize.xs, color: Colors.textMuted },
  occRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  occBar: { flex: 1, height: 6, backgroundColor: Colors.surface2, borderRadius: 3, overflow: 'hidden' },
  occFill: { height: 6, borderRadius: 3 },
  occText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, maxHeight: '85%' },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  form: { gap: Spacing.md, paddingBottom: Spacing.xl },
  label: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium, marginBottom: 6 },
  selectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface2, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, minHeight: 48 },
  selectText: { color: Colors.textPrimary, fontSize: FontSize.base },
  pickItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  pickItemActive: { backgroundColor: Colors.infoBg },
  pickItemText: { fontSize: FontSize.base, color: Colors.textPrimary, textTransform: 'capitalize' },
  pickItemTextActive: { color: Colors.primary, fontWeight: FontWeight.semibold },
});
