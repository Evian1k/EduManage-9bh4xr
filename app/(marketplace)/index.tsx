import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useAppContext } from '@/hooks/useAppContext';
import { getProducts } from '@/services/marketplace.service';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';

const CATEGORIES = [
  { key: '', label: 'All', icon: 'apps' },
  { key: 'books', label: 'Books', icon: 'menu-book' },
  { key: 'uniforms', label: 'Uniforms', icon: 'checkroom' },
  { key: 'transport_software', label: 'Transport', icon: 'directions-bus' },
  { key: 'lms_content', label: 'LMS Content', icon: 'computer' },
  { key: 'exam_papers', label: 'Exams', icon: 'assignment' },
  { key: 'teacher_training', label: 'Training', icon: 'school' },
  { key: 'supplies', label: 'Supplies', icon: 'inventory' },
];

export default function MarketplaceIndex() {
  const router = useRouter();
  const { school } = useAppContext();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    const { data } = await getProducts({ category: category || undefined, search: search || undefined });
    setProducts(data || []);
    setLoading(false);
  }, [category, search]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (!school) return <LoadingScreen />;
  if (loading) return <LoadingScreen message="Loading marketplace..." />;

  return (
    <SafeAreaView style={s.flex} edges={['bottom']}>
      <Header title="Marketplace" subtitle={school.name} showBack accentColor={Colors.secondary} rightAction={{ icon: 'shopping-cart', onPress: () => router.push('/(marketplace)/cart' as any) }} />
      <View style={s.searchWrap}>
        <TextInput style={s.search} value={search} onChangeText={setSearch} placeholder="Search products..." placeholderTextColor={Colors.textMuted} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.cats}>
        {CATEGORIES.map(c => (
          <Pressable key={c.key} style={[s.cat, category === c.key && s.catActive]} onPress={() => setCategory(c.key)}>
            <MaterialIcons name={c.icon as any} size={14} color={category === c.key ? Colors.textPrimary : Colors.textSecondary} />
            <Text style={[s.catText, category === c.key && s.catTextActive]}>{c.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        numColumns={2}
        renderItem={({ item }) => (
          <Pressable style={s.productCard} onPress={() => router.push({ pathname: '/(marketplace)/product', params: { id: item.id } } as any)}>
            <View style={s.productImage}><MaterialIcons name="image" size={40} color={Colors.textMuted} /></View>
            <Text style={s.productTitle} numberOfLines={2}>{item.title}</Text>
            <Text style={s.productPrice}>{item.currency} {Number(item.price).toLocaleString()}</Text>
            <View style={s.productMeta}>
              {item.digital && <Badge label="Digital" size="sm" />}
              <Text style={s.rating}>★ {item.rating || 'New'}</Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={<EmptyState icon="storefront" title="No products" description="No products match your search" />}
      />
    </SafeAreaView>
  );
}

import { ScrollView } from 'react-native';

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  searchWrap: { padding: Spacing.md },
  search: { backgroundColor: Colors.surface2, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, color: Colors.textPrimary, fontSize: FontSize.sm },
  cats: { paddingHorizontal: Spacing.md, gap: 6, paddingBottom: Spacing.sm },
  cat: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: Colors.surface2 },
  catActive: { backgroundColor: Colors.secondary },
  catText: { fontSize: 10, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  catTextActive: { color: Colors.textPrimary },
  list: { padding: Spacing.md, gap: Spacing.sm },
  productCard: { width: '48%', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.sm, gap: 4, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm },
  productImage: { height: 80, backgroundColor: Colors.surface2, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center' },
  productTitle: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.medium },
  productPrice: { fontSize: FontSize.base, color: Colors.secondary, fontWeight: FontWeight.bold },
  productMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rating: { fontSize: 10, color: Colors.warning },
});
