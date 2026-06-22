import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList } from 'react-native';
import { BottomNav } from '@/components/layout/BottomNav';

const ADMIN_NAV = [
  { label: 'Dashboard', icon: 'dashboard' as const, route: '/(admin)/' },
  { label: 'Students', icon: 'people' as const, route: '/(admin)/students' },
  { label: 'Staff', icon: 'badge' as const, route: '/(admin)/teachers' },
  { label: 'Finance', icon: 'account-balance' as const, route: '/(admin)/finance' },
  { label: 'More', icon: 'grid-view' as const, route: '/(admin)/classes' },
];
import { useAuth, useAlert } from '@/template';
import { useAppContext } from '@/hooks/useAppContext';
import { getSchoolStats } from '@/services/school.service';
import { getSchoolAnnouncements } from '@/services/school.service';
import { StatCard } from '@/components/ui/StatCard';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Header } from '@/components/layout/Header';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { formatDate, getPlanLabel } from '@/constants/config';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const { showAlert } = useAlert();
  const { school, schoolUser } = useAppContext();
  const [stats, setStats] = useState<any>(null);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!school) return;
    const [statsRes, annRes] = await Promise.all([
      getSchoolStats(school.id),
      getSchoolAnnouncements(school.id),
    ]);
    setStats(statsRes);
    setAnnouncements((annRes.data || []).slice(0, 3));
    setLoading(false);
    setRefreshing(false);
  }, [school]);

  useEffect(() => { load(); }, [school]);

  const handleLogout = () => {
    showAlert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  if (loading) return <LoadingScreen message="Loading dashboard..." />;

  const planDaysLeft = school?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(school.trial_ends_at).getTime() - Date.now()) / 86400000))
    : 0;

  return (
    <View style={styles.flex}>
      <Header
        title={school?.name || 'School Dashboard'}
        subtitle={`${getPlanLabel(school?.plan || 'free_trial')} Plan`}
        accentColor={Colors.primary}
        rightAction={{ icon: 'logout', onPress: handleLogout }}
      />
      <ScreenWrapper refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
        {/* Plan Banner */}
        {school?.plan === 'free_trial' ? (
          <View style={styles.trialBanner}>
            <MaterialIcons name="access-time" size={20} color={Colors.warning} />
            <Text style={styles.trialText}>Free Trial: {planDaysLeft} days remaining</Text>
            <Text style={styles.upgradeLink}>Upgrade</Text>
          </View>
        ) : null}

        {/* Welcome */}
        <View style={styles.welcome}>
          <View style={styles.welcomeIcon}>
            <MaterialIcons name="admin-panel-settings" size={24} color={Colors.primary} />
          </View>
          <View>
            <Text style={styles.welcomeName}>Welcome, {user?.username || 'Admin'}</Text>
            <Text style={styles.welcomeRole}>School Administrator</Text>
          </View>
        </View>

        {/* Stats */}
        <Text style={styles.sectionTitle}>School Overview</Text>
        <View style={styles.statsRow}>
          <StatCard label="Students" value={stats?.totalStudents || 0} icon="people" color={Colors.primary} subtitle={`${stats?.activeStudents || 0} active`} />
          <StatCard label="Teachers" value={stats?.totalTeachers || 0} icon="person" color={Colors.teacher} />
        </View>
        <View style={styles.statsRow}>
          <StatCard label="Classes" value={stats?.totalClasses || 0} icon="class" color={Colors.secondary} />
          <StatCard label="Assignments" value={stats?.totalAssignments || 0} icon="assignment" color={Colors.warning} />
        </View>

        {/* Capacity */}
        {school ? (
          <>
            <Text style={styles.sectionTitle}>Plan Capacity</Text>
            <Card>
              <View style={styles.capacityRow}>
                <Text style={styles.capacityLabel}>Students</Text>
                <Text style={styles.capacityVal}>{stats?.totalStudents || 0} / {school.max_students}</Text>
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${Math.min(100, ((stats?.totalStudents || 0) / school.max_students) * 100)}%`, backgroundColor: Colors.primary }]} />
              </View>
              <View style={[styles.capacityRow, { marginTop: Spacing.sm }]}>
                <Text style={styles.capacityLabel}>Teachers</Text>
                <Text style={styles.capacityVal}>{stats?.totalTeachers || 0} / {school.max_teachers}</Text>
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${Math.min(100, ((stats?.totalTeachers || 0) / school.max_teachers) * 100)}%`, backgroundColor: Colors.teacher }]} />
              </View>
              <View style={[styles.capacityRow, { marginTop: Spacing.sm }]}>
                <Text style={styles.capacityLabel}>AI Usage</Text>
                <Text style={styles.capacityVal}>{school.ai_usage_count} / {school.ai_usage_limit}</Text>
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${Math.min(100, (school.ai_usage_count / school.ai_usage_limit) * 100)}%`, backgroundColor: Colors.secondary }]} />
              </View>
            </Card>
          </>
        ) : null}

        {/* Announcements */}
        {announcements.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Recent Announcements</Text>
            {announcements.map((a) => (
              <Card key={a.id} style={styles.announcementCard}>
                <View style={styles.announcementRow}>
                  {a.is_platform_wide ? <MaterialIcons name="public" size={16} color={Colors.superAdmin} /> : <MaterialIcons name="campaign" size={16} color={Colors.primary} />}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.announcementTitle}>{a.title}</Text>
                    <Text style={styles.announcementContent} numberOfLines={2}>{a.content}</Text>
                    <Text style={styles.announcementDate}>{formatDate(a.created_at)}</Text>
                  </View>
                </View>
              </Card>
            ))}
          </>
        ) : null}
      </ScreenWrapper>
      <BottomNav items={ADMIN_NAV} accentColor={Colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  trialBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.warningBg, padding: Spacing.md, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: `${Colors.warning}30`, marginBottom: Spacing.sm,
  },
  trialText: { flex: 1, fontSize: FontSize.sm, color: Colors.warning, fontWeight: FontWeight.medium },
  upgradeLink: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.semibold },
  welcome: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
  welcomeIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.schoolAdminBg, alignItems: 'center', justifyContent: 'center' },
  welcomeName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  welcomeRole: { fontSize: FontSize.sm, color: Colors.textSecondary },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginBottom: Spacing.sm, marginTop: Spacing.sm },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  capacityRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  capacityLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  capacityVal: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  progressBar: { height: 8, backgroundColor: Colors.surface2, borderRadius: 4, overflow: 'hidden', marginTop: 6 },
  progressFill: { height: '100%', borderRadius: 4 },
  announcementCard: { marginBottom: Spacing.xs },
  announcementRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  announcementTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  announcementContent: { fontSize: FontSize.sm, color: Colors.textSecondary },
  announcementDate: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
});
