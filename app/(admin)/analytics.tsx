import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useAlert } from '@/template';
import { useAppContext } from '@/hooks/useAppContext';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import {
  getSchoolOverview,
  getFinanceAnalytics,
  getAttendanceAnalytics,
  getAIAnalytics,
  getStudentAnalytics,
  SchoolOverview,
  FinanceAnalytics,
  AttendanceAnalytics,
  AIAnalytics,
  StudentAnalytics,
} from '@/services/analytics.service';

function formatCurrency(amount: number) {
  return `KES ${Number(amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export default function AnalyticsScreen() {
  const { school } = useAppContext();
  const { showAlert } = useAlert();
  const [overview, setOverview] = useState<SchoolOverview | null>(null);
  const [finance, setFinance] = useState<FinanceAnalytics | null>(null);
  const [attendance, setAttendance] = useState<AttendanceAnalytics | null>(null);
  const [ai, setAi] = useState<AIAnalytics | null>(null);
  const [student, setStudent] = useState<StudentAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!school) return;
    const [ovRes, finRes, attRes, aiRes, stuRes] = await Promise.all([
      getSchoolOverview(school.id),
      getFinanceAnalytics(school.id),
      getAttendanceAnalytics(school.id),
      getAIAnalytics(school.id),
      getStudentAnalytics(school.id),
    ]);
    if (ovRes.error || finRes.error || attRes.error || aiRes.error || stuRes.error) {
      const msg = ovRes.error || finRes.error || attRes.error || aiRes.error || stuRes.error;
      showAlert('Analytics Error', msg);
    }
    setOverview(ovRes.data);
    setFinance(finRes.data);
    setAttendance(attRes.data);
    setAi(aiRes.data);
    setStudent(stuRes.data);
    setLoading(false);
    setRefreshing(false);
  }, [school]);

  useEffect(() => { load(); }, [school]);

  if (loading) return <LoadingScreen message="Loading analytics..." />;

  const aiUsagePct = ai?.usagePercent ?? 0;
  const collectionRate = finance?.collectionRate ?? 0;
  const attendanceRate = attendance?.rate ?? 0;

  return (
    <View style={styles.flex}>
      <Header title="Analytics" subtitle={school?.name} showBack accentColor={Colors.primary} />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} colors={[Colors.primary]} />}
      >
        {/* StatCards grid */}
        <View style={styles.statsRow}>
          <StatCard label="Students" value={overview?.totalStudents ?? 0} icon="people" color={Colors.primary} subtitle={`${overview?.activeStudents ?? 0} active`} />
          <StatCard label="Teachers" value={overview?.totalTeachers ?? 0} icon="person" color={Colors.teacher} />
        </View>
        <View style={styles.statsRow}>
          <StatCard label="Classes" value={overview?.totalClasses ?? 0} icon="class" color={Colors.secondary} subtitle={`${overview?.totalStreams ?? 0} streams`} />
          <StatCard label="Invoices" value={overview?.totalInvoices ?? 0} icon="receipt" color={Colors.warning} />
        </View>

        {/* Attendance */}
        <Text style={styles.sectionTitle}>Attendance</Text>
        <Card>
          <View style={styles.rowBetween}>
            <Text style={styles.cardLabel}>Attendance Rate</Text>
            <Text style={[styles.bigVal, { color: attendanceRate >= 80 ? Colors.success : Colors.warning }]}>{attendanceRate}%</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${Math.min(100, attendanceRate)}%`, backgroundColor: attendanceRate >= 80 ? Colors.success : Colors.warning }]} />
          </View>
          <View style={styles.countRow}>
            <View style={styles.countBox}><Text style={[styles.countNum, { color: Colors.success }]}>{attendance?.present ?? 0}</Text><Text style={styles.countLabel}>Present</Text></View>
            <View style={styles.countBox}><Text style={[styles.countNum, { color: Colors.error }]}>{attendance?.absent ?? 0}</Text><Text style={styles.countLabel}>Absent</Text></View>
            <View style={styles.countBox}><Text style={[styles.countNum, { color: Colors.warning }]}>{attendance?.late ?? 0}</Text><Text style={styles.countLabel}>Late</Text></View>
            <View style={styles.countBox}><Text style={[styles.countNum, { color: Colors.info }]}>{attendance?.excused ?? 0}</Text><Text style={styles.countLabel}>Excused</Text></View>
          </View>
        </Card>

        {/* Finance */}
        <Text style={styles.sectionTitle}>Finance Summary</Text>
        <Card>
          <View style={styles.rowBetween}>
            <Text style={styles.cardLabel}>Collection Rate</Text>
            <Text style={[styles.bigVal, { color: Colors.success }]}>{collectionRate}%</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${Math.min(100, collectionRate)}%`, backgroundColor: Colors.success }]} />
          </View>
          <View style={styles.financeRow}>
            <View style={styles.financeBox}>
              <Text style={styles.financeLabel}>Billed</Text>
              <Text style={[styles.financeVal, { color: Colors.textPrimary }]}>{formatCurrency(finance?.totalBilled ?? 0)}</Text>
            </View>
            <View style={styles.financeBox}>
              <Text style={styles.financeLabel}>Collected</Text>
              <Text style={[styles.financeVal, { color: Colors.success }]}>{formatCurrency(finance?.totalCollected ?? 0)}</Text>
            </View>
            <View style={styles.financeBox}>
              <Text style={styles.financeLabel}>Outstanding</Text>
              <Text style={[styles.financeVal, { color: Colors.error }]}>{formatCurrency(finance?.totalOutstanding ?? 0)}</Text>
            </View>
          </View>
        </Card>

        {/* AI usage */}
        <Text style={styles.sectionTitle}>AI Usage</Text>
        <Card>
          <View style={styles.rowBetween}>
            <View style={styles.aiIconWrap}>
              <MaterialIcons name="smart-toy" size={20} color={Colors.secondary} />
              <Text style={styles.cardLabel}>AI Quota Used</Text>
            </View>
            <Text style={[styles.bigVal, { color: aiUsagePct >= 90 ? Colors.error : Colors.secondary }]}>{aiUsagePct}%</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${Math.min(100, aiUsagePct)}%`, backgroundColor: aiUsagePct >= 90 ? Colors.error : Colors.secondary }]} />
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.subtleText}>{overview?.aiUsageCount ?? 0} requests used</Text>
            <Text style={styles.subtleText}>of {overview?.aiUsageLimit ?? 0}</Text>
          </View>
          {ai && ai.totalCostUsd > 0 ? (
            <View style={[styles.rowBetween, { marginTop: Spacing.sm }]}>
              <Text style={styles.subtleText}>Total AI Cost</Text>
              <Text style={[styles.subtleText, { color: Colors.warning, fontWeight: FontWeight.semibold }]}>${ai.totalCostUsd.toFixed(2)}</Text>
            </View>
          ) : null}
        </Card>

        {/* Student performance */}
        <Text style={styles.sectionTitle}>Student Performance</Text>
        <Card>
          <View style={styles.rowBetween}>
            <Text style={styles.cardLabel}>Total Students</Text>
            <Text style={styles.bigVal}>{student?.total ?? 0}</Text>
          </View>
          <View style={styles.countRow}>
            <View style={styles.countBox}><Text style={[styles.countNum, { color: Colors.success }]}>{student?.byStatus?.active ?? 0}</Text><Text style={styles.countLabel}>Active</Text></View>
            <View style={styles.countBox}><Text style={[styles.countNum, { color: Colors.warning }]}>{student?.byStatus?.inactive ?? 0}</Text><Text style={styles.countLabel}>Inactive</Text></View>
            <View style={styles.countBox}><Text style={[styles.countNum, { color: Colors.primary }]}>{student?.newThisMonth ?? 0}</Text><Text style={styles.countLabel}>New</Text></View>
          </View>
          {student && student.byClass.length > 0 ? (
            <>
              <Text style={[styles.subtleText, { marginTop: Spacing.md, marginBottom: Spacing.xs }]}>By Class</Text>
              {student.byClass.slice(0, 5).map((c) => (
                <View key={c.class_id} style={styles.classRow}>
                  <Text style={styles.className}>{c.class_name}</Text>
                  <View style={styles.classBarWrap}>
                    <View style={[styles.classBar, { width: `${Math.min(100, (c.count / (student.total || 1)) * 100)}%` }]} />
                  </View>
                  <Text style={styles.classCount}>{c.count}</Text>
                </View>
              ))}
            </>
          ) : null}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl, gap: Spacing.sm },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginTop: Spacing.sm, marginBottom: Spacing.xs },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLabel: { fontSize: FontSize.base, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  bigVal: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  progressBar: { height: 10, backgroundColor: Colors.surface2, borderRadius: 5, overflow: 'hidden', marginTop: Spacing.sm, marginBottom: Spacing.sm },
  progressFill: { height: '100%', borderRadius: 5 },
  countRow: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  countBox: { alignItems: 'center', gap: 2 },
  countNum: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  countLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  financeRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  financeBox: { flex: 1, padding: Spacing.sm, backgroundColor: Colors.surface2, borderRadius: BorderRadius.md, alignItems: 'center' },
  financeLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 4 },
  financeVal: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  aiIconWrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  subtleText: { fontSize: FontSize.xs, color: Colors.textMuted },
  classRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 6 },
  className: { fontSize: FontSize.sm, color: Colors.textSecondary, width: 90 },
  classBarWrap: { flex: 1, height: 8, backgroundColor: Colors.surface2, borderRadius: 4, overflow: 'hidden' },
  classBar: { height: '100%', backgroundColor: Colors.primary, borderRadius: 4 },
  classCount: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.semibold, width: 30, textAlign: 'right' },
});
