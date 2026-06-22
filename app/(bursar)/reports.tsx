import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useAlert } from '@/template';
import { useAppContext } from '@/hooks/useAppContext';
import { BottomNav } from '@/components/layout/BottomNav';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { getFinancialReport, FinancialReport } from '@/services/finance.service';

const NAV = [
  { label: 'Finance', icon: 'account-balance' as const, route: '/(bursar)/' },
  { label: 'Invoices', icon: 'receipt' as const, route: '/(bursar)/invoices' },
  { label: 'Payments', icon: 'payments' as const, route: '/(bursar)/payments' },
  { label: 'Reports', icon: 'bar-chart' as const, route: '/(bursar)/reports' },
];

function formatCurrency(amount: number) {
  return `KES ${Number(amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function todayDate(): string {
  return new Date().toISOString().split('T')[0];
}

function monthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function yearStart(): string {
  return `${new Date().getFullYear()}-01-01`;
}

export default function ReportsScreen() {
  const { school } = useAppContext();
  const { showAlert } = useAlert();
  const [report, setReport] = useState<FinancialReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(todayDate());

  const load = useCallback(async () => {
    if (!school) return;
    const { data, error } = await getFinancialReport(school.id, { startDate: from, endDate: to });
    if (error) { showAlert('Error', error); }
    setReport(data);
    setLoading(false);
    setRefreshing(false);
  }, [school, from, to]);

  useEffect(() => {
    if (school) load();
  }, [school]);

  const handleGenerate = async () => {
    if (!school) return;
    if (!from || !to) { showAlert('Missing Dates', 'Please enter both start and end dates.'); return; }
    if (new Date(from).getTime() > new Date(to).getTime()) {
      showAlert('Invalid Range', 'Start date must be before end date.'); return;
    }
    setGenerating(true);
    await load();
    setGenerating(false);
    showAlert('Report Generated', `Financial report from ${from} to ${to} has been generated.`);
  };

  const applyPreset = (preset: 'month' | 'year') => {
    if (preset === 'month') {
      setFrom(monthStart());
      setTo(todayDate());
    } else {
      setFrom(yearStart());
      setTo(todayDate());
    }
  };

  if (loading) return <LoadingScreen message="Loading financial report..." />;

  const byMethodEntries = report?.byMethod ? Object.entries(report.byMethod).filter(([_, v]) => v > 0).sort((a, b) => b[1] - a[1]) : [];
  const totalByMethod = byMethodEntries.reduce((s, [_, v]) => s + v, 0);
  const METHOD_COLORS: Record<string, string> = {
    mpesa: Colors.success, airtel_money: Colors.error, stripe: Colors.primary, paypal: Colors.primary,
    bank_transfer: Colors.secondary, cash: Colors.success, cheque: Colors.warning,
  };

  return (
    <View style={styles.flex}>
      <Header title="Reports" subtitle={school?.name} accentColor={Colors.success} />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={undefined}
      >
        {/* Date range */}
        <Card>
          <Text style={styles.cardTitle}>Date Range</Text>
          <View style={styles.dateRow}>
            <View style={styles.dateBox}>
              <Text style={styles.dateLabel}>From</Text>
              <Input value={from} onChangeText={setFrom} placeholder="YYYY-MM-DD" leftIcon="event" />
            </View>
            <View style={styles.dateBox}>
              <Text style={styles.dateLabel}>To</Text>
              <Input value={to} onChangeText={setTo} placeholder="YYYY-MM-DD" leftIcon="event" />
            </View>
          </View>
          <View style={styles.presetRow}>
            <Pressable style={styles.presetBtn} onPress={() => applyPreset('month')}>
              <Text style={styles.presetText}>This Month</Text>
            </Pressable>
            <Pressable style={styles.presetBtn} onPress={() => applyPreset('year')}>
              <Text style={styles.presetText}>This Year</Text>
            </Pressable>
          </View>
          <Button label={generating ? 'Generating...' : 'Generate Report'} onPress={handleGenerate} loading={generating} fullWidth style={{ marginTop: Spacing.sm }} icon={<MaterialIcons name="bar-chart" size={18} color={Colors.textPrimary} />} />
        </Card>

        {/* Stat cards */}
        <View style={styles.statsRow}>
          <StatCard label="Billed" value={formatCurrency(report?.totalBilled ?? 0)} icon="receipt" color={Colors.primary} />
          <StatCard label="Collected" value={formatCurrency(report?.totalCollected ?? 0)} icon="check-circle" color={Colors.success} />
        </View>
        <View style={styles.statsRow}>
          <StatCard label="Outstanding" value={formatCurrency(report?.totalOutstanding ?? 0)} icon="pending" color={Colors.error} />
          <StatCard label="Scholarships" value={formatCurrency(report?.totalScholarships ?? 0)} icon="school" color={Colors.superAdmin} />
        </View>
        <View style={styles.statsRow}>
          <StatCard label="Fines" value={formatCurrency(report?.totalFines ?? 0)} icon="gavel" color={Colors.warning} />
          <StatCard label="Collection Rate" value={`${report ? Math.round((report.totalCollected / (report.totalBilled || 1)) * 100) : 0}%`} icon="trending-up" color={Colors.secondary} />
        </View>

        {/* Invoice status breakdown */}
        <Text style={styles.sectionTitle}>Invoice Status Breakdown</Text>
        <Card>
          {report?.byStatus && Object.keys(report.byStatus).length > 0 ? (
            Object.entries(report.byStatus).map(([status, count]) => (
              <View key={status} style={styles.statusRow}>
                <View style={styles.statusLeft}>
                  <View style={[styles.statusDot, { backgroundColor: status === 'paid' ? Colors.success : status === 'partial' ? Colors.warning : status === 'unpaid' ? Colors.error : Colors.textMuted }]} />
                  <Text style={styles.statusText} >{status.charAt(0).toUpperCase() + status.slice(1)}</Text>
                </View>
                <Text style={styles.statusCount}>{count}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No invoices in this period.</Text>
          )}
        </Card>

        {/* Payment methods breakdown */}
        <Text style={styles.sectionTitle}>Payment Method Breakdown</Text>
        <Card>
          {byMethodEntries.length > 0 ? (
            byMethodEntries.map(([method, amount]) => {
              const pct = totalByMethod > 0 ? Math.round((amount / totalByMethod) * 100) : 0;
              const color = METHOD_COLORS[method] || Colors.textSecondary;
              return (
                <View key={method} style={styles.methodRow}>
                  <View style={styles.methodHeader}>
                    <View style={styles.methodLeft}>
                      <View style={[styles.methodDot, { backgroundColor: color }]} />
                      <Text style={styles.methodName}>{method.replace(/_/g, ' ')}</Text>
                    </View>
                    <Text style={styles.methodAmount}>{formatCurrency(amount)}</Text>
                  </View>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: color }]} />
                  </View>
                  <Text style={styles.methodPct}>{pct}% of total</Text>
                </View>
              );
            })
          ) : (
            <Text style={styles.emptyText}>No payments recorded in this period.</Text>
          )}
        </Card>

        {/* Period footer */}
        <Text style={styles.periodFooter}>Report period: {from} → {to}</Text>
      </ScrollView>
      <BottomNav items={NAV} accentColor={Colors.success} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl, gap: Spacing.sm },
  cardTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  dateRow: { flexDirection: 'row', gap: Spacing.sm },
  dateBox: { flex: 1 },
  dateLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 4 },
  presetRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  presetBtn: { flex: 1, paddingVertical: Spacing.xs + 2, borderRadius: BorderRadius.md, backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  presetText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.semibold },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginTop: Spacing.sm, marginBottom: Spacing.xs },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.xs + 2, borderBottomWidth: 1, borderBottomColor: Colors.border },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontSize: FontSize.sm, color: Colors.textPrimary, textTransform: 'capitalize' },
  statusCount: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  methodRow: { marginBottom: Spacing.md },
  methodHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  methodLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  methodDot: { width: 10, height: 10, borderRadius: 5 },
  methodName: { fontSize: FontSize.sm, color: Colors.textPrimary, textTransform: 'capitalize' },
  methodAmount: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.semibold },
  progressBar: { height: 8, backgroundColor: Colors.surface2, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  methodPct: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 4 },
  emptyText: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center', padding: Spacing.md },
  periodFooter: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.md, fontStyle: 'italic' },
});
