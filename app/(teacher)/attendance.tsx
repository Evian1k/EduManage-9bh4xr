import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Modal, Pressable, ScrollView } from 'react-native';
import { useAlert } from '@/template';
import { useAppContext } from '@/hooks/useAppContext';
import { getStudents } from '@/services/student.service';
import { getTeacherClasses } from '@/services/class.service';
import { getAttendanceByDate, bulkRecordAttendance } from '@/services/attendance.service';
import { BottomNav } from '@/components/layout/BottomNav';

const TEACHER_NAV = [
  { label: 'Home', icon: 'home' as const, route: '/(teacher)/' },
  { label: 'Assignments', icon: 'assignment' as const, route: '/(teacher)/assignments' },
  { label: 'Grades', icon: 'grade' as const, route: '/(teacher)/grades' },
  { label: 'Attendance', icon: 'fact-check' as const, route: '/(teacher)/attendance' },
  { label: 'AI', icon: 'auto-awesome' as const, route: '/(teacher)/ai-assistant' },
];
import { Card } from '@/components/ui/Card';
import { Badge, getStatusBadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Header } from '@/components/layout/Header';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';

const STATUSES = ['present', 'absent', 'late', 'excused'];
const STATUS_COLORS: Record<string, string> = {
  present: Colors.success, absent: Colors.error, late: Colors.warning, excused: Colors.info,
};

export default function AttendanceScreen() {
  const { school, schoolUser } = useAppContext();
  const { showAlert } = useAlert();
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [existing, setExisting] = useState<any[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, string>>({});
  const [selectedClass, setSelectedClass] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const today = new Date().toISOString().split('T')[0];

  const load = useCallback(async () => {
    if (!schoolUser) return;
    const { data } = await getTeacherClasses(schoolUser.id);
    const uniqueClasses = Array.from(new Map((data || []).map((cs: any) => [cs.classes?.id, cs.classes])).values()).filter(Boolean);
    setClasses(uniqueClasses as any[]);
    setLoading(false);
  }, [schoolUser]);

  useEffect(() => { load(); }, [schoolUser]);

  useEffect(() => {
    if (!selectedClass || !school) return;
    Promise.all([
      getStudents(school.id, selectedClass.id),
      getAttendanceByDate(selectedClass.id, today),
    ]).then(([studRes, attRes]) => {
      const studs = studRes.data || [];
      setStudents(studs);
      setExisting(attRes.data || []);
      const map: Record<string, string> = {};
      studs.forEach((s) => { map[s.id] = 'present'; });
      (attRes.data || []).forEach((a: any) => { map[a.student_id] = a.status; });
      setAttendanceMap(map);
    });
  }, [selectedClass, school]);

  const setStatus = (studentId: string, status: string) => {
    setAttendanceMap((prev) => ({ ...prev, [studentId]: status }));
  };

  const handleSave = async () => {
    if (!school || !schoolUser || !selectedClass) return;
    const records = students.map((s) => ({
      schoolId: school.id, classId: selectedClass.id, studentId: s.id,
      date: today, status: attendanceMap[s.id] || 'present', recordedBy: schoolUser.id,
    }));
    setSaving(true);
    const { error } = await bulkRecordAttendance(records);
    setSaving(false);
    if (error) { showAlert('Error', error); return; }
    showAlert('Saved', `Attendance recorded for ${students.length} students.`);
  };

  const summary = Object.values(attendanceMap).reduce((acc, status) => {
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (loading) return <LoadingScreen message="Loading attendance..." />;

  return (
    <View style={styles.flex}>
      <Header title="Attendance" subtitle={today} accentColor={Colors.teacher} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.classScroll} contentContainerStyle={styles.classScrollContent}>
        {classes.map((cls: any) => (
          <Pressable key={cls?.id} style={[styles.classChip, selectedClass?.id === cls?.id && styles.classChipActive]} onPress={() => setSelectedClass(cls)}>
            <Text style={[styles.classChipText, selectedClass?.id === cls?.id && styles.classChipTextActive]}>{cls?.name}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {!selectedClass ? (
        <EmptyState icon="fact-check" title="Select a Class" description="Choose a class to record attendance." />
      ) : (
        <>
          {/* Summary */}
          <View style={styles.summary}>
            {STATUSES.map((s) => (
              <View key={s} style={[styles.summaryItem, { borderBottomColor: STATUS_COLORS[s] }]}>
                <Text style={[styles.summaryCount, { color: STATUS_COLORS[s] }]}>{summary[s] || 0}</Text>
                <Text style={styles.summaryLabel}>{s}</Text>
              </View>
            ))}
          </View>

          <FlatList
            data={students}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={<EmptyState icon="people" title="No Students" description="No students in this class." />}
            renderItem={({ item }) => (
              <Card style={styles.studentCard}>
                <View style={styles.studentRow}>
                  <Avatar name={`${item.full_name}`} size={40} />
                  <View style={styles.studentInfo}>
                    <Text style={styles.studentName}>{item.full_name} {}</Text>
                    <Text style={styles.studentId}>{item.admission_number}</Text>
                  </View>
                </View>
                <View style={styles.statusRow}>
                  {STATUSES.map((status) => (
                    <Pressable
                      key={status}
                      style={[styles.statusBtn, { borderColor: STATUS_COLORS[status] }, attendanceMap[item.id] === status && { backgroundColor: STATUS_COLORS[status] }]}
                      onPress={() => setStatus(item.id, status)}
                    >
                      <Text style={[styles.statusText, attendanceMap[item.id] === status && styles.statusTextActive]}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </Card>
            )}
          />
          <View style={styles.saveBar}>
            <Button label={`Save Attendance (${students.length} students)`} onPress={handleSave} loading={saving} fullWidth size="lg" />
          </View>
        </>
      )}
      <BottomNav items={TEACHER_NAV} accentColor={Colors.teacher} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  classScroll: { maxHeight: 60 },
  classScrollContent: { paddingHorizontal: Spacing.md, alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.sm },
  classChip: { paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: BorderRadius.full, backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border },
  classChipActive: { backgroundColor: Colors.teacher, borderColor: Colors.teacher },
  classChipText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  classChipTextActive: { color: Colors.textPrimary, fontWeight: FontWeight.semibold },
  summary: { flexDirection: 'row', padding: Spacing.md, gap: Spacing.sm },
  summaryItem: { flex: 1, alignItems: 'center', borderBottomWidth: 3, paddingBottom: 4 },
  summaryCount: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  summaryLabel: { fontSize: FontSize.xs, color: Colors.textMuted, textTransform: 'capitalize' },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 120 },
  studentCard: { gap: Spacing.sm },
  studentRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  studentInfo: { flex: 1 },
  studentName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  studentId: { fontSize: FontSize.xs, color: Colors.textMuted },
  statusRow: { flexDirection: 'row', gap: Spacing.xs },
  statusBtn: { flex: 1, paddingVertical: 6, borderRadius: BorderRadius.sm, borderWidth: 1.5, alignItems: 'center' },
  statusText: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  statusTextActive: { color: Colors.textPrimary, fontWeight: FontWeight.bold },
  saveBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: Spacing.md, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border },
});
