import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Modal, Pressable, ScrollView } from 'react-native';
import { useAlert } from '@/template';
import { useAppContext } from '@/hooks/useAppContext';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import {
  listDomains,
  addCustomDomain,
  verifyDomain,
  removeDomain,
  setPrimaryDomain,
  CustomDomain,
} from '@/services/domain.service';

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function DomainsScreen() {
  const { school, profileId } = useAppContext();
  const { showAlert } = useAlert();
  const [domains, setDomains] = useState<CustomDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newDomain, setNewDomain] = useState('');

  const load = useCallback(async () => {
    if (!school) return;
    const { data, error } = await listDomains(school.id);
    if (error) { showAlert('Error', error); }
    setDomains(data || []);
    setLoading(false);
    setRefreshing(false);
  }, [school]);

  useEffect(() => { load(); }, [school]);

  const handleAdd = async () => {
    if (!school || !profileId) return;
    if (!newDomain.trim()) { showAlert('Missing Domain', 'Please enter a domain name.'); return; }
    setSaving(true);
    const { data, error } = await addCustomDomain(school.id, newDomain.trim(), profileId);
    setSaving(false);
    if (error) { showAlert('Error', error); return; }
    showAlert('Domain Added', `${data?.domain} added. Please add the verification TXT record to your DNS.`);
    setShowModal(false);
    setNewDomain('');
    load();
  };

  const handleVerify = async (d: CustomDomain) => {
    if (!school || !profileId) return;
    const { error } = await verifyDomain(school.id, d.id, profileId);
    if (error) { showAlert('Verification Failed', error); return; }
    showAlert('Verified', `${d.domain} has been marked as verified. SSL provisioning will begin shortly.`);
    load();
  };

  const handleSetPrimary = (d: CustomDomain) => {
    if (!school) return;
    showAlert('Set Primary', `Set ${d.domain} as your primary domain?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Set Primary',
        onPress: async () => {
          const { error } = await setPrimaryDomain(school.id, d.id);
          if (error) { showAlert('Error', error); return; }
          showAlert('Primary Updated', `${d.domain} is now your primary domain.`);
          load();
        },
      },
    ]);
  };

  const handleRemove = (d: CustomDomain) => {
    if (!school || !profileId) return;
    showAlert('Remove Domain', `Remove ${d.domain}? This action cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const { error } = await removeDomain(school.id, d.id, profileId);
          if (error) { showAlert('Error', error); return; }
          showAlert('Removed', `${d.domain} has been removed.`);
          load();
        },
      },
    ]);
  };

  if (loading) return <LoadingScreen message="Loading domains..." />;

  return (
    <View style={styles.flex}>
      <Header
        title="Domains"
        subtitle={school?.name}
        showBack
        accentColor={Colors.primary}
        rightAction={{ icon: 'add', onPress: () => setShowModal(true) }}
      />
      <FlatList
        data={domains}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={() => { setRefreshing(true); load(); }}
        ListHeaderComponent={
          <View>
            {/* Current subdomain */}
            <Card>
              <View style={styles.subdomainRow}>
                <View style={styles.subIconWrap}>
                  <MaterialIcons name="language" size={22} color={Colors.secondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.labelText}>Current Subdomain</Text>
                  <Text style={styles.subdomainVal}>{school?.subdomain}.edumanage.app</Text>
                </View>
                <Badge label="Default" variant="info" size="sm" />
              </View>
              <Text style={styles.helperText}>This is your school's default address on the EduManage platform. Add a custom domain to white-label your deployment.</Text>
            </Card>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Custom Domains</Text>
              <Pressable style={styles.addBtn} onPress={() => setShowModal(true)}>
                <MaterialIcons name="add" size={16} color={Colors.primary} />
                <Text style={styles.addBtnText}>Add Domain</Text>
              </Pressable>
            </View>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="dns"
            title="No Custom Domains"
            description="Add a custom domain (e.g., portal.yourschool.edu) to white-label your EduManage deployment."
            actionLabel="Add Domain"
            onAction={() => setShowModal(true)}
          />
        }
        renderItem={({ item }) => (
          <Card>
            <View style={styles.domainRow}>
              <View style={[styles.domainIcon, { backgroundColor: item.is_primary ? Colors.successBg : Colors.surface2 }]}>
                <MaterialIcons name={item.is_primary ? 'verified' : 'public'} size={18} color={item.is_primary ? Colors.success : Colors.primary} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.domainName}>{item.domain}</Text>
                <View style={styles.badgeRow}>
                  <Badge label={item.status} variant={item.status === 'verified' || item.status === 'active' ? 'success' : item.status === 'pending' ? 'warning' : 'default'} size="sm" />
                  <Badge label={item.ssl_status || 'none'} variant={item.ssl_status === 'active' ? 'success' : 'default'} size="sm" />
                  {item.is_primary ? <Badge label="Primary" variant="primary" size="sm" /> : null}
                </View>
                <Text style={styles.metaText}>Verified: {formatDate(item.verified_at)}</Text>
                {item.verification_token ? (
                  <View style={styles.tokenRow}>
                    <Text style={styles.tokenLabel}>Verification Token:</Text>
                    <Text style={styles.tokenVal} numberOfLines={1}>{item.verification_token}</Text>
                  </View>
                ) : null}
              </View>
            </View>
            <View style={styles.actionRow}>
              {item.status === 'pending' ? (
                <Pressable style={[styles.actionBtn, { borderColor: Colors.success }]} onPress={() => handleVerify(item)}>
                  <MaterialIcons name="check-circle" size={14} color={Colors.success} />
                  <Text style={[styles.actionText, { color: Colors.success }]}>Verify</Text>
                </Pressable>
              ) : null}
              {!item.is_primary && (item.status === 'verified' || item.status === 'active') ? (
                <Pressable style={[styles.actionBtn, { borderColor: Colors.primary }]} onPress={() => handleSetPrimary(item)}>
                  <MaterialIcons name="star" size={14} color={Colors.primary} />
                  <Text style={[styles.actionText, { color: Colors.primary }]}>Set Primary</Text>
                </Pressable>
              ) : null}
              <Pressable style={[styles.actionBtn, { borderColor: Colors.error }]} onPress={() => handleRemove(item)}>
                <MaterialIcons name="delete-outline" size={14} color={Colors.error} />
                <Text style={[styles.actionText, { color: Colors.error }]}>Remove</Text>
              </Pressable>
            </View>
          </Card>
        )}
      />

      {/* Add Domain Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Custom Domain</Text>
              <Pressable onPress={() => setShowModal(false)} hitSlop={8}>
                <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
              </Pressable>
            </View>
            <Input
              label="Domain Name *"
              value={newDomain}
              onChangeText={setNewDomain}
              placeholder="portal.yourschool.edu"
              autoCapitalize="none"
              leftIcon="public"
            />
            <Text style={styles.helperText}>You'll need to add a verification TXT record to your DNS, plus a CNAME pointing to edumanage.app.</Text>
            <Button label={saving ? 'Adding...' : 'Add Domain'} onPress={handleAdd} loading={saving} fullWidth style={{ marginTop: Spacing.md, marginBottom: Spacing.lg }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 100 },
  subdomainRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.xs },
  subIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.infoBg, alignItems: 'center', justifyContent: 'center' },
  labelText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  subdomainVal: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  helperText: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: Spacing.xs, lineHeight: 18 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.lg, marginBottom: Spacing.xs },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 6, backgroundColor: Colors.schoolAdminBg, borderRadius: BorderRadius.sm },
  addBtnText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semibold },
  domainRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.sm },
  domainIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  domainName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  badgeRow: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' },
  metaText: { fontSize: FontSize.xs, color: Colors.textMuted },
  tokenRow: { flexDirection: 'row', gap: 4, alignItems: 'center', marginTop: 4, backgroundColor: Colors.surface2, padding: Spacing.xs, borderRadius: BorderRadius.sm },
  tokenLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  tokenVal: { fontSize: FontSize.xs, color: Colors.textPrimary, fontWeight: FontWeight.medium, flex: 1 },
  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: BorderRadius.sm, borderWidth: 1, backgroundColor: 'transparent' },
  actionText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
});
