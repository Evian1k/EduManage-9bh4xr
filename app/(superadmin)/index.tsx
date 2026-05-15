import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { useAuth, useAlert } from '@/template';
import { useAppContext } from '@/hooks/useAppContext';
import { getPlatformStats, getAllSchools } from '@/services/platform.service';
import { StatCard } from '@/components/ui/StatCard';
import { Card } from '@/components/ui/Card';
import { Badge, getPlanBadgeVariant } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Header } from '@/components/layout/Header';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { BottomNav } from '@/components/layout/BottomNav';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { formatDate, getPlanLabel } from '@/constants/config';

const SUPER_ADMIN_NAV = [
  { label: 'Dashboard', icon: 'dashboard' as const, route: '/(superadmin)/' },
  { label: 'Schools', icon: 'business' as const, route: '/(superadmin)/schools' },
  { label: 'Revenue', icon: 'attach-money' as const, route: '/(superadmin)/revenue' },
  { label: 'Support', icon: 'support-agent' as const, route: '/(superadmin)/support' },
  { label: 'Announce', icon: 'campaign' as const, route: '/(superadmin)/announcements' },
];

export default function SuperAdminDashboard() {
  const { user, logout } = useAuth();
  const { showAlert } = useAlert();
  const [stats, setStats] = useState<any>(null);
  const [recentSchools, setRecentSchools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [statsRes, schoolsRes] = await Promise.all([getPlatformStats(), getAllSchools()]);
    setStats(statsRes);
    setRecentSchools((schoolsRes.data || []).slice(0, 5));
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, []);

  const handleLogout = () => {
    showAlert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  if (loading) return <LoadingScreen message="Loading platform data..." />;

  return (
    <View style={styles.flex}>
      <Header
        title="Platform Dashboard"
        subtitle="EduManage Control Center"
        accentColor={Colors.superAdmin}
        rightAction={{ icon: 'logout', onPress: handleLogout }}
      />
      <ScreenWrapper refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
        {/* Welcome */}
        <View style={styles.welcomeBanner}>
          <View style={styles.crownBg}>
            <MaterialIcons name="shield" size={24} color={Colors.superAdmin} />
          </View>
          <View>
            <Text style={styles.welcomeTitle}>Platform Owner</Text>
            <Text style={styles.welcomeEmail}>{user?.email}</Text>
          </View>
        </View>

        {/* Stats Grid */}
        <Text style={styles.sectionTitle}>Platform Overview</Text>
        <View style={styles.statsGrid}>
          <StatCard label="Total Schools" value={stats?.totalSchools || 0} icon="business" color={Colors.primary} subtitle={`${stats?.activeSchools || 0} active`} />
          <StatCard label="Total Students" value={stats?.totalStudents || 0} icon="people" color={Colors.secondary} />
        </View>
        <View style={styles.statsGrid}>
          <StatCard label="Total Teachers" value={stats?.totalTeachers || 0} icon="person" color={Colors.teacher} />
          <StatCard label="Open Tickets" value={stats?.openTickets || 0} icon="support-agent" color={Colors.warning} />
        </View>

        {/* Plan Breakdown */}
        <Text style={styles.sectionTitle}>Plan Distribution</Text>
        <Card>
          {[
            { plan: 'free_trial', label: 'Free Trial', color: Colors.textMuted },
            { plan: 'basic', label: 'Basic', color: Colors.success },
            { plan: 'pro', label: 'Pro', color: Colors.primary },
            { plan: 'enterprise', label: 'Enterprise', color: Colors.superAdmin },
          ].map((p) => (
            <View key={p.plan} style={styles.planRow}>
              <View style={[styles.planDot, { backgroundColor: p.color }]} />
              <Text style={styles.planLabel}>{p.label}</Text>
              <Text style={styles.planCount}>{stats?.planBreakdown?.[p.plan] || 0} schools</Text>
            </View>
          ))}
        </Card>

        {/* Recent Schools */}
        <Text style={styles.sectionTitle}>Recent Schools</Text>
        {recentSchools.map((school) => (
          <Card key={school.id} style={styles.schoolCard}>
            <View style={styles.schoolRow}>
              <Avatar name={school.name} size={42} />
              <View style={styles.schoolInfo}>
                <Text style={styles.schoolName}>{school.name}</Text>
                <Text style={styles.schoolSub}>{school.subdomain}.edumanage.com</Text>
                <Text style={styles.schoolDate}>Joined {formatDate(school.created_at)}</Text>
              </View>
              <View style={styles.schoolRight}>
                <Badge label={getPlanLabel(school.plan)} variant={getPlanBadgeVariant(school.plan)} size="sm" />
                <Badge label={school.is_active ? 'Active' : 'Inactive'} variant={school.is_active ? 'success' : 'error'} size="sm" />
              </View>
            </View>
          </Card>
        ))}
      </ScreenWrapper>
      <BottomNav items={SUPER_ADMIN_NAV} accentColor={Colors.superAdmin} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  welcomeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.superAdminBg, padding: Spacing.md,
    borderRadius: BorderRadius.lg, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: `${Colors.superAdmin}30`,
  },
  crownBg: { width: 48, height: 48, borderRadius: 24, backgroundColor: `${Colors.superAdmin}20`, alignItems: 'center', justifyContent: 'center' },
  welcomeTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.superAdmin },
  welcomeEmail: { fontSize: FontSize.sm, color: Colors.textSecondary },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginBottom: Spacing.sm, marginTop: Spacing.md },
  statsGrid: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  planDot: { width: 10, height: 10, borderRadius: 5 },
  planLabel: { flex: 1, fontSize: FontSize.base, color: Colors.textPrimary },
  planCount: { fontSize: FontSize.base, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  schoolCard: { marginBottom: Spacing.sm },
  schoolRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  schoolInfo: { flex: 1 },
  schoolName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  schoolSub: { fontSize: FontSize.sm, color: Colors.textSecondary },
  schoolDate: { fontSize: FontSize.xs, color: Colors.textMuted },
  schoolRight: { alignItems: 'flex-end', gap: 4 },
});
