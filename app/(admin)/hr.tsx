import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAlert } from '@/template';
import { useAppContext } from '@/hooks/useAppContext';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { getStaffRecords, getLeaveRequests, approveLeave, LeaveRequest, StaffRecord } from '@/services/hr.service';
import { getSupabaseClient } from '@/template';

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function HrScreen() {
  const { school, profileId } = useAppContext();
  const router = useRouter();
  const { showAlert } = useAlert();
  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!school) return;
    const supabase = getSupabaseClient();
    const [staffRes, leaveRes, perfRes] = await Promise.all([
      getStaffRecords(school.id),
      getLeaveRequests(school.id),
      supabase.from('performance_reviews').select('id, reviewed_at', { count: 'exact', head: true }).eq('school_id', school.id).gte('reviewed_at', new Date(Date.now() - 90 * 86400000).toISOString()),
    ]);
    setStaff(staffRes.data || []);
    // Sort leave requests to put pending first
    const all = (leaveRes.data || []) as LeaveRequest[];
    all.sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (b.status === 'pending' && a.status !== 'pending') return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    setLeaveRequests(all.slice(0, 10));
    setLoading(false);
    setRefreshing(false);
  }, [school]);

  useEffect(() => { load(); }, [school]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const handleApprove = (leave: LeaveRequest, status: 'approved' | 'rejected') => {
    if (!school || !profileId) return;
    showAlert(status === 'approved' ? 'Approve Leave' : 'Reject Leave', `Are you sure you want to ${status === 'approved' ? 'approve' : 'reject'} this leave request?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: status === 'approved' ? 'Approve' : 'Reject',
        style: status === 'approved' ? 'default' : 'destructive',
        onPress: async () => {
          setProcessing(leave.id);
          const { error } = await approveLeave(school.id, leave.id, profileId, status);
          setProcessing(null);
          if (error) { showAlert('Error', error); return; }
          showAlert('Done', `Leave request ${status}.`);
          load();
        },
      },
    ]);
  };

  if (loading) return <LoadingScreen message="Loading HR dashboard..." />;

  const totalStaff = staff.length;
  const onLeave = staff.filter((s) => s.status === 'on_leave').length;
  const active = staff.filter((s) => s.status === 'active').length;
  const pendingLeave = leaveRequests.filter((l) => l.status === 'pending').length;

  const quickActions = [
    { label: 'Payroll', icon: 'payments' as const, color: Colors.success, route: '/(admin)/payroll' },
    { label: 'Leave', icon: 'beach-access' as const, color: Colors.warning, route: '/(admin)/leave' },
    { label: 'Directory', icon: 'badge' as const, color: Colors.primary, route: '/(admin)/staff' },
    { label: 'Invite', icon: 'person-add' as const, color: Colors.teacher, route: '/(admin)/invitations' },
  ];

  return (
    <View style={styles.flex}>
      <Header title="HR Dashboard" subtitle={school?.name} showBack accentColor={Colors.primary} />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={undefined}
      >
        {/* StatCards */}
        <View style={styles.statsRow}>
          <StatCard label="Total Staff" value={totalStaff} icon="badge" color={Colors.primary} />
          <StatCard label="Active" value={active} icon="check-circle" color={Colors.success} />
        </View>
        <View style={styles.statsRow}>
          <StatCard label="On Leave" value={onLeave} icon="beach-access" color={Colors.warning} />
          <StatCard label="Pending Leave" value={pendingLeave} icon="pending-actions" color={Colors.error} />
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionGrid}>
          {quickActions.map((a) => (
            <Pressable key={a.label} style={styles.actionCard} onPress={() => router.push(a.route as any)}>
              <View style={[styles.actionIcon, { backgroundColor: `${a.color}18` }]}>
                <MaterialIcons name={a.icon} size={22} color={a.color} />
              </View>
              <Text style={styles.actionLabel}>{a.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Recent Leave Requests */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Leave Requests</Text>
          {leaveRequests.length > 0 ? (
            <Pressable onPress={() => router.push('/(admin)/leave')}>
              <Text style={styles.viewAll}>View All</Text>
            </Pressable>
          ) : null}
        </View>
        {leaveRequests.length === 0 ? (
          <Card>
            <EmptyState icon="beach-access" title="No Leave Requests" description="Leave requests from staff will appear here." />
          </Card>
        ) : (
          leaveRequests.map((lr) => {
            const staffName = staff.find((s) => s.id === lr.staff_record_id)?.full_name || 'Staff Member';
            return (
              <Card key={lr.id}>
                <View style={styles.leaveRow}>
                  <View style={[styles.leaveIcon, { backgroundColor: lr.status === 'approved' ? Colors.successBg : lr.status === 'pending' ? Colors.warningBg : Colors.errorBg }]}>
                    <MaterialIcons name="event-busy" size={18} color={lr.status === 'approved' ? Colors.success : lr.status === 'pending' ? Colors.warning : Colors.error} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.leaveName}>{staffName}</Text>
                    <Text style={styles.leaveType}>{lr.leave_type.replace(/_/g, ' ')} • {lr.days} day{lr.days === 1 ? '' : 's'}</Text>
                    <Text style={styles.leaveRange}>{formatDate(lr.start_date)} → {formatDate(lr.end_date)}</Text>
                    {lr.reason ? <Text style={styles.leaveReason} numberOfLines={2}>{lr.reason}</Text> : null}
                  </View>
                  <Badge label={lr.status} variant={lr.status === 'approved' ? 'success' : lr.status === 'pending' ? 'warning' : 'error'} size="sm" />
                </View>
                {lr.status === 'pending' ? (
                  <View style={styles.leaveActions}>
                    <Button label="Approve" onPress={() => handleApprove(lr, 'approved')} loading={processing === lr.id} size="sm" variant="primary" />
                    <Button label="Reject" onPress={() => handleApprove(lr, 'rejected')} loading={processing === lr.id} size="sm" variant="outline" />
                  </View>
                ) : null}
              </Card>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl, gap: Spacing.sm },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.sm, marginBottom: Spacing.xs },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginBottom: Spacing.xs },
  viewAll: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semibold },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.sm },
  actionCard: { width: '48%', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, alignItems: 'center', gap: Spacing.sm, borderWidth: 1, borderColor: Colors.border, flexGrow: 1 },
  actionIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.semibold },
  leaveRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, marginBottom: Spacing.sm },
  leaveIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  leaveName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  leaveType: { fontSize: FontSize.xs, color: Colors.textSecondary, textTransform: 'capitalize' },
  leaveRange: { fontSize: FontSize.xs, color: Colors.textMuted },
  leaveReason: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 4, fontStyle: 'italic' },
  leaveActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
});
