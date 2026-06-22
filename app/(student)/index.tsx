import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useAuth, useAlert } from '@/template';
import { useAppContext } from '@/hooks/useAppContext';
import { getStudentAttendanceSummary } from '@/services/attendance.service';
import { getStudentGrades } from '@/services/student.service';
import { getSchoolAnnouncements } from '@/services/school.service';
import { BottomNav } from '@/components/layout/BottomNav';

const STUDENT_NAV = [
  { label: 'Home', icon: 'home' as const, route: '/(student)/' },
  { label: 'Assignments', icon: 'assignment' as const, route: '/(student)/assignments' },
  { label: 'Grades', icon: 'grade' as const, route: '/(student)/grades' },
  { label: 'AI Tutor', icon: 'auto-awesome' as const, route: '/(student)/ai-assistant' },
];
import { StatCard } from '@/components/ui/StatCard';
import { Card } from '@/components/ui/Card';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Header } from '@/components/layout/Header';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { formatDate, getGradeLetter } from '@/constants/config';

export default function StudentHome() {
  const { user, logout } = useAuth();
  const { showAlert } = useAlert();
  const { school, studentProfile } = useAppContext();
  const [grades, setGrades] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any>(null);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!studentProfile || !school) return;
    const promises: Promise<any>[] = [
      getStudentGrades(studentProfile.id),
      getSchoolAnnouncements(school.id),
    ];
    if (studentProfile.class_id) {
      promises.push(getStudentAttendanceSummary(studentProfile.id, studentProfile.class_id));
    }
    const [gradesRes, annRes, attRes] = await Promise.all(promises);
    setGrades(gradesRes?.data || []);
    setAnnouncements((annRes?.data || []).slice(0, 3));
    if (attRes) setAttendance(attRes.summary);
    setLoading(false);
    setRefreshing(false);
  }, [studentProfile, school]);

  useEffect(() => { load(); }, [studentProfile, school]);

  const handleLogout = () => {
    showAlert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  if (loading) return <LoadingScreen message="Loading your dashboard..." />;

  const avgScore = grades.length > 0
    ? Math.round(grades.reduce((s, g) => s + (g.score || 0), 0) / grades.length)
    : 0;
  const { letter: avgGrade } = getGradeLetter(avgScore);

  return (
    <View style={styles.flex}>
      <Header
        title={school?.name || 'Student Portal'}
        subtitle="Student Dashboard"
        accentColor={Colors.student}
        rightAction={{ icon: 'logout', onPress: handleLogout }}
      />
      <ScreenWrapper refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileInitials}>
              {(studentProfile?.first_name?.[0] || '') + (studentProfile?.last_name?.[0] || '')}
            </Text>
          </View>
          <View>
            <Text style={styles.profileName}>{studentProfile?.first_name} {studentProfile?.last_name}</Text>
            <Text style={styles.profileId}>{studentProfile?.admission_number}</Text>
            <Text style={styles.profileSchool}>{school?.name}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Academic Summary</Text>
        <View style={styles.statsRow}>
          <StatCard label="Avg Score" value={`${avgScore}%`} icon="grade" color={Colors.student} subtitle={`Grade ${avgGrade}`} />
          <StatCard label="Subjects" value={grades.length} icon="book" color={Colors.primary} />
        </View>
        {attendance ? (
          <View style={styles.statsRow}>
            <StatCard label="Attendance" value={`${attendance.percentage}%`} icon="fact-check" color={Colors.success} subtitle={`${attendance.present}/${attendance.total} days`} />
            <StatCard label="Absences" value={attendance.absent} icon="cancel" color={Colors.error} />
          </View>
        ) : null}

        {/* Recent grades */}
        {grades.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Recent Grades</Text>
            {grades.slice(0, 4).map((g) => {
              const { letter } = getGradeLetter(g.score || 0);
              const gradeColor = g.score >= 70 ? Colors.success : g.score >= 50 ? Colors.warning : Colors.error;
              return (
                <Card key={g.id} style={styles.gradeCard}>
                  <View style={styles.gradeRow}>
                    <View>
                      <Text style={styles.gradeSubject}>{g.subjects?.name}</Text>
                      <Text style={styles.gradeTerm}>{g.term} • {g.academic_year}</Text>
                    </View>
                    <View style={styles.gradeScoreBox}>
                      <Text style={[styles.gradeScore, { color: gradeColor }]}>{g.score}</Text>
                      <Text style={[styles.gradeLetter, { color: gradeColor }]}>{letter}</Text>
                    </View>
                  </View>
                </Card>
              );
            })}
          </>
        ) : null}

        {/* Announcements */}
        {announcements.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Announcements</Text>
            {announcements.map((a) => (
              <Card key={a.id} style={styles.announcementCard}>
                <View style={styles.announcementRow}>
                  <MaterialIcons name={a.is_platform_wide ? 'public' : 'campaign'} size={16} color={a.is_platform_wide ? Colors.superAdmin : Colors.primary} />
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
      <BottomNav items={STUDENT_NAV} accentColor={Colors.student} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.studentBg, padding: Spacing.md,
    borderRadius: BorderRadius.lg, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: `${Colors.student}30`,
  },
  profileAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.student, alignItems: 'center', justifyContent: 'center' },
  profileInitials: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  profileName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  profileId: { fontSize: FontSize.sm, color: Colors.textSecondary },
  profileSchool: { fontSize: FontSize.xs, color: Colors.textMuted },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginBottom: Spacing.sm, marginTop: Spacing.sm },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  gradeCard: {},
  gradeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  gradeSubject: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  gradeTerm: { fontSize: FontSize.xs, color: Colors.textMuted },
  gradeScoreBox: { alignItems: 'center' },
  gradeScore: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold },
  gradeLetter: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  announcementCard: {},
  announcementRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  announcementTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  announcementContent: { fontSize: FontSize.sm, color: Colors.textSecondary },
  announcementDate: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
});
