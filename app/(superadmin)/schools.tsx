import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Modal, ScrollView } from 'react-native';
import { useAlert } from '@/template';
import { getAllSchools, updateSchoolPlan, toggleSchoolStatus } from '@/services/platform.service';
import { BottomNav } from '@/components/layout/BottomNav';

const SUPER_ADMIN_NAV = [
  { label: 'Dashboard', icon: 'dashboard' as const, route: '/(superadmin)/' },
  { label: 'Schools', icon: 'business' as const, route: '/(superadmin)/schools' },
  { label: 'Revenue', icon: 'attach-money' as const, route: '/(superadmin)/revenue' },
  { label: 'Support', icon: 'support-agent' as const, route: '/(superadmin)/support' },
  { label: 'Announce', icon: 'campaign' as const, route: '/(superadmin)/announcements' },
];
import { Card } from '@/components/ui/Card';
import { Badge, getPlanBadgeVariant } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Header } from '@/components/layout/Header';
import { Input } from '@/components/ui/Input';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { formatDate, getPlanLabel, PLAN_LIMITS } from '@/constants/config';

const PLANS = ['free_trial', 'basic', 'pro', 'enterprise'];

export default function SchoolsScreen() {
  const { showAlert } = useAlert();
  const [schools, setSchools] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedSchool, setSelectedSchool] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    const { data } = await getAllSchools();
    setSchools(data || []);
    setFiltered(data || []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!search.trim()) {
      setFiltered(schools);
    } else {
      const q = search.toLowerCase();
      setFiltered(schools.filter((s) => s.name.toLowerCase().includes(q) || s.subdomain.toLowerCase().includes(q)));
    }
  }, [search, schools]);

  const handleChangePlan = async (plan: string) => {
    if (!selectedSchool) return;
    const { error } = await updateSchoolPlan(selectedSchool.id, plan);
    if (error) {
      showAlert('Error', error);
      return;
    }
    setSchools((prev) => prev.map((s) => s.id === selectedSchool.id ? { ...s, plan } : s));
    setSelectedSchool((prev: any) => ({ ...prev, plan }));
    showAlert('Plan Updated', `${selectedSchool.name} has been moved to ${getPlanLabel(plan)}.`);
  };

  const handleToggleActive = async () => {
    if (!selectedSchool) return;
    const newStatus = !selectedSchool.is_active;
    const { error } = await toggleSchoolStatus(selectedSchool.id, newStatus);
    if (error) {
      showAlert('Error', error);
      return;
    }
    setSchools((prev) => prev.map((s) => s.id === selectedSchool.id ? { ...s, is_active: newStatus } : s));
    setSelectedSchool((prev: any) => ({ ...prev, is_active: newStatus }));
    showAlert('Status Updated', `${selectedSchool.name} is now ${newStatus ? 'active' : 'suspended'}.`);
  };

  if (loading) return <LoadingScreen message="Loading schools..." />;

  return (
    <View style={styles.flex}>
      <Header title="Schools" subtitle={`${schools.length} registered`} accentColor={Colors.superAdmin} />
      <View style={styles.searchBar}>
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Search schools..."
          leftIcon="search"
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={() => { setRefreshing(true); load(); }}
        ListEmptyComponent={<EmptyState icon="business" title="No schools found" description="No schools match your search." />}
        renderItem={({ item }) => (
          <Card style={styles.schoolCard} onPress={() => { setSelectedSchool(item); setShowModal(true); }}>
            <View style={styles.schoolRow}>
              <Avatar name={item.name} size={44} />
              <View style={styles.schoolInfo}>
                <Text style={styles.schoolName}>{item.name}</Text>
                <Text style={styles.schoolSub}>{item.subdomain}.edumanage.com</Text>
                <Text style={styles.schoolEmail}>{item.email}</Text>
                <Text style={styles.schoolDate}>Joined {formatDate(item.created_at)}</Text>
              </View>
              <View style={styles.badges}>
                <Badge label={getPlanLabel(item.plan)} variant={getPlanBadgeVariant(item.plan)} size="sm" />
                <Badge label={item.is_active ? 'Active' : 'Suspended'} variant={item.is_active ? 'success' : 'error'} size="sm" />
              </View>
            </View>
            <View style={styles.statsRow}>
              {[
                { label: 'Max Students', value: item.max_students },
                { label: 'Max Teachers', value: item.max_teachers },
                { label: 'AI Limit', value: item.ai_usage_limit },
                { label: 'AI Used', value: item.ai_usage_count || 0 },
              ].map((stat) => (
                <View key={stat.label} style={styles.statItem}>
                  <Text style={styles.statValue}>{stat.value}</Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </View>
              ))}
            </View>
          </Card>
        )}
      />

      {/* School Detail Modal */}
      <Modal visible={showModal} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedSchool?.name}</Text>
              <Pressable onPress={() => setShowModal(false)} hitSlop={8}>
                <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalSub}>{selectedSchool?.subdomain}.edumanage.com</Text>
              <Text style={styles.modalSub}>{selectedSchool?.email}</Text>

              <Text style={styles.sectionLabel}>Current Plan</Text>
              <Badge label={getPlanLabel(selectedSchool?.plan)} variant={getPlanBadgeVariant(selectedSchool?.plan)} />

              <Text style={styles.sectionLabel}>Change Plan</Text>
              <View style={styles.planGrid}>
                {PLANS.map((plan) => (
                  <Pressable
                    key={plan}
                    style={[styles.planOption, selectedSchool?.plan === plan && styles.planOptionActive]}
                    onPress={() => handleChangePlan(plan)}
                  >
                    <Text style={[styles.planOptionText, selectedSchool?.plan === plan && styles.planOptionTextActive]}>
                      {getPlanLabel(plan)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.sectionLabel}>School Status</Text>
              <Button
                label={selectedSchool?.is_active ? 'Suspend School' : 'Activate School'}
                onPress={handleToggleActive}
                variant={selectedSchool?.is_active ? 'danger' : 'primary'}
                fullWidth
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
      <BottomNav items={SUPER_ADMIN_NAV} accentColor={Colors.superAdmin} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  searchBar: { padding: Spacing.md, paddingBottom: 0 },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 100 },
  schoolCard: { gap: Spacing.sm },
  schoolRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  schoolInfo: { flex: 1, gap: 2 },
  schoolName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  schoolSub: { fontSize: FontSize.sm, color: Colors.textSecondary },
  schoolEmail: { fontSize: FontSize.xs, color: Colors.textMuted },
  schoolDate: { fontSize: FontSize.xs, color: Colors.textMuted },
  badges: { gap: 4, alignItems: 'flex-end' },
  statsRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  statLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: Spacing.lg, maxHeight: '80%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  modalSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 4 },
  sectionLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.semibold, marginTop: Spacing.md, marginBottom: Spacing.sm },
  planGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.sm },
  planOption: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface2 },
  planOptionActive: { borderColor: Colors.primary, backgroundColor: Colors.schoolAdminBg },
  planOptionText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  planOptionTextActive: { color: Colors.primary, fontWeight: FontWeight.semibold },
});
