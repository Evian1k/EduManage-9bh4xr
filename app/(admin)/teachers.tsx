import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Modal, Pressable, ScrollView } from 'react-native';
import { useAlert } from '@/template';
import { useAppContext } from '@/hooks/useAppContext';
import { getAllStaff, toggleStaffActive, updateStaffRole } from '@/services/teacher.service';
import { BottomNav } from '@/components/layout/BottomNav';

const ADMIN_NAV = [
  { label: 'Dashboard', icon: 'dashboard' as const, route: '/(admin)/' },
  { label: 'Students', icon: 'people' as const, route: '/(admin)/students' },
  { label: 'Staff', icon: 'badge' as const, route: '/(admin)/teachers' },
  { label: 'Classes', icon: 'class' as const, route: '/(admin)/classes' },
  { label: 'Settings', icon: 'settings' as const, route: '/(admin)/settings' },
];
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Header } from '@/components/layout/Header';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';

const ROLES = ['teacher', 'ict_manager', 'accountant', 'clerk'];
const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', teacher: 'Teacher', ict_manager: 'ICT Manager',
  accountant: 'Accountant', clerk: 'Clerk', student: 'Student',
};
const ROLE_COLORS: Record<string, string> = {
  admin: Colors.primary, teacher: Colors.teacher,
  ict_manager: Colors.secondary, accountant: Colors.success, clerk: Colors.warning,
};

export default function TeachersScreen() {
  const { school } = useAppContext();
  const { showAlert } = useAlert();
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!school) return;
    const { data } = await getAllStaff(school.id);
    setStaff(data || []);
    setLoading(false);
    setRefreshing(false);
  }, [school]);

  useEffect(() => { load(); }, [school]);

  const handleToggleActive = async (member: any) => {
    const newStatus = !member.is_active;
    showAlert(newStatus ? 'Activate Staff' : 'Deactivate Staff', `Are you sure?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: newStatus ? 'Activate' : 'Deactivate',
        style: newStatus ? 'default' : 'destructive',
        onPress: async () => {
          await toggleStaffActive(member.id, newStatus);
          load();
        },
      },
    ]);
  };

  const handleChangeRole = async (role: string) => {
    if (!selected) return;
    setSaving(true);
    const { error } = await updateStaffRole(selected.id, role);
    setSaving(false);
    if (error) { showAlert('Error', error.message); return; }
    setSelected(null);
    load();
  };

  if (loading) return <LoadingScreen message="Loading staff..." />;

  const byRole = ROLES.reduce((acc, role) => {
    acc[role] = staff.filter((s) => s.role === role);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <View style={styles.flex}>
      <Header title="Staff Management" subtitle={`${staff.length} staff members`} accentColor={Colors.teacher} />
      <FlatList
        data={staff}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={() => { setRefreshing(true); load(); }}
        ListHeaderComponent={
          <View style={styles.summaryRow}>
            {ROLES.map((role) => (
              <View key={role} style={[styles.roleStat, { borderColor: ROLE_COLORS[role] + '40' }]}>
                <Text style={[styles.roleStatCount, { color: ROLE_COLORS[role] }]}>{byRole[role]?.length || 0}</Text>
                <Text style={styles.roleStatLabel}>{ROLE_LABELS[role]}s</Text>
              </View>
            ))}
          </View>
        }
        ListEmptyComponent={
          <EmptyState icon="badge" title="No Staff" description="Staff members will appear here once added." />
        }
        renderItem={({ item }) => (
          <Card style={styles.staffCard} onPress={() => setSelected(item)}>
            <View style={styles.staffRow}>
              <Avatar name={item.user_profiles?.username || 'Staff'} size={44} />
              <View style={styles.staffInfo}>
                <Text style={styles.staffName}>{item.user_profiles?.username || 'Unknown'}</Text>
                <Text style={styles.staffEmail}>{item.user_profiles?.email}</Text>
                {item.employee_id ? <Text style={styles.staffId}>ID: {item.employee_id}</Text> : null}
              </View>
              <View style={styles.staffRight}>
                <View style={[styles.roleBadge, { backgroundColor: `${ROLE_COLORS[item.role]}20` }]}>
                  <Text style={[styles.roleText, { color: ROLE_COLORS[item.role] }]}>{ROLE_LABELS[item.role]}</Text>
                </View>
                <View style={[styles.activeDot, { backgroundColor: item.is_active ? Colors.success : Colors.error }]} />
              </View>
            </View>
          </Card>
        )}
      />

      <Modal visible={!!selected} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selected?.user_profiles?.username}</Text>
              <Pressable onPress={() => setSelected(null)} hitSlop={8}>
                <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalEmail}>{selected?.user_profiles?.email}</Text>
              <Text style={styles.sectionLabel}>Current Role</Text>
              <View style={[styles.roleBadge, { backgroundColor: `${ROLE_COLORS[selected?.role || 'teacher']}20`, alignSelf: 'flex-start' }]}>
                <Text style={[styles.roleText, { color: ROLE_COLORS[selected?.role || 'teacher'] }]}>
                  {ROLE_LABELS[selected?.role || 'teacher']}
                </Text>
              </View>
              <Text style={styles.sectionLabel}>Change Role</Text>
              <View style={styles.roleGrid}>
                {ROLES.map((role) => (
                  <Pressable
                    key={role}
                    style={[styles.roleOption, selected?.role === role && styles.roleOptionActive]}
                    onPress={() => handleChangeRole(role)}
                  >
                    <Text style={[styles.roleOptionText, selected?.role === role && styles.roleOptionTextActive]}>
                      {ROLE_LABELS[role]}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.sectionLabel}>Status</Text>
              <Button
                label={selected?.is_active ? 'Deactivate Account' : 'Activate Account'}
                onPress={() => { handleToggleActive(selected); setSelected(null); }}
                variant={selected?.is_active ? 'danger' : 'primary'}
                fullWidth
              />
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
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 100 },
  summaryRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  roleStat: { flex: 1, backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.sm, alignItems: 'center', borderWidth: 1 },
  roleStatCount: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  roleStatLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  staffCard: {},
  staffRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  staffInfo: { flex: 1, gap: 2 },
  staffName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  staffEmail: { fontSize: FontSize.sm, color: Colors.textSecondary },
  staffId: { fontSize: FontSize.xs, color: Colors.textMuted },
  staffRight: { alignItems: 'flex-end', gap: 6 },
  roleBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: BorderRadius.full },
  roleText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  activeDot: { width: 8, height: 8, borderRadius: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  modalEmail: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md },
  sectionLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textSecondary, marginTop: Spacing.md, marginBottom: Spacing.sm },
  roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.sm },
  roleOption: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface2 },
  roleOptionActive: { borderColor: Colors.teacher, backgroundColor: Colors.teacherBg },
  roleOptionText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  roleOptionTextActive: { color: Colors.teacher, fontWeight: FontWeight.semibold },
});
