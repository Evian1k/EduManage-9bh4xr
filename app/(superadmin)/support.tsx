import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Modal, Pressable, ScrollView } from 'react-native';
import { useAuth, useAlert } from '@/template';
import { getAllTickets, updateTicketStatus, replyToTicket } from '@/services/platform.service';
import { BottomNav } from '@/components/layout/BottomNav';

const SUPER_ADMIN_NAV = [
  { label: 'Dashboard', icon: 'dashboard' as const, route: '/(superadmin)/' },
  { label: 'Schools', icon: 'business' as const, route: '/(superadmin)/schools' },
  { label: 'Revenue', icon: 'attach-money' as const, route: '/(superadmin)/revenue' },
  { label: 'Support', icon: 'support-agent' as const, route: '/(superadmin)/support' },
  { label: 'Announce', icon: 'campaign' as const, route: '/(superadmin)/announcements' },
];
import { Card } from '@/components/ui/Card';
import { Badge, getStatusBadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Header } from '@/components/layout/Header';
import { Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { formatDate } from '@/constants/config';

const PRIORITY_COLOR: Record<string, string> = {
  low: Colors.success, medium: Colors.warning, high: Colors.error, urgent: '#FF0000',
};

export default function SupportScreen() {
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const load = useCallback(async () => {
    const { data } = await getAllTickets();
    setTickets(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, []);

  const filtered = filterStatus === 'all' ? tickets : tickets.filter((t) => t.status === filterStatus);

  const handleReply = async () => {
    if (!reply.trim() || !user || !selected) return;
    setSending(true);
    const { error } = await replyToTicket(selected.id, user.id, reply.trim());
    if (error) { showAlert('Error', error); setSending(false); return; }
    await updateTicketStatus(selected.id, 'in_progress', user.id);
    setReply('');
    setSending(false);
    showAlert('Reply Sent', 'Your reply has been sent to the school.');
    setSelected(null);
    load();
  };

  const handleResolve = async () => {
    if (!user || !selected) return;
    await updateTicketStatus(selected.id, 'resolved', user.id);
    showAlert('Ticket Resolved', 'The ticket has been marked as resolved.');
    setSelected(null);
    load();
  };

  if (loading) return <LoadingScreen message="Loading support tickets..." />;

  return (
    <View style={styles.flex}>
      <Header title="Support Tickets" subtitle={`${tickets.filter((t) => t.status === 'open').length} open`} accentColor={Colors.superAdmin} />
      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {['all', 'open', 'in_progress', 'resolved'].map((s) => (
          <Pressable
            key={s}
            style={[styles.filterTab, filterStatus === s && styles.filterTabActive]}
            onPress={() => setFilterStatus(s)}
          >
            <Text style={[styles.filterText, filterStatus === s && styles.filterTextActive]}>
              {s === 'all' ? 'All' : s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<EmptyState icon="support-agent" title="No tickets" description="No support tickets match this filter." />}
        renderItem={({ item }) => (
          <Card style={styles.ticket} onPress={() => setSelected(item)}>
            <View style={styles.ticketHeader}>
              <View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLOR[item.priority] }]} />
              <Text style={styles.ticketTitle} numberOfLines={2}>{item.title}</Text>
            </View>
            <Text style={styles.ticketSchool}>{item.schools?.name} • {item.category}</Text>
            <Text style={styles.ticketDesc} numberOfLines={2}>{item.description}</Text>
            <View style={styles.ticketFooter}>
              <Badge label={item.status.replace('_', ' ')} variant={getStatusBadgeVariant(item.status)} size="sm" />
              <Text style={styles.ticketDate}>{formatDate(item.created_at)}</Text>
            </View>
          </Card>
        )}
      />

      <Modal visible={!!selected} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={2}>{selected?.title}</Text>
              <Pressable onPress={() => setSelected(null)} hitSlop={8}>
                <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
              <Text style={styles.modalSchool}>{selected?.schools?.name} • {selected?.category} • {selected?.priority} priority</Text>
              <Text style={styles.modalDate}>{formatDate(selected?.created_at)}</Text>
              <View style={styles.modalBody}>
                <Text style={styles.modalDesc}>{selected?.description}</Text>
              </View>
              <Badge label={selected?.status || ''} variant={getStatusBadgeVariant(selected?.status || '')} />
              <Text style={styles.replyLabel}>Reply to School</Text>
              <Input
                value={reply}
                onChangeText={setReply}
                placeholder="Type your reply..."
                multiline
                numberOfLines={4}
                style={{ height: 100, textAlignVertical: 'top' }}
              />
              <View style={styles.modalActions}>
                <Button label="Send Reply" onPress={handleReply} loading={sending} fullWidth />
                {selected?.status !== 'resolved' ? (
                  <Button label="Mark Resolved" onPress={handleResolve} variant="outline" fullWidth />
                ) : null}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
      <BottomNav items={SUPER_ADMIN_NAV} accentColor={Colors.superAdmin} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  filterRow: { flexDirection: 'row', padding: Spacing.md, paddingBottom: 0, gap: Spacing.xs },
  filterTab: { paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.surface2 },
  filterTabActive: { backgroundColor: Colors.primary },
  filterText: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  filterTextActive: { color: Colors.textPrimary, fontWeight: FontWeight.semibold },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 100 },
  ticket: { gap: Spacing.xs },
  ticketHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs },
  priorityDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4, flexShrink: 0 },
  ticketTitle: { flex: 1, fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  ticketSchool: { fontSize: FontSize.sm, color: Colors.textSecondary, marginLeft: 18 },
  ticketDesc: { fontSize: FontSize.sm, color: Colors.textMuted, marginLeft: 18 },
  ticketFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginLeft: 18 },
  ticketDate: { fontSize: FontSize.xs, color: Colors.textMuted },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: Spacing.xs, gap: Spacing.sm },
  modalTitle: { flex: 1, fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  modalScroll: { flex: 1 },
  modalSchool: { fontSize: FontSize.sm, color: Colors.textSecondary, textTransform: 'capitalize' },
  modalDate: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: Spacing.sm },
  modalBody: { backgroundColor: Colors.surface2, padding: Spacing.md, borderRadius: 12, marginBottom: Spacing.md },
  modalDesc: { fontSize: FontSize.base, color: Colors.textSecondary, lineHeight: 22 },
  replyLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textSecondary, marginTop: Spacing.md, marginBottom: Spacing.sm },
  modalActions: { gap: Spacing.sm, marginTop: Spacing.md, paddingBottom: Spacing.md },
});
