import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Modal, Pressable, ScrollView } from 'react-native';
import { useAlert } from '@/template';
import { useAppContext } from '@/hooks/useAppContext';
import { BottomNav } from '@/components/layout/BottomNav';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { getScholarships, createScholarship, Scholarship } from '@/services/finance.service';

const NAV = [
  { label: 'Finance', icon: 'account-balance' as const, route: '/(bursar)/' },
  { label: 'Invoices', icon: 'receipt' as const, route: '/(bursar)/invoices' },
  { label: 'Payments', icon: 'payments' as const, route: '/(bursar)/payments' },
  { label: 'Reports', icon: 'bar-chart' as const, route: '/(bursar)/reports' },
];

function formatCurrency(amount: number) {
  return `KES ${Number(amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function ScholarshipsScreen() {
  const { school, profileId } = useAppContext();
  const { showAlert } = useAlert();
  const [scholarships, setScholarships] = useState<Scholarship[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState<'amount' | 'percentage'>('amount');
  const [form, setForm] = useState({
    name: '',
    student_id: '',
    amount: '',
    percentage: '',
    reason: '',
    expires_at: '',
  });

  const load = useCallback(async () => {
    if (!school) return;
    const { data, error } = await getScholarships(school.id);
    if (error) { showAlert('Error', error); }
    setScholarships(data || []);
    setLoading(false);
    setRefreshing(false);
  }, [school]);

  useEffect(() => { load(); }, [school]);

  const handleSave = async () => {
    if (!school || !profileId) return;
    if (!form.name.trim() || !form.student_id.trim()) {
      showAlert('Missing Fields', 'Scholarship name and student ID are required.'); return;
    }
    setSaving(true);
    const { error } = await createScholarship(school.id, {
      name: form.name.trim(),
      student_id: form.student_id.trim(),
      amount: type === 'amount' && form.amount ? parseFloat(form.amount) : 0,
      percentage: type === 'percentage' && form.percentage ? parseFloat(form.percentage) : 0,
      reason: form.reason.trim() || undefined,
      expires_at: form.expires_at || undefined,
      awarded_by: profileId,
    });
    setSaving(false);
    if (error) { showAlert('Error', error); return; }
    showAlert('Scholarship Awarded', `${form.name} has been awarded.`);
    setShowModal(false);
    setForm({ name: '', student_id: '', amount: '', percentage: '', reason: '', expires_at: '' });
    setType('amount');
    load();
  };

  if (loading) return <LoadingScreen message="Loading scholarships..." />;

  return (
    <View style={styles.flex}>
      <Header
        title="Scholarships"
        subtitle={`${scholarships.length} awarded`}
        accentColor={Colors.success}
        rightAction={{ icon: 'add', onPress: () => setShowModal(true) }}
      />
      <FlatList
        data={scholarships}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={() => { setRefreshing(true); load(); }}
        ListEmptyComponent={
          <EmptyState
            icon="school"
            title="No Scholarships"
            description="Award scholarships to deserving students — either as fixed amounts or percentage discounts."
            actionLabel="New Scholarship"
            onAction={() => setShowModal(true)}
          />
        }
        renderItem={({ item: sch }) => {
          const studentName = (sch as any).students ? (sch as any).students.full_name : 'Unknown Student';
          const expired = sch.expires_at && new Date(sch.expires_at).getTime() < Date.now();
          return (
            <Card>
              <View style={styles.schRow}>
                <View style={styles.schIcon}>
                  <MaterialIcons name="school" size={20} color={Colors.superAdmin} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.schName}>{sch.name}</Text>
                  <Text style={styles.schStudent}>{studentName}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  {sch.percentage > 0 ? (
                    <Text style={[styles.schVal, { color: Colors.superAdmin }]}>{sch.percentage}%</Text>
                  ) : (
                    <Text style={[styles.schVal, { color: Colors.success }]}>{formatCurrency(sch.amount)}</Text>
                  )}
                  {expired ? <Badge label="Expired" variant="error" size="sm" /> : <Badge label="Active" variant="success" size="sm" />}
                </View>
              </View>
              {sch.reason ? (
                <View style={styles.reasonRow}>
                  <MaterialIcons name="notes" size={12} color={Colors.textMuted} />
                  <Text style={styles.reasonText}>{sch.reason}</Text>
                </View>
              ) : null}
              <View style={styles.dateRow}>
                <Text style={styles.dateText}>Awarded: {formatDate(sch.awarded_at)}</Text>
                <Text style={[styles.dateText, expired && { color: Colors.error }]}>Expires: {formatDate(sch.expires_at)}</Text>
              </View>
            </Card>
          );
        }}
      />

      {/* New Scholarship Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Scholarship</Text>
              <Pressable onPress={() => setShowModal(false)} hitSlop={8}>
                <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Input label="Scholarship Name *" value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="e.g., Academic Excellence Award" leftIcon="school" />
              <Input label="Student ID *" value={form.student_id} onChangeText={(v) => setForm((f) => ({ ...f, student_id: v }))} placeholder="Student UUID" leftIcon="person" />
              <Text style={styles.fieldLabel}>Award Type</Text>
              <View style={styles.typeRow}>
                <Pressable style={[styles.typeBtn, type === 'amount' && styles.typeBtnActive]} onPress={() => setType('amount')}>
                  <MaterialIcons name="payments" size={16} color={type === 'amount' ? Colors.textPrimary : Colors.textSecondary} />
                  <Text style={[styles.typeText, type === 'amount' && styles.typeTextActive]}>Fixed Amount</Text>
                </Pressable>
                <Pressable style={[styles.typeBtn, type === 'percentage' && styles.typeBtnActive]} onPress={() => setType('percentage')}>
                  <MaterialIcons name="percent" size={16} color={type === 'percentage' ? Colors.textPrimary : Colors.textSecondary} />
                  <Text style={[styles.typeText, type === 'percentage' && styles.typeTextActive]}>Percentage</Text>
                </Pressable>
              </View>
              {type === 'amount' ? (
                <Input label="Amount (KES)" value={form.amount} onChangeText={(v) => setForm((f) => ({ ...f, amount: v }))} placeholder="10000" keyboardType="numeric" leftIcon="payments" />
              ) : (
                <Input label="Percentage (%)" value={form.percentage} onChangeText={(v) => setForm((f) => ({ ...f, percentage: v }))} placeholder="50" keyboardType="numeric" leftIcon="percent" />
              )}
              <Input label="Reason" value={form.reason} onChangeText={(v) => setForm((f) => ({ ...f, reason: v }))} placeholder="Reason for awarding" leftIcon="notes" multiline />
              <Input label="Expires At" value={form.expires_at} onChangeText={(v) => setForm((f) => ({ ...f, expires_at: v }))} placeholder="YYYY-MM-DD" leftIcon="event" />
              <Button label={saving ? 'Saving...' : 'Award Scholarship'} onPress={handleSave} loading={saving} fullWidth style={{ marginTop: Spacing.md, marginBottom: Spacing.lg }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
      <BottomNav items={NAV} accentColor={Colors.success} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 100 },
  schRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  schIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.superAdminBg, alignItems: 'center', justifyContent: 'center' },
  schName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  schStudent: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  schVal: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  reasonRow: { flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.sm, alignItems: 'flex-start' },
  reasonText: { flex: 1, fontSize: FontSize.xs, color: Colors.textMuted, fontStyle: 'italic' },
  dateRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  dateText: { fontSize: FontSize.xs, color: Colors.textMuted },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  fieldLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium, marginBottom: 6, marginTop: Spacing.sm },
  typeRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border },
  typeBtnActive: { backgroundColor: Colors.success, borderColor: Colors.success },
  typeText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  typeTextActive: { color: Colors.textPrimary },
});
