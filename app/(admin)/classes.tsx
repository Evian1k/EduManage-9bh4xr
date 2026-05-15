import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Modal, Pressable, ScrollView } from 'react-native';
import { useAlert } from '@/template';
import { useAppContext } from '@/hooks/useAppContext';
import { getClasses, createClass, getSubjects, createSubject, deleteClass } from '@/services/class.service';
import { BottomNav } from '@/components/layout/BottomNav';

const ADMIN_NAV = [
  { label: 'Dashboard', icon: 'dashboard' as const, route: '/(admin)/' },
  { label: 'Students', icon: 'people' as const, route: '/(admin)/students' },
  { label: 'Staff', icon: 'badge' as const, route: '/(admin)/teachers' },
  { label: 'Classes', icon: 'class' as const, route: '/(admin)/classes' },
  { label: 'Settings', icon: 'settings' as const, route: '/(admin)/settings' },
];
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Header } from '@/components/layout/Header';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';

export default function ClassesScreen() {
  const { school } = useAppContext();
  const { showAlert } = useAlert();
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'classes' | 'subjects'>('classes');
  const [showClassModal, setShowClassModal] = useState(false);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [classForm, setClassForm] = useState({ name: '', grade_level: '', section: 'A', academic_year: '2025/2026', capacity: '30', room_number: '' });
  const [subjectForm, setSubjectForm] = useState({ name: '', code: '', description: '' });

  const load = useCallback(async () => {
    if (!school) return;
    const [clsRes, subRes] = await Promise.all([getClasses(school.id), getSubjects(school.id)]);
    setClasses(clsRes.data || []);
    setSubjects(subRes.data || []);
    setLoading(false);
  }, [school]);

  useEffect(() => { load(); }, [school]);

  const handleCreateClass = async () => {
    if (!classForm.name.trim() || !classForm.grade_level.trim()) {
      showAlert('Missing Fields', 'Class name and grade level are required.');
      return;
    }
    if (!school) return;
    setSaving(true);
    const { error } = await createClass(school.id, classForm.name, classForm.grade_level, classForm.section, classForm.academic_year, parseInt(classForm.capacity) || 30, classForm.room_number || undefined);
    setSaving(false);
    if (error) { showAlert('Error', error.message); return; }
    setShowClassModal(false);
    setClassForm({ name: '', grade_level: '', section: 'A', academic_year: '2025/2026', capacity: '30', room_number: '' });
    load();
  };

  const handleCreateSubject = async () => {
    if (!subjectForm.name.trim()) {
      showAlert('Missing Fields', 'Subject name is required.');
      return;
    }
    if (!school) return;
    setSaving(true);
    const { error } = await createSubject(school.id, subjectForm.name, subjectForm.code, subjectForm.description || undefined);
    setSaving(false);
    if (error) { showAlert('Error', error.message); return; }
    setShowSubjectModal(false);
    setSubjectForm({ name: '', code: '', description: '' });
    load();
  };

  const handleDeleteClass = (cls: any) => {
    showAlert('Delete Class', `Remove class "${cls.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteClass(cls.id); load(); } },
    ]);
  };

  if (loading) return <LoadingScreen message="Loading classes..." />;

  return (
    <View style={styles.flex}>
      <Header
        title={tab === 'classes' ? 'Classes' : 'Subjects'}
        subtitle={tab === 'classes' ? `${classes.length} classes` : `${subjects.length} subjects`}
        accentColor={Colors.secondary}
        rightAction={{ icon: 'add', onPress: () => tab === 'classes' ? setShowClassModal(true) : setShowSubjectModal(true) }}
      />

      <View style={styles.tabRow}>
        <Pressable style={[styles.tabBtn, tab === 'classes' && styles.tabBtnActive]} onPress={() => setTab('classes')}>
          <MaterialIcons name="class" size={16} color={tab === 'classes' ? Colors.textPrimary : Colors.textMuted} />
          <Text style={[styles.tabText, tab === 'classes' && styles.tabTextActive]}>Classes ({classes.length})</Text>
        </Pressable>
        <Pressable style={[styles.tabBtn, tab === 'subjects' && styles.tabBtnActive]} onPress={() => setTab('subjects')}>
          <MaterialIcons name="book" size={16} color={tab === 'subjects' ? Colors.textPrimary : Colors.textMuted} />
          <Text style={[styles.tabText, tab === 'subjects' && styles.tabTextActive]}>Subjects ({subjects.length})</Text>
        </Pressable>
      </View>

      {tab === 'classes' ? (
        <FlatList
          data={classes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<EmptyState icon="class" title="No Classes" description="Create your first class." actionLabel="Add Class" onAction={() => setShowClassModal(true)} />}
          renderItem={({ item }) => (
            <Card style={styles.classCard}>
              <View style={styles.classRow}>
                <View style={styles.classIcon}>
                  <MaterialIcons name="class" size={22} color={Colors.secondary} />
                </View>
                <View style={styles.classInfo}>
                  <Text style={styles.className}>{item.name}</Text>
                  <Text style={styles.classGrade}>Grade {item.grade_level} • Section {item.section}</Text>
                  <Text style={styles.classYear}>{item.academic_year}</Text>
                  {item.room_number ? <Text style={styles.classRoom}>Room {item.room_number}</Text> : null}
                </View>
                <View style={styles.classRight}>
                  <View style={styles.capacityBadge}>
                    <MaterialIcons name="people" size={12} color={Colors.textSecondary} />
                    <Text style={styles.capacityText}>{item.capacity}</Text>
                  </View>
                  <Pressable onPress={() => handleDeleteClass(item)} hitSlop={8}>
                    <MaterialIcons name="delete-outline" size={20} color={Colors.error} />
                  </Pressable>
                </View>
              </View>
            </Card>
          )}
        />
      ) : (
        <FlatList
          data={subjects}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<EmptyState icon="book" title="No Subjects" description="Create subjects for your school." actionLabel="Add Subject" onAction={() => setShowSubjectModal(true)} />}
          renderItem={({ item }) => (
            <Card style={styles.subjectCard}>
              <View style={styles.subjectRow}>
                <View style={styles.subjectCode}>
                  <Text style={styles.subjectCodeText}>{item.code || item.name.slice(0, 3).toUpperCase()}</Text>
                </View>
                <View style={styles.subjectInfo}>
                  <Text style={styles.subjectName}>{item.name}</Text>
                  {item.description ? <Text style={styles.subjectDesc}>{item.description}</Text> : null}
                </View>
              </View>
            </Card>
          )}
        />
      )}

      {/* Class Modal */}
      <Modal visible={showClassModal} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Class</Text>
              <Pressable onPress={() => setShowClassModal(false)} hitSlop={8}><MaterialIcons name="close" size={24} color={Colors.textPrimary} /></Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.form}>
                <Input label="Class Name *" value={classForm.name} onChangeText={(v) => setClassForm((f) => ({ ...f, name: v }))} placeholder="e.g. Primary 3" />
                <View style={styles.formRow}>
                  <View style={styles.formHalf}>
                    <Input label="Grade Level *" value={classForm.grade_level} onChangeText={(v) => setClassForm((f) => ({ ...f, grade_level: v }))} placeholder="e.g. 3" />
                  </View>
                  <View style={styles.formHalf}>
                    <Input label="Section" value={classForm.section} onChangeText={(v) => setClassForm((f) => ({ ...f, section: v }))} placeholder="A" />
                  </View>
                </View>
                <View style={styles.formRow}>
                  <View style={styles.formHalf}>
                    <Input label="Academic Year" value={classForm.academic_year} onChangeText={(v) => setClassForm((f) => ({ ...f, academic_year: v }))} placeholder="2025/2026" />
                  </View>
                  <View style={styles.formHalf}>
                    <Input label="Capacity" value={classForm.capacity} onChangeText={(v) => setClassForm((f) => ({ ...f, capacity: v }))} keyboardType="numeric" placeholder="30" />
                  </View>
                </View>
                <Input label="Room Number" value={classForm.room_number} onChangeText={(v) => setClassForm((f) => ({ ...f, room_number: v }))} placeholder="e.g. B12" />
                <Button label="Create Class" onPress={handleCreateClass} fullWidth loading={saving} size="lg" />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Subject Modal */}
      <Modal visible={showSubjectModal} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Subject</Text>
              <Pressable onPress={() => setShowSubjectModal(false)} hitSlop={8}><MaterialIcons name="close" size={24} color={Colors.textPrimary} /></Pressable>
            </View>
            <View style={styles.form}>
              <Input label="Subject Name *" value={subjectForm.name} onChangeText={(v) => setSubjectForm((f) => ({ ...f, name: v }))} placeholder="e.g. Mathematics" />
              <Input label="Subject Code" value={subjectForm.code} onChangeText={(v) => setSubjectForm((f) => ({ ...f, code: v }))} placeholder="e.g. MATH101" />
              <Input label="Description" value={subjectForm.description} onChangeText={(v) => setSubjectForm((f) => ({ ...f, description: v }))} placeholder="Brief description..." multiline numberOfLines={3} />
              <Button label="Create Subject" onPress={handleCreateSubject} fullWidth loading={saving} size="lg" />
            </View>
          </View>
        </View>
      </Modal>
      <BottomNav items={ADMIN_NAV} accentColor={Colors.secondary} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  tabRow: { flexDirection: 'row', margin: Spacing.md, backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: 4, borderWidth: 1, borderColor: Colors.border },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.sm, gap: 6, borderRadius: BorderRadius.sm },
  tabBtnActive: { backgroundColor: Colors.secondary },
  tabText: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: FontWeight.medium },
  tabTextActive: { color: Colors.textPrimary, fontWeight: FontWeight.semibold },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 100 },
  classCard: {},
  classRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  classIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: `${Colors.secondary}20`, alignItems: 'center', justifyContent: 'center' },
  classInfo: { flex: 1 },
  className: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  classGrade: { fontSize: FontSize.sm, color: Colors.textSecondary },
  classYear: { fontSize: FontSize.xs, color: Colors.textMuted },
  classRoom: { fontSize: FontSize.xs, color: Colors.textMuted },
  classRight: { alignItems: 'flex-end', gap: 8 },
  capacityBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.surface2, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  capacityText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  subjectCard: {},
  subjectRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  subjectCode: { width: 48, height: 48, borderRadius: 12, backgroundColor: Colors.infoBg, alignItems: 'center', justifyContent: 'center' },
  subjectCodeText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.primary },
  subjectInfo: { flex: 1 },
  subjectName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  subjectDesc: { fontSize: FontSize.sm, color: Colors.textSecondary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  form: { gap: Spacing.md, paddingBottom: Spacing.xl },
  formRow: { flexDirection: 'row', gap: Spacing.sm },
  formHalf: { flex: 1 },
});
