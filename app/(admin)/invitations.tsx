import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Modal, Pressable, ScrollView } from 'react-native';
import { useAlert } from '@/template';
import { useAppContext } from '@/hooks/useAppContext';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import {
  listPendingInvitations,
  sendInvitation,
  revokeInvitation,
  ALL_STAFF_ROLES,
  SchoolInvitationRow,
} from '@/services/invitation.service';

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function InvitationsScreen() {
  const { school, profileId } = useAppContext();
  const { showAlert } = useAlert();
  const [invitations, setInvitations] = useState<SchoolInvitationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>(ALL_STAFF_ROLES[0]);

  const load = useCallback(async () => {
    if (!school) return;
    const { data, error } = await listPendingInvitations(school.id);
    if (error) { showAlert('Error', error); }
    setInvitations(data || []);
    setLoading(false);
    setRefreshing(false);
  }, [school]);

  useEffect(() => { load(); }, [school]);

  const handleSend = async () => {
    if (!school || !profileId) return;
    if (!email.trim()) { showAlert('Missing Email', 'Please enter an email address.'); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) { showAlert('Invalid Email', 'Please enter a valid email address.'); return; }
    setSaving(true);
    const { data, error } = await sendInvitation({
      schoolId: school.id,
      email: email.trim(),
      role: role as any,
      invitedBy: profileId,
    });
    setSaving(false);
    if (error) { showAlert('Error', error); return; }
    showAlert('Invitation Sent', `Invitation email sent to ${email.trim()} as ${role.replace(/_/g, ' ')}.`);
    setShowModal(false);
    setEmail('');
    setRole(ALL_STAFF_ROLES[0]);
    load();
  };

  const handleRevoke = (inv: SchoolInvitationRow) => {
    if (!school || !profileId) return;
    showAlert('Revoke Invitation', `Revoke invitation to ${inv.email}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke',
        style: 'destructive',
        onPress: async () => {
          const { error } = await revokeInvitation(school.id, inv.id, profileId);
          if (error) { showAlert('Error', error); return; }
          showAlert('Revoked', 'Invitation has been revoked.');
          load();
        },
      },
    ]);
  };

  if (loading) return <LoadingScreen message="Loading invitations..." />;

  return (
    <View style={styles.flex}>
      <Header
        title="Invitations"
        subtitle={`${invitations.length} pending`}
        showBack
        accentColor={Colors.primary}
        rightAction={{ icon: 'person-add', onPress: () => setShowModal(true) }}
      />
      <FlatList
        data={invitations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={() => { setRefreshing(true); load(); }}
        ListEmptyComponent={
          <EmptyState
            icon="mail"
            title="No Pending Invitations"
            description="Invite teachers, bursars, librarians and other staff to join your school."
            actionLabel="Send Invitation"
            onAction={() => setShowModal(true)}
          />
        }
        renderItem={({ item }) => {
          const expiringSoon = new Date(item.expires_at).getTime() - Date.now() < 2 * 86400000;
          return (
            <Card>
              <View style={styles.invRow}>
                <View style={[styles.iconWrap, { backgroundColor: Colors.schoolAdminBg }]}>
                  <MaterialIcons name="mail-outline" size={20} color={Colors.primary} />
                </View>
                <View style={styles.invInfo}>
                  <Text style={styles.email} numberOfLines={1}>{item.email}</Text>
                  <View style={styles.badgeRow}>
                    <Badge label={item.role.replace(/_/g, ' ')} variant="primary" size="sm" />
                    <Badge label={item.status} variant={item.status === 'pending' ? 'warning' : 'default'} size="sm" />
                  </View>
                  <Text style={[styles.expires, { color: expiringSoon ? Colors.warning : Colors.textMuted }]}>
                    <MaterialIcons name="schedule" size={11} color={expiringSoon ? Colors.warning : Colors.textMuted} /> Expires {formatDate(item.expires_at)}
                  </Text>
                </View>
                {item.status === 'pending' ? (
                  <Pressable style={styles.revokeBtn} onPress={() => handleRevoke(item)}>
                    <MaterialIcons name="block" size={16} color={Colors.error} />
                    <Text style={styles.revokeText}>Revoke</Text>
                  </Pressable>
                ) : null}
              </View>
            </Card>
          );
        }}
      />

      {/* New Invitation Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Send Invitation</Text>
              <Pressable onPress={() => setShowModal(false)} hitSlop={8}>
                <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Input
                label="Email Address *"
                value={email}
                onChangeText={setEmail}
                placeholder="staffmember@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                leftIcon="email"
              />
              <Text style={styles.fieldLabel}>Role *</Text>
              <View style={styles.roleGrid}>
                {ALL_STAFF_ROLES.map((r) => (
                  <Pressable key={r} style={[styles.roleChip, role === r && styles.roleChipActive]} onPress={() => setRole(r)}>
                    <Text style={[styles.roleChipText, role === r && styles.roleChipTextActive]}>{r.replace(/_/g, ' ')}</Text>
                  </Pressable>
                ))}
              </View>
              <Button label={saving ? 'Sending...' : 'Send Invite'} onPress={handleSend} loading={saving} fullWidth style={{ marginTop: Spacing.md, marginBottom: Spacing.lg }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 100 },
  invRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  invInfo: { flex: 1, gap: 4 },
  email: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  badgeRow: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' },
  expires: { fontSize: FontSize.xs, marginTop: 2 },
  revokeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, backgroundColor: Colors.errorBg, borderRadius: BorderRadius.sm },
  revokeText: { fontSize: FontSize.xs, color: Colors.error, fontWeight: FontWeight.semibold },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  fieldLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium, marginBottom: 6, marginTop: Spacing.sm },
  roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  roleChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2, borderRadius: BorderRadius.full, backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border },
  roleChipActive: { backgroundColor: Colors.primaryDark, borderColor: Colors.primary },
  roleChipText: { fontSize: FontSize.xs, color: Colors.textSecondary, textTransform: 'capitalize' },
  roleChipTextActive: { color: Colors.textPrimary, fontWeight: FontWeight.semibold },
});
