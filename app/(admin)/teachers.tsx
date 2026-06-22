import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Modal, Pressable, ScrollView, TextInput, ActivityIndicator,
} from 'react-native';
import { useAlert, useAuth } from '@/template';
import { useAppContext } from '@/hooks/useAppContext';
import { getAllStaffWithLifecycle, updateStaffLifecycle, reinstateStaff, initiateTransfer, retireStaff, suspendStaff, getStaffAuditLog, getActiveAdminCount } from '@/services/staffLifecycle.service';
import { updateStaffRole } from '@/services/teacher.service';
import { BottomNav } from '@/components/layout/BottomNav';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Header } from '@/components/layout/Header';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';

const ADMIN_NAV = [
  { label: 'Dashboard', icon: 'dashboard' as const, route: '/(admin)/' },
  { label: 'Students', icon: 'people' as const, route: '/(admin)/students' },
  { label: 'Staff', icon: 'badge' as const, route: '/(admin)/teachers' },
  { label: 'Classes', icon: 'class' as const, route: '/(admin)/classes' },
  { label: 'Settings', icon: 'settings' as const, route: '/(admin)/settings' },
];

const ALL_ROLES = [
  'teacher', 'ict_manager', 'bursar', 'secretary', 'librarian', 'nurse',
  'accountant', 'clerk', 'receptionist', 'discipline_officer', 'timetable_officer',
];

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', teacher: 'Teacher', ict_manager: 'ICT Manager',
  accountant: 'Accountant', clerk: 'Clerk', student: 'Student',
  secretary: 'Secretary', bursar: 'Bursar', librarian: 'Librarian',
  nurse: 'Nurse', receptionist: 'Receptionist',
  discipline_officer: 'Discipline Officer', timetable_officer: 'Timetable Officer',
};

const STATUS_COLORS: Record<string, string> = {
  active: Colors.success,
  transferred: Colors.primary,
  retired: Colors.textMuted,
  resigned: Colors.textMuted,
  suspended: Colors.warning,
  terminated: Colors.error,
  on_leave: Colors.warning,
};

const STATUS_ICONS: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  active: 'check-circle',
  transferred: 'swap-horiz',
  retired: 'chair',
  resigned: 'exit-to-app',
  suspended: 'pause-circle',
  terminated: 'cancel',
  on_leave: 'beach-access',
};

type StaffView = 'active' | 'inactive';

export default function TeachersScreen() {
  const { school, schoolUser } = useAppContext();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [view, setView] = useState<StaffView>('active');
  const [saving, setSaving] = useState(false);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [showAudit, setShowAudit] = useState(false);
  const [notes, setNotes] = useState('');
  const [transferDest, setTransferDest] = useState('');
  const [showAction, setShowAction] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');

  const load = useCallback(async () => {
    if (!school) return;
    const { data } = await getAllStaffWithLifecycle(school.id);
    setStaff(data || []);
    setLoading(false);
    setRefreshing(false);
  }, [school]);

  useEffect(() => { load(); }, [school]);

  const filtered = staff.filter(s => {
    const isActive = (s.employment_status === 'active' || !s.employment_status) && s.is_active;
    const matchesView = view === 'active' ? isActive : !isActive;
    if (!matchesView) return false;
    if (!searchText) return true;
    const name = (s.user_profiles?.username || '').toLowerCase();
    const email = (s.user_profiles?.email || '').toLowerCase();
    return name.includes(searchText.toLowerCase()) || email.includes(searchText.toLowerCase());
  });

  const runAction = async (action: string) => {
    if (!selected || !school || !user) return;
    setSaving(true);

    let result: any = { error: null };

    if (action === 'transfer') {
      result = await initiateTransfer(selected.id, school.id, user.id, transferDest || 'pending');
    } else if (action === 'retire') {
      // Guard: prevent retiring last admin
      if (selected.role === 'admin') {
        const count = await getActiveAdminCount(school.id);
        if (count <= 1) {
          showAlert('Cannot Retire', 'This is the only active admin. Assign another admin before retiring this account.');
          setSaving(false);
          return;
        }
      }
      result = await retireStaff(selected.id, school.id, user.id);
    } else if (action === 'suspend') {
      result = await suspendStaff(selected.id, school.id, user.id, notes || 'Suspended by admin');
    } else if (action === 'resign') {
      result = await updateStaffLifecycle(selected.id, school.id, { employment_status: 'resigned', archived: true }, user.id, notes);
    } else if (action === 'terminate') {
      result = await updateStaffLifecycle(selected.id, school.id, { employment_status: 'terminated', archived: true }, user.id, notes);
    } else if (action === 'on_leave') {
      result = await updateStaffLifecycle(selected.id, school.id, { employment_status: 'on_leave' }, user.id, notes);
    } else if (action === 'reinstate') {
      result = await reinstateStaff(selected.id, school.id, user.id);
    }

    setSaving(false);
    if (result.error) {
      showAlert('Error', result.error);
      return;
    }
    setSelected(null);
    setShowAction(null);
    setNotes('');
    setTransferDest('');
    load();
    showAlert('Done', `Staff status updated successfully.`);
  };

  const handleChangeRole = async (role: string) => {
    if (!selected) return;
    setSaving(true);
    const { error } = await updateStaffRole(selected.id, role);
    setSaving(false);
    if (error) { showAlert('Error', error); return; }
    setSelected(null);
    load();
  };

  const handleViewAudit = async () => {
    if (!school) return;
    const { data } = await getStaffAuditLog(school.id, selected?.id);
    setAuditLog(data || []);
    setShowAudit(true);
  };

  if (loading) return <LoadingScreen message="Loading staff..." />;

  const activeCount = staff.filter(s => (s.employment_status === 'active' || !s.employment_status) && s.is_active).length;
  const inactiveCount = staff.filter(s => !(s.employment_status === 'active' || !s.employment_status) || !s.is_active).length;

  return (
    <View style={styles.flex}>
      <Header title="Staff Management" subtitle={`${activeCount} active · ${inactiveCount} archived`} accentColor={Colors.teacher} />
      <View style={styles.topBar}>
        {/* View Toggle */}
        <View style={styles.toggle}>
          {(['active', 'inactive'] as StaffView[]).map(v => (
            <Pressable key={v} style={[styles.toggleBtn, view === v && styles.toggleBtnActive]} onPress={() => setView(v)}>
              <Text style={[styles.toggleText, view === v && styles.toggleTextActive]}>
                {v === 'active' ? `Active (${activeCount})` : `Archived (${inactiveCount})`}
              </Text>
            </Pressable>
          ))}
        </View>
        {/* Search */}
        <View style={styles.searchRow}>
          <MaterialIcons name="search" size={16} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search staff..."
            placeholderTextColor={Colors.textMuted}
          />
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={() => { setRefreshing(true); load(); }}
        ListEmptyComponent={
          <EmptyState
            icon="badge"
            title={view === 'active' ? 'No Active Staff' : 'No Archived Staff'}
            description={view === 'active' ? 'Active staff members will appear here.' : 'Transferred, retired, or suspended staff appear here.'}
          />
        }
        renderItem={({ item }) => {
          const status = item.employment_status || 'active';
          const statusColor = STATUS_COLORS[status] || Colors.textMuted;
          return (
            <Card style={styles.staffCard} onPress={() => setSelected(item)}>
              <View style={styles.staffRow}>
                <Avatar name={item.user_profiles?.username || 'Staff'} size={44} />
                <View style={styles.staffInfo}>
                  <Text style={styles.staffName}>{item.user_profiles?.username || 'Unknown'}</Text>
                  <Text style={styles.staffEmail}>{item.user_profiles?.email}</Text>
                  <View style={styles.metaRow}>
                    {item.employee_id ? <Text style={styles.staffId}>{item.employee_id}</Text> : null}
                    {item.department ? <Text style={styles.staffDept}>{item.department}</Text> : null}
                  </View>
                </View>
                <View style={styles.staffRight}>
                  <View style={[styles.rolePill, { backgroundColor: `${Colors.teacher}20` }]}>
                    <Text style={[styles.roleText, { color: Colors.teacher }]}>{ROLE_LABELS[item.role] || item.role}</Text>
                  </View>
                  <View style={styles.statusRow}>
                    <MaterialIcons name={STATUS_ICONS[status] || 'circle'} size={13} color={statusColor} />
                    <Text style={[styles.statusText, { color: statusColor }]}>{status}</Text>
                  </View>
                </View>
              </View>
            </Card>
          );
        }}
      />

      {/* --- Staff Detail Modal --- */}
      <Modal visible={!!selected} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Avatar name={selected?.user_profiles?.username || 'Staff'} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{selected?.user_profiles?.username}</Text>
                <Text style={styles.modalEmail}>{selected?.user_profiles?.email}</Text>
              </View>
              <Pressable onPress={() => { setSelected(null); setShowAction(null); }} hitSlop={8}>
                <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Current Status */}
              <View style={styles.statusCard}>
                <View style={styles.statusCardRow}>
                  <Text style={styles.sectionLabel}>Status</Text>
                  <View style={[styles.statusPill, { backgroundColor: `${STATUS_COLORS[selected?.employment_status || 'active']}20` }]}>
                    <MaterialIcons name={STATUS_ICONS[selected?.employment_status || 'active'] || 'circle'} size={14} color={STATUS_COLORS[selected?.employment_status || 'active']} />
                    <Text style={[styles.statusPillText, { color: STATUS_COLORS[selected?.employment_status || 'active'] }]}>
                      {(selected?.employment_status || 'active').toUpperCase()}
                    </Text>
                  </View>
                </View>
                <View style={styles.infoGrid}>
                  <View style={styles.infoCell}>
                    <Text style={styles.infoCellLabel}>Role</Text>
                    <Text style={styles.infoCellVal}>{ROLE_LABELS[selected?.role] || selected?.role}</Text>
                  </View>
                  <View style={styles.infoCell}>
                    <Text style={styles.infoCellLabel}>Employee ID</Text>
                    <Text style={styles.infoCellVal}>{selected?.employee_id || '—'}</Text>
                  </View>
                  <View style={styles.infoCell}>
                    <Text style={styles.infoCellLabel}>Department</Text>
                    <Text style={styles.infoCellVal}>{selected?.department || '—'}</Text>
                  </View>
                  <View style={styles.infoCell}>
                    <Text style={styles.infoCellLabel}>Start Date</Text>
                    <Text style={styles.infoCellVal}>{selected?.employment_start_date || '—'}</Text>
                  </View>
                </View>
              </View>

              {/* Action Selector */}
              {!showAction ? (
                <>
                  {/* Change Role */}
                  <Text style={styles.sectionLabel}>Change Role</Text>
                  <View style={styles.roleGrid}>
                    {ALL_ROLES.map(role => (
                      <Pressable
                        key={role}
                        style={[styles.roleChip, selected?.role === role && styles.roleChipActive]}
                        onPress={() => handleChangeRole(role)}
                      >
                        {saving ? <ActivityIndicator size="small" color={Colors.teacher} /> : null}
                        <Text style={[styles.roleChipText, selected?.role === role && styles.roleChipTextActive]}>
                          {ROLE_LABELS[role]}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  {/* Lifecycle Actions */}
                  <Text style={styles.sectionLabel}>Employment Actions</Text>
                  <View style={styles.actionGrid}>
                    {selected?.is_active ? (
                      <>
                        <Pressable style={[styles.actionBtn, { borderColor: Colors.warning }]} onPress={() => setShowAction('on_leave')}>
                          <MaterialIcons name="beach-access" size={18} color={Colors.warning} />
                          <Text style={[styles.actionBtnText, { color: Colors.warning }]}>Place on Leave</Text>
                        </Pressable>
                        <Pressable style={[styles.actionBtn, { borderColor: Colors.warning }]} onPress={() => setShowAction('suspend')}>
                          <MaterialIcons name="pause-circle" size={18} color={Colors.warning} />
                          <Text style={[styles.actionBtnText, { color: Colors.warning }]}>Suspend</Text>
                        </Pressable>
                        <Pressable style={[styles.actionBtn, { borderColor: Colors.primary }]} onPress={() => setShowAction('transfer')}>
                          <MaterialIcons name="swap-horiz" size={18} color={Colors.primary} />
                          <Text style={[styles.actionBtnText, { color: Colors.primary }]}>Transfer</Text>
                        </Pressable>
                        <Pressable style={[styles.actionBtn, { borderColor: Colors.textMuted }]} onPress={() => setShowAction('resign')}>
                          <MaterialIcons name="exit-to-app" size={18} color={Colors.textMuted} />
                          <Text style={[styles.actionBtnText, { color: Colors.textMuted }]}>Mark Resigned</Text>
                        </Pressable>
                        <Pressable style={[styles.actionBtn, { borderColor: Colors.textMuted }]} onPress={() => setShowAction('retire')}>
                          <MaterialIcons name="chair" size={18} color={Colors.textMuted} />
                          <Text style={[styles.actionBtnText, { color: Colors.textMuted }]}>Retire</Text>
                        </Pressable>
                        <Pressable style={[styles.actionBtn, { borderColor: Colors.error }]} onPress={() => setShowAction('terminate')}>
                          <MaterialIcons name="cancel" size={18} color={Colors.error} />
                          <Text style={[styles.actionBtnText, { color: Colors.error }]}>Terminate</Text>
                        </Pressable>
                      </>
                    ) : (
                      <Pressable style={[styles.actionBtn, { borderColor: Colors.success, flex: 1 }]} onPress={() => runAction('reinstate')}>
                        <MaterialIcons name="check-circle" size={18} color={Colors.success} />
                        <Text style={[styles.actionBtnText, { color: Colors.success }]}>Reinstate Staff</Text>
                      </Pressable>
                    )}
                  </View>

                  <Button label="View Audit Log" onPress={handleViewAudit} variant="outline" fullWidth size="sm" />
                </>
              ) : (
                // Action Confirmation Panel
                <View style={styles.confirmPanel}>
                  <Text style={styles.confirmTitle}>
                    {showAction === 'transfer' ? 'Initiate Transfer' :
                     showAction === 'suspend' ? 'Suspend Staff' :
                     showAction === 'resign' ? 'Record Resignation' :
                     showAction === 'retire' ? 'Retire Staff' :
                     showAction === 'on_leave' ? 'Place on Leave' :
                     'Terminate Employment'}
                  </Text>
                  <View style={styles.warningBox}>
                    <MaterialIcons name="info" size={16} color={Colors.warning} />
                    <Text style={styles.warningText}>
                      {showAction === 'terminate'
                        ? 'This will permanently revoke access. All historical data is preserved.'
                        : showAction === 'transfer'
                        ? 'This removes access from this school. All teaching records are preserved here.'
                        : 'Staff access will be disabled. All records are preserved and can be reinstated.'}
                    </Text>
                  </View>
                  {showAction === 'transfer' ? (
                    <View style={styles.fieldWrap}>
                      <Text style={styles.fieldLabel}>Destination School (optional)</Text>
                      <TextInput
                        style={styles.textIn}
                        value={transferDest}
                        onChangeText={setTransferDest}
                        placeholder="e.g., Lincoln High School"
                        placeholderTextColor={Colors.textMuted}
                      />
                    </View>
                  ) : null}
                  <View style={styles.fieldWrap}>
                    <Text style={styles.fieldLabel}>Reason / Notes</Text>
                    <TextInput
                      style={[styles.textIn, { height: 80, textAlignVertical: 'top' }]}
                      value={notes}
                      onChangeText={setNotes}
                      placeholder="Add a reason or internal note..."
                      placeholderTextColor={Colors.textMuted}
                      multiline
                    />
                  </View>
                  <View style={styles.confirmBtns}>
                    <Button label="Cancel" onPress={() => setShowAction(null)} variant="ghost" size="sm" />
                    <Button
                      label={saving ? 'Processing...' : 'Confirm'}
                      onPress={() => runAction(showAction)}
                      loading={saving}
                      variant={showAction === 'terminate' ? 'danger' : 'primary'}
                    />
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* --- Audit Log Modal --- */}
      <Modal visible={showAudit} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Audit Log</Text>
              <Pressable onPress={() => setShowAudit(false)} hitSlop={8}>
                <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {auditLog.length === 0 ? (
                <Text style={styles.emptyAudit}>No audit entries found.</Text>
              ) : auditLog.map(entry => (
                <View key={entry.id} style={styles.auditEntry}>
                  <View style={styles.auditRow}>
                    <View style={[styles.auditIcon, { backgroundColor: `${STATUS_COLORS[entry.action?.toLowerCase()] || Colors.primary}20` }]}>
                      <MaterialIcons name={STATUS_ICONS[entry.action?.toLowerCase()] || 'history'} size={16} color={STATUS_COLORS[entry.action?.toLowerCase()] || Colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.auditAction}>{entry.action}</Text>
                      <Text style={styles.auditBy}>
                        by {entry['user_profiles']?.username || 'System'} · {new Date(entry.created_at).toLocaleDateString()}
                      </Text>
                      {entry.notes ? <Text style={styles.auditNotes}>{entry.notes}</Text> : null}
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <BottomNav items={ADMIN_NAV} accentColor={Colors.teacher} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  topBar: { backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border, padding: Spacing.md, gap: Spacing.sm },
  toggle: { flexDirection: 'row', backgroundColor: Colors.surface2, borderRadius: BorderRadius.md, padding: 3, gap: 3 },
  toggleBtn: { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: BorderRadius.sm },
  toggleBtnActive: { backgroundColor: Colors.surface },
  toggleText: { fontSize: FontSize.sm, color: Colors.textMuted },
  toggleTextActive: { color: Colors.textPrimary, fontWeight: FontWeight.semibold },
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface2, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, gap: Spacing.xs, borderWidth: 1, borderColor: Colors.border },
  searchInput: { flex: 1, fontSize: FontSize.sm, color: Colors.textPrimary },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 100 },
  staffCard: {},
  staffRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  staffInfo: { flex: 1, gap: 2 },
  staffName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  staffEmail: { fontSize: FontSize.sm, color: Colors.textSecondary },
  metaRow: { flexDirection: 'row', gap: Spacing.sm },
  staffId: { fontSize: FontSize.xs, color: Colors.textMuted },
  staffDept: { fontSize: FontSize.xs, color: Colors.textMuted },
  staffRight: { alignItems: 'flex-end', gap: 5 },
  rolePill: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: BorderRadius.full },
  roleText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statusText: { fontSize: FontSize.xs },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, flex: 1 },
  modalEmail: { fontSize: FontSize.sm, color: Colors.textSecondary },
  statusCard: { backgroundColor: Colors.surface2, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  statusCardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.full },
  statusPillText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  infoCell: { minWidth: '45%', gap: 2 },
  infoCellLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  infoCellVal: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.medium },
  sectionLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textSecondary, marginTop: Spacing.md, marginBottom: Spacing.sm },
  roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.sm },
  roleChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface2, flexDirection: 'row', gap: 4, alignItems: 'center' },
  roleChipActive: { borderColor: Colors.teacher, backgroundColor: Colors.teacherBg },
  roleChipText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  roleChipTextActive: { color: Colors.teacher, fontWeight: FontWeight.semibold },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1, backgroundColor: Colors.surface2 },
  actionBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  confirmPanel: { gap: Spacing.sm, backgroundColor: Colors.surface2, padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border },
  confirmTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  warningBox: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: Colors.warningBg, padding: Spacing.sm, borderRadius: BorderRadius.sm },
  warningText: { flex: 1, fontSize: FontSize.sm, color: Colors.warning, lineHeight: 18 },
  fieldWrap: { gap: 4 },
  fieldLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  textIn: { backgroundColor: Colors.surface, borderRadius: BorderRadius.sm, padding: Spacing.md, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border, fontSize: FontSize.base },
  confirmBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm },
  auditEntry: { borderBottomWidth: 1, borderBottomColor: Colors.border, paddingVertical: Spacing.sm },
  auditRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  auditIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  auditAction: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  auditBy: { fontSize: FontSize.xs, color: Colors.textMuted },
  auditNotes: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  emptyAudit: { color: Colors.textMuted, textAlign: 'center', padding: Spacing.md },
});
