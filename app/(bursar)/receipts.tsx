import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAlert } from '@/template';
import { useAppContext } from '@/hooks/useAppContext';
import { BottomNav } from '@/components/layout/BottomNav';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { getReceipts, Receipt } from '@/services/finance.service';

const NAV = [
  { label: 'Finance', icon: 'account-balance' as const, route: '/(bursar)/' },
  { label: 'Invoices', icon: 'receipt' as const, route: '/(bursar)/invoices' },
  { label: 'Payments', icon: 'payments' as const, route: '/(bursar)/payments' },
  { label: 'Reports', icon: 'bar-chart' as const, route: '/(bursar)/reports' },
];

function formatCurrency(amount: number) {
  return `KES ${Number(amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

const METHOD_COLORS: Record<string, string> = {
  mpesa: Colors.success,
  airtel_money: Colors.error,
  stripe: Colors.primary,
  paypal: Colors.primary,
  bank_transfer: Colors.secondary,
  cash: Colors.success,
  cheque: Colors.warning,
};

export default function ReceiptsScreen() {
  const { school } = useAppContext();
  const router = useRouter();
  const { showAlert } = useAlert();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!school) return;
    const { data, error } = await getReceipts(school.id, { limit: 200 });
    if (error) { showAlert('Error', error); }
    setReceipts(data || []);
    setLoading(false);
    setRefreshing(false);
  }, [school]);

  useEffect(() => { load(); }, [school]);

  if (loading) return <LoadingScreen message="Loading receipts..." />;

  return (
    <View style={styles.flex}>
      <Header title="Receipts" subtitle={`${receipts.length} issued`} accentColor={Colors.success} />
      <FlatList
        data={receipts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={() => { setRefreshing(true); load(); }}
        ListEmptyComponent={
          <EmptyState
            icon="receipt"
            title="No Receipts"
            description="Receipts are generated automatically when payments are recorded. Record a payment to issue a receipt."
            actionLabel="Record Payment"
            onAction={() => router.push('/(bursar)/payments')}
          />
        }
        renderItem={({ item: r }) => {
          const studentName = (r as any).students ? (r as any).students.full_name : 'Unknown Student';
          const payment = (r as any).payments;
          const method = payment?.payment_method || 'unknown';
          const methodColor = METHOD_COLORS[method] || Colors.textSecondary;
          return (
            <Card>
              <View style={styles.recRow}>
                <View style={[styles.recIcon, { backgroundColor: `${methodColor}18` }]}>
                  <MaterialIcons name="receipt" size={20} color={methodColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recNum}>{r.receipt_number}</Text>
                  <Text style={styles.recStudent}>{studentName}</Text>
                  <Text style={styles.recDate}>Issued: {formatDate(r.issued_at)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={[styles.recAmount, { color: Colors.success }]}>{formatCurrency(r.amount)}</Text>
                  <Badge label={method} variant="primary" size="sm" />
                </View>
              </View>
              {payment?.payment_number ? (
                <View style={styles.footRow}>
                  <Text style={styles.footText}>Linked Payment: {payment.payment_number}</Text>
                </View>
              ) : null}
            </Card>
          );
        }}
      />
      <BottomNav items={NAV} accentColor={Colors.success} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 100 },
  recRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  recIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  recNum: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  recStudent: { fontSize: FontSize.base, color: Colors.textSecondary, marginTop: 2 },
  recDate: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  recAmount: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  footRow: { marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  footText: { fontSize: FontSize.xs, color: Colors.textMuted },
});
