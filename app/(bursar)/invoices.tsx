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
import { getInvoices, createInvoice, Invoice } from '@/services/finance.service';

const NAV = [
  { label: 'Finance', icon: 'account-balance' as const, route: '/(bursar)/' },
  { label: 'Invoices', icon: 'receipt' as const, route: '/(bursar)/invoices' },
  { label: 'Payments', icon: 'payments' as const, route: '/(bursar)/payments' },
  { label: 'Reports', icon: 'bar-chart' as const, route: '/(bursar)/reports' },
];

type Filter = 'all' | 'unpaid' | 'partial' | 'paid' | 'overdue';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'unpaid', label: 'Unpaid' },
  { id: 'partial', label: 'Partial' },
  { id: 'paid', label: 'Paid' },
  { id: 'overdue', label: 'Overdue' },
];

function formatCurrency(amount: number) {
  return `KES ${Number(amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function statusVariant(status: string): 'success' | 'warning' | 'error' | 'default' {
  if (status === 'paid') return 'success';
  if (status === 'partial') return 'warning';
  if (status === 'unpaid') return 'error';
  return 'default';
}

export default function InvoicesScreen() {
  const { school } = useAppContext();
  const { showAlert } = useAlert();
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ student_id: '', amount_due: '', due_date: '' });

  const load = useCallback(async () => {
    if (!school) return;
    const { data, error } = await getInvoices(school.id);
    if (error) { showAlert('Error', error); }
    setAllInvoices(data || []);
    setLoading(false);
    setRefreshing(false);
  }, [school]);

  useEffect(() => { load(); }, [school]);

  const handleSave = async () => {
    if (!school) return;
    if (!form.student_id.trim() || !form.amount_due) {
      showAlert('Missing Fields', 'Student ID and amount due are required.'); return;
    }
    setSaving(true);
    const { data, error } = await createInvoice(school.id, {
      student_id: form.student_id.trim(),
      amount_due: parseFloat(form.amount_due),
      due_date: form.due_date || undefined,
    });
    setSaving(false);
    if (error) { showAlert('Error', error); return; }
    showAlert('Invoice Created', `Invoice ${data?.invoice_number} created.`);
    setShowModal(false);
    setForm({ student_id: '', amount_due: '', due_date: '' });
    load();
  };

  if (loading) return <LoadingScreen message="Loading invoices..." />;

  const isOverdue = (inv: Invoice) => {
    if (inv.status === 'paid') return false;
    if (!inv.due_date) return false;
    return new Date(inv.due_date).getTime() < Date.now();
  };

  const filtered = allInvoices.filter((inv) => {
    if (filter === 'all') return true;
    if (filter === 'overdue') return isOverdue(inv);
    return inv.status === filter;
  });

  return (
    <View style={styles.flex}>
      <Header
        title="Invoices"
        subtitle={`${allInvoices.length} total`}
        accentColor={Colors.success}
        rightAction={{ icon: 'add', onPress: () => setShowModal(true) }}
      />
      {/* Filter chips */}
      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {FILTERS.map((f) => {
            const count = f.id === 'all' ? allInvoices.length : f.id === 'overdue' ? allInvoices.filter(isOverdue).length : allInvoices.filter((i) => i.status === f.id).length;
            return (
              <Pressable key={f.id} style={[styles.chip, filter === f.id && styles.chipActive]} onPress={() => setFilter(f.id)}>
                <Text style={[styles.chipText, filter === f.id && styles.chipTextActive]}>{f.label}</Text>
                <Text style={[styles.chipCount, filter === f.id && styles.chipCountActive]}>{count}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={() => { setRefreshing(true); load(); }}
        ListEmptyComponent={
          <EmptyState
            icon="receipt"
            title={`No ${filter === 'all' ? '' : filter + ' '}Invoices`}
            description="Create invoices for students to bill tuition and other fees."
            actionLabel="New Invoice"
            onAction={() => setShowModal(true)}
          />
        }
        renderItem={({ item: inv }) => {
          const studentName = (inv as any).students ? `${(inv as any).students.full_name}` : 'Unknown Student';
          const overdue = isOverdue(inv);
          const pct = inv.amount_due > 0 ? Math.round((inv.amount_paid / inv.amount_due) * 100) : 0;
          return (
            <Card>
              <View style={styles.invHeader}>
                <View style={[styles.invIcon, { backgroundColor: overdue ? Colors.errorBg : inv.status === 'paid' ? Colors.successBg : Colors.warningBg }]}>
                  <MaterialIcons name={overdue ? 'warning' : inv.status === 'paid' ? 'check-circle' : 'receipt'} size={18} color={overdue ? Colors.error : inv.status === 'paid' ? Colors.success : Colors.warning} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.invNum}>{inv.invoice_number}</Text>
                  <Text style={styles.invStudent}>{studentName}</Text>
                </View>
                <Badge label={overdue ? 'overdue' : inv.status} variant={overdue ? 'error' : statusVariant(inv.status)} size="sm" />
              </View>
              <View style={styles.invAmounts}>
                <View style={styles.amountBox}>
                  <Text style={styles.amountLabel}>Amount Due</Text>
                  <Text style={styles.amountVal}>{formatCurrency(inv.amount_due)}</Text>
                </View>
                <View style={styles.amountBox}>
                  <Text style={styles.amountLabel}>Paid</Text>
                  <Text style={[styles.amountVal, { color: Colors.success }]}>{formatCurrency(inv.amount_paid)}</Text>
                </View>
                <View style={styles.amountBox}>
                  <Text style={styles.amountLabel}>Balance</Text>
                  <Text style={[styles.amountVal, { color: Colors.error }]}>{formatCurrency(inv.balance)}</Text>
                </View>
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${Math.min(100, pct)}%`, backgroundColor: inv.status === 'paid' ? Colors.success : Colors.warning }]} />
              </View>
              <View style={styles.invFooter}>
                <Text style={styles.invMeta}>Issued: {formatDate(inv.issue_date)}</Text>
                <Text style={[styles.invMeta, overdue && { color: Colors.error }]}>Due: {formatDate(inv.due_date)}</Text>
              </View>
            </Card>
          );
        }}
      />

      {/* New Invoice Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Invoice</Text>
              <Pressable onPress={() => setShowModal(false)} hitSlop={8}>
                <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Input label="Student ID *" value={form.student_id} onChangeText={(v) => setForm((f) => ({ ...f, student_id: v }))} placeholder="Student UUID" leftIcon="person" />
              <Input label="Amount Due (KES) *" value={form.amount_due} onChangeText={(v) => setForm((f) => ({ ...f, amount_due: v }))} placeholder="15000" keyboardType="numeric" leftIcon="payments" />
              <Input label="Due Date" value={form.due_date} onChangeText={(v) => setForm((f) => ({ ...f, due_date: v }))} placeholder="YYYY-MM-DD" leftIcon="event" />
              <Text style={styles.helperText}>Tip: Find the student UUID from the Students screen.</Text>
              <Button label={saving ? 'Creating...' : 'Create Invoice'} onPress={handleSave} loading={saving} fullWidth style={{ marginTop: Spacing.md, marginBottom: Spacing.lg }} />
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
  filterRow: { backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  filterScroll: { gap: Spacing.xs },
  chip: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2, borderRadius: BorderRadius.full, backgroundColor: Colors.surface2, marginRight: Spacing.xs },
  chipActive: { backgroundColor: Colors.successBg, borderWidth: 1, borderColor: Colors.success },
  chipText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  chipTextActive: { color: Colors.success },
  chipCount: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: FontWeight.bold, backgroundColor: Colors.surface3, paddingHorizontal: 6, paddingVertical: 1, borderRadius: BorderRadius.full, overflow: 'hidden' },
  chipCountActive: { color: Colors.textPrimary, backgroundColor: Colors.success },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 100 },
  invHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.sm },
  invIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  invNum: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  invStudent: { fontSize: FontSize.base, color: Colors.textSecondary, marginTop: 2 },
  invAmounts: { flexDirection: 'row', gap: Spacing.xs, marginBottom: Spacing.sm },
  amountBox: { flex: 1, alignItems: 'center' },
  amountLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 2 },
  amountVal: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  progressBar: { height: 6, backgroundColor: Colors.surface2, borderRadius: 3, overflow: 'hidden', marginBottom: Spacing.sm },
  progressFill: { height: '100%', borderRadius: 3 },
  invFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  invMeta: { fontSize: FontSize.xs, color: Colors.textMuted },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  helperText: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: Spacing.xs, lineHeight: 18 },
});
