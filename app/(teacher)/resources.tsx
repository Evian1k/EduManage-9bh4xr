import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Modal, Pressable, ScrollView, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useAppContext } from '@/hooks/useAppContext';
import { getSupabaseClient } from '@/template';
import { useAlert } from '@/template';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';

export default function TeacherResources() {
  const { school, profileId } = useAppContext();
  const { showAlert } = useAlert();
  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', resource_type: 'pdf', url: '', class_id: '' });

  const load = useCallback(async () => {
    if (!school) { setLoading(false); return; }
    const supabase = getSupabaseClient();
    const { data } = await supabase.from('learning_resources').select('*').eq('school_id', school.id).order('created_at', { ascending: false });
    setResources(data || []);
    setLoading(false);
  }, [school]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const handleSave = async () => {
    if (!school || !form.title.trim() || !form.url.trim()) { showAlert('Missing', 'Title and URL are required'); return; }
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('learning_resources').insert({ school_id: school.id, title: form.title, description: form.description, resource_type: form.resource_type, url: form.url, class_id: form.class_id || null, uploaded_by: profileId });
    if (error) { showAlert('Error', error); return; }
    setShowForm(false); setForm({ title: '', description: '', resource_type: 'pdf', url: '', class_id: '' }); load();
  };

  if (!school) return <LoadingScreen />;
  if (loading) return <LoadingScreen message="Loading resources..." />;

  return (
    <SafeAreaView style={s.flex} edges={['bottom']}>
      <Header title="Resources" subtitle={school.name} showBack accentColor={Colors.teacher} rightAction={{ icon: 'add', onPress: () => setShowForm(true) }} />
      <FlatList data={resources} keyExtractor={(item) => item.id} contentContainerStyle={s.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        renderItem={({ item }) => (
          <Card style={s.card}><Pressable onPress={() => item.url && Linking.openURL(item.url)}><View style={s.row}><View style={[s.icon, { backgroundColor: (item.resource_type === 'video' ? Colors.error : Colors.primary) + '20' }]}><MaterialIcons name={item.resource_type === 'video' ? 'play-circle' : 'picture-as-pdf'} size={24} color={item.resource_type === 'video' ? Colors.error : Colors.primary} /></View><View style={s.info}><Text style={s.title}>{item.title}</Text>{item.description && <Text style={s.desc} numberOfLines={2}>{item.description}</Text>}<Badge label={item.resource_type || 'file'} size="sm" /></View><MaterialIcons name="open-in-new" size={20} color={Colors.textMuted} /></View></Pressable></Card>
        )}
        ListEmptyComponent={<EmptyState icon="folder-open" title="No resources" description="Upload learning resources for your students" />}
      />
      <Modal visible={showForm} transparent animationType="slide" onRequestClose={() => setShowForm(false)}>
        <View style={s.overlay}><ScrollView style={s.modal}>
          <Text style={s.modalTitle}>New Resource</Text>
          <Input label="Title *" value={form.title} onChangeText={(v) => setForm({ ...form, title: v })} />
          <Input label="Description" value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} />
          <Input label="Type (pdf/video/link)" value={form.resource_type} onChangeText={(v) => setForm({ ...form, resource_type: v })} />
          <Input label="URL *" value={form.url} onChangeText={(v) => setForm({ ...form, url: v })} />
          <Input label="Class ID" value={form.class_id} onChangeText={(v) => setForm({ ...form, class_id: v })} />
          <View style={s.actions}><Button label="Cancel" variant="ghost" onPress={() => setShowForm(false)} /><Button label="Save" onPress={handleSave} /></View>
        </ScrollView></View>
      </Modal>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({ flex: { flex: 1, backgroundColor: Colors.background }, list: { padding: Spacing.md, gap: 8 }, card: { padding: Spacing.md }, row: { flexDirection: 'row', alignItems: 'center', gap: 12 }, icon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, info: { flex: 1, gap: 4 }, title: { fontSize: 15, fontWeight: FontWeight.bold, color: Colors.textPrimary }, desc: { fontSize: 12, color: Colors.textSecondary }, overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 }, modal: { backgroundColor: Colors.surface, borderRadius: 16, padding: 20, maxHeight: '80%' }, modalTitle: { fontSize: 18, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: 16 }, actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 } });