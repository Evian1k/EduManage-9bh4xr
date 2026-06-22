import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { useAlert } from '@/template';
import { useAppContext } from '@/hooks/useAppContext';
import { getSupabaseClient } from '@/template';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { getStaffRecords, StaffRecord } from '@/services/hr.service';

interface StaffRow extends StaffRecord {
  user_profiles?: { full_name?: string; email?: string } | null;
}

export default function StaffScreen() {
  const { school } = useAppContext();
  const router = useRouter();
  const { showAlert } = useAlert();
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [filtered, setFiltered] = useState<StaffRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!school) return;
    // Pull both staff_records (HR-managed) and school_users (membership roll)
    // then fetch user_profiles for any school_user lacking a staff_record.
    const supabase = getSupabaseClient();
    const [hrRes, suRes] = await Promise.all([
      getStaffRecords(school.id),
      supabase
        .from('school_users')
        .select('id, role, is_active, user_id')
        .eq('school_id', school.id)
        .order('joined_at', { ascending: false }),
    ]);

    if (hrRes.error) {
      showAlert('Error', hrRes.error);
    }
    const hrStaff = (hrRes.data || []) as StaffRow[];
    const suRows = (suRes.data || []) as Array<{
      id: string;
      role: string;
      is_active: boolean;
      user_id: string;
    }>;

    // Look up user_profiles for any school_user that has no matching staff_record
    const hrUserIds = new Set(hrStaff.filter((h) => h.user_id).map((h) => h.user_id));
    const orphanUserIds = suRows.filter((su) => !hrUserIds.has(su.user_id)).map((su) => su.user_id);
    let profileMap: Record<string, { full_name?: string; email?: string }> = {};
    if (orphanUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, full_name, email')
        .in('id', orphanUserIds);
      profileMap = (profiles || []).reduce((acc, p: any) => {
        acc[p.id] = { full_name: p.full_name, email: p.email };
        return acc;
      }, {} as Record<string, { full_name?: string; email?: string }>);
    }

    const merged: StaffRow[] = suRows.map((su) => {
      const match = hrStaff.find((h) => h.user_id === su.user_id);
      if (match) {
        return { ...match, user_profiles: profileMap[su.user_id] || null };
      }
      const profile = profileMap[su.user_id];
      return {
        id: su.id,
        school_id: school.id,
        user_id: su.user_id,
        employee_number: '—',
        full_name: profile?.full_name || profile?.email || 'Unknown Member',
        role: su.role,
        employment_date: new Date().toISOString(),
        basic_salary: 0,
        allowances: 0,
        deductions: 0,
        status: su.is_active ? 'active' : 'inactive',
        email: profile?.email,
        user_profiles: profile || null,
      } as StaffRow;
    });
    setStaff(merged);
    setFiltered(merged);
    setLoading(false);
    setRefreshing(false);
  }, [school]);

  useEffect(() => { load(); }, [school]);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(!q ? staff : staff.filter((s) => `${s.full_name} ${s.email || ''} ${s.role} ${s.department || ''} ${s.position || ''}`.toLowerCase().includes(q)));
  }, [search, staff]);

  if (loading) return <LoadingScreen message="Loading staff..." />;

  return (
    <View style={styles.flex}>
      <Header
        title="Staff"
        subtitle={`${staff.length} members`}
        showBack
        accentColor={Colors.primary}
        rightAction={{ icon: 'person-add', onPress: () => router.push('/(admin)/invitations') }}
      />
      <View style={styles.searchBar}>
        <Input value={search} onChangeText={setSearch} placeholder="Search staff by name, role, email..." leftIcon="search" />
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
            title="No Staff Found"
            description="Invite staff members to populate your directory."
            actionLabel="Invite Staff"
            onAction={() => router.push('/(admin)/invitations')}
          />
        }
        renderItem={({ item }) => (
          <Card>
            <View style={styles.row}>
              <Avatar name={item.full_name || item.email || 'U'} size={44} />
              <View style={styles.info}>
                <Text style={styles.name}>{item.full_name || item.email}</Text>
                {item.email ? <Text style={styles.email}>{item.email}</Text> : null}
                <View style={styles.metaRow}>
                  <Badge label={item.role.replace(/_/g, ' ')} variant="primary" size="sm" />
                  {item.department ? <Text style={styles.meta}>• {item.department}</Text> : null}
                </View>
              </View>
              <View style={styles.statusWrap}>
                {item.status === 'active' ? (
                  <View style={styles.statusDotWrap}>
                    <View style={[styles.statusDot, { backgroundColor: Colors.success }]} />
                    <Text style={[styles.statusText, { color: Colors.success }]}>Active</Text>
                  </View>
                ) : (
                  <View style={styles.statusDotWrap}>
                    <View style={[styles.statusDot, { backgroundColor: Colors.textMuted }]} />
                    <Text style={[styles.statusText, { color: Colors.textMuted }]}>{item.status}</Text>
                  </View>
                )}
                {item.position ? <Text style={styles.position} numberOfLines={1}>{item.position}</Text> : null}
              </View>
            </View>
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  searchBar: { padding: Spacing.md, paddingBottom: 0 },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 100 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  info: { flex: 1, gap: 2 },
  name: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  email: { fontSize: FontSize.xs, color: Colors.textMuted },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, flexWrap: 'wrap' },
  meta: { fontSize: FontSize.xs, color: Colors.textSecondary },
  statusWrap: { alignItems: 'flex-end', gap: 4, minWidth: 80 },
  statusDotWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, textTransform: 'capitalize' },
  position: { fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'right' },
});
