import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Modal, Pressable, ScrollView } from 'react-native';
import { useAlert } from '@/template';
import { useAppContext } from '@/hooks/useAppContext';
import { BottomNav } from '@/components/layout/BottomNav';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { getFeeStructures, createFeeStructure, FeeStructure } from '@/services/finance.service';

const NAV = [
  { label: 'Finance', icon: 'account-balance' as const, route: '/(bursar)/' },
  { label: 'Invoices', icon: 'receipt' as const, route: '/(bursar)/invoices' },
  { label: 'Payments', icon: 'payments' as const, route: '/(bursar)/payments' },
  { label: 'Reports', icon: 'bar-chart' as const, route: '/(bursar)/reports' },
];

function formatCurrency(amount: number) {
  return `KES ${Number(amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export default function BursarFeesScreen() {
  const { school } = useAppContext();
  const { showAlert } = useAlert();
  const [fees, setFees] = useState<FeeStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    class_id: '',
    term_id: '',
    tuition_fee: '',
    boarding_fee: '',
    transport_fee: '',
  });

  const load = useCallback(async () => {
    if (!school) return;
    const { data, error } = await getFeeStructures(school.id);
    if (error) { showAlert('Error', error); }
    setFees(data || []);
    setLoading(false);
    setRefreshing(false);
  }, [school]);

  useEffect(() => { load(); }, [school]);

  const handleSave = async () => {
    if (!school) return;
    if (!form.name.trim()) { showAlert('Missing Fields', 'Fee structure name is required.'); return; }
    setSaving(true);
    const { error } = await createFeeStructure(school.id, {
      name: form.name.trim(),
      class_id: form.class_id.trim() || null,
      term_id: form.term_id.trim() || null,
      tuition_fee: form.tuition_fee ? parseFloat(form.tuition_fee) : 0,
      boarding_fee: form.boarding_fee ? parseFloat(form.boarding_fee) : 0,
      transport_fee: form.transport_fee ? parseFloat(form.transport_fee) : 0,
    });
    setSaving(false);
    if (error) { showAlert('Error', error); return; }
    showAlert('Saved', 'Fee structure created.');
    setShowModal(false);
    setForm({ name: '', class_id: '', term_id: '', tuition_fee: '', boarding_fee: '', transport_fee: '' });
    load();
  };

  if (loading) return <LoadingScreen message="Loading fee structures..." />;

  return (
    <View style={styles.flex}>
      <Header
        title="Fee Structures"
        subtitle={`${fees.length} structures`}
        accentColor={Colors.success}
        rightAction={{ icon: 'add', onPress: () => setShowModal(true) }}
      />
      <FlatList
        data={fees}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={() => { setRefreshing(true); load(); }}
        ListEmptyComponent={
          <EmptyState
            icon="receipt-long"
            title="No Fee Structures"
            description="Create fee structures with tuition, boarding, and transport components."
            actionLabel="New Fee Structure"
            onAction={() => setShowModal(true)}
          />
        }
        renderItem={({ item: fee }) => (
          <Card>
            <View style={styles.feeHeader}>
              <View style={styles.feeIconWrap}>
                <MaterialIcons name="receipt-long" size={20} color={Colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.feeName}>{fee.name}</Text>
                <Text style={styles.feeMeta}>
                  {[fee.class_id && `Class: ${fee.class_id.slice(0, 8)}`, fee.term_id && `Term: ${fee.term_id.slice(0, 8)}`].filter(Boolean).join(' • ') || 'All classes • All terms'}
                </Text>
              </View>
              <Text style={styles.feeTotal}>{formatCurrency(fee.total)}</Text>
            </View>
            <View style={styles.breakdownRow}>
              <BreakdownBox label="Tuition" value={fee.tuition_fee} color={Colors.primary} />
              <BreakdownBox label="Boarding" value={fee.boarding_fee} color={Colors.warning} />
              <BreakdownBox label="Transport" value={fee.transport_fee} color={Colors.secondary} />
              <BreakdownBox label="Other" value={fee.library_fee + fee.medical_fee + fee.activity_fee + fee.other_fee} color={Colors.textSecondary} />
            </View>
          </Card>
        )}
      />

      {/* New Fee Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Fee Structure</Text>
              <Pressable onPress={() => setShowModal(false)} hitSlop={8}>
                <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Input label="Name *" value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="e.g., Term 1 Fees - Grade 4" leftIcon="receipt-long" />
              <Input label="Class ID" value={form.class_id} onChangeText={(v) => setForm((f) => ({ ...f, class_id: v }))} placeholder="Optional: class UUID" />
              <Input label="Term ID" value={form.term_id} onChangeText={(v) => setForm((f) => ({ ...f, term_id: v }))} placeholder="Optional: term UUID" />
              <Input label="Tuition Fee (KES)" value={form.tuition_fee} onChangeText={(v) => setForm((f) => ({ ...f, tuition_fee: v }))} placeholder="15000" keyboardType="numeric" />
              <Input label="Boarding Fee (KES)" value={form.boarding_fee} onChangeText={(v) => setForm((f) => ({ ...f, boarding_fee: v }))} placeholder="8000" keyboardType="numeric" />
              <Input label="Transport Fee (KES)" value={form.transport_fee} onChangeText={(v) => setForm((f) => ({ ...f, transport_fee: v }))} placeholder="4000" keyboardType="numeric" />
              <Button label={saving ? 'Saving...' : 'Save Fee Structure'} onPress={handleSave} loading={saving} fullWidth style={{ marginTop: Spacing.md, marginBottom: Spacing.lg }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
      <BottomNav items={NAV} accentColor={Colors.success} />
    </View>
  );
}

function BreakdownBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.breakdownBox}>
      <Text style={styles.breakdownLabel}>{label}</Text>
      <Text style={[styles.breakdownVal, { color }]}>{formatCurrency(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 100 },
  feeHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
  feeIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.successBg, alignItems: 'center', justifyContent: 'center' },
  feeName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  feeMeta: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  feeTotal: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.success },
  breakdownRow: { flexDirection: 'row', gap: Spacing.xs, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  breakdownBox: { flex: 1, alignItems: 'center' },
  breakdownLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 2 },
  breakdownVal: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
});
