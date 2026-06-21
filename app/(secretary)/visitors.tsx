// Secretary: Visitor log — check-in modal, FlatList, filter chips (All/Active/Checked Out), check-out button
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Modal, Pressable, ScrollView, RefreshControl,
} from 'react-native';
import { useAppContext } from '@/hooks/useAppContext';
import {
  getVisitors, checkInVisitor, checkOutVisitor, Visitor,
} from '@/services/communication.service';
import { useAlert } from '@/template';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';

type Filter = 'all' | 'active' | 'checked_out';

export default function SecretaryVisitorsScreen() {
  const { showAlert } = useAlert();
  const { school } = useAppContext();
  const schoolId = school?.id;
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    visitor_name: '', visitor_phone: '', id_number: '',
    purpose: '', host_name: '', vehicle_plate: '',
  });

  const load = useCallback(async () => {
    if (!schoolId) return;
    const { data, error } = await getVisitors(schoolId, { limit: 200 });
    if (error) showAlert('Error', error);
    setVisitors(data || []);
    setLoading(false);
    setRefreshing(false);
  }, [schoolId]);

  useEffect(() => { if (schoolId) load(); }, [schoolId]);

  const handleCheckIn = async () => {
    if (!form.visitor_name.trim() || !form.purpose.trim() || !schoolId) {
      showAlert('Missing Fields', 'Visitor name and purpose are required.');
      return;
    }
    setSaving(true);
    const { error } = await checkInVisitor(schoolId, {
      visitor_name: form.visitor_name.trim(),
      visitor_phone: form.visitor_phone.trim() || undefined,
      visitor_id_number: form.id_number.trim() || undefined,
      purpose: form.purpose.trim(),
      host_name: form.host_name.trim() || undefined,
      vehicle_plate: form.vehicle_plate.trim() || undefined,
    });
    setSaving(false);
    if (error) { showAlert('Error', error); return; }
    setShowModal(false);
    setForm({ visitor_name: '', visitor_phone: '', id_number: '', purpose: '', host_name: '', vehicle_plate: '' });
    load();
  };

  const handleCheckOut = (v: Visitor) => {
    showAlert('Check Out', `Check out ${v.visitor_name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Check Out', onPress: async () => {
        if (!schoolId) return;
        const { error } = await checkOutVisitor(schoolId, v.id);
        if (error) { showAlert('Error', error); return; }
        load();
      } },
    ]);
  };

  if (!schoolId) return <LoadingScreen />;
  if (loading) return <LoadingScreen message="Loading visitors..." />;

  const filtered = visitors.filter((v) => {
    if (filter === 'active') return !v.check_out_at;
    if (filter === 'checked_out') return !!v.check_out_at;
    return true;
  });

  const activeCount = visitors.filter((v) => !v.check_out_at).length;

  return (
    <View style={s.flex}>
      <Header
        title="Visitors"
        subtitle={`${activeCount} active · ${visitors.length} total`}
        showBack
        accentColor="#00897B"
        rightAction={{ icon: 'person-add', onPress: () => setShowModal(true) }}
      />
      <View style={s.filterRow}>
        {(['all', 'active', 'checked_out'] as Filter[]).map((f) => (
          <Pressable
            key={f}
            style={[s.chip, filter === f && s.chipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[s.chipText, filter === f && s.chipTextActive]}>{f === 'checked_out' ? 'Checked Out' : f.charAt(0).toUpperCase() + f.slice(1)}</Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} colors={[Colors.primary]} />}
        ListEmptyComponent={<EmptyState icon="badge" title="No Visitors" description="Check in your first visitor." actionLabel="Check In Visitor" onAction={() => setShowModal(true)} />}
        renderItem={({ item }) => {
          const isActive = !item.check_out_at;
          return (
            <Card style={s.card}>
              <View style={s.row}>
                <View style={[s.icon, { backgroundColor: isActive ? Colors.successBg : Colors.surface2 }]}>
                  <MaterialIcons name="person-pin" size={20} color={isActive ? Colors.success : Colors.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{item.visitor_name}</Text>
                  <Text style={s.purpose}>{item.purpose}</Text>
                  {item.host_name ? <Text style={s.meta}>Host: {item.host_name}</Text> : null}
                  <View style={s.timeRow}>
                    <MaterialIcons name="login" size={12} color={Colors.textMuted} />
                    <Text style={s.time}>In: {new Date(item.check_in_at).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}</Text>
                  </View>
                  {item.check_out_at ? (
                    <View style={s.timeRow}>
                      <MaterialIcons name="logout" size={12} color={Colors.textMuted} />
                      <Text style={s.time}>Out: {new Date(item.check_out_at).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={s.rightCol}>
                  <Badge label={isActive ? 'Active' : 'Out'} variant={isActive ? 'success' : 'default'} size="sm" />
                  {isActive ? (
                    <Button label="Check Out" variant="outline" size="sm" onPress={() => handleCheckOut(item)} />
                  ) : null}
                </View>
              </View>
            </Card>
          );
        }}
      />

      <Modal visible={showModal} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={s.overlay}>
          <View style={s.modal}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>Check In Visitor</Text>
              <Pressable onPress={() => setShowModal(false)} hitSlop={8}>
                <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={s.form}>
                <Input label="Visitor Name *" value={form.visitor_name} onChangeText={(v) => setForm((f) => ({ ...f, visitor_name: v }))} placeholder="Full name" />
                <Input label="Phone" value={form.visitor_phone} onChangeText={(v) => setForm((f) => ({ ...f, visitor_phone: v }))} placeholder="+1 555-0000" keyboardType="phone-pad" />
                <Input label="ID Number" value={form.id_number} onChangeText={(v) => setForm((f) => ({ ...f, id_number: v }))} placeholder="National ID / Passport" />
                <Input label="Purpose of Visit *" value={form.purpose} onChangeText={(v) => setForm((f) => ({ ...f, purpose: v }))} placeholder="e.g., Parent meeting" />
                <Input label="Host Name" value={form.host_name} onChangeText={(v) => setForm((f) => ({ ...f, host_name: v }))} placeholder="Person to see" />
                <Input label="Vehicle Plate" value={form.vehicle_plate} onChangeText={(v) => setForm((f) => ({ ...f, vehicle_plate: v }))} placeholder="e.g., KDA 123A (optional)" />
                <Button label="Check In Visitor" onPress={handleCheckIn} fullWidth loading={saving} size="lg" />
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
  filterRow: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.md, paddingBottom: 0 },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: '#00897B', borderColor: '#00897B' },
  chipText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium, textTransform: 'capitalize' },
  chipTextActive: { color: Colors.textPrimary, fontWeight: FontWeight.semibold },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 100 },
  card: {},
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  purpose: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  meta: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  time: { fontSize: FontSize.xs, color: Colors.textMuted },
  rightCol: { alignItems: 'flex-end', gap: 6 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, maxHeight: '88%' },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  form: { gap: Spacing.md, paddingBottom: Spacing.xl },
});
