import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useAppContext } from '@/hooks/useAppContext';
import { getOrders } from '@/services/marketplace.service';
import { Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';

export default function OrdersScreen() {
  const { school } = useAppContext();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!school) return;
    const { data } = await getOrders(school.id);
    setOrders(data || []);
    setLoading(false);
  }, [school]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (!school) return <LoadingScreen />;
  if (loading) return <LoadingScreen message="Loading orders..." />;

  return (
    <SafeAreaView style={s.flex} edges={['bottom']}>
      <Header title="My Orders" subtitle={school.name} showBack accentColor={Colors.secondary} />
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        renderItem={({ item }) => (
          <Card style={s.order}>
            <View style={s.orderRow}>
              <View>
                <Text style={s.orderNum}>{item.order_number}</Text>
                <Text style={s.orderDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
                <Text style={s.orderItems}>{item.marketplace_order_items?.length || 0} items</Text>
              </View>
              <View style={s.orderRight}>
                <Text style={s.orderTotal}>{item.currency} {Number(item.total_amount).toLocaleString()}</Text>
                <Badge label={item.status} variant={item.status === 'delivered' ? 'success' : item.status === 'cancelled' ? 'error' : 'warning'} size="sm" />
                <Badge label={item.payment_status} variant={item.payment_status === 'paid' ? 'success' : 'default'} size="sm" />
              </View>
            </View>
          </Card>
        )}
        ListEmptyComponent={<EmptyState icon="receipt-long" title="No orders" description="Your marketplace orders will appear here" />}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.md, gap: Spacing.sm },
  order: { padding: Spacing.md },
  orderRow: { flexDirection: 'row', justifyContent: 'space-between' },
  orderNum: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  orderDate: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  orderItems: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  orderRight: { alignItems: 'flex-end', gap: 4 },
  orderTotal: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.secondary },
});
