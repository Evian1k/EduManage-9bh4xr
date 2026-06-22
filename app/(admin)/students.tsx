import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Modal, Pressable, ScrollView } from 'react-native';
import { useAlert } from '@/template';
import { useAppContext } from '@/hooks/useAppContext';
import { getStudents, createStudent, updateStudent, deleteStudent } from '@/services/student.service';
import { getClasses } from '@/services/class.service';
import { BottomNav } from '@/components/layout/BottomNav';

const ADMIN_NAV = [
  { label: 'Dashboard', icon: 'dashboard' as const, route: '/(admin)/' },
  { label: 'Students', icon: 'people' as const, route: '/(admin)/students' },
  { label: 'Staff', icon: 'badge' as const, route: '/(admin)/teachers' },
  { label: 'Classes', icon: 'class' as const, route: '/(admin)/classes' },
  { label: 'Settings', icon: 'settings' as const, route: '/(admin)/settings' },
];
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Header } from '@/components/layout/Header';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';

export default function StudentsScreen() {
  const { school } = useAppContext();
  const { showAlert } = useAlert();
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editStudent, setEditStudent] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    full_name: '', email: '', phone: '',
    gender: 'male', class_id: '', parent_name: '', parent_phone: '', parent_email: '',
  });

  const resetForm = () => setForm({ full_name: '', email: '', phone: '', gender: 'male', class_id: '', parent_name: '', parent_phone: '', parent_email: '' });

  const load = useCallback(async () => {
    if (!school) return;
    const [studRes, clsRes] = await Promise.all([getStudents(school.id), getClasses(school.id)]);
    setStudents(studRes.data || []);
    setFiltered(studRes.data || []);
    setClasses(clsRes.data || []);
    setLoading(false);
    setRefreshing(false);
  }, [school]);

  useEffect(() => { load(); }, [school]);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(!q ? students : students.filter((s) => `${s.full_name} ${s.admission_number}`.toLowerCase().includes(q)));
  }, [search, students]);

  const openEdit = (student: any) => {
    setEditStudent(student);
    setForm({
      full_name: student.full_name,
      email: student.email || '',
      phone: student.phone || '',
      gender: student.gender || 'male',
      class_id: student.class_id || '',
      parent_name: student.parent_name || '',
      parent_phone: student.parent_phone || '',
      parent_email: student.parent_email || '',
    });
    setShowAdd(true);
  };

  const handleSave = async () => {
    if (!form.full_name.trim() || !.trim()) {
      showAlert('Missing Fields', 'First name and last name are required.');
      return;
    }
    if (!school) return;
    setSaving(true);
    if (editStudent) {
      const { error } = await updateStudent(editStudent.id, form);
      if (error) { showAlert('Error', error.message); setSaving(false); return; }
    } else {
      if (students.length >= school.max_students) {
        showAlert('Limit Reached', `Your plan allows max ${school.max_students} students. Please upgrade.`);
        setSaving(false);
        return;
      }
      const { error } = await createStudent(school.id, form);
      if (error) { showAlert('Error', error.message); setSaving(false); return; }
    }
    setSaving(false);
    setShowAdd(false);
    setEditStudent(null);
    resetForm();
    load();
  };

  const handleDelete = (student: any) => {
    showAlert('Delete Student', `Remove ${student.full_name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteStudent(student.id); load(); } },
    ]);
  };

  if (loading) return <LoadingScreen message="Loading students..." />;

  return (
    <View style={styles.flex}>
      <Header
        title="Students"
        subtitle={`${students.length} enrolled`}
        accentColor={Colors.primary}
        rightAction={{ icon: 'person-add', onPress: () => { resetForm(); setEditStudent(null); setShowAdd(true); } }}
      />
      <View style={styles.searchBar}>
        <Input value={search} onChangeText={setSearch} placeholder="Search students..." leftIcon="search" />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={() => { setRefreshing(true); load(); }}
        ListEmptyComponent={
          <EmptyState icon="people" title="No Students" description="Add students to get started." actionLabel="Add Student" onAction={() => { resetForm(); setShowAdd(true); }} />
        }
        renderItem={({ item }) => (
          <Card style={styles.studentCard} onPress={() => openEdit(item)}>
            <View style={styles.studentRow}>
              <Avatar name={`${item.full_name}`} size={44} />
              <View style={styles.studentInfo}>
                <Text style={styles.studentName}>{item.full_name} {}</Text>
                <Text style={styles.studentId}>{item.admission_number}</Text>
                {item.classes ? <Text style={styles.studentClass}>{item.classes.name} • {item.classes.grade_level}</Text> : null}
                {item.email ? <Text style={styles.studentEmail}>{item.email}</Text> : null}
              </View>
              <View style={styles.studentActions}>
                <Badge label={item.status} variant={item.status === 'active' ? 'success' : 'default'} size="sm" />
                <Pressable onPress={() => handleDelete(item)} hitSlop={8}>
                  <MaterialIcons name="delete-outline" size={20} color={Colors.error} />
                </Pressable>
              </View>
            </View>
          </Card>
        )}
      />

      <Modal visible={showAdd} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editStudent ? 'Edit Student' : 'Add Student'}</Text>
              <Pressable onPress={() => { setShowAdd(false); setEditStudent(null); resetForm(); }} hitSlop={8}>
                <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.form}>
                <View style={styles.formRow}>
                  <View style={styles.formHalf}>
                    <Input label="Full Name *" value={form.full_name} onChangeText={(v) => setForm((f) => ({ ...f, full_name: v }))} placeholder="John Doe" />
                  </View>
                  <View style={styles.formHalf}>
                    
                  </View>
                </View>
                <Input label="Email" value={form.email} onChangeText={(v) => setForm((f) => ({ ...f, email: v }))} keyboardType="email-address" autoCapitalize="none" leftIcon="email" placeholder="student@email.com" />
                <Input label="Phone" value={form.phone} onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))} keyboardType="phone-pad" leftIcon="phone" placeholder="+234..." />
                <Text style={styles.sectionLabel}>Class</Text>
                <View style={styles.classGrid}>
                  {classes.map((cls) => (
                    <Pressable key={cls.id} style={[styles.classOption, form.class_id === cls.id && styles.classOptionActive]} onPress={() => setForm((f) => ({ ...f, class_id: cls.id }))}>
                      <Text style={[styles.classOptionText, form.class_id === cls.id && styles.classOptionTextActive]}>{cls.name}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.sectionLabel}>Parent/Guardian</Text>
                <Input label="Parent Name" value={form.parent_name} onChangeText={(v) => setForm((f) => ({ ...f, parent_name: v }))} placeholder="Parent name" leftIcon="person" />
                <Input label="Parent Phone" value={form.parent_phone} onChangeText={(v) => setForm((f) => ({ ...f, parent_phone: v }))} keyboardType="phone-pad" leftIcon="phone" placeholder="+234..." />
                <Input label="Parent Email" value={form.parent_email} onChangeText={(v) => setForm((f) => ({ ...f, parent_email: v }))} keyboardType="email-address" autoCapitalize="none" leftIcon="email" placeholder="parent@email.com" />
                <Button label={editStudent ? 'Save Changes' : 'Add Student'} onPress={handleSave} fullWidth loading={saving} size="lg" />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
      <BottomNav items={ADMIN_NAV} accentColor={Colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  searchBar: { padding: Spacing.md, paddingBottom: 0 },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 100 },
  studentCard: {},
  studentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  studentInfo: { flex: 1, gap: 2 },
  studentName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  studentId: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: FontWeight.medium },
  studentClass: { fontSize: FontSize.sm, color: Colors.textSecondary },
  studentEmail: { fontSize: FontSize.xs, color: Colors.textMuted },
  studentActions: { alignItems: 'flex-end', gap: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  form: { gap: Spacing.md, paddingBottom: Spacing.xl },
  formRow: { flexDirection: 'row', gap: Spacing.sm },
  formHalf: { flex: 1 },
  sectionLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  classGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  classOption: { paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface2 },
  classOptionActive: { borderColor: Colors.primary, backgroundColor: Colors.schoolAdminBg },
  classOptionText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  classOptionTextActive: { color: Colors.primary, fontWeight: FontWeight.semibold },
});
