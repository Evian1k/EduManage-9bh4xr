import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, FlatList, Modal } from 'react-native';
import { useAuth, useAlert } from '@/template';
import { useAppContext } from '@/hooks/useAppContext';
import { BottomNav } from '@/components/layout/BottomNav';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { getFinanceStats, getFeeStructures, getFeePayments, recordPayment, createFeeStructure } from '@/services/finance.service';
import { getStudents } from '@/services/student.service';

const ADMIN_NAV = [
  { label: 'Dashboard', icon: 'dashboard' as const, route: '/(admin)/' },
  { label: 'Students', icon: 'people' as const, route: '/(admin)/students' },
  { label: 'Finance', icon: 'account-balance' as const, route: '/(admin)/finance' },
  { label: 'Timetable', icon: 'schedule' as const, route: '/(admin)/timetable' },
  { label: 'Settings', icon: 'settings' as const, route: '/(admin)/settings' },
];

function formatCurrency(amount: number) {
  return `$${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function FinanceScreen() {
  const { showAlert } = useAlert();
  const { school, schoolUser } = useAppContext();
  const [tab, setTab] = useState<'overview' | 'payments' | 'fees'>('overview');
  const [stats, setStats] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [feeStructures, setFeeStructures] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showFeeModal, setShowFeeModal] = useState(false);
  const [newPayment, setNewPayment] = useState({ student_id: '', fee_structure_id: '', amount_due: '', amount_paid: '', payment_method: 'cash', reference: '' });
  const [newFee, setNewFee] = useState({ name: '', amount: '', term: 'Term 1', description: '' });
  const [saving, setSaving] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  const load = useCallback(async () => {
    if (!school) return;
    const [statsRes, paymentsRes, feesRes, studentsRes] = await Promise.all([
      getFinanceStats(school.id),
      getFeePayments(school.id),
      getFeeStructures(school.id),
      getStudents(school.id),
    ]);
    setStats(statsRes);
    setPayments(paymentsRes.data || []);
    setFeeStructures(feesRes.data || []);
    setStudents(studentsRes.data || []);
    setLoading(false);
  }, [school]);

  useEffect(() => { load(); }, [school]);

  const handleRecordPayment = async () => {
    if (!newPayment.student_id || !newPayment.amount_due) {
      showAlert('Missing Info', 'Please select a student and enter the amount due.'); return;
    }
    setSaving(true);
    const { error } = await recordPayment(school!.id, {
      student_id: newPayment.student_id,
      fee_structure_id: newPayment.fee_structure_id || undefined,
      amount_due: parseFloat(newPayment.amount_due),
      amount_paid: parseFloat(newPayment.amount_paid) || 0,
      payment_method: newPayment.payment_method,
      reference_number: newPayment.reference || undefined,
      recorded_by: schoolUser?.id,
    });
    setSaving(false);
    if (error) { showAlert('Error', error.message); return; }
    setShowPaymentModal(false);
    setNewPayment({ student_id: '', fee_structure_id: '', amount_due: '', amount_paid: '', payment_method: 'cash', reference: '' });
    showAlert('Success', 'Payment recorded successfully');
    load();
  };

  const handleCreateFee = async () => {
    if (!newFee.name || !newFee.amount) {
      showAlert('Missing Info', 'Please enter fee name and amount.'); return;
    }
    setSaving(true);
    const { error } = await createFeeStructure(school!.id, {
      name: newFee.name,
      amount: parseFloat(newFee.amount),
      term: newFee.term,
      description: newFee.description,
      academic_year: '2025/2026',
      is_mandatory: true,
    });
    setSaving(false);
    if (error) { showAlert('Error', error.message); return; }
    setShowFeeModal(false);
    setNewFee({ name: '', amount: '', term: 'Term 1', description: '' });
    showAlert('Success', 'Fee structure created');
    load();
  };

  if (loading) return <LoadingScreen message="Loading finance..." />;

  const collectionRate = stats ? ((stats.totalCollected / (stats.totalCollected + stats.totalOutstanding + 0.01)) * 100) : 0;
  const filteredStudents = students.filter((s: any) => !studentSearch || `${s.full_name} ${s.admission_number}`.toLowerCase().includes(studentSearch.toLowerCase()));

  return (
    <View style={s.flex}>
      <Header title="Finance & Fees" subtitle={school?.name} accentColor={Colors.success} />
      <ScrollView style={s.flex} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Tabs */}
        <View style={s.tabRow}>
          {(['overview', 'payments', 'fees'] as const).map(t => (
            <Pressable key={t} style={[s.tabBtn, tab === t && s.tabBtnActive]} onPress={() => setTab(t)}>
              <Text style={[s.tabText, tab === t && s.tabTextActive]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
            </Pressable>
          ))}
        </View>

        {/* OVERVIEW TAB */}
        {tab === 'overview' ? (
          <>
            <View style={s.summaryRow}>
              <View style={[s.summaryCard, { borderColor: `${Colors.success}40` }]}>
                <MaterialIcons name="check-circle" size={24} color={Colors.success} />
                <Text style={[s.summaryAmount, { color: Colors.success }]}>{formatCurrency(stats?.totalCollected)}</Text>
                <Text style={s.summaryLabel}>Collected</Text>
              </View>
              <View style={[s.summaryCard, { borderColor: `${Colors.error}40` }]}>
                <MaterialIcons name="cancel" size={24} color={Colors.error} />
                <Text style={[s.summaryAmount, { color: Colors.error }]}>{formatCurrency(stats?.totalOutstanding)}</Text>
                <Text style={s.summaryLabel}>Outstanding</Text>
              </View>
            </View>
            <Card>
              <View style={s.rateRow}>
                <Text style={s.rateLabel}>Collection Rate</Text>
                <Text style={[s.rateVal, { color: collectionRate >= 80 ? Colors.success : Colors.warning }]}>{collectionRate.toFixed(1)}%</Text>
              </View>
              <View style={s.progressBar}>
                <View style={[s.progressFill, { width: `${Math.min(100, collectionRate)}%` as any, backgroundColor: collectionRate >= 80 ? Colors.success : Colors.warning }]} />
              </View>
              <View style={s.countRow}>
                <View style={s.countBox}><Text style={[s.countNum, { color: Colors.success }]}>{stats?.paidCount}</Text><Text style={s.countLabel}>Paid</Text></View>
                <View style={s.countBox}><Text style={[s.countNum, { color: Colors.warning }]}>{stats?.partialCount}</Text><Text style={s.countLabel}>Partial</Text></View>
                <View style={s.countBox}><Text style={[s.countNum, { color: Colors.error }]}>{stats?.unpaidCount}</Text><Text style={s.countLabel}>Unpaid</Text></View>
              </View>
            </Card>
            <Text style={[s.sectionTitle, { marginTop: Spacing.md }]}>Fee Structures ({feeStructures.length})</Text>
            {feeStructures.map(fee => (
              <Card key={fee.id}>
                <View style={s.feeRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.feeName}>{fee.name}</Text>
                    <Text style={s.feeTerm}>{fee.term} · {fee.academic_year}</Text>
                  </View>
                  <Text style={s.feeAmount}>{formatCurrency(fee.amount)}</Text>
                  <Badge label={fee.is_mandatory ? 'Required' : 'Optional'} variant={fee.is_mandatory ? 'primary' : 'default'} size="sm" />
                </View>
              </Card>
            ))}
          </>
        ) : null}

        {/* PAYMENTS TAB */}
        {tab === 'payments' ? (
          <>
            <Button label="Record New Payment" onPress={() => setShowPaymentModal(true)} fullWidth icon="add" style={{ marginBottom: Spacing.md }} />
            {payments.map(p => (
              <Card key={p.id}>
                <View style={s.payRow}>
                  <View style={[s.payIcon, {
                    backgroundColor: p.status === 'paid' ? Colors.successBg : p.status === 'partial' ? Colors.warningBg : Colors.errorBg,
                  }]}>
                    <MaterialIcons name={p.status === 'paid' ? 'check-circle' : p.status === 'partial' ? 'pending' : 'cancel'} size={18} color={p.status === 'paid' ? Colors.success : p.status === 'partial' ? Colors.warning : Colors.error} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.payName}>{p.students ? `${p.students.full_name}` : 'Unknown'}</Text>
                    <Text style={s.payFee}>{p.fee_structures?.name || 'General Payment'}</Text>
                    <Text style={s.payDate}>{p.payment_date ? new Date(p.payment_date).toLocaleDateString() : 'Pending'}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={[s.payPaid, { color: Colors.success }]}>{formatCurrency(p.amount_paid)}</Text>
                    <Text style={s.payDue}>/ {formatCurrency(p.amount_due)}</Text>
                    <Badge label={p.status} variant={p.status === 'paid' ? 'success' : p.status === 'partial' ? 'warning' : 'error'} size="sm" />
                  </View>
                </View>
              </Card>
            ))}
            {payments.length === 0 && <Card><Text style={s.emptyText}>No payment records. Use the button above to record payments.</Text></Card>}
          </>
        ) : null}

        {/* FEES TAB */}
        {tab === 'fees' ? (
          <>
            <Button label="Create Fee Structure" onPress={() => setShowFeeModal(true)} fullWidth icon="add" style={{ marginBottom: Spacing.md }} />
            {feeStructures.map(fee => (
              <Card key={fee.id}>
                <View style={s.feeDetailRow}>
                  <View style={s.feeIcon}><MaterialIcons name="receipt-long" size={22} color={Colors.success} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.feeName}>{fee.name}</Text>
                    {fee.description ? <Text style={s.feeDesc}>{fee.description}</Text> : null}
                    <Text style={s.feeTerm}>{fee.term} · {fee.academic_year}</Text>
                    {fee.due_date ? <Text style={s.feeDue}>Due: {new Date(fee.due_date).toLocaleDateString()}</Text> : null}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={s.feeAmount}>{formatCurrency(fee.amount)}</Text>
                    <Badge label={fee.is_mandatory ? 'Mandatory' : 'Optional'} variant={fee.is_mandatory ? 'primary' : 'default'} size="sm" />
                  </View>
                </View>
              </Card>
            ))}
            {feeStructures.length === 0 && <Card><Text style={s.emptyText}>No fee structures created yet.</Text></Card>}
          </>
        ) : null}
      </ScrollView>

      {/* New Payment Modal */}
      <Modal visible={showPaymentModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modal}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Record Payment</Text>
              <Pressable onPress={() => setShowPaymentModal(false)}><MaterialIcons name="close" size={24} color={Colors.textPrimary} /></Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.fieldLabel}>Student *</Text>
              <TextInput style={s.input} value={studentSearch} onChangeText={setStudentSearch} placeholder="Search student..." placeholderTextColor={Colors.textMuted} />
              {studentSearch && !newPayment.student_id ? (
                <View style={s.dropdown}>
                  {filteredStudents.slice(0, 5).map((st: any) => (
                    <Pressable key={st.id} style={s.dropItem} onPress={() => { setNewPayment(p => ({ ...p, student_id: st.id })); setStudentSearch(`${st.full_name}`); }}>
                      <Text style={s.dropName}>{st.full_name}</Text>
                      <Text style={s.dropSub}>{st.admission_number}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              <Text style={s.fieldLabel}>Fee Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.xs }}>
                {feeStructures.map(f => (
                  <Pressable key={f.id} style={[s.feeChip, newPayment.fee_structure_id === f.id && s.feeChipActive]} onPress={() => setNewPayment(p => ({ ...p, fee_structure_id: f.id, amount_due: String(f.amount) }))}>
                    <Text style={[s.feeChipText, newPayment.fee_structure_id === f.id && { color: Colors.textPrimary }]}>{f.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              {[
                { label: 'Amount Due ($) *', key: 'amount_due', placeholder: '1500.00', keyboard: 'numeric' as const },
                { label: 'Amount Paid ($)', key: 'amount_paid', placeholder: '750.00', keyboard: 'numeric' as const },
                { label: 'Reference Number', key: 'reference', placeholder: 'RCP-001', keyboard: 'default' as const },
              ].map(f => (
                <View key={f.key}>
                  <Text style={s.fieldLabel}>{f.label}</Text>
                  <TextInput
                    style={s.input}
                    value={(newPayment as any)[f.key]}
                    onChangeText={v => setNewPayment(p => ({ ...p, [f.key]: v }))}
                    placeholder={f.placeholder}
                    placeholderTextColor={Colors.textMuted}
                    keyboardType={f.keyboard}
                  />
                </View>
              ))}
              <Text style={s.fieldLabel}>Payment Method</Text>
              <View style={s.methodRow}>
                {['cash', 'bank_transfer', 'mobile_money', 'card'].map(m => (
                  <Pressable key={m} style={[s.methodBtn, newPayment.payment_method === m && s.methodBtnActive]} onPress={() => setNewPayment(p => ({ ...p, payment_method: m }))}>
                    <Text style={[s.methodText, newPayment.payment_method === m && { color: Colors.textPrimary }]}>{m.replace('_', ' ')}</Text>
                  </Pressable>
                ))}
              </View>
              <Button label={saving ? 'Recording...' : 'Record Payment'} onPress={handleRecordPayment} loading={saving} fullWidth style={{ marginTop: Spacing.md }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* New Fee Modal */}
      <Modal visible={showFeeModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modal}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>New Fee Structure</Text>
              <Pressable onPress={() => setShowFeeModal(false)}><MaterialIcons name="close" size={24} color={Colors.textPrimary} /></Pressable>
            </View>
            {[
              { label: 'Fee Name *', key: 'name', placeholder: 'e.g., Term 1 Tuition Fee' },
              { label: 'Amount ($) *', key: 'amount', placeholder: '1500.00', keyboard: 'numeric' as const },
              { label: 'Description', key: 'description', placeholder: 'Optional description...' },
            ].map(f => (
              <View key={f.key}>
                <Text style={s.fieldLabel}>{f.label}</Text>
                <TextInput
                  style={s.input}
                  value={(newFee as any)[f.key]}
                  onChangeText={v => setNewFee(p => ({ ...p, [f.key]: v }))}
                  placeholder={f.placeholder}
                  placeholderTextColor={Colors.textMuted}
                  keyboardType={f.keyboard}
                />
              </View>
            ))}
            <Text style={s.fieldLabel}>Term</Text>
            <View style={s.methodRow}>
              {['Term 1', 'Term 2', 'Term 3', 'Annual'].map(t => (
                <Pressable key={t} style={[s.methodBtn, newFee.term === t && s.methodBtnActive]} onPress={() => setNewFee(p => ({ ...p, term: t }))}>
                  <Text style={[s.methodText, newFee.term === t && { color: Colors.textPrimary }]}>{t}</Text>
                </Pressable>
              ))}
            </View>
            <Button label={saving ? 'Creating...' : 'Create Fee'} onPress={handleCreateFee} loading={saving} fullWidth style={{ marginTop: Spacing.md }} />
          </View>
        </View>
      </Modal>

      <BottomNav items={ADMIN_NAV} accentColor={Colors.success} />
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingBottom: 100, gap: Spacing.sm },
  tabRow: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: 4, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  tabBtn: { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', borderRadius: BorderRadius.sm },
  tabBtnActive: { backgroundColor: Colors.primary },
  tabText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  tabTextActive: { color: Colors.textPrimary },
  summaryRow: { flexDirection: 'row', gap: Spacing.sm },
  summaryCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, alignItems: 'center', gap: Spacing.xs, borderWidth: 1 },
  summaryAmount: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  summaryLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  rateRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  rateLabel: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  rateVal: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  progressBar: { height: 10, backgroundColor: Colors.surface2, borderRadius: 5, overflow: 'hidden', marginBottom: Spacing.md },
  progressFill: { height: '100%', borderRadius: 5 },
  countRow: { flexDirection: 'row', justifyContent: 'space-around' },
  countBox: { alignItems: 'center', gap: 2 },
  countNum: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  countLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginBottom: Spacing.xs },
  feeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  feeDetailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  feeIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.successBg, alignItems: 'center', justifyContent: 'center' },
  feeName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  feeDesc: { fontSize: FontSize.sm, color: Colors.textSecondary },
  feeTerm: { fontSize: FontSize.xs, color: Colors.textMuted },
  feeDue: { fontSize: FontSize.xs, color: Colors.warning },
  feeAmount: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.success },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  payIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  payName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  payFee: { fontSize: FontSize.sm, color: Colors.textSecondary },
  payDate: { fontSize: FontSize.xs, color: Colors.textMuted },
  payPaid: { fontSize: FontSize.base, fontWeight: FontWeight.bold },
  payDue: { fontSize: FontSize.xs, color: Colors.textMuted },
  emptyText: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center', padding: Spacing.sm },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modal: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  fieldLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium, marginBottom: 4, marginTop: Spacing.sm },
  input: { backgroundColor: Colors.surface2, borderRadius: BorderRadius.sm, padding: Spacing.md, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border, marginBottom: 4 },
  dropdown: { backgroundColor: Colors.surface2, borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm },
  dropItem: { padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  dropName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  dropSub: { fontSize: FontSize.xs, color: Colors.textSecondary },
  feeChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full, backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border, marginRight: 6 },
  feeChipActive: { backgroundColor: Colors.primaryDark, borderColor: Colors.primary },
  feeChipText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  methodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.sm },
  methodBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.sm, backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border },
  methodBtnActive: { backgroundColor: Colors.primaryDark, borderColor: Colors.primary },
  methodText: { fontSize: FontSize.sm, color: Colors.textSecondary, textTransform: 'capitalize' },
});
