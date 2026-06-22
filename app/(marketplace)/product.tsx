import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useAppContext } from '@/hooks/useAppContext';
import { getProductById, addToCart, placeOrder } from '@/services/marketplace.service';
import { useAlert } from '@/template';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { school, profileId } = useAppContext();
  const { showAlert } = useAlert();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const { data } = await getProductById(id);
      setProduct(data);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <LoadingScreen />;
  if (!product) return <LoadingScreen message="Product not found" />;

  const handleAddToCart = async () => {
    if (!school || !profileId) return;
    const { error } = await addToCart(school.id, profileId, product.id);
    if (error) { showAlert('Error', error); return; }
    showAlert('Added', 'Product added to cart!');
  };

  const handleBuyNow = async () => {
    if (!school || !profileId) return;
    const { error } = await placeOrder(school.id, profileId, [{ product_id: product.id, quantity: 1 }]);
    if (error) { showAlert('Error', error); return; }
    showAlert('Order Placed', 'Your order has been placed successfully!');
    router.push('/(marketplace)/orders' as any);
  };

  return (
    <SafeAreaView style={s.flex} edges={['bottom']}>
      <Header title={product.title} showBack accentColor={Colors.secondary} />
      <ScrollView contentContainerStyle={s.container}>
        <View style={s.image}><MaterialIcons name="image" size={64} color={Colors.textMuted} /></View>
        <Text style={s.title}>{product.title}</Text>
        <Text style={s.price}>{product.currency} {Number(product.price).toLocaleString()}</Text>
        {product.compare_at_price && <Text style={s.compare}>{product.currency} {Number(product.compare_at_price).toLocaleString()}</Text>}
        <View style={s.badges}>
          {product.digital && <Badge label="Digital Download" variant="primary" />}
          <Badge label={product.category} variant="default" />
          {product.stock_quantity > 0 && <Badge label="In Stock" variant="success" />}
        </View>
        <Card style={s.card}>
          <Text style={s.sectionTitle}>Description</Text>
          <Text style={s.desc}>{product.description}</Text>
        </Card>
        <Card style={s.card}>
          <Text style={s.sectionTitle}>Vendor</Text>
          <Text style={s.vendor}>{product.vendor_name}</Text>
        </Card>
        <View style={s.actions}>
          <Button label="Add to Cart" variant="outline" onPress={handleAddToCart} fullWidth />
          <Button label="Buy Now" onPress={handleBuyNow} fullWidth size="lg" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: { padding: Spacing.md, gap: Spacing.md },
  image: { height: 200, backgroundColor: Colors.surface2, borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  price: { fontSize: FontSize.xl, color: Colors.secondary, fontWeight: FontWeight.bold },
  compare: { fontSize: FontSize.base, color: Colors.textMuted, textDecorationLine: 'line-through' },
  badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  card: { gap: 8 },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  desc: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 22 },
  vendor: { fontSize: FontSize.sm, color: Colors.textSecondary },
  actions: { gap: Spacing.sm, marginTop: Spacing.sm },
});
