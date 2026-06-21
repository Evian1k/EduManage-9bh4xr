// ICT: User management — search, filter chips (All/Active/Suspended), FlatList with avatar/email/role/MFA/email-verified icons + suspend/activate toggle
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, TextInput, RefreshControl,
} from 'react-native';
import { useAppContext } from '@/hooks/useAppContext';
import { useAlert } from '@/template';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { getSupabaseClient } from '@/template';

interface SchoolUserRow {
  id: string;
  user_id: string;
  role: string;
  is_active: boolean;
  created_at: string;
  user_profiles: { id: string; email: string; full_name?: string; username?: string; email_verified?: boolean; mfa_enabled?: boolean } | null;
}

type Filter = 'all' | 'active' | 'suspended';

const roleVariant = (role: string) => {
  const r = (role || '').toLowerCase();
  if (r.includes('admin') || r.includes('owner') || r.includes('principal')) return 'gold' as const;
  if (r.includes('teacher')) return 'info' as const;
  if (r.includes('student')) return 'primary' as const;
  return 'default' as const;
};

export default function ICTUsersScreen() {
  const { showAlert } = useAlert();
  const { school } = useAppContext();
  const schoolId = school?.id;
  const [users, setUsers] = useState<SchoolUserRow[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!schoolId) return;
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('school_users')
      .select('id, user_id, role, is_active, created_at, user_profiles(id, email, full_name, username, email_verified, mfa_enabled)')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false });
    if (error) showAlert('Error', error.message);
    setUsers((data || []) as unknown as SchoolUserRow[]);
    setLoading(false);
    setRefreshing(false);
  }, [schoolId]);

  useEffect(() => { if (schoolId) load(); }, [schoolId]);

  const handleToggle = (u: SchoolUserRow) => {
    const action = u.is_active ? 'Suspend' : 'Activate';
    const name = u.user_profiles?.full_name || u.user_profiles?.username || u.user_profiles?.email || 'this user';
    showAlert(`${action} User`, `${action} ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: action, style: u.is_active ? 'destructive' : undefined, onPress: async () => {
        const supabase = getSupabaseClient();
        await supabase.from('school_users').update({ is_active: !u.is_active }).eq('id', u.id);
        load();
      } },
    ]);
  };

  if (!schoolId) return <LoadingScreen />;
  if (loading) return <LoadingScreen message="Loading users..." />;

  const filtered = users.filter((u) => {
    if (filter === 'active' && !u.is_active) return false;
    if (filter === 'suspended' && u.is_active) return false;
    if (search) {
      const q = search.toLowerCase();
      const prof = u.user_profiles;
      return (prof?.email || '').toLowerCase().includes(q) ||
        (prof?.full_name || '').toLowerCase().includes(q) ||
        (prof?.username || '').toLowerCase().includes(q) ||
        (u.role || '').toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <View style={s.flex}>
      <Header title="User Management" subtitle={`${users.length} users`} showBack accentColor="#7B1FA2" />
      <View style={s.searchBox}>
        <MaterialIcons name="search" size={18} color={Colors.textMuted} />
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, email, role..."
          placeholderTextColor={Colors.textMuted}
        />
        {search ? (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <MaterialIcons name="close" size={18} color={Colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      <View style={s.filterRow}>
        {(['all', 'active', 'suspended'] as Filter[]).map((f) => (
          <Pressable key={f} style={[s.chip, filter === f && s.chipActive]} onPress={() => setFilter(f)}>
            <Text style={[s.chipText, filter === f && s.chipTextActive]}>{f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}</Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} colors={[Colors.primary]} />}
        ListEmptyComponent={<EmptyState icon="manage-accounts" title="No Users Found" description={search ? 'Try a different search term.' : 'No users in this school yet.'} />}
        renderItem={({ item }) => {
          const prof = item.user_profiles;
          const name = prof?.full_name || prof?.username || prof?.email?.split('@')[0] || 'Unknown';
          return (
            <Card style={s.card}>
              <View style={s.row}>
                <Avatar name={name} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={s.name} numberOfLines={1}>{name}</Text>
                  <Text style={s.email} numberOfLines={1}>{prof?.email || '—'}</Text>
                  <View style={s.badgeRow}>
                    <Badge label={item.role} variant={roleVariant(item.role)} size="sm" />
                    <Badge label={item.is_active ? 'Active' : 'Suspended'} variant={item.is_active ? 'success' : 'error'} size="sm" />
                  </View>
                </View>
                <View style={s.icons}>
                  {prof?.email_verified ? (
                    <MaterialIcons name="verified" size={16} color={Colors.success} />
                  ) : (
                    <MaterialIcons name="gpp-bad" size={16} color={Colors.textMuted} />
                  )}
                  {prof?.mfa_enabled ? (
                    <MaterialIcons name="lock" size={16} color={Colors.primary} />
                  ) : (
                    <MaterialIcons name="lock-open" size={16} color={Colors.textMuted} />
                  )}
                </View>
              </View>
              <View style={s.actionRow}>
                <Pressable
                  style={[s.toggleBtn, { backgroundColor: item.is_active ? Colors.errorBg : Colors.successBg }]}
                  onPress={() => handleToggle(item)}
                >
                  <MaterialIcons name={item.is_active ? 'block' : 'check-circle'} size={16} color={item.is_active ? Colors.error : Colors.success} />
                  <Text style={[s.toggleText, { color: item.is_active ? Colors.error : Colors.success }]}>
                    {item.is_active ? 'Suspend' : 'Activate'}
                  </Text>
                </Pressable>
              </View>
            </Card>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.sm, borderWidth: 1, borderColor: Colors.border, margin: Spacing.md, marginBottom: 0 },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: FontSize.base },
  filterRow: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.md, paddingBottom: 0 },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: '#7B1FA2', borderColor: '#7B1FA2' },
  chipText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  chipTextActive: { color: Colors.textPrimary, fontWeight: FontWeight.semibold },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 100 },
  card: { gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  name: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  email: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  icons: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  toggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2, borderRadius: BorderRadius.sm },
  toggleText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
});
