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
import { getPayments, recordPayment, Payment } from '@/services/finance.service';

const NAV = [
  { label: 'Finance', icon: 'account-balance' as const, route: '/(bursar)/' },
  { label: 'Invoices', icon: 'receipt' as const, route: '/(bursar)/invoices' },
  { label: 'Payments', icon: 'payments' as const, route: '/(bursar)/payments' },
  { label: 'Reports', icon: 'bar-chart' as const, route: '/(bursar)/reports' },
];

const PAYMENT_METHODS = [
  { id: 'mpesa', label: 'M-Pesa', icon: 'phone-iphone' as const },
  { id: 'airtel_money', label: 'Airtel Money', icon: 'phone-iphone' as const },
  { id: 'stripe', label: 'Stripe', icon: 'credit-card' as const },
  { id: 'paypal', label: 'PayPal', icon: 'account-balance-wallet' as const },
  { id: 'bank_transfer', label: 'Bank Transfer', icon: 'account-balance' as const },
  { id: 'cash', label: 'Cash', icon: 'money' as const },
  { id: 'cheque', label: 'Cheque', icon: 'receipt' as const },
];

const METHOD_COLORS: Record<string, string> = {
  mpesa: Colors.success,
  airtel_money: Colors.error,
  stripe: Colors.primary,
  paypal: Colors.primary,
  bank_transfer: Colors.secondary,
  cash: Colors.success,
  cheque: Colors.warning,
};

function formatCurrency(amount: number) {
  return `KES ${Number(amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function PaymentsScreen() {
  const { school, profileId } = useAppContext();
  const { showAlert } = useAlert();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    student_id: '',
    invoice_id: '',
    amount: '',
    payment_method: 'mpesa',
    remarks: '',
  });

  const load = useCallback(async () => {
    if (!school) return;
    const { data, error } = await getPayments(school.id);
    if (error) { showAlert('Error', error); }
    setPayments(data || []);
    setLoading(false);
    setRefreshing(false);
  }, [school]);

  useEffect(() => { load(); }, [school]);

  const handleSave = async () => {
    if (!school || !profileId) return;
    if (!form.student_id.trim() || !form.amount) {
      showAlert('Missing Fields', 'Student ID and amount are required.'); return;
    }
    const amount = parseFloat(form.amount);
    if (amount <= 0) { showAlert('Invalid Amount', 'Amount must be greater than zero.'); return; }
    setSaving(true);
    const { data, error } = await recordPayment(school.id, {
      student_id: form.student_id.trim(),
      invoice_id: form.invoice_id.trim() || undefined,
      amount,
      payment_method: form.payment_method,
      remarks: form.remarks.trim() || undefined,
      received_by: profileId,
    });
    setSaving(false);
    if (error) { showAlert('Error', error); return; }
    showAlert('Payment Recorded', `Payment ${data?.payment.payment_number} recorded. Receipt ${data?.receipt?.receipt_number || 'N/A'} issued.`);
    setShowModal(false);
    setForm({ student_id: '', invoice_id: '', amount: '', payment_method: 'mpesa', remarks: '' });
    load();
  };

  if (loading) return <LoadingScreen message="Loading payments..." />;

  return (
    <View style={styles.flex}>
      <Header
        title="Payments"
        subtitle={`${payments.length} records`}
        accentColor={Colors.success}
        rightAction={{ icon: 'add', onPress: () => setShowModal(true) }}
      />
      <FlatList
        data={payments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={() => { setRefreshing(true); load(); }}
        ListEmptyComponent={
          <EmptyState
            icon="payments"
            title="No Payments Yet"
            description="Record payments from students. A receipt will be generated automatically."
            actionLabel="Record Payment"
            onAction={() => setShowModal(true)}
          />
        }
        renderItem={({ item: pay }) => {
          const studentName = (pay as any).students ? (pay as any).students.full_name : 'Unknown Student';
          const methodColor = METHOD_COLORS[pay.payment_method] || Colors.textSecondary;
          return (
            <Card>
              <View style={styles.payRow}>
                <View style={[styles.payIcon, { backgroundColor: `${methodColor}18` }]}>
                  <MaterialIcons name="payments" size={18} color={methodColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.payNum}>{pay.payment_number}</Text>
                  <Text style={styles.payStudent}>{studentName}</Text>
                  <Text style={styles.payDate}>{formatDate(pay.paid_at)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={[styles.payAmount, { color: Colors.success }]}>{formatCurrency(pay.amount)}</Text>
                  <Badge label={pay.payment_method} variant="primary" size="sm" />
                </View>
              </View>
              {pay.remarks ? (
                <View style={styles.remarksRow}>
                  <MaterialIcons name="notes" size={12} color={Colors.textMuted} />
                  <Text style={styles.remarksText}>{pay.remarks}</Text>
                </View>
              ) : null}
            </Card>
          );
        }}
      />

      {/* New Payment Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Record Payment</Text>
              <Pressable onPress={() => setShowModal(false)} hitSlop={8}>
                <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Input label="Student ID *" value={form.student_id} onChangeText={(v) => setForm((f) => ({ ...f, student_id: v }))} placeholder="Student UUID" leftIcon="person" />
              <Input label="Invoice ID (optional)" value={form.invoice_id} onChangeText={(v) => setForm((f) => ({ ...f, invoice_id: v }))} placeholder="Link to existing invoice" leftIcon="receipt" />
              <Input label="Amount (KES) *" value={form.amount} onChangeText={(v) => setForm((f) => ({ ...f, amount: v }))} placeholder="5000" keyboardType="numeric" leftIcon="payments" />
              <Text style={styles.fieldLabel}>Payment Method *</Text>
              <View style={styles.methodGrid}>
                {PAYMENT_METHODS.map((m) => (
                  <Pressable key={m.id} style={[styles.methodChip, form.payment_method === m.id && styles.methodChipActive]} onPress={() => setForm((f) => ({ ...f, payment_method: m.id }))}>
                    <MaterialIcons name={m.icon} size={14} color={form.payment_method === m.id ? Colors.textPrimary : METHOD_COLORS[m.id] || Colors.textSecondary} />
                    <Text style={[styles.methodChipText, form.payment_method === m.id && styles.methodChipTextActive]}>{m.label}</Text>
                  </Pressable>
                ))}
              </View>
              <Input label="Remarks" value={form.remarks} onChangeText={(v) => setForm((f) => ({ ...f, remarks: v }))} placeholder="Optional notes..." leftIcon="notes" multiline />
              <Button label={saving ? 'Recording...' : 'Record Payment'} onPress={handleSave} loading={saving} fullWidth style={{ marginTop: Spacing.md, marginBottom: Spacing.lg }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
      <BottomNav items={NAV} accentColor={Colors.success} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 100 },
  payRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  payIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  payNum: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  payStudent: { fontSize: FontSize.base, color: Colors.textSecondary, marginTop: 2 },
  payDate: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  payAmount: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  remarksRow: { flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border, alignItems: 'flex-start' },
  remarksText: { flex: 1, fontSize: FontSize.xs, color: Colors.textMuted, fontStyle: 'italic' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  fieldLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium, marginBottom: 6, marginTop: Spacing.sm },
  methodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.sm },
  methodChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs + 2, borderRadius: BorderRadius.sm, backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border },
  methodChipActive: { backgroundColor: Colors.success, borderColor: Colors.success },
  methodChipText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  methodChipTextActive: { color: Colors.textPrimary, fontWeight: FontWeight.semibold },
});
