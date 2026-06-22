import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, FlatList } from 'react-native';
import { useAuth, useAlert } from '@/template';
import { useAppContext } from '@/hooks/useAppContext';
import { BottomNav } from '@/components/layout/BottomNav';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { getFinanceStats, getFeeStructures, getFeePayments, recordPayment } from '@/services/finance.service';

const NAV = [
  { label: 'Finance', icon: 'account-balance' as const, route: '/(bursar)/' },
  { label: 'Payments', icon: 'payments' as const, route: '/(bursar)/payments' },
  { label: 'Fees', icon: 'receipt-long' as const, route: '/(bursar)/fees' },
  { label: 'Reports', icon: 'bar-chart' as const, route: '/(bursar)/reports' },
];

function formatCurrency(amount: number) {
  return `$${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function BursarDashboard() {
  const { user, logout } = useAuth();
  const { showAlert } = useAlert();
  const { school, schoolUser } = useAppContext();
  const [stats, setStats] = useState<any>(null);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!school) return;
    const [statsRes, paymentsRes] = await Promise.all([
      getFinanceStats(school.id),
      getFeePayments(school.id),
    ]);
    setStats(statsRes);
    setRecentPayments((paymentsRes.data || []).slice(0, 8));
    setLoading(false);
    setRefreshing(false);
  }, [school]);

  useEffect(() => { load(); }, [school]);

  if (loading) return <LoadingScreen message="Loading finance data..." />;

  const collectionRate = stats ? ((stats.totalCollected / (stats.totalCollected + stats.totalOutstanding)) * 100) : 0;

  return (
    <View style={s.flex}>
      <Header
        title="Finance Dashboard"
        subtitle={school?.name}
        accentColor="#43A047"
        rightAction={{ icon: 'logout', onPress: () => showAlert('Sign Out', 'Sign out?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign Out', style: 'destructive', onPress: () => logout() }]) }}
      />
      <ScrollView style={s.flex} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Welcome */}
        <View style={s.welcomeRow}>
          <View style={s.avatar}><MaterialIcons name="account-balance-wallet" size={22} color="#43A047" /></View>
          <View>
            <Text style={s.welcomeName}>{user?.username || 'Bursar'}</Text>
            <Text style={s.welcomeRole}>Finance & Accounts</Text>
          </View>
        </View>

        {/* Finance Summary Cards */}
        <Text style={s.sectionTitle}>Financial Overview</Text>
        <View style={s.summaryRow}>
          <View style={[s.summaryCard, { borderColor: '#43A04740' }]}>
            <MaterialIcons name="check-circle" size={24} color="#43A047" />
            <Text style={[s.summaryAmount, { color: '#43A047' }]}>{formatCurrency(stats?.totalCollected || 0)}</Text>
            <Text style={s.summaryLabel}>Total Collected</Text>
          </View>
          <View style={[s.summaryCard, { borderColor: `${Colors.error}40` }]}>
            <MaterialIcons name="pending" size={24} color={Colors.error} />
            <Text style={[s.summaryAmount, { color: Colors.error }]}>{formatCurrency(stats?.totalOutstanding || 0)}</Text>
            <Text style={s.summaryLabel}>Outstanding</Text>
          </View>
        </View>

        {/* Collection Rate */}
        <Card>
          <View style={s.rateRow}>
            <Text style={s.rateLabel}>Collection Rate</Text>
            <Text style={[s.rateVal, { color: collectionRate >= 80 ? Colors.success : Colors.warning }]}>
              {collectionRate.toFixed(1)}%
            </Text>
          </View>
          <View style={s.progressBar}>
            <View style={[s.progressFill, {
              width: `${collectionRate}%` as any,
              backgroundColor: collectionRate >= 80 ? Colors.success : Colors.warning,
            }]} />
          </View>
          <View style={s.paymentCounts}>
            <Text style={s.countItem}><Text style={{ color: Colors.success }}>●</Text> Paid: {stats?.paidCount || 0}</Text>
            <Text style={s.countItem}><Text style={{ color: Colors.warning }}>●</Text> Partial: {stats?.partialCount || 0}</Text>
            <Text style={s.countItem}><Text style={{ color: Colors.error }}>●</Text> Unpaid: {stats?.unpaidCount || 0}</Text>
          </View>
        </Card>

        {/* Recent Payments */}
        <Text style={[s.sectionTitle, { marginTop: Spacing.md }]}>Recent Transactions</Text>
        {recentPayments.length > 0 ? recentPayments.map(p => (
          <Card key={p.id} style={s.paymentCard}>
            <View style={s.paymentRow}>
              <View style={[s.payIcon, { backgroundColor: p.status === 'paid' ? Colors.successBg : p.status === 'partial' ? Colors.warningBg : Colors.errorBg }]}>
                <MaterialIcons
                  name={p.status === 'paid' ? 'check-circle' : p.status === 'partial' ? 'pending' : 'cancel'}
                  size={20}
                  color={p.status === 'paid' ? Colors.success : p.status === 'partial' ? Colors.warning : Colors.error}
                />
              </View>
              <View style={s.payInfo}>
                <Text style={s.payName}>
                  {p.students ? `${p.students.full_name} ${p.}` : 'Unknown'}
                </Text>
                <Text style={s.payFee}>{p.fee_structures?.name || 'General Payment'}</Text>
                <Text style={s.payDate}>
                  {p.payment_date ? new Date(p.payment_date).toLocaleDateString() : 'No payment date'}
                </Text>
              </View>
              <View style={s.payAmounts}>
                <Text style={[s.payPaid, { color: Colors.success }]}>{formatCurrency(p.amount_paid)}</Text>
                <Text style={s.payDue}>of {formatCurrency(p.amount_due)}</Text>
                <Badge
                  label={p.status}
                  variant={p.status === 'paid' ? 'success' : p.status === 'partial' ? 'warning' : 'error'}
                  size="sm"
                />
              </View>
            </View>
          </Card>
        )) : (
          <Card><Text style={s.emptyText}>No payment records yet. Go to Payments to add records.</Text></Card>
        )}
      </ScrollView>
      <BottomNav items={NAV} accentColor="#43A047" />
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingBottom: 100, gap: Spacing.sm },
  welcomeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.sm },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(67,160,71,0.15)', alignItems: 'center', justifyContent: 'center' },
  welcomeName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  welcomeRole: { fontSize: FontSize.sm, color: Colors.textSecondary },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginBottom: Spacing.xs },
  summaryRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  summaryCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, alignItems: 'center', gap: Spacing.xs, borderWidth: 1,
  },
  summaryAmount: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  summaryLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'center' },
  rateRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  rateLabel: { fontSize: FontSize.base, color: Colors.textPrimary, fontWeight: FontWeight.semibold },
  rateVal: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  progressBar: { height: 10, backgroundColor: Colors.surface2, borderRadius: 5, overflow: 'hidden', marginBottom: Spacing.md },
  progressFill: { height: '100%', borderRadius: 5 },
  paymentCounts: { flexDirection: 'row', justifyContent: 'space-around' },
  countItem: { fontSize: FontSize.sm, color: Colors.textSecondary, gap: 4 },
  paymentCard: {},
  paymentRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  payIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  payInfo: { flex: 1, gap: 2 },
  payName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  payFee: { fontSize: FontSize.sm, color: Colors.textSecondary },
  payDate: { fontSize: FontSize.xs, color: Colors.textMuted },
  payAmounts: { alignItems: 'flex-end', gap: 2 },
  payPaid: { fontSize: FontSize.base, fontWeight: FontWeight.bold },
  payDue: { fontSize: FontSize.xs, color: Colors.textMuted },
  emptyText: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center', padding: Spacing.sm },
});
