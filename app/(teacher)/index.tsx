import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useAuth, useAlert } from '@/template';
import { useAppContext } from '@/hooks/useAppContext';
import { getTeacherDashboardStats } from '@/services/teacher.service';
import { getTeacherClasses } from '@/services/class.service';
import { getAssignments } from '@/services/assignment.service';
import { BottomNav } from '@/components/layout/BottomNav';

const TEACHER_NAV = [
  { label: 'Home', icon: 'home' as const, route: '/(teacher)/' },
  { label: 'Assignments', icon: 'assignment' as const, route: '/(teacher)/assignments' },
  { label: 'Grades', icon: 'grade' as const, route: '/(teacher)/grades' },
  { label: 'Attendance', icon: 'fact-check' as const, route: '/(teacher)/attendance' },
  { label: 'AI', icon: 'auto-awesome' as const, route: '/(teacher)/ai-assistant' },
];
import { StatCard } from '@/components/ui/StatCard';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Header } from '@/components/layout/Header';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { formatDate } from '@/constants/config';

export default function TeacherHome() {
  const { user, logout } = useAuth();
  const { showAlert } = useAlert();
  const { school, schoolUser } = useAppContext();
  const [stats, setStats] = useState<any>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [recentAssignments, setRecentAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!school || !schoolUser) return;
    const [statsRes, classesRes, assignRes] = await Promise.all([
      getTeacherDashboardStats(schoolUser.id, school.id),
      getTeacherClasses(schoolUser.id),
      getAssignments(school.id, schoolUser.id),
    ]);
    setStats(statsRes);
    const uniqueClasses = Array.from(
      new Map((classesRes.data || []).map((cs: any) => [cs.classes?.id, cs.classes])).values()
    ).filter(Boolean);
    setClasses(uniqueClasses.slice(0, 4) as any[]);
    setRecentAssignments((assignRes.data || []).slice(0, 3));
    setLoading(false);
    setRefreshing(false);
  }, [school, schoolUser]);

  useEffect(() => { load(); }, [school, schoolUser]);

  const handleLogout = () => {
    showAlert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  if (loading) return <LoadingScreen message="Loading teacher dashboard..." />;

  return (
    <View style={styles.flex}>
      <Header
        title={school?.name || 'Teacher Portal'}
        subtitle="Teacher Dashboard"
        accentColor={Colors.teacher}
        rightAction={{ icon: 'logout', onPress: handleLogout }}
      />
      <ScreenWrapper refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
        <View style={styles.welcome}>
          <View style={styles.welcomeIcon}>
            <MaterialIcons name="person" size={24} color={Colors.teacher} />
          </View>
          <View>
            <Text style={styles.welcomeName}>Hello, {user?.username || 'Teacher'}</Text>
            <Text style={styles.welcomeRole}>Teacher • {school?.name}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Your Overview</Text>
        <View style={styles.statsRow}>
          <StatCard label="My Classes" value={stats?.totalClasses || 0} icon="class" color={Colors.teacher} />
          <StatCard label="Students" value={stats?.totalStudents || 0} icon="people" color={Colors.primary} />
        </View>
        <View style={styles.statsRow}>
          <StatCard label="Assignments" value={stats?.totalAssignments || 0} icon="assignment" color={Colors.warning} />
          <StatCard label="Pending Grading" value={stats?.pendingGrading || 0} icon="grading" color={Colors.error} />
        </View>

        {classes.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>My Classes</Text>
            <View style={styles.classGrid}>
              {classes.map((cls: any, i: number) => {
                const colors = [Colors.teacher, Colors.primary, Colors.secondary, Colors.success];
                const color = colors[i % colors.length];
                return (
                  <View key={cls?.id || i} style={[styles.classCard, { borderLeftColor: color }]}>
                    <Text style={styles.className}>{cls?.name}</Text>
                    <Text style={styles.classGrade}>Grade {cls?.grade_level} • {cls?.section}</Text>
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        {recentAssignments.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Recent Assignments</Text>
            {recentAssignments.map((a) => (
              <Card key={a.id} style={styles.assignCard}>
                <View style={styles.assignRow}>
                  <View style={styles.assignIcon}>
                    <MaterialIcons name="assignment" size={18} color={Colors.warning} />
                  </View>
                  <View style={styles.assignInfo}>
                    <Text style={styles.assignTitle}>{a.title}</Text>
                    <Text style={styles.assignSub}>{a.classes?.name} • {a.subjects?.name}</Text>
                    {a.due_date ? <Text style={styles.assignDue}>Due: {formatDate(a.due_date)}</Text> : null}
                  </View>
                  <Badge label={a.is_published ? 'Published' : 'Draft'} variant={a.is_published ? 'success' : 'default'} size="sm" />
                </View>
              </Card>
            ))}
          </>
        ) : null}
      </ScreenWrapper>
      <BottomNav items={TEACHER_NAV} accentColor={Colors.teacher} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  welcome: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
  welcomeIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.teacherBg, alignItems: 'center', justifyContent: 'center' },
  welcomeName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  welcomeRole: { fontSize: FontSize.sm, color: Colors.textSecondary },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginBottom: Spacing.sm, marginTop: Spacing.sm },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  classGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  classCard: {
    flex: 1, minWidth: '45%', backgroundColor: Colors.surface, borderRadius: BorderRadius.md,
    padding: Spacing.md, borderLeftWidth: 4, borderWidth: 1, borderColor: Colors.border,
  },
  className: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  classGrade: { fontSize: FontSize.xs, color: Colors.textSecondary },
  assignCard: {},
  assignRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  assignIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.warningBg, alignItems: 'center', justifyContent: 'center' },
  assignInfo: { flex: 1 },
  assignTitle: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  assignSub: { fontSize: FontSize.sm, color: Colors.textSecondary },
  assignDue: { fontSize: FontSize.xs, color: Colors.textMuted },
});
