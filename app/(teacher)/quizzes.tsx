import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Modal, Pressable, ScrollView } from 'react-native';
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
import { Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';

export default function TeacherQuizzes() {
  const { school } = useAppContext();
  const { showAlert } = useAlert();
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', class_id: '', total_marks: '100', pass_mark: '50', duration_minutes: '60' });

  const load = useCallback(async () => {
    if (!school) { setLoading(false); return; }
    const supabase = getSupabaseClient();
    const { data } = await supabase.from('quizzes').select('*').eq('school_id', school.id).order('created_at', { ascending: false });
    setQuizzes(data || []);
    setLoading(false);
  }, [school]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const handleSave = async () => {
    if (!school || !form.title.trim()) { showAlert('Missing', 'Title is required'); return; }
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('quizzes').insert({ school_id: school.id, title: form.title, description: form.description, class_id: form.class_id || null, total_marks: parseInt(form.total_marks) || 100, pass_mark: parseInt(form.pass_mark) || 50, duration_minutes: parseInt(form.duration_minutes) || 60 });
    if (error) { showAlert('Error', error); return; }
    setShowForm(false); setForm({ title: '', description: '', class_id: '', total_marks: '100', pass_mark: '50', duration_minutes: '60' }); load();
  };

  if (!school) return <LoadingScreen />;
  if (loading) return <LoadingScreen message="Loading quizzes..." />;

  return (
    <SafeAreaView style={s.flex} edges={['bottom']}>
      <Header title="Quizzes" subtitle={school.name} showBack accentColor={Colors.teacher} rightAction={{ icon: 'add', onPress: () => setShowForm(true) }} />
      <FlatList data={quizzes} keyExtractor={(item) => item.id} contentContainerStyle={s.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        renderItem={({ item }) => (
          <Card style={s.card}><Text style={s.title}>{item.title}</Text>{item.description && <Text style={s.desc}>{item.description}</Text>}<View style={s.row}><Badge label={`${item.total_marks} marks`} size="sm" /><Text style={s.meta}>{item.duration_minutes} min - Pass: {item.pass_mark}</Text></View></Card>
        )}
        ListEmptyComponent={<EmptyState icon="quiz" title="No quizzes" description="Create quizzes for your classes" />}
      />
      <Modal visible={showForm} transparent animationType="slide" onRequestClose={() => setShowForm(false)}>
        <View style={s.overlay}><ScrollView style={s.modal}>
          <Text style={s.modalTitle}>New Quiz</Text>
          <Input label="Title *" value={form.title} onChangeText={(v) => setForm({ ...form, title: v })} />
          <Input label="Description" value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} />
          <Input label="Class ID" value={form.class_id} onChangeText={(v) => setForm({ ...form, class_id: v })} />
          <Input label="Total Marks" value={form.total_marks} onChangeText={(v) => setForm({ ...form, total_marks: v })} keyboardType="numeric" />
          <Input label="Pass Mark" value={form.pass_mark} onChangeText={(v) => setForm({ ...form, pass_mark: v })} keyboardType="numeric" />
          <Input label="Duration (min)" value={form.duration_minutes} onChangeText={(v) => setForm({ ...form, duration_minutes: v })} keyboardType="numeric" />
          <View style={s.actions}><Button label="Cancel" variant="ghost" onPress={() => setShowForm(false)} /><Button label="Save" onPress={handleSave} /></View>
        </ScrollView></View>
      </Modal>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({ flex: { flex: 1, backgroundColor: Colors.background }, list: { padding: Spacing.md, gap: 8 }, card: { padding: Spacing.md, gap: 6 }, title: { fontSize: 16, fontWeight: FontWeight.bold, color: Colors.textPrimary }, desc: { fontSize: 13, color: Colors.textSecondary }, row: { flexDirection: 'row', gap: 8, alignItems: 'center' }, meta: { fontSize: 12, color: Colors.textMuted }, overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 }, modal: { backgroundColor: Colors.surface, borderRadius: 16, padding: 20, maxHeight: '80%' }, modalTitle: { fontSize: 18, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: 16 }, actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 } });