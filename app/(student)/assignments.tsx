import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Modal, Pressable, ScrollView } from 'react-native';
import { useAlert } from '@/template';
import { useAppContext } from '@/hooks/useAppContext';
import { getStudentAssignments, submitAssignment } from '@/services/student.service';
import { BottomNav } from '@/components/layout/BottomNav';

const STUDENT_NAV = [
  { label: 'Home', icon: 'home' as const, route: '/(student)/' },
  { label: 'Assignments', icon: 'assignment' as const, route: '/(student)/assignments' },
  { label: 'Grades', icon: 'grade' as const, route: '/(student)/grades' },
  { label: 'AI Tutor', icon: 'auto-awesome' as const, route: '/(student)/ai-assistant' },
];
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Header } from '@/components/layout/Header';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { formatDate } from '@/constants/config';

export default function StudentAssignments() {
  const { school, studentProfile } = useAppContext();
  const { showAlert } = useAlert();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [submissionText, setSubmissionText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!studentProfile?.class_id) { setLoading(false); return; }
    const { data } = await getStudentAssignments(studentProfile.class_id);
    setAssignments(data || []);
    setLoading(false);
  }, [studentProfile]);

  useEffect(() => { load(); }, [studentProfile]);

  const handleSubmit = async () => {
    if (!submissionText.trim()) { showAlert('Required', 'Please write your submission.'); return; }
    if (!studentProfile || !school || !selected) return;
    setSubmitting(true);
    const { error } = await submitAssignment(selected.id, studentProfile.id, school.id, submissionText.trim());
    setSubmitting(false);
    if (error) { showAlert('Error', error.message); return; }
    showAlert('Submitted', 'Your assignment has been submitted successfully!');
    setSelected(null);
    setSubmissionText('');
  };

  const getDueStatus = (dueDate: string | null) => {
    if (!dueDate) return { label: 'No Due Date', variant: 'default' as const };
    const due = new Date(dueDate);
    const now = new Date();
    const diff = Math.ceil((due.getTime() - now.getTime()) / 86400000);
    if (diff < 0) return { label: 'Overdue', variant: 'error' as const };
    if (diff === 0) return { label: 'Due Today', variant: 'warning' as const };
    if (diff <= 3) return { label: `Due in ${diff}d`, variant: 'warning' as const };
    return { label: `Due in ${diff}d`, variant: 'success' as const };
  };

  if (loading) return <LoadingScreen message="Loading assignments..." />;

  return (
    <View style={styles.flex}>
      <Header title="Assignments" subtitle={`${assignments.length} assignments`} accentColor={Colors.student} />
      <FlatList
        data={assignments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="assignment"
            title="No Assignments"
            description={studentProfile?.class_id ? 'No assignments have been published yet.' : 'You are not enrolled in a class.'}
          />
        }
        renderItem={({ item }) => {
          const { label, variant } = getDueStatus(item.due_date);
          return (
            <Card style={styles.card} onPress={() => { setSelected(item); setSubmissionText(''); }}>
              <View style={styles.cardHeader}>
                <View style={styles.typeBadge}>
                  <Text style={styles.typeText}>{item.assignment_type}</Text>
                </View>
                <Badge label={label} variant={variant} size="sm" />
              </View>
              <Text style={styles.title}>{item.title}</Text>
              {item.subjects ? <Text style={styles.subtitle}>{item.subjects.name}</Text> : null}
              {item.description ? <Text style={styles.desc} numberOfLines={2}>{item.description}</Text> : null}
              <View style={styles.footer}>
                <View style={styles.footerItem}>
                  <MaterialIcons name="star" size={14} color={Colors.textMuted} />
                  <Text style={styles.footerText}>{item.max_score} pts</Text>
                </View>
                {item.due_date ? (
                  <View style={styles.footerItem}>
                    <MaterialIcons name="schedule" size={14} color={Colors.textMuted} />
                    <Text style={styles.footerText}>{formatDate(item.due_date)}</Text>
                  </View>
                ) : null}
                <View style={styles.submitBtn}>
                  <Text style={styles.submitText}>Submit</Text>
                  <MaterialIcons name="arrow-forward" size={14} color={Colors.student} />
                </View>
              </View>
            </Card>
          );
        }}
      />

      <Modal visible={!!selected} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={2}>{selected?.title}</Text>
              <Pressable onPress={() => setSelected(null)} hitSlop={8}>
                <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.details}>
                {selected?.subjects ? <Text style={styles.detailSub}>{selected.subjects.name}</Text> : null}
                {selected?.due_date ? <Text style={styles.detailSub}>Due: {formatDate(selected.due_date)}</Text> : null}
                <Text style={styles.detailSub}>Max Score: {selected?.max_score} points</Text>
                {selected?.description ? (
                  <View style={styles.descBox}>
                    <Text style={styles.descText}>{selected.description}</Text>
                  </View>
                ) : null}
              </View>
              <Input
                label="Your Submission *"
                value={submissionText}
                onChangeText={setSubmissionText}
                placeholder="Write your answer, explanation, or notes here..."
                multiline
                numberOfLines={8}
                style={{ height: 160, textAlignVertical: 'top' }}
              />
              <View style={styles.modalActions}>
                <Button label="Submit Assignment" onPress={handleSubmit} fullWidth loading={submitting} size="lg" />
                <Button label="Cancel" onPress={() => setSelected(null)} variant="ghost" fullWidth size="sm" />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
      <BottomNav items={STUDENT_NAV} accentColor={Colors.student} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 100 },
  card: { gap: Spacing.xs },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  typeBadge: { backgroundColor: Colors.studentBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  typeText: { fontSize: FontSize.xs, color: Colors.student, fontWeight: FontWeight.semibold, textTransform: 'capitalize' },
  title: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary },
  desc: { fontSize: FontSize.sm, color: Colors.textMuted },
  footer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.xs },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerText: { fontSize: FontSize.xs, color: Colors.textMuted },
  submitBtn: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4 },
  submitText: { fontSize: FontSize.sm, color: Colors.student, fontWeight: FontWeight.semibold },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: Spacing.md, gap: Spacing.sm },
  modalTitle: { flex: 1, fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  details: { gap: 4, marginBottom: Spacing.md },
  detailSub: { fontSize: FontSize.sm, color: Colors.textSecondary },
  descBox: { backgroundColor: Colors.surface2, padding: Spacing.md, borderRadius: BorderRadius.md, marginTop: Spacing.sm },
  descText: { fontSize: FontSize.base, color: Colors.textSecondary, lineHeight: 22 },
  modalActions: { gap: Spacing.sm, marginTop: Spacing.md, paddingBottom: Spacing.md },
});
