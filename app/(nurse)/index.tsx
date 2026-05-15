import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Modal } from 'react-native';
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
import { getClinicStats, getClinicVisits, createClinicVisit, getStudentsWithMedicalRecords } from '@/services/medical.service';

const NAV = [
  { label: 'Clinic', icon: 'local-hospital' as const, route: '/(nurse)/' },
  { label: 'Visits', icon: 'healing' as const, route: '/(nurse)/visits' },
  { label: 'Records', icon: 'folder-shared' as const, route: '/(nurse)/records' },
];

export default function NurseDashboard() {
  const { user, logout } = useAuth();
  const { showAlert } = useAlert();
  const { school, schoolUser } = useAppContext();
  const [stats, setStats] = useState<any>(null);
  const [recentVisits, setRecentVisits] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewVisit, setShowNewVisit] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [reason, setReason] = useState('');
  const [treatment, setTreatment] = useState('');
  const [temperature, setTemperature] = useState('');
  const [outcome, setOutcome] = useState('treated_and_returned');
  const [parentNotified, setParentNotified] = useState(false);
  const [saving, setSaving] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  const load = useCallback(async () => {
    if (!school) return;
    const [statsRes, visitsRes, studentsRes] = await Promise.all([
      getClinicStats(school.id),
      getClinicVisits(school.id),
      getStudentsWithMedicalRecords(school.id),
    ]);
    setStats(statsRes);
    setRecentVisits((visitsRes.data || []).slice(0, 8));
    setStudents(studentsRes.data || []);
    setLoading(false);
  }, [school]);

  useEffect(() => { load(); }, [school]);

  const handleLogVisit = async () => {
    if (!selectedStudent || !reason.trim()) {
      showAlert('Missing Info', 'Please select a student and enter the reason for visit.');
      return;
    }
    setSaving(true);
    const { error } = await createClinicVisit(school!.id, {
      student_id: selectedStudent.id,
      reason: reason.trim(),
      treatment: treatment.trim(),
      temperature: temperature ? parseFloat(temperature) : undefined,
      outcome,
      parent_notified: parentNotified,
      recorded_by: schoolUser?.id,
    });
    setSaving(false);
    if (error) { showAlert('Error', error.message); return; }
    setShowNewVisit(false);
    setSelectedStudent(null);
    setReason(''); setTreatment(''); setTemperature('');
    showAlert('Success', 'Clinic visit logged successfully');
    load();
  };

  if (loading) return <LoadingScreen message="Loading clinic data..." />;

  const filteredStudents = students.filter(s =>
    !studentSearch ||
    `${s.first_name} ${s.last_name}`.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.admission_number?.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const hasAllergy = (s: any) => s.medical_records?.[0]?.allergies?.length > 0;

  return (
    <View style={s.flex}>
      <Header
        title="Health / Clinic"
        subtitle={school?.name}
        accentColor="#D32F2F"
        rightAction={{ icon: 'logout', onPress: () => showAlert('Sign Out', 'Sign out?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign Out', style: 'destructive', onPress: () => logout() }]) }}
      />
      <ScrollView style={s.flex} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Welcome */}
        <View style={s.welcomeRow}>
          <View style={s.avatar}><MaterialIcons name="local-hospital" size={22} color="#D32F2F" /></View>
          <View>
            <Text style={s.welcomeName}>{user?.username || 'Nurse'}</Text>
            <Text style={s.welcomeRole}>Health Officer · School Clinic</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={s.statsGrid}>
          {[
            { label: "Today's Visits", value: stats?.todayVisits || 0, icon: 'today', color: '#D32F2F' },
            { label: 'This Week', value: stats?.weekVisits || 0, icon: 'date-range', color: Colors.warning },
            { label: 'Referrals (30d)', value: stats?.referralsThisMonth || 0, icon: 'local-hospital', color: Colors.error },
          ].map(stat => (
            <View key={stat.label} style={s.statCard}>
              <MaterialIcons name={stat.icon as any} size={20} color={stat.color} />
              <Text style={[s.statNum, { color: stat.color }]}>{stat.value}</Text>
              <Text style={s.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Log New Visit */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Today's Visits</Text>
          <Pressable style={s.addBtn} onPress={() => setShowNewVisit(!showNewVisit)}>
            <MaterialIcons name={showNewVisit ? 'close' : 'add'} size={18} color={Colors.textPrimary} />
            <Text style={s.addBtnText}>{showNewVisit ? 'Cancel' : 'New Visit'}</Text>
          </Pressable>
        </View>

        {showNewVisit ? (
          <Card style={s.formCard}>
            <Text style={s.formTitle}>Log Clinic Visit</Text>

            {/* Student Selection */}
            <Text style={s.fieldLabel}>Select Student *</Text>
            <TextInput
              style={s.input}
              value={studentSearch}
              onChangeText={setStudentSearch}
              placeholder="Search student name or admission number..."
              placeholderTextColor={Colors.textMuted}
            />
            {studentSearch && !selectedStudent ? (
              <View style={s.dropdown}>
                {filteredStudents.slice(0, 5).map(st => (
                  <Pressable key={st.id} style={s.dropItem} onPress={() => { setSelectedStudent(st); setStudentSearch(`${st.first_name} ${st.last_name}`); }}>
                    <Text style={s.dropName}>{st.first_name} {st.last_name}</Text>
                    <Text style={s.dropAdm}>{st.admission_number} · {st.classes?.name}</Text>
                    {hasAllergy(st) ? <Badge label="ALLERGY" variant="error" size="sm" /> : null}
                  </Pressable>
                ))}
              </View>
            ) : null}

            {selectedStudent ? (
              <View style={s.selectedStudent}>
                <MaterialIcons name="person" size={16} color={Colors.primary} />
                <Text style={s.selectedName}>{selectedStudent.first_name} {selectedStudent.last_name}</Text>
                {hasAllergy(selectedStudent) ? (
                  <View style={s.allergyWarn}>
                    <MaterialIcons name="warning" size={12} color={Colors.error} />
                    <Text style={s.allergyText}>Has allergies</Text>
                  </View>
                ) : null}
                <Pressable onPress={() => { setSelectedStudent(null); setStudentSearch(''); }}>
                  <MaterialIcons name="close" size={16} color={Colors.textMuted} />
                </Pressable>
              </View>
            ) : null}

            {[
              { label: 'Reason for Visit *', val: reason, set: setReason, placeholder: 'e.g., Headache, Stomachache, Injury...' },
              { label: 'Treatment Given', val: treatment, set: setTreatment, placeholder: 'e.g., Paracetamol 500mg, Ice pack...' },
              { label: 'Temperature (°C)', val: temperature, set: setTemperature, placeholder: '36.5', keyboard: 'numeric' as const },
            ].map(field => (
              <View key={field.label} style={s.fieldWrap}>
                <Text style={s.fieldLabel}>{field.label}</Text>
                <TextInput
                  style={s.input}
                  value={field.val}
                  onChangeText={field.set}
                  placeholder={field.placeholder}
                  placeholderTextColor={Colors.textMuted}
                  keyboardType={field.keyboard}
                />
              </View>
            ))}

            <Text style={s.fieldLabel}>Outcome</Text>
            <View style={s.outcomeRow}>
              {[
                { val: 'treated_and_returned', label: 'Returned to Class' },
                { val: 'sent_home', label: 'Sent Home' },
                { val: 'referred_to_hospital', label: 'Hospital Referral' },
              ].map(o => (
                <Pressable key={o.val} style={[s.outcomeBtn, outcome === o.val && s.outcomeBtnActive]} onPress={() => setOutcome(o.val)}>
                  <Text style={[s.outcomeBtnText, outcome === o.val && s.outcomeBtnTextActive]}>{o.label}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable style={s.checkRow} onPress={() => setParentNotified(!parentNotified)}>
              <MaterialIcons name={parentNotified ? 'check-box' : 'check-box-outline-blank'} size={22} color={parentNotified ? Colors.success : Colors.textMuted} />
              <Text style={s.checkLabel}>Parent/Guardian Notified</Text>
            </Pressable>

            <Button label={saving ? 'Logging...' : 'Log Visit'} onPress={handleLogVisit} loading={saving} fullWidth />
          </Card>
        ) : null}

        {/* Recent Visits */}
        {recentVisits.map(v => (
          <Card key={v.id} style={s.visitCard}>
            <View style={s.visitRow}>
              <View style={[s.visitIcon, {
                backgroundColor: v.referred_to_hospital ? Colors.errorBg :
                  v.outcome === 'sent_home' ? Colors.warningBg : Colors.successBg,
              }]}>
                <MaterialIcons
                  name={v.referred_to_hospital ? 'local-hospital' : v.outcome === 'sent_home' ? 'home' : 'healing'}
                  size={18}
                  color={v.referred_to_hospital ? Colors.error : v.outcome === 'sent_home' ? Colors.warning : Colors.success}
                />
              </View>
              <View style={s.visitInfo}>
                <Text style={s.visitName}>
                  {v.students ? `${v.students.first_name} ${v.students.last_name}` : 'Unknown'}
                </Text>
                <Text style={s.visitReason}>{v.reason}</Text>
                {v.treatment ? <Text style={s.visitTreatment}>Rx: {v.treatment}</Text> : null}
              </View>
              <View style={s.visitMeta}>
                <Text style={s.visitTime}>{new Date(v.visited_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                {v.parent_notified ? <Badge label="Parent Notified" variant="success" size="sm" /> : null}
              </View>
            </View>
          </Card>
        ))}
        {recentVisits.length === 0 && !showNewVisit && (
          <Card><Text style={s.emptyText}>No visits recorded today. Log a new visit above.</Text></Card>
        )}
      </ScrollView>
      <BottomNav items={NAV} accentColor="#D32F2F" />
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingBottom: 100, gap: Spacing.sm },
  welcomeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.sm },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(211,47,47,0.15)', alignItems: 'center', justifyContent: 'center' },
  welcomeName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  welcomeRole: { fontSize: FontSize.sm, color: Colors.textSecondary },
  statsGrid: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  statCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: Colors.border },
  statNum: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold },
  statLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'center' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.xs },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.surface2, paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: BorderRadius.sm },
  addBtnText: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.medium },
  formCard: { gap: Spacing.sm },
  formTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  fieldWrap: { gap: 4 },
  fieldLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium, marginTop: 2 },
  input: { backgroundColor: Colors.surface2, borderRadius: BorderRadius.sm, padding: Spacing.md, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border, fontSize: FontSize.base },
  dropdown: { backgroundColor: Colors.surface2, borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: Colors.border },
  dropItem: { padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 2 },
  dropName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  dropAdm: { fontSize: FontSize.xs, color: Colors.textSecondary },
  selectedStudent: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.infoBg, padding: Spacing.sm, borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: `${Colors.info}30` },
  selectedName: { flex: 1, fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  allergyWarn: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: Colors.errorBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  allergyText: { fontSize: 10, color: Colors.error, fontWeight: FontWeight.bold },
  outcomeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  outcomeBtn: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface2 },
  outcomeBtnActive: { backgroundColor: Colors.primaryDark, borderColor: Colors.primary },
  outcomeBtnText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  outcomeBtnTextActive: { color: Colors.textPrimary, fontWeight: FontWeight.semibold },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  checkLabel: { fontSize: FontSize.base, color: Colors.textPrimary },
  visitCard: {},
  visitRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  visitIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  visitInfo: { flex: 1, gap: 2 },
  visitName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  visitReason: { fontSize: FontSize.sm, color: Colors.textSecondary },
  visitTreatment: { fontSize: FontSize.xs, color: Colors.textMuted },
  visitMeta: { alignItems: 'flex-end', gap: 4 },
  visitTime: { fontSize: FontSize.xs, color: Colors.textMuted },
  emptyText: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center', padding: Spacing.sm },
});
