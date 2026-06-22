import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { getLeads, createLead, updateLeadStatus } from '@/services/company.service';
import { useAlert } from '@/template';
import { Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';

export default function SalesDashboard() {
  const { showAlert } = useAlert();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ school_name: '', contact_name: '', contact_email: '', contact_phone: '', country: '', lead_source: 'website', estimated_value: '' });

  const load = useCallback(async () => { const { data } = await getLeads(filter !== 'all' ? { status: filter } : undefined); setLeads(data || []); setLoading(false); }, [filter]);
  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const handleAdd = async () => {
    if (!form.school_name || !form.contact_name || !form.contact_email) { showAlert('Missing', 'School name, contact name, and email are required'); return; }
    const { error } = await createLead({ ...form, estimated_value: form.estimated_value ? parseFloat(form.estimated_value) : undefined });
    if (error) { showAlert('Error', error); return; }
    setShowAdd(false); setForm({ school_name: '', contact_name: '', contact_email: '', contact_phone: '', country: '', lead_source: 'website', estimated_value: '' }); load();
  };

  const handleStatusChange = async (id: string, status: string) => { await updateLeadStatus(id, status); load(); };

  if (loading) return <LoadingScreen message="Loading leads..." />;

  return (
    <SafeAreaView style={s.flex} edges={['bottom']}>
      <Header title="Sales Dashboard" subtitle="Lead Pipeline" showBack accentColor={Colors.primary} rightAction={{ icon: 'add', onPress: () => setShowAdd(true) }} />
      <View style={s.filters}>
        {['all', 'new', 'contacted', 'qualified', 'won', 'lost'].map(f => (
          <Pressable key={f} style={[s.chip, filter === f && s.chipActive]} onPress={() => setFilter(f)}><Text style={[s.chipText, filter === f && s.chipTextActive]}>{f.toUpperCase()}</Text></Pressable>
        ))}
      </View>
      <FlatList data={leads} keyExtractor={(item) => item.id} contentContainerStyle={s.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        renderItem={({ item }) => (
          <Card style={s.leadCard}>
            <View style={s.leadRow}><View style={s.leadInfo}><Text style={s.leadName}>{item.school_name}</Text><Text style={s.leadContact}>{item.contact_name} · {item.contact_email}</Text>{item.estimated_value ? <Text style={s.leadValue}>${item.estimated_value.toLocaleString()}</Text> : null}</View>
              <Badge label={item.lead_status} variant={item.lead_status === 'won' ? 'success' : item.lead_status === 'lost' ? 'error' : 'default'} size="sm" />
            </View>
            {item.lead_status !== 'won' && item.lead_status !== 'lost' && (
              <View style={s.actions}>
                {item.lead_status === 'new' && <Button label="Mark Contacted" size="sm" onPress={() => handleStatusChange(item.id, 'contacted')} />}
                {item.lead_status === 'contacted' && <Button label="Qualify" size="sm" onPress={() => handleStatusChange(item.id, 'qualified')} />}
                {item.lead_status === 'qualified' && <><Button label="Won" size="sm" onPress={() => handleStatusChange(item.id, 'won')} /><Button label="Lost" size="sm" variant="danger" onPress={() => handleStatusChange(item.id, 'lost')} /></>}
              </View>
            )}
          </Card>
        )}
        ListEmptyComponent={<EmptyState icon="trending-up" title="No leads" description="Create a lead to start tracking" />}
      />
      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <View style={s.overlay}><View style={s.modal}>
          <Text style={s.modalTitle}>New Lead</Text>
          <Input label="School Name *" value={form.school_name} onChangeText={(v) => setForm({ ...form, school_name: v })} />
          <Input label="Contact Name *" value={form.contact_name} onChangeText={(v) => setForm({ ...form, contact_name: v })} />
          <Input label="Contact Email *" value={form.contact_email} onChangeText={(v) => setForm({ ...form, contact_email: v })} keyboardType="email-address" />
          <Input label="Phone" value={form.contact_phone} onChangeText={(v) => setForm({ ...form, contact_phone: v })} keyboardType="phone-pad" />
          <Input label="Country" value={form.country} onChangeText={(v) => setForm({ ...form, country: v })} />
          <Input label="Estimated Value ($)" value={form.estimated_value} onChangeText={(v) => setForm({ ...form, estimated_value: v })} keyboardType="numeric" />
          <View style={s.modalActions}><Button label="Cancel" variant="ghost" onPress={() => setShowAdd(false)} /><Button label="Create Lead" onPress={handleAdd} /></View>
        </View></View>
      </Modal>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({ flex: { flex: 1, backgroundColor: Colors.background }, filters: { flexDirection: 'row', padding: Spacing.sm, gap: 6, flexWrap: 'wrap' }, chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: Colors.surface2 }, chipActive: { backgroundColor: Colors.primary }, chipText: { fontSize: 10, color: Colors.textSecondary, fontWeight: FontWeight.bold }, chipTextActive: { color: Colors.textPrimary }, list: { padding: Spacing.md, gap: Spacing.sm }, leadCard: { padding: Spacing.md, gap: 8 }, leadRow: { flexDirection: 'row', justifyContent: 'space-between' }, leadInfo: { flex: 1 }, leadName: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary }, leadContact: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 }, leadValue: { fontSize: FontSize.sm, color: Colors.success, marginTop: 2, fontWeight: FontWeight.bold }, actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: 8 }, overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: Spacing.lg }, modal: { backgroundColor: Colors.surface, borderRadius: 16, padding: Spacing.lg, gap: Spacing.md }, modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary }, modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm } });
