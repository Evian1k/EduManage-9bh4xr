// Parent: Fees — picker for child + outstanding balance + invoices + receipts
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Modal, Pressable, ScrollView, RefreshControl,
} from 'react-native';
import { useAppContext } from '@/hooks/useAppContext';
import { getInvoices, getReceipts, Invoice, Receipt } from '@/services/finance.service';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge, getStatusBadgeVariant } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { getSupabaseClient } from '@/template';

interface Child { id: string; full_name: string; admission_number: string; }

export default function ParentFeesScreen() {
  const { school, profileId } = useAppContext();
  const schoolId = school?.id;
  const [children, setChildren] = useState<Child[]>([]);
  const [selected, setSelected] = useState<Child | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadChildren = useCallback(async () => {
    if (!schoolId || !profileId) return;
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('guardians')
      .select('students(id, full_name, admission_number)')
      .eq('user_id', profileId);
    const kids: Child[] = (data || []).map((g: any) => g.students).filter(Boolean);
    setChildren(kids);
    if (kids.length > 0 && !selected) setSelected(kids[0]);
    if (kids.length === 0) setLoading(false);
  }, [schoolId, profileId]);

  const loadFees = useCallback(async () => {
    if (!schoolId || !selected) { setLoading(false); return; }
    const [invRes, recRes] = await Promise.all([
      getInvoices(schoolId, { studentId: selected.id, limit: 50 }),
      getReceipts(schoolId, { studentId: selected.id, limit: 50 }),
    ]);
    setInvoices(invRes.data || []);
    setReceipts(recRes.data || []);
    setLoading(false);
    setRefreshing(false);
  }, [schoolId, selected]);

  useEffect(() => { if (schoolId && profileId) loadChildren(); }, [schoolId, profileId]);
  useEffect(() => { if (selected) { setLoading(true); loadFees(); } }, [selected]);

  if (!schoolId) return <LoadingScreen />;
  if (loading && !selected) return <LoadingScreen message="Loading fees..." />;

  const outstanding = invoices.reduce((sum, i) => sum + (i.balance || 0), 0);
  const currency = invoices[0]?.currency || school?.settings?.currency || 'KES';

  return (
    <View style={s.flex}>
      <Header title="Fees" subtitle={selected?.full_name} showBack accentColor="#FF9800" />
      <View style={s.filterRow}>
        <Text style={s.label}>Child</Text>
        <Pressable style={s.selectBtn} onPress={() => setPickerOpen(true)}>
          <Text style={s.selectText} numberOfLines={1}>{selected?.full_name || 'Select child'}</Text>
          <MaterialIcons name="arrow-drop-down" size={20} color={Colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView
        style={s.flex}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadFees(); }} tintColor={Colors.primary} colors={[Colors.primary]} />}
      >
        {/* Outstanding balance */}
        <Card style={[s.balanceCard, outstanding > 0 && { borderColor: Colors.warning }]}>
          <View style={s.balanceRow}>
            <View style={s.balanceIcon}>
              <MaterialIcons name="account-balance-wallet" size={22} color={outstanding > 0 ? Colors.warning : Colors.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.balanceLabel}>Outstanding Balance</Text>
              <Text style={[s.balanceValue, { color: outstanding > 0 ? Colors.warning : Colors.success }]}>
                {currency} {outstanding.toLocaleString()}
              </Text>
            </View>
          </View>
        </Card>

        {/* Invoices */}
        <Text style={s.sectionTitle}>Invoices ({invoices.length})</Text>
        {invoices.length === 0 ? (
          <Card><Text style={s.emptyText}>No invoices for this child.</Text></Card>
        ) : (
          invoices.map((inv) => (
            <Card key={inv.id} style={s.feeCard}>
              <View style={s.feeRow}>
                <View style={s.feeIcon}>
                  <MaterialIcons name="receipt-long" size={18} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.feeTitle}>{inv.invoice_number}</Text>
                  <Text style={s.feeMeta}>Issued: {new Date(inv.issue_date).toLocaleDateString()}{inv.due_date ? ` · Due: ${new Date(inv.due_date).toLocaleDateString()}` : ''}</Text>
                </View>
                <Badge label={inv.status} variant={getStatusBadgeVariant(inv.status)} size="sm" />
              </View>
              <View style={s.amountRow}>
                <View style={s.amountBox}>
                  <Text style={s.amountLabel}>Due</Text>
                  <Text style={s.amountValue}>{inv.currency} {inv.amount_due.toLocaleString()}</Text>
                </View>
                <View style={s.amountBox}>
                  <Text style={s.amountLabel}>Paid</Text>
                  <Text style={[s.amountValue, { color: Colors.success }]}>{inv.currency} {inv.amount_paid.toLocaleString()}</Text>
                </View>
                <View style={s.amountBox}>
                  <Text style={s.amountLabel}>Balance</Text>
                  <Text style={[s.amountValue, { color: inv.balance > 0 ? Colors.warning : Colors.success }]}>{inv.currency} {inv.balance.toLocaleString()}</Text>
                </View>
              </View>
            </Card>
          ))
        )}

        {/* Receipts */}
        <Text style={[s.sectionTitle, { marginTop: Spacing.md }]}>Receipts ({receipts.length})</Text>
        {receipts.length === 0 ? (
          <Card><Text style={s.emptyText}>No receipts for this child.</Text></Card>
        ) : (
          receipts.map((rec) => (
            <Card key={rec.id} style={s.feeCard}>
              <View style={s.feeRow}>
                <View style={[s.feeIcon, { backgroundColor: Colors.successBg }]}>
                  <MaterialIcons name="check-circle" size={18} color={Colors.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.feeTitle}>{rec.receipt_number}</Text>
                  <Text style={s.feeMeta}>{new Date(rec.issued_at).toLocaleDateString()}</Text>
                </View>
                <Text style={[s.amountValue, { color: Colors.success }]}>{rec.amount.toLocaleString()}</Text>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      <Modal visible={pickerOpen} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={s.overlay}>
          <View style={s.modal}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>Select Child</Text>
              <Pressable onPress={() => setPickerOpen(false)} hitSlop={8}>
                <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
              </Pressable>
            </View>
            <ScrollView>
              {children.map((c) => (
                <Pressable
                  key={c.id}
                  style={[s.pickItem, selected?.id === c.id && s.pickItemActive]}
                  onPress={() => { setSelected(c); setPickerOpen(false); }}
                >
                  <Text style={[s.pickItemText, selected?.id === c.id && s.pickItemTextActive]}>{c.full_name}</Text>
                  {selected?.id === c.id ? <MaterialIcons name="check" size={20} color={Colors.primary} /> : null}
                </Pressable>
              ))}
              {children.length === 0 ? <Text style={s.emptyText}>No children linked.</Text> : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  filterRow: { padding: Spacing.md, paddingBottom: 0 },
  label: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium, marginBottom: 6 },
  selectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface2, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, minHeight: 48 },
  selectText: { color: Colors.textPrimary, fontSize: FontSize.base, flex: 1 },
  content: { padding: Spacing.md, paddingBottom: 100, gap: Spacing.sm },
  balanceCard: { borderWidth: 1, borderColor: Colors.border },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  balanceIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.surface2, alignItems: 'center', justifyContent: 'center' },
  balanceLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  balanceValue: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, marginTop: 2 },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginTop: Spacing.xs },
  feeCard: { gap: Spacing.sm },
  feeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  feeIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.infoBg, alignItems: 'center', justifyContent: 'center' },
  feeTitle: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  feeMeta: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  amountRow: { flexDirection: 'row', gap: Spacing.sm },
  amountBox: { flex: 1, backgroundColor: Colors.surface2, borderRadius: BorderRadius.sm, padding: Spacing.sm, alignItems: 'center' },
  amountLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  amountValue: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginTop: 2 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, maxHeight: '70%' },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  pickItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  pickItemActive: { backgroundColor: Colors.infoBg },
  pickItemText: { fontSize: FontSize.base, color: Colors.textPrimary },
  pickItemTextActive: { color: Colors.primary, fontWeight: FontWeight.semibold },
  emptyText: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center', padding: Spacing.sm },
});
