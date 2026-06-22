import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Modal, Pressable, ScrollView } from 'react-native';
import { useAlert } from '@/template';
import { useAppContext } from '@/hooks/useAppContext';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { getSupabaseClient } from '@/template';
import { getPayrollRuns, getPayrollItems, generatePayrollRun, PayrollRun, PayrollItem } from '@/services/hr.service';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function formatCurrency(amount: number) {
  return `KES ${Number(amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export default function PayrollScreen() {
  const { school, profileId } = useAppContext();
  const { showAlert } = useAlert();
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [items, setItems] = useState<Record<string, PayrollItem[]>>({});
  const [loadingItems, setLoadingItems] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear().toString());

  const load = useCallback(async () => {
    if (!school) return;
    const { data, error } = await getPayrollRuns(school.id);
    if (error) { showAlert('Error', error); }
    setRuns(data || []);
    setLoading(false);
    setRefreshing(false);
  }, [school]);

  useEffect(() => { load(); }, [school]);

  const handleExpand = async (run: PayrollRun) => {
    if (expandedId === run.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(run.id);
    if (!items[run.id] && school) {
      setLoadingItems(true);
      const { data, error } = await getPayrollItems(school.id, run.id);
      setLoadingItems(false);
      if (error) { showAlert('Error', error); return; }
      setItems((prev) => ({ ...prev, [run.id]: data || [] }));
    }
  };

  const handleGenerate = async () => {
    if (!school || !profileId) return;
    const yearNum = parseInt(year, 10);
    if (!yearNum || yearNum < 2000 || yearNum > 2100) {
      showAlert('Invalid Year', 'Please enter a valid year.'); return;
    }
    setSaving(true);
    const { data, error } = await generatePayrollRun(school.id, month, yearNum, profileId);
    setSaving(false);
    if (error) { showAlert('Error', error); return; }
    showAlert(
      'Payroll Generated',
      `Payroll for ${MONTHS[month - 1]} ${yearNum} generated.\nGross: ${formatCurrency(data?.run.total_gross || 0)}\nNet: ${formatCurrency(data?.run.total_net || 0)}\n${data?.items.length || 0} staff processed.`,
    );
    setShowModal(false);
    load();
  };

  if (loading) return <LoadingScreen message="Loading payroll..." />;

  return (
    <View style={styles.flex}>
      <Header
        title="Payroll"
        subtitle={school?.name}
        showBack
        accentColor={Colors.success}
        rightAction={{ icon: 'add', onPress: () => setShowModal(true) }}
      />
      <FlatList
        data={runs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={() => { setRefreshing(true); load(); }}
        ListEmptyComponent={
          <EmptyState
            icon="payments"
            title="No Payroll Runs"
            description="Generate your first payroll run to compute salaries, taxes, and net pay for staff."
            actionLabel="Generate Payroll"
            onAction={() => setShowModal(true)}
          />
        }
        renderItem={({ item: run }) => {
          const isExpanded = expandedId === run.id;
          const period = `${MONTHS[run.period_month - 1]} ${run.period_year}`;
          return (
            <Card>
              <Pressable onPress={() => handleExpand(run)}>
                <View style={styles.runRow}>
                  <View style={[styles.runIcon, { backgroundColor: run.status === 'approved' ? Colors.successBg : run.status === 'paid' ? Colors.successBg : Colors.warningBg }]}>
                    <MaterialIcons name="receipt" size={20} color={run.status === 'approved' || run.status === 'paid' ? Colors.success : Colors.warning} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.period}>{period}</Text>
                    <Text style={styles.netTotal}>Net: {formatCurrency(run.total_net)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Badge label={run.status} variant={run.status === 'approved' || run.status === 'paid' ? 'success' : 'warning'} size="sm" />
                    <MaterialIcons name={isExpanded ? 'expand-less' : 'expand-more'} size={20} color={Colors.textSecondary} />
                  </View>
                </View>
                {!isExpanded ? (
                  <View style={styles.summaryRow}>
                    <View style={styles.summaryBox}>
                      <Text style={styles.summaryLabel}>Gross</Text>
                      <Text style={[styles.summaryVal, { color: Colors.success }]}>{formatCurrency(run.total_gross)}</Text>
                    </View>
                    <View style={styles.summaryBox}>
                      <Text style={styles.summaryLabel}>Deductions</Text>
                      <Text style={[styles.summaryVal, { color: Colors.error }]}>{formatCurrency(run.total_deductions)}</Text>
                    </View>
                    <View style={styles.summaryBox}>
                      <Text style={styles.summaryLabel}>Net</Text>
                      <Text style={[styles.summaryVal, { color: Colors.textPrimary }]}>{formatCurrency(run.total_net)}</Text>
                    </View>
                  </View>
                ) : null}
              </Pressable>

              {isExpanded ? (
                <View style={styles.itemsWrap}>
                  <Text style={styles.itemsHeader}>Payroll Items ({items[run.id]?.length || 0})</Text>
                  {loadingItems ? (
                    <Text style={styles.loadingText}>Loading items...</Text>
                  ) : items[run.id] && items[run.id].length > 0 ? (
                    items[run.id]!.map((it) => (
                      <View key={it.id} style={styles.itemRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.itemName}>{it.employee_name}</Text>
                          <Text style={styles.itemDetails}>Gross: {formatCurrency(it.gross_pay)} • PAYE: {formatCurrency(it.tax_paye)} • NSSF: {formatCurrency(it.nssf)} • NHIF: {formatCurrency(it.nhif)}</Text>
                        </View>
                        <Text style={[styles.itemNet, { color: Colors.success }]}>{formatCurrency(it.net_pay)}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptyItems}>No items in this run.</Text>
                  )}
                </View>
              ) : null}
            </Card>
          );
        }}
      />

      {/* Generate Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Generate Payroll</Text>
              <Pressable onPress={() => setShowModal(false)} hitSlop={8}>
                <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
              </Pressable>
            </View>
            <Text style={styles.fieldLabel}>Month *</Text>
            <View style={styles.monthGrid}>
              {MONTHS.map((m, i) => (
                <Pressable key={m} style={[styles.monthChip, month === i + 1 && styles.monthChipActive]} onPress={() => setMonth(i + 1)}>
                  <Text style={[styles.monthChipText, month === i + 1 && styles.monthChipTextActive]}>{m.slice(0, 3)}</Text>
                </Pressable>
              ))}
            </View>
            <Input label="Year *" value={year} onChangeText={setYear} placeholder="2025" keyboardType="numeric" />
            <Text style={styles.helperText}>This will compute PAYE, NSSF, NHIF deductions for all active staff members.</Text>
            <Button label={saving ? 'Generating...' : 'Generate Payroll'} onPress={handleGenerate} loading={saving} fullWidth style={{ marginTop: Spacing.md, marginBottom: Spacing.lg }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 100 },
  runRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  runIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  period: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  netTotal: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  summaryRow: { flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  summaryBox: { flex: 1, alignItems: 'center' },
  summaryLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 2 },
  summaryVal: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  itemsWrap: { marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border, gap: Spacing.xs },
  itemsHeader: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.semibold, marginBottom: Spacing.xs },
  loadingText: { fontSize: FontSize.sm, color: Colors.textMuted, fontStyle: 'italic', textAlign: 'center', padding: Spacing.md },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, paddingVertical: Spacing.xs },
  itemName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  itemDetails: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  itemNet: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, minWidth: 100, textAlign: 'right' },
  emptyItems: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', padding: Spacing.md },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  fieldLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium, marginBottom: 6 },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.md },
  monthChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2, borderRadius: BorderRadius.sm, backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border, minWidth: 60, alignItems: 'center' },
  monthChipActive: { backgroundColor: Colors.primaryDark, borderColor: Colors.primary },
  monthChipText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  monthChipTextActive: { color: Colors.textPrimary, fontWeight: FontWeight.semibold },
  helperText: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: Spacing.xs, lineHeight: 18 },
});
