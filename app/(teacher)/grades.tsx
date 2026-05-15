import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Modal, Pressable, ScrollView } from 'react-native';
import { useAlert } from '@/template';
import { useAppContext } from '@/hooks/useAppContext';
import { getStudents } from '@/services/student.service';
import { getTeacherClasses, getSubjects } from '@/services/class.service';
import { recordGrade, getGrades } from '@/services/grade.service';
import { BottomNav } from '@/components/layout/BottomNav';

const TEACHER_NAV = [
  { label: 'Home', icon: 'home' as const, route: '/(teacher)/' },
  { label: 'Assignments', icon: 'assignment' as const, route: '/(teacher)/assignments' },
  { label: 'Grades', icon: 'grade' as const, route: '/(teacher)/grades' },
  { label: 'Attendance', icon: 'fact-check' as const, route: '/(teacher)/attendance' },
  { label: 'AI', icon: 'auto-awesome' as const, route: '/(teacher)/ai-assistant' },
];
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Header } from '@/components/layout/Header';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { getGradeLetter, TERMS } from '@/constants/config';

export default function TeacherGrades() {
  const { school, schoolUser } = useAppContext();
  const { showAlert } = useAlert();
  const [grades, setGrades] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState<any>(null);
  const [selectedTerm, setSelectedTerm] = useState(TERMS[0]);
  const [showGrade, setShowGrade] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [selectedSubject, setSelectedSubject] = useState<any>(null);
  const [scoreInput, setScoreInput] = useState('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!school || !schoolUser) return;
    const [classRes, subRes] = await Promise.all([
      getTeacherClasses(schoolUser.id),
      getSubjects(school.id),
    ]);
    const uniqueClasses = Array.from(new Map((classRes.data || []).map((cs: any) => [cs.classes?.id, cs.classes])).values()).filter(Boolean);
    setClasses(uniqueClasses as any[]);
    setSubjects(subRes.data || []);
    setLoading(false);
  }, [school, schoolUser]);

  useEffect(() => { load(); }, [school, schoolUser]);

  useEffect(() => {
    if (selectedClass && school) {
      getStudents(school.id, selectedClass.id).then(({ data }) => setStudents(data || []));
      getGrades(school.id, selectedClass.id, selectedTerm).then(({ data }) => setGrades(data || []));
    }
  }, [selectedClass, selectedTerm, school]);

  const getStudentGrade = (studentId: string, subjectId: string) =>
    grades.find((g) => g.student_id === studentId && g.subject_id === subjectId);

  const openGradeModal = (student: any, subject: any) => {
    setSelectedStudent(student);
    setSelectedSubject(subject);
    const existing = getStudentGrade(student.id, subject.id);
    setScoreInput(existing?.score?.toString() || '');
    setRemarks(existing?.remarks || '');
    setShowGrade(true);
  };

  const handleSaveGrade = async () => {
    const score = parseFloat(scoreInput);
    if (isNaN(score) || score < 0 || score > 100) {
      showAlert('Invalid Score', 'Please enter a score between 0 and 100.');
      return;
    }
    if (!school || !schoolUser || !selectedClass || !selectedStudent || !selectedSubject) return;
    setSaving(true);
    const { error } = await recordGrade(
      school.id, selectedStudent.id, selectedSubject.id, selectedClass.id,
      selectedTerm, '2025/2026', score, schoolUser.id, remarks
    );
    setSaving(false);
    if (error) { showAlert('Error', error.message); return; }
    setShowGrade(false);
    getGrades(school.id, selectedClass.id, selectedTerm).then(({ data }) => setGrades(data || []));
  };

  if (loading) return <LoadingScreen message="Loading grades..." />;

  return (
    <View style={styles.flex}>
      <Header title="Grades" subtitle="Record & manage grades" accentColor={Colors.teacher} />
      {/* Class selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.classScroll} contentContainerStyle={styles.classScrollContent}>
        {classes.map((cls: any) => (
          <Pressable key={cls?.id} style={[styles.classChip, selectedClass?.id === cls?.id && styles.classChipActive]} onPress={() => setSelectedClass(cls)}>
            <Text style={[styles.classChipText, selectedClass?.id === cls?.id && styles.classChipTextActive]}>{cls?.name}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {/* Term selector */}
      {selectedClass ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.termScroll} contentContainerStyle={styles.classScrollContent}>
          {TERMS.map((term) => (
            <Pressable key={term} style={[styles.termChip, selectedTerm === term && styles.termChipActive]} onPress={() => setSelectedTerm(term)}>
              <Text style={[styles.termText, selectedTerm === term && styles.termTextActive]}>{term}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {!selectedClass ? (
        <EmptyState icon="grade" title="Select a Class" description="Choose a class to view and record grades." />
      ) : (
        <FlatList
          data={students}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<EmptyState icon="people" title="No Students" description="No students in this class." />}
          renderItem={({ item: student }) => (
            <Card style={styles.studentCard}>
              <Text style={styles.studentName}>{student.first_name} {student.last_name}</Text>
              <Text style={styles.studentId}>{student.admission_number}</Text>
              <View style={styles.subjectGrid}>
                {subjects.slice(0, 4).map((subject) => {
                  const grade = getStudentGrade(student.id, subject.id);
                  return (
                    <Pressable key={subject.id} style={styles.subjectBox} onPress={() => openGradeModal(student, subject)}>
                      <Text style={styles.subjectName}>{subject.name}</Text>
                      {grade ? (
                        <View style={styles.gradeBox}>
                          <Text style={styles.gradeScore}>{grade.score}</Text>
                          <Text style={styles.gradeLetter}>{grade.grade_letter}</Text>
                        </View>
                      ) : (
                        <View style={styles.noGrade}>
                          <MaterialIcons name="add" size={16} color={Colors.textMuted} />
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </Card>
          )}
        />
      )}

      <Modal visible={showGrade} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Record Grade</Text>
              <Pressable onPress={() => setShowGrade(false)} hitSlop={8}><MaterialIcons name="close" size={24} color={Colors.textPrimary} /></Pressable>
            </View>
            <Text style={styles.modalSub}>{selectedStudent?.first_name} {selectedStudent?.last_name}</Text>
            <Text style={styles.modalSub2}>{selectedSubject?.name} • {selectedTerm}</Text>
            <View style={styles.scoreRow}>
              <Input label="Score (0-100)" value={scoreInput} onChangeText={setScoreInput} keyboardType="numeric" placeholder="Enter score" leftIcon="grade" />
              {scoreInput && !isNaN(parseFloat(scoreInput)) ? (
                <View style={styles.gradePreview}>
                  <Text style={styles.gradePreviewLetter}>{getGradeLetter(parseFloat(scoreInput)).letter}</Text>
                  <Text style={styles.gradePreviewRemark}>{getGradeLetter(parseFloat(scoreInput)).remark}</Text>
                </View>
              ) : null}
            </View>
            <Input label="Remarks" value={remarks} onChangeText={setRemarks} placeholder="Optional remarks..." multiline numberOfLines={2} />
            <Button label="Save Grade" onPress={handleSaveGrade} fullWidth loading={saving} size="lg" />
          </View>
        </View>
      </Modal>
      <BottomNav items={TEACHER_NAV} accentColor={Colors.teacher} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  classScroll: { maxHeight: 60 },
  termScroll: { maxHeight: 50 },
  classScrollContent: { paddingHorizontal: Spacing.md, alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.sm },
  classChip: { paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: BorderRadius.full, backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border },
  classChipActive: { backgroundColor: Colors.teacher, borderColor: Colors.teacher },
  classChipText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  classChipTextActive: { color: Colors.textPrimary, fontWeight: FontWeight.semibold },
  termChip: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: BorderRadius.full, backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border },
  termChipActive: { backgroundColor: Colors.surface3, borderColor: Colors.secondary },
  termText: { fontSize: FontSize.xs, color: Colors.textMuted },
  termTextActive: { color: Colors.secondary, fontWeight: FontWeight.semibold },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 100 },
  studentCard: { gap: Spacing.sm },
  studentName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  studentId: { fontSize: FontSize.xs, color: Colors.textMuted },
  subjectGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  subjectBox: { flex: 1, minWidth: '45%', backgroundColor: Colors.surface2, borderRadius: BorderRadius.sm, padding: Spacing.sm, alignItems: 'center', gap: 4 },
  subjectName: { fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'center' },
  gradeBox: { alignItems: 'center' },
  gradeScore: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  gradeLetter: { fontSize: FontSize.xs, color: Colors.success, fontWeight: FontWeight.bold },
  noGrade: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.surface3, alignItems: 'center', justifyContent: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, gap: Spacing.md },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  modalSub: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  modalSub2: { fontSize: FontSize.sm, color: Colors.textSecondary },
  scoreRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.md },
  gradePreview: { alignItems: 'center', width: 60 },
  gradePreviewLetter: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.success },
  gradePreviewRemark: { fontSize: FontSize.xs, color: Colors.textMuted },
});
