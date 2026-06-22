import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Modal, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useAppContext } from '@/hooks/useAppContext';
import { getSupportTickets, createSupportTicket } from '@/services/company.service';
import { useAlert } from '@/template';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';

export default function SchoolSupport() {
  const { school, profileId } = useAppContext();
  const { showAlert } = useAlert();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ subject: '', description: '', category: 'technical', priority: 'normal' });

  const load = useCallback(async () => {
    if (!school) return;
    const { data } = await getSupportTickets({ schoolId: school.id });
    setTickets(data || []);
    setLoading(false);
  }, [school]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const handleCreate = async () => {
    if (!form.subject.trim() || !form.description.trim() || !school || !profileId) { showAlert('Missing', 'Subject and description are required'); return; }
    const { error } = await createSupportTicket({ school_id: school.id, subject: form.subject, description: form.description, category: form.category, priority: form.priority, created_by: profileId });
    if (error) { showAlert('Error', error); return; }
    setShowNew(false); setForm({ subject: '', description: '', category: 'technical', priority: 'normal' }); load();
    showAlert('Submitted', 'Your support ticket has been submitted. We will get back to you soon.');
  };

  if (!school) return <LoadingScreen />;
  if (loading) return <LoadingScreen message="Loading tickets..." />;

  return (
    <SafeAreaView style={s.flex} edges={['bottom']}>
      <Header title="Support" subtitle={school.name} showBack accentColor={Colors.primary} rightAction={{ icon: 'add', onPress: () => setShowNew(true) }} />
      <FlatList
        data={tickets}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        renderItem={({ item }) => (
          <Card style={s.ticket}>
            <View style={s.row}>
              <View style={s.info}>
                <Text style={s.num}>{item.ticket_number}</Text>
                <Text style={s.subject}>{item.subject}</Text>
                <Text style={s.date}>{new Date(item.created_at).toLocaleString()}</Text>
              </View>
              <View style={s.badges}>
                <Badge label={item.priority} variant={item.priority === 'critical' || item.priority === 'urgent' ? 'error' : item.priority === 'high' ? 'warning' : 'default'} size="sm" />
                <Badge label={item.status} variant={item.status === 'resolved' ? 'success' : item.status === 'open' ? 'warning' : 'default'} size="sm" />
              </View>
            </View>
            {item.resolution_notes && <Text style={s.resolution}>Resolution: {item.resolution_notes}</Text>}
          </Card>
        )}
        ListEmptyComponent={<EmptyState icon="support-agent" title="No tickets" description="Create a support ticket to get help" />}
      />
      <Modal visible={showNew} transparent animationType="slide" onRequestClose={() => setShowNew(false)}>
        <View style={s.overlay}><View style={s.modal}>
          <Text style={s.modalTitle}>New Support Ticket</Text>
          <Input label="Subject *" value={form.subject} onChangeText={(v) => setForm({ ...form, subject: v })} placeholder="Brief summary of issue" />
          <Input label="Description *" value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} placeholder="Describe the issue in detail" multiline />
          <View style={s.pickerRow}>
            <Pressable style={s.picker} onPress={() => setForm({ ...form, category: 'technical' })}><Text style={form.category === 'technical' ? s.pickerActive : s.pickerText}>Technical</Text></Pressable>
            <Pressable style={s.picker} onPress={() => setForm({ ...form, category: 'billing' })}><Text style={form.category === 'billing' ? s.pickerActive : s.pickerText}>Billing</Text></Pressable>
            <Pressable style={s.picker} onPress={() => setForm({ ...form, category: 'general' })}><Text style={form.category === 'general' ? s.pickerActive : s.pickerText}>General</Text></Pressable>
            <Pressable style={s.picker} onPress={() => setForm({ ...form, category: 'bug' })}><Text style={form.category === 'bug' ? s.pickerActive : s.pickerText}>Bug</Text></Pressable>
          </View>
          <View style={s.pickerRow}>
            <Pressable style={s.picker} onPress={() => setForm({ ...form, priority: 'low' })}><Text style={form.priority === 'low' ? s.pickerActive : s.pickerText}>Low</Text></Pressable>
            <Pressable style={s.picker} onPress={() => setForm({ ...form, priority: 'normal' })}><Text style={form.priority === 'normal' ? s.pickerActive : s.pickerText}>Normal</Text></Pressable>
            <Pressable style={s.picker} onPress={() => setForm({ ...form, priority: 'high' })}><Text style={form.priority === 'high' ? s.pickerActive : s.pickerText}>High</Text></Pressable>
            <Pressable style={s.picker} onPress={() => setForm({ ...form, priority: 'urgent' })}><Text style={form.priority === 'urgent' ? s.pickerActive : s.pickerText}>Urgent</Text></Pressable>
          </View>
          <View style={s.actions}><Button label="Cancel" variant="ghost" onPress={() => setShowNew(false)} /><Button label="Submit Ticket" onPress={handleCreate} /></View>
        </View></View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.md, gap: Spacing.sm },
  ticket: { padding: Spacing.md, gap: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  info: { flex: 1 },
  num: { fontSize: 10, color: Colors.textMuted },
  subject: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginTop: 2 },
  date: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  badges: { gap: 4, alignItems: 'flex-end' },
  resolution: { fontSize: FontSize.sm, color: Colors.success, marginTop: 8, fontStyle: 'italic' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: Spacing.lg },
  modal: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.lg, gap: Spacing.md },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  pickerRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  picker: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: Colors.surface2 },
  pickerText: { fontSize: 10, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  pickerActive: { fontSize: 10, color: Colors.primary, fontWeight: FontWeight.bold },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm },
});
