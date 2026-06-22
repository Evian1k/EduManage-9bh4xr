import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { getSupportTickets, resolveTicket, replyToTicket } from '@/services/company.service';
import { useAppContext } from '@/hooks/useAppContext';
import { useAlert } from '@/template';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';

export default function SupportDashboard() {
  const { profileId } = useAppContext();
  const { showAlert } = useAlert();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<any>(null);
  const [reply, setReply] = useState('');

  const load = useCallback(async () => {
    const { data } = await getSupportTickets(filter !== 'all' ? { status: filter } : undefined);
    setTickets(data || []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const handleReply = async () => {
    if (!reply.trim() || !selected || !profileId) return;
    const { error } = await replyToTicket(selected.id, reply.trim(), profileId);
    if (error) { showAlert('Error', error); return; }
    setReply('');
    showAlert('Replied', 'Your reply has been sent.');
  };

  const handleResolve = async () => {
    if (!selected || !profileId) return;
    const { error } = await resolveTicket(selected.id, profileId, 'Resolved by support team');
    if (error) { showAlert('Error', error); return; }
    showAlert('Resolved', 'Ticket has been marked as resolved.');
    setSelected(null);
    load();
  };

  if (loading) return <LoadingScreen message="Loading tickets..." />;

  return (
    <SafeAreaView style={s.flex} edges={['bottom']}>
      <Header title="Support Dashboard" subtitle="Ticket Management" showBack accentColor={Colors.success} />
      <View style={s.filters}>
        {['all', 'open', 'in_progress', 'resolved', 'escalated'].map(f => (
          <Pressable key={f} style={[s.chip, filter === f && s.chipActive]} onPress={() => setFilter(f)}>
            <Text style={[s.chipText, filter === f && s.chipTextActive]}>{f.replace('_', ' ').toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        data={tickets}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        renderItem={({ item }) => (
          <Card style={s.ticketCard} onPress={() => setSelected(item)}>
            <View style={s.ticketRow}>
              <View style={s.ticketInfo}>
                <Text style={s.ticketNum}>{item.ticket_number}</Text>
                <Text style={s.ticketSubject}>{item.subject}</Text>
                <Text style={s.ticketSchool}>{item.schools?.name || 'Unknown school'}</Text>
              </View>
              <View style={s.ticketBadges}>
                <Badge label={item.priority} variant={item.priority === 'critical' || item.priority === 'urgent' ? 'error' : item.priority === 'high' ? 'warning' : 'default'} size="sm" />
                <Badge label={item.status} variant={item.status === 'resolved' ? 'success' : item.status === 'open' ? 'warning' : 'default'} size="sm" />
              </View>
            </View>
          </Card>
        )}
        ListEmptyComponent={<EmptyState icon="support-agent" title="No tickets" description="No support tickets match the current filter" />}
      />
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={s.overlay}>
          <View style={s.modal}>
            {selected && (
              <>
                <Text style={s.modalTitle}>{selected.subject}</Text>
                <Text style={s.modalNum}>{selected.ticket_number}</Text>
                <Text style={s.modalDesc}>{selected.description}</Text>
                <Input label="Reply" value={reply} onChangeText={setReply} placeholder="Type your reply..." multiline />
                <View style={s.modalActions}>
                  <Button label="Cancel" variant="ghost" onPress={() => setSelected(null)} />
                  <Button label="Resolve" variant="danger" onPress={handleResolve} />
                  <Button label="Send Reply" onPress={handleReply} />
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  filters: { flexDirection: 'row', padding: Spacing.sm, gap: 6, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: Colors.surface2 },
  chipActive: { backgroundColor: Colors.primary },
  chipText: { fontSize: 10, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  chipTextActive: { color: Colors.textPrimary },
  list: { padding: Spacing.md, gap: Spacing.sm },
  ticketCard: { padding: Spacing.md },
  ticketRow: { flexDirection: 'row', justifyContent: 'space-between' },
  ticketInfo: { flex: 1 },
  ticketNum: { fontSize: 10, color: Colors.textMuted },
  ticketSubject: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginTop: 2 },
  ticketSchool: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  ticketBadges: { gap: 4, alignItems: 'flex-end' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: Spacing.lg },
  modal: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.lg, gap: Spacing.md },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  modalNum: { fontSize: FontSize.sm, color: Colors.textMuted },
  modalDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, justifyContent: 'flex-end' },
});
