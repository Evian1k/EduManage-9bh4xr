import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, Pressable, TextInput } from 'react-native';
import { useAuth, useAlert } from '@/template';
import { useAppContext } from '@/hooks/useAppContext';
import { BottomNav } from '@/components/layout/BottomNav';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { getSupabaseClient } from '@/template';

const NAV = [
  { label: 'Dashboard', icon: 'dashboard' as const, route: '/(ict)/' },
  { label: 'Users', icon: 'manage-accounts' as const, route: '/(ict)/users' },
  { label: 'Logs', icon: 'list-alt' as const, route: '/(ict)/logs' },
  { label: 'Settings', icon: 'settings' as const, route: '/(ict)/settings' },
];

export default function ICTDashboard() {
  const { user, logout } = useAuth();
  const { showAlert } = useAlert();
  const { school, schoolUser } = useAppContext();
  const [schoolUsers, setSchoolUsers] = useState<any[]>([]);
  const [aiLogs, setAiLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!school) return;
    const supabase = getSupabaseClient();
    const [usersRes, logsRes] = await Promise.all([
      supabase.from('school_users')
        .select('*, user_profiles(email, username)')
        .eq('school_id', school.id)
        .order('created_at', { ascending: false }),
      supabase.from('ai_usage_logs')
        .select('*')
        .eq('school_id', school.id)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);
    setSchoolUsers(usersRes.data || []);
    setAiLogs(logsRes.data || []);
    setLoading(false);
  }, [school]);

  useEffect(() => { load(); }, [school]);

  const handleToggleUser = async (userId: string, currentStatus: boolean, name: string) => {
    showAlert(
      currentStatus ? 'Deactivate User' : 'Activate User',
      `${currentStatus ? 'Deactivate' : 'Activate'} ${name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: async () => {
          const supabase = getSupabaseClient();
          await supabase.from('school_users').update({ is_active: !currentStatus }).eq('id', userId);
          load();
        }},
      ],
    );
  };

  if (loading) return <LoadingScreen message="Loading ICT dashboard..." />;

  const filtered = schoolUsers.filter(u =>
    !search || u.user_profiles?.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.user_profiles?.username?.toLowerCase().includes(search.toLowerCase()) ||
    u.role?.toLowerCase().includes(search.toLowerCase())
  );

  const roleStats: Record<string, number> = {};
  schoolUsers.forEach(u => { roleStats[u.role] = (roleStats[u.role] || 0) + 1; });
  const aiTotal = aiLogs.reduce((s, l) => s + (l.tokens_used || 0), 0);

  return (
    <View style={s.flex}>
      <Header
        title="ICT Manager"
        subtitle={school?.name}
        accentColor="#7B1FA2"
        rightAction={{ icon: 'logout', onPress: () => showAlert('Sign Out', 'Sign out?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign Out', style: 'destructive', onPress: () => logout() }]) }}
      />
      <ScrollView style={s.flex} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Welcome */}
        <View style={s.welcomeRow}>
          <View style={s.avatar}><MaterialIcons name="computer" size={22} color="#7B1FA2" /></View>
          <View>
            <Text style={s.welcomeName}>{user?.username || 'ICT Manager'}</Text>
            <Text style={s.welcomeRole}>Technical Administration</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={s.statsGrid}>
          <View style={s.statCard}>
            <MaterialIcons name="people" size={20} color="#7B1FA2" />
            <Text style={s.statNum}>{schoolUsers.length}</Text>
            <Text style={s.statLabel}>Total Users</Text>
          </View>
          <View style={s.statCard}>
            <MaterialIcons name="check-circle" size={20} color={Colors.success} />
            <Text style={s.statNum}>{schoolUsers.filter(u => u.is_active).length}</Text>
            <Text style={s.statLabel}>Active</Text>
          </View>
          <View style={s.statCard}>
            <MaterialIcons name="psychology" size={20} color={Colors.secondary} />
            <Text style={s.statNum}>{aiLogs.length}</Text>
            <Text style={s.statLabel}>AI Calls</Text>
          </View>
        </View>

        {/* Role Breakdown */}
        <Text style={s.sectionTitle}>User Roles</Text>
        <Card>
          {Object.entries(roleStats).map(([role, count]) => (
            <View key={role} style={s.roleRow}>
              <Text style={s.roleName}>{role}</Text>
              <Badge label={`${count} users`} variant="default" size="sm" />
            </View>
          ))}
          {Object.keys(roleStats).length === 0 ? (
            <Text style={s.emptyText}>No users found.</Text>
          ) : null}
        </Card>

        {/* AI Usage */}
        <Text style={[s.sectionTitle, { marginTop: Spacing.md }]}>AI Usage (Recent)</Text>
        <Card>
          <View style={s.aiSummaryRow}>
            <View style={s.aiStat}>
              <Text style={s.aiStatNum}>{aiLogs.length}</Text>
              <Text style={s.aiStatLabel}>Total Requests</Text>
            </View>
            <View style={s.aiStat}>
              <Text style={s.aiStatNum}>{aiTotal.toLocaleString()}</Text>
              <Text style={s.aiStatLabel}>Tokens Used</Text>
            </View>
            <View style={s.aiStat}>
              <Text style={s.aiStatNum}>{school?.ai_usage_count}/{school?.ai_usage_limit}</Text>
              <Text style={s.aiStatLabel}>Usage/Limit</Text>
            </View>
          </View>
          {aiLogs.slice(0, 5).map(log => (
            <View key={log.id} style={s.logRow}>
              <MaterialIcons name="psychology" size={14} color={Colors.secondary} />
              <Text style={s.logFeature}>{log.feature}</Text>
              <Text style={s.logTokens}>{log.tokens_used} tokens</Text>
              <Text style={s.logDate}>{new Date(log.created_at).toLocaleDateString()}</Text>
            </View>
          ))}
        </Card>

        {/* User Management */}
        <Text style={[s.sectionTitle, { marginTop: Spacing.md }]}>User Management</Text>
        <View style={s.searchBox}>
          <MaterialIcons name="search" size={18} color={Colors.textMuted} />
          <TextInput
            style={s.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search users..."
            placeholderTextColor={Colors.textMuted}
          />
        </View>
        {filtered.slice(0, 10).map(su => (
          <Card key={su.id} style={s.userCard}>
            <View style={s.userRow}>
              <View style={s.userAvatar}>
                <Text style={s.userInitial}>
                  {(su.user_profiles?.username || su.user_profiles?.email || '?')[0].toUpperCase()}
                </Text>
              </View>
              <View style={s.userInfo}>
                <Text style={s.userName}>{su.user_profiles?.username || 'No name'}</Text>
                <Text style={s.userEmail}>{su.user_profiles?.email}</Text>
                <Badge label={su.role} variant="default" size="sm" />
              </View>
              <Pressable
                style={[s.toggleBtn, { backgroundColor: su.is_active ? Colors.errorBg : Colors.successBg }]}
                onPress={() => handleToggleUser(su.id, su.is_active, su.user_profiles?.username || su.user_profiles?.email)}
              >
                <MaterialIcons name={su.is_active ? 'block' : 'check'} size={16} color={su.is_active ? Colors.error : Colors.success} />
              </Pressable>
            </View>
          </Card>
        ))}
        {filtered.length === 0 && <Card><Text style={s.emptyText}>No users match your search.</Text></Card>}
      </ScrollView>
      <BottomNav items={NAV} accentColor="#7B1FA2" />
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingBottom: 100, gap: Spacing.sm },
  welcomeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.sm },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(123,31,162,0.15)', alignItems: 'center', justifyContent: 'center' },
  welcomeName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  welcomeRole: { fontSize: FontSize.sm, color: Colors.textSecondary },
  statsGrid: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  statCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: Colors.border },
  statNum: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  statLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'center' },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginBottom: Spacing.xs },
  roleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  roleName: { fontSize: FontSize.base, color: Colors.textPrimary, textTransform: 'capitalize' },
  aiSummaryRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: Spacing.md },
  aiStat: { alignItems: 'center', gap: 2 },
  aiStatNum: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  aiStatLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: Colors.border },
  logFeature: { flex: 1, fontSize: FontSize.sm, color: Colors.textPrimary, textTransform: 'capitalize' },
  logTokens: { fontSize: FontSize.xs, color: Colors.secondary },
  logDate: { fontSize: FontSize.xs, color: Colors.textMuted },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.sm, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: FontSize.base },
  userCard: {},
  userRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  userAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface2, alignItems: 'center', justifyContent: 'center' },
  userInitial: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  userInfo: { flex: 1, gap: 3 },
  userName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  userEmail: { fontSize: FontSize.xs, color: Colors.textSecondary },
  toggleBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center', padding: Spacing.sm },
});
