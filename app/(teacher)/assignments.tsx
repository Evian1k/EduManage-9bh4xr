import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Modal, Pressable, ScrollView } from 'react-native';
import { useAlert } from '@/template';
import { useAppContext } from '@/hooks/useAppContext';
import { getAssignments, createAssignment, toggleAssignmentPublish, deleteAssignment } from '@/services/assignment.service';
import { getTeacherClasses, getSubjects } from '@/services/class.service';
import { BottomNav } from '@/components/layout/BottomNav';

const TEACHER_NAV = [
  { label: 'Home', icon: 'home' as const, route: '/(teacher)/' },
  { label: 'Assignments', icon: 'assignment' as const, route: '/(teacher)/assignments' },
  { label: 'Grades', icon: 'grade' as const, route: '/(teacher)/grades' },
  { label: 'Attendance', icon: 'fact-check' as const, route: '/(teacher)/attendance' },
  { label: 'AI', icon: 'auto-awesome' as const, route: '/(teacher)/ai-assistant' },
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
import { formatDate, ASSIGNMENT_TYPES } from '@/constants/config';

export default function TeacherAssignments() {
  const { school, schoolUser } = useAppContext();
  const { showAlert } = useAlert();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', due_date: '', max_score: '100',
    assignment_type: 'homework', class_id: '', subject_id: '', is_published: false,
  });

  const load = useCallback(async () => {
    if (!school || !schoolUser) return;
    const [assignRes, classRes, subRes] = await Promise.all([
      getAssignments(school.id, schoolUser.id),
      getTeacherClasses(schoolUser.id),
      getSubjects(school.id),
    ]);
    setAssignments(assignRes.data || []);
    const uniqueClasses = Array.from(new Map((classRes.data || []).map((cs: any) => [cs.classes?.id, cs.classes])).values()).filter(Boolean);
    setClasses(uniqueClasses as any[]);
    setSubjects(subRes.data || []);
    setLoading(false);
  }, [school, schoolUser]);

  useEffect(() => { load(); }, [school, schoolUser]);

  const handleCreate = async () => {
    if (!form.title.trim() || !form.class_id) {
      showAlert('Missing Fields', 'Title and class are required.');
      return;
    }
    if (!school || !schoolUser) return;
    setSaving(true);
    const { error } = await createAssignment(school.id, {
      title: form.title, description: form.description,
      due_date: form.due_date || undefined, max_score: parseFloat(form.max_score) || 100,
      assignment_type: form.assignment_type, class_id: form.class_id,
      subject_id: form.subject_id || undefined, teacher_id: schoolUser.id,
      is_published: form.is_published,
    });
    setSaving(false);
    if (error) { showAlert('Error', error); return; }
    setShowCreate(false);
    setForm({ title: '', description: '', due_date: '', max_score: '100', assignment_type: 'homework', class_id: '', subject_id: '', is_published: false });
    load();
  };

  const handleTogglePublish = async (a: any) => {
    const { error } = await toggleAssignmentPublish(a.id, !a.is_published);
    if (error) { showAlert('Error', error); return; }
    load();
  };

  const handleDelete = (a: any) => {
    showAlert('Delete Assignment', `Delete "${a.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteAssignment(a.id); load(); } },
    ]);
  };

  if (loading) return <LoadingScreen message="Loading assignments..." />;

  return (
    <View style={styles.flex}>
      <Header
        title="Assignments"
        subtitle={`${assignments.length} total`}
        accentColor={Colors.teacher}
        rightAction={{ icon: 'add', onPress: () => setShowCreate(true) }}
      />
      <FlatList
        data={assignments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<EmptyState icon="assignment" title="No Assignments" description="Create your first assignment." actionLabel="Create Assignment" onAction={() => setShowCreate(true)} />}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.typeTag}>
                <Text style={styles.typeText}>{item.assignment_type}</Text>
              </View>
              <Badge label={item.is_published ? 'Published' : 'Draft'} variant={item.is_published ? 'success' : 'default'} size="sm" />
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>{item.classes?.name} {item.subjects ? `• ${item.subjects.name}` : ''}</Text>
            {item.description ? <Text style={styles.desc} numberOfLines={2}>{item.description}</Text> : null}
            <View style={styles.meta}>
              {item.due_date ? (
                <View style={styles.metaItem}>
                  <MaterialIcons name="schedule" size={14} color={Colors.textMuted} />
                  <Text style={styles.metaText}>Due {formatDate(item.due_date)}</Text>
                </View>
              ) : null}
              <View style={styles.metaItem}>
                <MaterialIcons name="star" size={14} color={Colors.textMuted} />
                <Text style={styles.metaText}>{item.max_score} pts</Text>
              </View>
            </View>
            <View style={styles.actions}>
              <Button label={item.is_published ? 'Unpublish' : 'Publish'} onPress={() => handleTogglePublish(item)} variant={item.is_published ? 'secondary' : 'primary'} size="sm" />
              <Pressable onPress={() => handleDelete(item)} hitSlop={8}>
                <MaterialIcons name="delete-outline" size={20} color={Colors.error} />
              </Pressable>
            </View>
          </Card>
        )}
      />

      <Modal visible={showCreate} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Assignment</Text>
              <Pressable onPress={() => setShowCreate(false)} hitSlop={8}>
                <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.form}>
                <Input label="Title *" value={form.title} onChangeText={(v) => setForm((f) => ({ ...f, title: v }))} placeholder="Assignment title" />
                <Input label="Description" value={form.description} onChangeText={(v) => setForm((f) => ({ ...f, description: v }))} placeholder="Instructions..." multiline numberOfLines={3} />
                <Text style={styles.fieldLabel}>Class *</Text>
                <View style={styles.optionGrid}>
                  {classes.map((cls: any) => (
                    <Pressable key={cls?.id} style={[styles.option, form.class_id === cls?.id && styles.optionActive]} onPress={() => setForm((f) => ({ ...f, class_id: cls?.id || '' }))}>
                      <Text style={[styles.optionText, form.class_id === cls?.id && styles.optionTextActive]}>{cls?.name}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.fieldLabel}>Subject</Text>
                <View style={styles.optionGrid}>
                  {subjects.map((sub) => (
                    <Pressable key={sub.id} style={[styles.option, form.subject_id === sub.id && styles.optionActive]} onPress={() => setForm((f) => ({ ...f, subject_id: sub.id }))}>
                      <Text style={[styles.optionText, form.subject_id === sub.id && styles.optionTextActive]}>{sub.name}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.fieldLabel}>Type</Text>
                <View style={styles.optionGrid}>
                  {ASSIGNMENT_TYPES.map((type) => (
                    <Pressable key={type} style={[styles.option, form.assignment_type === type && styles.optionActive]} onPress={() => setForm((f) => ({ ...f, assignment_type: type }))}>
                      <Text style={[styles.optionText, form.assignment_type === type && styles.optionTextActive]}>{type}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.formRow}>
                  <View style={styles.half}>
                    <Input label="Max Score" value={form.max_score} onChangeText={(v) => setForm((f) => ({ ...f, max_score: v }))} keyboardType="numeric" placeholder="100" />
                  </View>
                  <View style={styles.half}>
                    <Input label="Due Date" value={form.due_date} onChangeText={(v) => setForm((f) => ({ ...f, due_date: v }))} placeholder="YYYY-MM-DD" />
                  </View>
                </View>
                <Pressable style={styles.publishToggle} onPress={() => setForm((f) => ({ ...f, is_published: !f.is_published }))}>
                  <MaterialIcons name={form.is_published ? 'check-box' : 'check-box-outline-blank'} size={24} color={Colors.primary} />
                  <Text style={styles.publishLabel}>Publish immediately</Text>
                </Pressable>
                <Button label="Create Assignment" onPress={handleCreate} fullWidth loading={saving} size="lg" />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
      <BottomNav items={TEACHER_NAV} accentColor={Colors.teacher} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 100 },
  card: { gap: Spacing.xs },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  typeTag: { backgroundColor: Colors.teacherBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  typeText: { fontSize: FontSize.xs, color: Colors.teacher, fontWeight: FontWeight.semibold, textTransform: 'capitalize' },
  title: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary },
  desc: { fontSize: FontSize.sm, color: Colors.textMuted },
  meta: { flexDirection: 'row', gap: Spacing.md },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: FontSize.xs, color: Colors.textMuted },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.xs },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  form: { gap: Spacing.md, paddingBottom: Spacing.xl },
  fieldLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  option: { paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface2 },
  optionActive: { borderColor: Colors.teacher, backgroundColor: Colors.teacherBg },
  optionText: { fontSize: FontSize.xs, color: Colors.textSecondary, textTransform: 'capitalize' },
  optionTextActive: { color: Colors.teacher, fontWeight: FontWeight.semibold },
  formRow: { flexDirection: 'row', gap: Spacing.sm },
  half: { flex: 1 },
  publishToggle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  publishLabel: { fontSize: FontSize.base, color: Colors.textPrimary },
});
