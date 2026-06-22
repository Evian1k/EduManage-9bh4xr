import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useAppContext } from '@/hooks/useAppContext';
import { getSupabaseClient } from '@/template';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';

export default function StudentResources() {
  const { school, studentProfile } = useAppContext();
  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!school || !studentProfile?.class_id) { setLoading(false); return; }
    const supabase = getSupabaseClient();
    const { data } = await supabase.from('learning_resources').select('*').eq('school_id', school.id).or(`class_id.eq.${studentProfile.class_id},is_public.eq.true`).order('created_at', { ascending: false });
    setResources(data || []);
    setLoading(false);
  }, [school, studentProfile]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (!school) return <LoadingScreen />;
  if (loading) return <LoadingScreen message="Loading resources..." />;

  return (
    <SafeAreaView style={s.flex} edges={['bottom']}>
      <Header title="Learning Resources" subtitle={school.name} showBack accentColor={Colors.student} />
      <FlatList data={resources} keyExtractor={(item) => item.id} contentContainerStyle={s.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        renderItem={({ item }) => (
          <Card style={s.card}><Pressable onPress={() => item.url && Linking.openURL(item.url)}>
            <View style={s.row}><View style={[s.icon, { backgroundColor: item.resource_type === 'video' ? Colors.error + '20' : Colors.primary + '20' }]}><MaterialIcons name={item.resource_type === 'video' ? 'play-circle' : 'picture-as-pdf'} size={24} color={item.resource_type === 'video' ? Colors.error : Colors.primary} /></View>
            <View style={s.info}><Text style={s.title}>{item.title}</Text>{item.description && <Text style={s.desc} numberOfLines={2}>{item.description}</Text>}<Badge label={item.resource_type || 'file'} size="sm" /></View>
            <MaterialIcons name="open-in-new" size={20} color={Colors.textMuted} /></View></Pressable></Card>
        )}
        ListEmptyComponent={<EmptyState icon="folder-open" title="No resources" description="Learning resources will appear here" />}
      />
    </SafeAreaView>
  );
}
const s = StyleSheet.create({ flex: { flex: 1, backgroundColor: Colors.background }, list: { padding: Spacing.md, gap: 8 }, card: { padding: Spacing.md }, row: { flexDirection: 'row', alignItems: 'center', gap: 12 }, icon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, info: { flex: 1, gap: 4 }, title: { fontSize: 15, fontWeight: FontWeight.bold, color: Colors.textPrimary }, desc: { fontSize: 12, color: Colors.textSecondary } });