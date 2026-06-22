import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, FlatList, Modal } from 'react-native';
import { useAuth, useAlert } from '@/template';
import { useAppContext } from '@/hooks/useAppContext';
import { BottomNav } from '@/components/layout/BottomNav';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { getAllTimetableSlots, getTimetableForClass, createTimetableSlot, deleteTimetableSlot, getDayName } from '@/services/timetable.service';
import { getClasses, getSubjects } from '@/services/class.service';
import { getTeachers } from '@/services/teacher.service';

const ADMIN_NAV = [
  { label: 'Dashboard', icon: 'dashboard' as const, route: '/(admin)/' },
  { label: 'Students', icon: 'people' as const, route: '/(admin)/students' },
  { label: 'Staff', icon: 'badge' as const, route: '/(admin)/teachers' },
  { label: 'Timetable', icon: 'schedule' as const, route: '/(admin)/timetable' },
  { label: 'Settings', icon: 'settings' as const, route: '/(admin)/settings' },
];

const DAYS = [
  { num: 1, name: 'Mon' },
  { num: 2, name: 'Tue' },
  { num: 3, name: 'Wed' },
  { num: 4, name: 'Thu' },
  { num: 5, name: 'Fri' },
];

const TIME_SLOTS = ['07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00'];

export default function TimetableScreen() {
  const { showAlert } = useAlert();
  const { school } = useAppContext();
  const [slots, setSlots] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<any>(null);
  const [selectedDay, setSelectedDay] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newSlot, setNewSlot] = useState({ subject_id: '', teacher_id: '', start_time: '08:00', end_time: '09:00', room_number: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!school) return;
    const [classRes, subjectRes, teacherRes] = await Promise.all([
      getClasses(school.id),
      getSubjects(school.id),
      getTeachers(school.id),
    ]);
    const cls = classRes.data || [];
    setClasses(cls);
    setSubjects(subjectRes.data || []);
    setTeachers(teacherRes.data || []);
    if (cls.length > 0 && !selectedClass) setSelectedClass(cls[0]);
    setLoading(false);
  }, [school]);

  useEffect(() => { load(); }, [school]);

  useEffect(() => {
    if (selectedClass && school) {
      getTimetableForClass(school.id, selectedClass.id).then(res => {
        setSlots(res.data || []);
      });
    }
  }, [selectedClass, school]);

  const handleAddSlot = async () => {
    if (!newSlot.start_time || !newSlot.end_time || !selectedClass) {
      showAlert('Missing Info', 'Please fill start and end times.');
      return;
    }
    if (newSlot.start_time >= newSlot.end_time) {
      showAlert('Invalid Time', 'End time must be after start time.');
      return;
    }
    setSaving(true);
    const { error } = await createTimetableSlot(school!.id, {
      class_id: selectedClass.id,
      subject_id: newSlot.subject_id || undefined,
      teacher_id: newSlot.teacher_id || undefined,
      day_of_week: selectedDay,
      start_time: newSlot.start_time,
      end_time: newSlot.end_time,
      room_number: newSlot.room_number || undefined,
    });
    setSaving(false);
    if (error) { showAlert('Error', error.message); return; }
    setShowAdd(false);
    setNewSlot({ subject_id: '', teacher_id: '', start_time: '08:00', end_time: '09:00', room_number: '' });
    const res = await getTimetableForClass(school!.id, selectedClass.id);
    setSlots(res.data || []);
    showAlert('Added', 'Timetable slot added successfully');
  };

  const handleDelete = async (slotId: string) => {
    showAlert('Delete Slot', 'Remove this timetable slot?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteTimetableSlot(slotId);
        const res = await getTimetableForClass(school!.id, selectedClass.id);
        setSlots(res.data || []);
      }},
    ]);
  };

  if (loading) return <LoadingScreen message="Loading timetable..." />;

  const daySlots = slots.filter(s => s.day_of_week === selectedDay);

  return (
    <View style={st.flex}>
      <Header title="Timetable Builder" subtitle={school?.name} accentColor={Colors.primary} />
      <ScrollView style={st.flex} contentContainerStyle={st.content} showsVerticalScrollIndicator={false}>

        {/* Class Selector */}
        <Text style={st.sectionTitle}>Select Class</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.chipBar}>
          {classes.map(cls => (
            <Pressable
              key={cls.id}
              style={[st.chip, selectedClass?.id === cls.id && st.chipActive]}
              onPress={() => setSelectedClass(cls)}
            >
              <Text style={[st.chipText, selectedClass?.id === cls.id && st.chipTextActive]}>{cls.name}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Day Selector */}
        <Text style={st.sectionTitle}>Day of Week</Text>
        <View style={st.dayRow}>
          {DAYS.map(d => (
            <Pressable
              key={d.num}
              style={[st.dayBtn, selectedDay === d.num && st.dayBtnActive]}
              onPress={() => setSelectedDay(d.num)}
            >
              <Text style={[st.dayText, selectedDay === d.num && st.dayTextActive]}>{d.name}</Text>
            </Pressable>
          ))}
        </View>

        {/* Slots for selected day */}
        <View style={st.sectionHeader}>
          <Text style={st.sectionTitle}>{getDayName(selectedDay)} Schedule</Text>
          <Pressable style={st.addBtn} onPress={() => setShowAdd(!showAdd)}>
            <MaterialIcons name={showAdd ? 'close' : 'add'} size={18} color={Colors.textPrimary} />
            <Text style={st.addBtnText}>{showAdd ? 'Cancel' : 'Add Slot'}</Text>
          </Pressable>
        </View>

        {showAdd ? (
          <Card style={st.formCard}>
            <Text style={st.formTitle}>New Timetable Slot · {getDayName(selectedDay)}</Text>
            <Text style={st.fieldLabel}>Subject</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.xs }}>
              <Pressable style={[st.chip, !newSlot.subject_id && st.chipActive]} onPress={() => setNewSlot(p => ({ ...p, subject_id: '' }))}>
                <Text style={[st.chipText, !newSlot.subject_id && st.chipTextActive]}>None</Text>
              </Pressable>
              {subjects.map(sub => (
                <Pressable key={sub.id} style={[st.chip, newSlot.subject_id === sub.id && st.chipActive]} onPress={() => setNewSlot(p => ({ ...p, subject_id: sub.id }))}>
                  <Text style={[st.chipText, newSlot.subject_id === sub.id && st.chipTextActive]}>{sub.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={st.fieldLabel}>Teacher</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.xs }}>
              <Pressable style={[st.chip, !newSlot.teacher_id && st.chipActive]} onPress={() => setNewSlot(p => ({ ...p, teacher_id: '' }))}>
                <Text style={[st.chipText, !newSlot.teacher_id && st.chipTextActive]}>None</Text>
              </Pressable>
              {teachers.map((t: any) => (
                <Pressable key={t.id} style={[st.chip, newSlot.teacher_id === t.id && st.chipActive]} onPress={() => setNewSlot(p => ({ ...p, teacher_id: t.id }))}>
                  <Text style={[st.chipText, newSlot.teacher_id === t.id && st.chipTextActive]}>
                    {t.user_profiles?.username || t.employee_id || 'Unknown'}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={st.timeRow}>
              <View style={{ flex: 1 }}>
                <Text style={st.fieldLabel}>Start Time</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {TIME_SLOTS.map(t => (
                    <Pressable key={t} style={[st.timeChip, newSlot.start_time === t && st.chipActive]} onPress={() => setNewSlot(p => ({ ...p, start_time: t }))}>
                      <Text style={[st.timeChipText, newSlot.start_time === t && st.chipTextActive]}>{t}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </View>
            <View style={st.timeRow}>
              <View style={{ flex: 1 }}>
                <Text style={st.fieldLabel}>End Time</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {TIME_SLOTS.filter(t => t > newSlot.start_time).map(t => (
                    <Pressable key={t} style={[st.timeChip, newSlot.end_time === t && st.chipActive]} onPress={() => setNewSlot(p => ({ ...p, end_time: t }))}>
                      <Text style={[st.timeChipText, newSlot.end_time === t && st.chipTextActive]}>{t}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </View>
            <View style={st.fieldWrap}>
              <Text style={st.fieldLabel}>Room Number (optional)</Text>
              <TextInput
                style={st.input}
                value={newSlot.room_number}
                onChangeText={v => setNewSlot(p => ({ ...p, room_number: v }))}
                placeholder="e.g., Room 101"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
            <Button label={saving ? 'Adding...' : 'Add to Timetable'} onPress={handleAddSlot} loading={saving} fullWidth />
          </Card>
        ) : null}

        {daySlots.length > 0 ? (
          <View style={st.slotList}>
            {daySlots
              .sort((a, b) => a.start_time.localeCompare(b.start_time))
              .map(slot => (
                <Card key={slot.id} style={st.slotCard}>
                  <View style={st.slotRow}>
                    <View style={st.timeBlock}>
                      <Text style={st.slotStart}>{slot.start_time.slice(0, 5)}</Text>
                      <View style={st.timeLine} />
                      <Text style={st.slotEnd}>{slot.end_time.slice(0, 5)}</Text>
                    </View>
                    <View style={st.slotInfo}>
                      <Text style={st.slotSubject}>{slot.subjects?.name || 'Free Period'}</Text>
                      {slot.subjects?.code ? <Badge label={slot.subjects.code} variant="default" size="sm" /> : null}
                      {slot.room_number ? (
                        <View style={st.slotMeta}>
                          <MaterialIcons name="room" size={12} color={Colors.textMuted} />
                          <Text style={st.slotMetaText}>{slot.room_number}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Pressable style={st.deleteBtn} onPress={() => handleDelete(slot.id)}>
                      <MaterialIcons name="delete-outline" size={18} color={Colors.error} />
                    </Pressable>
                  </View>
                </Card>
              ))}
          </View>
        ) : (
          <Card>
            <Text style={st.emptyText}>No slots for {getDayName(selectedDay)}. Add a slot above.</Text>
          </Card>
        )}
      </ScrollView>
      <BottomNav items={ADMIN_NAV} accentColor={Colors.primary} />
    </View>
  );
}

const st = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingBottom: 100, gap: Spacing.sm },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginBottom: Spacing.xs },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.sm },
  chipBar: { marginBottom: Spacing.sm },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full, backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border, marginRight: Spacing.sm },
  chipActive: { backgroundColor: Colors.primaryDark, borderColor: Colors.primary },
  chipText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  chipTextActive: { color: Colors.textPrimary, fontWeight: FontWeight.semibold },
  dayRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  dayBtn: { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', borderRadius: BorderRadius.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  dayBtnActive: { backgroundColor: Colors.primaryDark, borderColor: Colors.primary },
  dayText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  dayTextActive: { color: Colors.textPrimary },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.surface2, paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: BorderRadius.sm },
  addBtnText: { fontSize: FontSize.sm, color: Colors.textPrimary },
  formCard: { gap: Spacing.sm },
  formTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  fieldLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium, marginBottom: 4, marginTop: 4 },
  fieldWrap: { gap: 4 },
  input: { backgroundColor: Colors.surface2, borderRadius: BorderRadius.sm, padding: Spacing.md, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border },
  timeRow: { gap: Spacing.xs },
  timeChip: { paddingHorizontal: Spacing.sm, paddingVertical: 5, borderRadius: BorderRadius.sm, backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border, marginRight: 4 },
  timeChipText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  slotList: { gap: Spacing.sm },
  slotCard: {},
  slotRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  timeBlock: { alignItems: 'center', width: 52, gap: 2 },
  slotStart: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.primary },
  timeLine: { width: 2, height: 16, backgroundColor: Colors.border, borderRadius: 1 },
  slotEnd: { fontSize: FontSize.xs, color: Colors.textMuted },
  slotInfo: { flex: 1, gap: 4 },
  slotSubject: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  slotMeta: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  slotMetaText: { fontSize: FontSize.xs, color: Colors.textMuted },
  deleteBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: Colors.errorBg },
  emptyText: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center', padding: Spacing.sm },
});
