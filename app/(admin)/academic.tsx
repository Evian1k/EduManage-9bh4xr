import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Modal, Pressable, ScrollView, TextInput } from 'react-native';
import { useAlert } from '@/template';
import { useAppContext } from '@/hooks/useAppContext';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import {
  getAcademicYears, createAcademicYear,
  getTerms, createTerm,
  getSubjects, createSubject,
  getClasses, createClass,
  getStreams, createStream,
  AcademicYear, Term, Subject, SchoolClass, Stream,
} from '@/services/school_management.service';

type Tab = 'years' | 'terms' | 'subjects' | 'classes' | 'streams';

const TABS: { id: Tab; label: string }[] = [
  { id: 'years', label: 'Years' },
  { id: 'terms', label: 'Terms' },
  { id: 'subjects', label: 'Subjects' },
  { id: 'classes', label: 'Classes' },
  { id: 'streams', label: 'Streams' },
];

export default function AcademicScreen() {
  const { school } = useAppContext();
  const { showAlert } = useAlert();
  const [tab, setTab] = useState<Tab>('years');
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state per tab
  const [yearForm, setYearForm] = useState({ name: '', start_date: '', end_date: '', is_active: true });
  const [termForm, setTermForm] = useState({ academic_year_id: '', name: '', start_date: '', end_date: '', is_active: true });
  const [subjectForm, setSubjectForm] = useState({ name: '', code: '', department: '', is_compulsory: true });
  const [classForm, setClassForm] = useState({ name: '', level: '', capacity: '40' });
  const [streamForm, setStreamForm] = useState({ class_id: '', name: '' });

  const load = useCallback(async () => {
    if (!school) return;
    const [yRes, tRes, subRes, clsRes, strRes] = await Promise.all([
      getAcademicYears(school.id),
      getTerms(school.id),
      getSubjects(school.id),
      getClasses(school.id),
      getStreams(school.id),
    ]);
    setYears(yRes.data || []);
    setTerms(tRes.data || []);
    setSubjects(subRes.data || []);
    setClasses(clsRes.data || []);
    setStreams(strRes.data || []);
    setLoading(false);
    setRefreshing(false);
  }, [school]);

  useEffect(() => { load(); }, [school]);

  const openModal = () => {
    // Pre-fill sensible defaults
    if (tab === 'terms' && termForm.academic_year_id === '' && years.length > 0) {
      setTermForm((f) => ({ ...f, academic_year_id: years[0].id }));
    }
    if (tab === 'streams' && streamForm.class_id === '' && classes.length > 0) {
      setStreamForm((f) => ({ ...f, class_id: classes[0].id }));
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!school) return;
    setSaving(true);
    try {
      if (tab === 'years') {
        if (!yearForm.name || !yearForm.start_date || !yearForm.end_date) {
          showAlert('Missing Fields', 'Name, start and end dates are required.'); setSaving(false); return;
        }
        const { error } = await createAcademicYear(school.id, yearForm);
        if (error) { showAlert('Error', error); return; }
        setYearForm({ name: '', start_date: '', end_date: '', is_active: true });
      } else if (tab === 'terms') {
        if (!termForm.academic_year_id || !termForm.name || !termForm.start_date || !termForm.end_date) {
          showAlert('Missing Fields', 'Year, name, and dates are required.'); setSaving(false); return;
        }
        const { error } = await createTerm(school.id, termForm);
        if (error) { showAlert('Error', error); return; }
        setTermForm({ academic_year_id: '', name: '', start_date: '', end_date: '', is_active: true });
      } else if (tab === 'subjects') {
        if (!subjectForm.name) { showAlert('Missing Fields', 'Subject name is required.'); setSaving(false); return; }
        const { error } = await createSubject(school.id, subjectForm);
        if (error) { showAlert('Error', error); return; }
        setSubjectForm({ name: '', code: '', department: '', is_compulsory: true });
      } else if (tab === 'classes') {
        if (!classForm.name) { showAlert('Missing Fields', 'Class name is required.'); setSaving(false); return; }
        const { error } = await createClass(school.id, {
          name: classForm.name,
          level: classForm.level || undefined,
          capacity: classForm.capacity ? parseInt(classForm.capacity, 10) : undefined,
        });
        if (error) { showAlert('Error', error); return; }
        setClassForm({ name: '', level: '', capacity: '40' });
      } else if (tab === 'streams') {
        if (!streamForm.class_id || !streamForm.name) {
          showAlert('Missing Fields', 'Class and stream name are required.'); setSaving(false); return;
        }
        const { error } = await createStream(school.id, streamForm);
        if (error) { showAlert('Error', error); return; }
        setStreamForm({ class_id: '', name: '' });
      }
      setShowModal(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingScreen message="Loading academic data..." />;

  const renderItem = ({ item }: { item: any }) => {
    if (tab === 'years') {
      return (
        <Card>
          <View style={styles.itemRow}>
            <View style={[styles.itemIcon, { backgroundColor: Colors.schoolAdminBg }]}>
              <MaterialIcons name="event" size={20} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{item.name}</Text>
              <Text style={styles.itemSub}>{item.start_date} → {item.end_date}</Text>
            </View>
            {item.is_active ? <Badge label="Active" variant="success" size="sm" /> : <Badge label="Inactive" variant="default" size="sm" />}
          </View>
        </Card>
      );
    }
    if (tab === 'terms') {
      return (
        <Card>
          <View style={styles.itemRow}>
            <View style={[styles.itemIcon, { backgroundColor: Colors.teacherBg }]}>
              <MaterialIcons name="date-range" size={20} color={Colors.teacher} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{item.name}</Text>
              <Text style={styles.itemSub}>{item.start_date} → {item.end_date}</Text>
            </View>
            {item.is_active ? <Badge label="Active" variant="success" size="sm" /> : <Badge label="Inactive" variant="default" size="sm" />}
          </View>
        </Card>
      );
    }
    if (tab === 'subjects') {
      return (
        <Card>
          <View style={styles.itemRow}>
            <View style={[styles.itemIcon, { backgroundColor: Colors.successBg }]}>
              <MaterialIcons name="menu-book" size={20} color={Colors.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{item.name}</Text>
              <Text style={styles.itemSub}>{[item.code, item.department].filter(Boolean).join(' • ') || 'No code/department'}</Text>
            </View>
            {item.is_compulsory ? <Badge label="Compulsory" variant="primary" size="sm" /> : <Badge label="Optional" variant="default" size="sm" />}
          </View>
        </Card>
      );
    }
    if (tab === 'classes') {
      return (
        <Card>
          <View style={styles.itemRow}>
            <View style={[styles.itemIcon, { backgroundColor: Colors.infoBg }]}>
              <MaterialIcons name="class" size={20} color={Colors.info} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{item.name}</Text>
              <Text style={styles.itemSub}>{[item.level, `Capacity ${item.capacity}`].filter(Boolean).join(' • ')}</Text>
            </View>
          </View>
        </Card>
      );
    }
    // streams
    const className = (item as any).classes?.name || '—';
    return (
      <Card>
        <View style={styles.itemRow}>
          <View style={[styles.itemIcon, { backgroundColor: Colors.warningBg }]}>
            <MaterialIcons name="fork-right" size={20} color={Colors.warning} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemTitle}>{item.name}</Text>
            <Text style={styles.itemSub}>Class: {className} • Capacity {item.capacity}</Text>
          </View>
        </View>
      </Card>
    );
  };

  const data = tab === 'years' ? years : tab === 'terms' ? terms : tab === 'subjects' ? subjects : tab === 'classes' ? classes : streams;
  const emptyIcon = tab === 'years' ? 'event' : tab === 'terms' ? 'date-range' : tab === 'subjects' ? 'menu-book' : tab === 'classes' ? 'class' : 'fork-right';
  const emptyTitle = `No ${tab.charAt(0).toUpperCase() + tab.slice(1)} Yet`;
  const modalTitle = `Add ${tab === 'years' ? 'Academic Year' : tab === 'terms' ? 'Term' : tab === 'subjects' ? 'Subject' : tab === 'classes' ? 'Class' : 'Stream'}`;

  return (
    <View style={styles.flex}>
      <Header title="Academic" subtitle={school?.name} showBack accentColor={Colors.primary} />
      {/* Tab row */}
      <View style={styles.tabRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
          {TABS.map((t) => (
            <Pressable key={t.id} style={[styles.tabBtn, tab === t.id && styles.tabBtnActive]} onPress={() => setTab(t.id)}>
              <Text style={[styles.tabText, tab === t.id && styles.tabTextActive]}>{t.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={() => { setRefreshing(true); load(); }}
        ListEmptyComponent={<EmptyState icon={emptyIcon as any} title={emptyTitle} description={`Tap + to create your first ${tab.slice(0, -1)}.`} actionLabel={`Add ${tab.slice(0, -1)}`} onAction={openModal} />}
        renderItem={renderItem}
      />

      {/* FAB */}
      <Pressable style={styles.fab} onPress={openModal} hitSlop={12}>
        <MaterialIcons name="add" size={28} color={Colors.textPrimary} />
      </Pressable>

      {/* Modal form */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{modalTitle}</Text>
              <Pressable onPress={() => setShowModal(false)} hitSlop={8}>
                <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {tab === 'years' && (
                <>
                  <FieldLabel label="Name *" />
                  <TextInput style={styles.input} value={yearForm.name} onChangeText={(v) => setYearForm((f) => ({ ...f, name: v }))} placeholder="e.g., 2025/2026" placeholderTextColor={Colors.textMuted} />
                  <FieldLabel label="Start Date *" />
                  <TextInput style={styles.input} value={yearForm.start_date} onChangeText={(v) => setYearForm((f) => ({ ...f, start_date: v }))} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textMuted} />
                  <FieldLabel label="End Date *" />
                  <TextInput style={styles.input} value={yearForm.end_date} onChangeText={(v) => setYearForm((f) => ({ ...f, end_date: v }))} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textMuted} />
                  <ToggleRow label="Set as active year" value={yearForm.is_active} onToggle={(v) => setYearForm((f) => ({ ...f, is_active: v }))} />
                </>
              )}
              {tab === 'terms' && (
                <>
                  <FieldLabel label="Academic Year *" />
                  <View style={styles.pickerRow}>
                    {years.map((y) => (
                      <Pressable key={y.id} style={[styles.chip, termForm.academic_year_id === y.id && styles.chipActive]} onPress={() => setTermForm((f) => ({ ...f, academic_year_id: y.id }))}>
                        <Text style={[styles.chipText, termForm.academic_year_id === y.id && styles.chipTextActive]}>{y.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <FieldLabel label="Name *" />
                  <TextInput style={styles.input} value={termForm.name} onChangeText={(v) => setTermForm((f) => ({ ...f, name: v }))} placeholder="e.g., Term 1" placeholderTextColor={Colors.textMuted} />
                  <FieldLabel label="Start Date *" />
                  <TextInput style={styles.input} value={termForm.start_date} onChangeText={(v) => setTermForm((f) => ({ ...f, start_date: v }))} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textMuted} />
                  <FieldLabel label="End Date *" />
                  <TextInput style={styles.input} value={termForm.end_date} onChangeText={(v) => setTermForm((f) => ({ ...f, end_date: v }))} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textMuted} />
                  <ToggleRow label="Set as active term" value={termForm.is_active} onToggle={(v) => setTermForm((f) => ({ ...f, is_active: v }))} />
                </>
              )}
              {tab === 'subjects' && (
                <>
                  <FieldLabel label="Subject Name *" />
                  <TextInput style={styles.input} value={subjectForm.name} onChangeText={(v) => setSubjectForm((f) => ({ ...f, name: v }))} placeholder="e.g., Mathematics" placeholderTextColor={Colors.textMuted} />
                  <FieldLabel label="Code" />
                  <TextInput style={styles.input} value={subjectForm.code} onChangeText={(v) => setSubjectForm((f) => ({ ...f, code: v }))} placeholder="e.g., MTH" placeholderTextColor={Colors.textMuted} />
                  <FieldLabel label="Department" />
                  <TextInput style={styles.input} value={subjectForm.department} onChangeText={(v) => setSubjectForm((f) => ({ ...f, department: v }))} placeholder="e.g., Sciences" placeholderTextColor={Colors.textMuted} />
                  <ToggleRow label="Compulsory subject" value={subjectForm.is_compulsory} onToggle={(v) => setSubjectForm((f) => ({ ...f, is_compulsory: v }))} />
                </>
              )}
              {tab === 'classes' && (
                <>
                  <FieldLabel label="Class Name *" />
                  <TextInput style={styles.input} value={classForm.name} onChangeText={(v) => setClassForm((f) => ({ ...f, name: v }))} placeholder="e.g., Grade 4" placeholderTextColor={Colors.textMuted} />
                  <FieldLabel label="Level" />
                  <TextInput style={styles.input} value={classForm.level} onChangeText={(v) => setClassForm((f) => ({ ...f, level: v }))} placeholder="e.g., Primary" placeholderTextColor={Colors.textMuted} />
                  <FieldLabel label="Capacity" />
                  <TextInput style={styles.input} value={classForm.capacity} onChangeText={(v) => setClassForm((f) => ({ ...f, capacity: v }))} placeholder="40" keyboardType="numeric" placeholderTextColor={Colors.textMuted} />
                </>
              )}
              {tab === 'streams' && (
                <>
                  <FieldLabel label="Class *" />
                  {classes.length === 0 ? (
                    <Text style={styles.helperText}>Create a class first.</Text>
                  ) : (
                    <View style={styles.pickerRow}>
                      {classes.map((c) => (
                        <Pressable key={c.id} style={[styles.chip, streamForm.class_id === c.id && styles.chipActive]} onPress={() => setStreamForm((f) => ({ ...f, class_id: c.id }))}>
                          <Text style={[styles.chipText, streamForm.class_id === c.id && styles.chipTextActive]}>{c.name}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                  <FieldLabel label="Stream Name *" />
                  <TextInput style={styles.input} value={streamForm.name} onChangeText={(v) => setStreamForm((f) => ({ ...f, name: v }))} placeholder="e.g., Stream A" placeholderTextColor={Colors.textMuted} />
                </>
              )}
              <Button label={saving ? 'Saving...' : 'Save'} onPress={handleSave} loading={saving} fullWidth style={{ marginTop: Spacing.md, marginBottom: Spacing.lg }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function FieldLabel({ label }: { label: string }) {
  return <Text style={styles.fieldLabel}>{label}</Text>;
}

function ToggleRow({ label, value, onToggle }: { label: string; value: boolean; onToggle: (v: boolean) => void }) {
  return (
    <Pressable style={styles.toggleRow} onPress={() => onToggle(!value)}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <View style={[styles.toggle, value ? styles.toggleOn : styles.toggleOff]}>
        <View style={[styles.toggleThumb, value ? styles.toggleThumbOn : styles.toggleThumbOff]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  tabRow: { backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  tabScroll: { gap: Spacing.xs },
  tabBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2, borderRadius: BorderRadius.full, backgroundColor: Colors.surface2, marginRight: Spacing.xs },
  tabBtnActive: { backgroundColor: Colors.primary },
  tabText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  tabTextActive: { color: Colors.textPrimary },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 100 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  itemIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  itemTitle: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  itemSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  fab: {
    position: 'absolute', right: Spacing.lg, bottom: Spacing.xl, width: 56, height: 56,
    borderRadius: 28, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    ...({ shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 } as any),
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  fieldLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium, marginBottom: 4, marginTop: Spacing.sm },
  input: { backgroundColor: Colors.surface2, borderRadius: BorderRadius.md, padding: Spacing.md, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border },
  pickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.sm },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full, backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.primaryDark, borderColor: Colors.primary },
  chipText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  chipTextActive: { color: Colors.textPrimary, fontWeight: FontWeight.semibold },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.sm, marginTop: Spacing.sm },
  toggleLabel: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.medium },
  toggle: { width: 44, height: 24, borderRadius: 12, padding: 2, justifyContent: 'center' },
  toggleOn: { backgroundColor: Colors.success },
  toggleOff: { backgroundColor: Colors.surface2 },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.textPrimary },
  toggleThumbOn: { alignSelf: 'flex-end' },
  toggleThumbOff: { alignSelf: 'flex-start', backgroundColor: Colors.textMuted },
  helperText: { fontSize: FontSize.xs, color: Colors.warning, fontStyle: 'italic' },
});
