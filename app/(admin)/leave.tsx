import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ScrollView } from 'react-native';
import { useAlert } from '@/template';
import { useAppContext } from '@/hooks/useAppContext';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { getLeaveRequests, approveLeave, LeaveRequest, StaffRecord } from '@/services/hr.service';
import { getStaffRecords } from '@/services/hr.service';

type Filter = 'pending' | 'approved' | 'rejected';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
];

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function LeaveScreen() {
  const { school, profileId } = useAppContext();
  const { showAlert } = useAlert();
  const [allLeave, setAllLeave] = useState<LeaveRequest[]>([]);
  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [filter, setFilter] = useState<Filter>('pending');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!school) return;
    const [leaveRes, staffRes] = await Promise.all([
      getLeaveRequests(school.id),
      getStaffRecords(school.id),
    ]);
    if (leaveRes.error) { showAlert('Error', leaveRes.error); }
    setAllLeave(leaveRes.data || []);
    setStaff(staffRes.data || []);
    setLoading(false);
    setRefreshing(false);
  }, [school]);

  useEffect(() => { load(); }, [school]);

  const handleAction = (leave: LeaveRequest, status: 'approved' | 'rejected') => {
    if (!school || !profileId) return;
    showAlert(status === 'approved' ? 'Approve Leave' : 'Reject Leave', `${status === 'approved' ? 'Approve' : 'Reject'} this leave request?`, [
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

  if (loading) return <LoadingScreen message="Loading leave requests..." />;

  const filtered = allLeave.filter((l) => l.status === filter);

  const staffName = (leave: LeaveRequest) => {
    if (leave.staff_record_id) {
      const match = staff.find((s) => s.id === leave.staff_record_id);
      if (match) return match.full_name;
    }
    return 'Staff Member';
  };

  return (
    <View style={styles.flex}>
      <Header title="Leave Requests" subtitle={school?.name} showBack accentColor={Colors.warning} />
      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {FILTERS.map((f) => {
            const count = allLeave.filter((l) => l.status === f.id).length;
            return (
              <Pressable key={f.id} style={[styles.chip, filter === f.id && styles.chipActive]} onPress={() => setFilter(f.id)}>
                <Text style={[styles.chipText, filter === f.id && styles.chipTextActive]}>{f.label}</Text>
                <View style={[styles.chipCount, filter === f.id ? styles.chipCountActive : styles.chipCountInactive]}>
                  <Text style={[styles.chipCountText, filter === f.id && styles.chipCountTextActive]}>{count}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
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
            icon="beach-access"
            title={`No ${filter.charAt(0).toUpperCase() + filter.slice(1)} Requests`}
            description={filter === 'pending' ? 'When staff submit leave requests, they will appear here for your review.' : `No ${filter} leave requests at this time.`}
          />
        }
        renderItem={({ item: leave }) => (
          <Card>
            <View style={styles.leaveRow}>
              <View style={[styles.leaveIcon, {
                backgroundColor: leave.status === 'approved' ? Colors.successBg : leave.status === 'pending' ? Colors.warningBg : Colors.errorBg,
              }]}>
                <MaterialIcons
                  name={leave.leave_type === 'sick' ? 'sick' : leave.leave_type === 'annual' ? 'event-available' : 'event-busy'}
                  size={18}
                  color={leave.status === 'approved' ? Colors.success : leave.status === 'pending' ? Colors.warning : Colors.error}
                />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{staffName(leave)}</Text>
                  <Badge label={leave.status} variant={leave.status === 'approved' ? 'success' : leave.status === 'pending' ? 'warning' : 'error'} size="sm" />
                </View>
                <Text style={styles.type}>{leave.leave_type.replace(/_/g, ' ')} • {leave.days} day{leave.days === 1 ? '' : 's'}</Text>
                <Text style={styles.range}>{formatDate(leave.start_date)} → {formatDate(leave.end_date)}</Text>
                {leave.reason ? <Text style={styles.reason}>{leave.reason}</Text> : null}
              </View>
            </View>
            {leave.status === 'pending' ? (
              <View style={styles.actions}>
                <Button label="Approve" onPress={() => handleAction(leave, 'approved')} loading={processing === leave.id} variant="primary" size="sm" />
                <Button label="Reject" onPress={() => handleAction(leave, 'rejected')} loading={processing === leave.id} variant="outline" size="sm" />
              </View>
            ) : null}
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  filterRow: { backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  filterScroll: { gap: Spacing.xs },
  chip: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2, borderRadius: BorderRadius.full, backgroundColor: Colors.surface2, marginRight: Spacing.xs },
  chipActive: { backgroundColor: Colors.warningBg, borderWidth: 1, borderColor: Colors.warning },
  chipText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  chipTextActive: { color: Colors.warning },
  chipCount: { paddingHorizontal: 8, paddingVertical: 1, borderRadius: BorderRadius.full, minWidth: 18, alignItems: 'center' },
  chipCountActive: { backgroundColor: Colors.warning },
  chipCountInactive: { backgroundColor: Colors.surface3 },
  chipCountText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textSecondary },
  chipCountTextActive: { color: Colors.textPrimary },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 100 },
  leaveRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, marginBottom: Spacing.sm },
  leaveIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
  name: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary, flex: 1 },
  type: { fontSize: FontSize.xs, color: Colors.textSecondary, textTransform: 'capitalize' },
  range: { fontSize: FontSize.xs, color: Colors.textMuted },
  reason: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4, fontStyle: 'italic' },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
});
