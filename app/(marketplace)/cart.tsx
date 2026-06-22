import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useAppContext } from '@/hooks/useAppContext';
import { getCart, removeFromCart, placeOrder } from '@/services/marketplace.service';
import { useAlert } from '@/template';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';

export default function CartScreen() {
  const router = useRouter();
  const { school, profileId } = useAppContext();
  const { showAlert } = useAlert();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!school || !profileId) return;
    const { data } = await getCart(school.id, profileId);
    setItems(data || []);
    setLoading(false);
  }, [school, profileId]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const total = items.reduce((sum, i) => sum + Number(i.marketplace_products?.price || 0) * i.quantity, 0);

  const handleCheckout = async () => {
    if (!school || !profileId || items.length === 0) return;
    const orderItems = items.map(i => ({ product_id: i.product_id, quantity: i.quantity }));
    const { error } = await placeOrder(school.id, profileId, orderItems);
    if (error) { showAlert('Error', error); return; }
    showAlert('Order Placed', 'Your order has been placed!');
    router.push('/(marketplace)/orders' as any);
  };

  if (!school) return <LoadingScreen />;
  if (loading) return <LoadingScreen message="Loading cart..." />;

  return (
    <SafeAreaView style={s.flex} edges={['bottom']}>
      <Header title="Shopping Cart" subtitle={`${items.length} items`} showBack accentColor={Colors.secondary} />
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        renderItem={({ item }) => (
          <Card style={s.item}>
            <View style={s.itemRow}>
              <View style={s.itemInfo}>
                <Text style={s.itemTitle}>{item.marketplace_products?.title || 'Product'}</Text>
                <Text style={s.itemPrice}>{item.marketplace_products?.currency} {Number(item.marketplace_products?.price || 0).toLocaleString()}</Text>
                <Text style={s.itemQty}>Qty: {item.quantity}</Text>
              </View>
              <Pressable onPress={async () => { await removeFromCart(item.id); load(); }}>
                <MaterialIcons name="delete" size={22} color={Colors.error} />
              </Pressable>
            </View>
          </Card>
        )}
        ListEmptyComponent={<EmptyState icon="shopping-cart" title="Cart is empty" description="Add products to your cart" />}
      />
      {items.length > 0 && (
        <View style={s.footer}>
          <Text style={s.totalLabel}>Total</Text>
          <Text style={s.totalValue}>KES {total.toLocaleString()}</Text>
          <Button label="Checkout" onPress={handleCheckout} size="lg" />
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.md, gap: Spacing.sm },
  item: { padding: Spacing.md },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemInfo: { flex: 1 },
  itemTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  itemPrice: { fontSize: FontSize.md, color: Colors.secondary, fontWeight: FontWeight.bold, marginTop: 4 },
  itemQty: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  footer: { backgroundColor: Colors.surface, padding: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border, gap: Spacing.sm },
  totalLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  totalValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
});
