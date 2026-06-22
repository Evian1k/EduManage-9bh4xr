import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { useAppContext } from '@/hooks/useAppContext';
import { getStudentGrades } from '@/services/student.service';
import { BottomNav } from '@/components/layout/BottomNav';

const STUDENT_NAV = [
  { label: 'Home', icon: 'home' as const, route: '/(student)/' },
  { label: 'Assignments', icon: 'assignment' as const, route: '/(student)/assignments' },
  { label: 'Grades', icon: 'grade' as const, route: '/(student)/grades' },
  { label: 'AI Tutor', icon: 'auto-awesome' as const, route: '/(student)/ai-assistant' },
];
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Header } from '@/components/layout/Header';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { getGradeLetter, TERMS } from '@/constants/config';

export default function StudentGrades() {
  const { studentProfile } = useAppContext();
  const [grades, setGrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!studentProfile) { setLoading(false); return; }
    const { data } = await getStudentGrades(studentProfile.id);
    setGrades(data || []);
    setLoading(false);
  }, [studentProfile]);

  useEffect(() => { load(); }, [studentProfile]);

  const filtered = selectedTerm ? grades.filter((g) => g.term === selectedTerm) : grades;
  const avgScore = filtered.length > 0
    ? Math.round(filtered.reduce((s, g) => s + (g.score || 0), 0) / filtered.length)
    : 0;

  if (loading) return <LoadingScreen message="Loading grades..." />;

  return (
    <View style={styles.flex}>
      <Header title="My Grades" subtitle={`${grades.length} recorded`} accentColor={Colors.student} />

      {/* Average score banner */}
      {filtered.length > 0 ? (
        <View style={styles.avgBanner}>
          {(() => {
            const { letter, remark } = getGradeLetter(avgScore);
            const color = avgScore >= 70 ? Colors.success : avgScore >= 50 ? Colors.warning : Colors.error;
            return (
              <>
                <View style={[styles.avgGradeBox, { backgroundColor: `${color}20` }]}>
                  <Text style={[styles.avgLetter, { color }]}>{letter}</Text>
                </View>
                <View>
                  <Text style={styles.avgLabel}>Average Performance</Text>
                  <Text style={styles.avgScore}>{avgScore}% — {remark}</Text>
                  <Text style={styles.avgCount}>{filtered.length} subjects</Text>
                </View>
              </>
            );
          })()}
        </View>
      ) : null}

      {/* Term filter */}
      <View style={styles.filterRow}>
        <Pressable style={[styles.filterBtn, !selectedTerm && styles.filterBtnActive]} onPress={() => setSelectedTerm(null)}>
          <Text style={[styles.filterText, !selectedTerm && styles.filterTextActive]}>All Terms</Text>
        </Pressable>
        {TERMS.map((term) => (
          <Pressable key={term} style={[styles.filterBtn, selectedTerm === term && styles.filterBtnActive]} onPress={() => setSelectedTerm(term)}>
            <Text style={[styles.filterText, selectedTerm === term && styles.filterTextActive]}>{term}</Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<EmptyState icon="grade" title="No Grades" description="No grades recorded yet." />}
        renderItem={({ item }) => {
          const { letter, remark } = getGradeLetter(item.score || 0);
          const gradeColor = (item.score || 0) >= 70 ? Colors.success : (item.score || 0) >= 50 ? Colors.warning : Colors.error;
          return (
            <Card style={styles.gradeCard}>
              <View style={styles.gradeRow}>
                <View style={[styles.gradeCircle, { borderColor: gradeColor, backgroundColor: `${gradeColor}15` }]}>
                  <Text style={[styles.gradeLetter, { color: gradeColor }]}>{letter}</Text>
                </View>
                <View style={styles.gradeInfo}>
                  <Text style={styles.subjectName}>{item.subjects?.name}</Text>
                  <Text style={styles.termText}>{item.term} • {item.academic_year}</Text>
                  {item.remarks ? <Text style={styles.remarks}>{item.remarks}</Text> : null}
                </View>
                <View style={styles.scoreBox}>
                  <Text style={[styles.scoreNum, { color: gradeColor }]}>{item.score}</Text>
                  <Text style={styles.scoreLabel}>/ 100</Text>
                  <Text style={styles.remarkLabel}>{remark}</Text>
                </View>
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${item.score || 0}%`, backgroundColor: gradeColor }]} />
              </View>
            </Card>
          );
        }}
      />
      <BottomNav items={STUDENT_NAV} accentColor={Colors.student} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  avgBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    margin: Spacing.md, backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  avgGradeBox: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  avgLetter: { fontSize: FontSize.xxxl, fontWeight: FontWeight.bold },
  avgLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  avgScore: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  avgCount: { fontSize: FontSize.xs, color: Colors.textSecondary },
  filterRow: { flexDirection: 'row', paddingHorizontal: Spacing.md, gap: Spacing.xs, flexWrap: 'wrap', marginBottom: Spacing.xs },
  filterBtn: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: BorderRadius.full, backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border },
  filterBtnActive: { backgroundColor: Colors.student, borderColor: Colors.student },
  filterText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  filterTextActive: { color: Colors.textPrimary, fontWeight: FontWeight.semibold },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 100 },
  gradeCard: { gap: Spacing.sm },
  gradeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  gradeCircle: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  gradeLetter: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  gradeInfo: { flex: 1 },
  subjectName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  termText: { fontSize: FontSize.xs, color: Colors.textMuted },
  remarks: { fontSize: FontSize.xs, color: Colors.textSecondary },
  scoreBox: { alignItems: 'flex-end' },
  scoreNum: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold },
  scoreLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  remarkLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  progressBar: { height: 6, backgroundColor: Colors.surface2, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
});
