import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useAuth, useAlert } from '@/template';
import { useAppContext } from '@/hooks/useAppContext';
import { updateSchool, createTicket } from '@/services/school.service';
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
import { Badge, getPlanBadgeVariant } from '@/components/ui/Badge';
import { Header } from '@/components/layout/Header';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { getPlanLabel, formatDate } from '@/constants/config';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const { showAlert } = useAlert();
  const { school, refreshContext } = useAppContext();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(school?.name || '');
  const [phone, setPhone] = useState(school?.phone || '');
  const [address, setAddress] = useState(school?.address || '');
  const [ticketTitle, setTicketTitle] = useState('');
  const [ticketDesc, setTicketDesc] = useState('');
  const [ticketCategory, setTicketCategory] = useState('general');
  const [sendingTicket, setSendingTicket] = useState(false);
  const [showTicket, setShowTicket] = useState(false);

  const handleSave = async () => {
    if (!school) return;
    setSaving(true);
    const { error } = await updateSchool(school.id, { name, phone, address });
    setSaving(false);
    if (error) { showAlert('Error', error.message); return; }
    await refreshContext();
    showAlert('Saved', 'School settings updated successfully.');
  };

  const handleLogout = () => {
    showAlert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const handleSubmitTicket = async () => {
    if (!ticketTitle.trim() || !ticketDesc.trim() || !school || !user) return;
    setSendingTicket(true);
    const { error } = await createTicket(school.id, user.id, ticketTitle.trim(), ticketDesc.trim(), ticketCategory, 'medium');
    setSendingTicket(false);
    if (error) { showAlert('Error', error.message); return; }
    setTicketTitle('');
    setTicketDesc('');
    setShowTicket(false);
    showAlert('Ticket Submitted', 'Your support request has been sent to EduManage support.');
  };

  return (
    <View style={styles.flex}>
      <Header title="Settings" subtitle={school?.name} accentColor={Colors.primary} />
      <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* School Info */}
        <Text style={styles.section}>School Information</Text>
        <Card style={styles.card}>
          <Input label="School Name" value={name} onChangeText={setName} leftIcon="business" />
          <Input label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" leftIcon="phone" placeholder="+234..." />
          <Input label="Address" value={address} onChangeText={setAddress} leftIcon="location-on" placeholder="School address" />
          <Button label="Save Changes" onPress={handleSave} loading={saving} fullWidth />
        </Card>

        {/* Subscription */}
        <Text style={styles.section}>Subscription</Text>
        <Card style={styles.card}>
          <View style={styles.planRow}>
            <View>
              <Text style={styles.planLabel}>Current Plan</Text>
              <Badge label={getPlanLabel(school?.plan || 'free_trial')} variant={getPlanBadgeVariant(school?.plan || 'free_trial')} />
            </View>
            <View style={styles.planStats}>
              <Text style={styles.planStat}>{school?.max_students} students</Text>
              <Text style={styles.planStat}>{school?.max_teachers} teachers</Text>
              <Text style={styles.planStat}>{school?.ai_usage_limit} AI calls</Text>
            </View>
          </View>
          {school?.plan === 'free_trial' ? (
            <View style={styles.trialInfo}>
              <MaterialIcons name="access-time" size={16} color={Colors.warning} />
              <Text style={styles.trialText}>Trial ends {formatDate(school.trial_ends_at)}</Text>
            </View>
          ) : null}
          <View style={styles.upgradeBox}>
            <Text style={styles.upgradeTitle}>Upgrade Your Plan</Text>
            <Text style={styles.upgradeSub}>Contact EduManage support to upgrade and unlock more capacity.</Text>
            <Button label="Contact Support" onPress={() => setShowTicket(true)} variant="outline" fullWidth />
          </View>
        </Card>

        {/* Account */}
        <Text style={styles.section}>Account</Text>
        <Card style={styles.card}>
          <View style={styles.accountRow}>
            <MaterialIcons name="email" size={20} color={Colors.textSecondary} />
            <View>
              <Text style={styles.accountLabel}>Email</Text>
              <Text style={styles.accountValue}>{user?.email}</Text>
            </View>
          </View>
          <View style={styles.accountRow}>
            <MaterialIcons name="link" size={20} color={Colors.textSecondary} />
            <View>
              <Text style={styles.accountLabel}>School Subdomain</Text>
              <Text style={styles.accountValue}>{school?.subdomain}.edumanage.com</Text>
            </View>
          </View>
          <Button label="Sign Out" onPress={handleLogout} variant="danger" fullWidth />
        </Card>

        {/* Support Ticket Form */}
        {showTicket ? (
          <>
            <Text style={styles.section}>Submit Support Ticket</Text>
            <Card style={styles.card}>
              <Input label="Subject" value={ticketTitle} onChangeText={setTicketTitle} placeholder="What do you need help with?" />
              <Input label="Description" value={ticketDesc} onChangeText={setTicketDesc} placeholder="Describe your issue..." multiline numberOfLines={4} style={{ height: 100, textAlignVertical: 'top' }} />
              <Text style={styles.categoryLabel}>Category</Text>
              <View style={styles.categoryRow}>
                {['general', 'billing', 'technical', 'account', 'feature_request'].map((cat) => (
                  <Pressable
                    key={cat}
                    style={[styles.catBtn, ticketCategory === cat && styles.catBtnActive]}
                    onPress={() => setTicketCategory(cat)}
                  >
                    <Text style={[styles.catText, ticketCategory === cat && styles.catTextActive]}>
                      {cat.replace('_', ' ')}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Button label="Submit Ticket" onPress={handleSubmitTicket} loading={sendingTicket} fullWidth />
              <Button label="Cancel" onPress={() => setShowTicket(false)} variant="ghost" fullWidth size="sm" />
            </Card>
          </>
        ) : (
          <Button label="Submit Support Ticket" onPress={() => setShowTicket(true)} variant="outline" fullWidth />
        )}
      </ScrollView>
      <BottomNav items={ADMIN_NAV} accentColor={Colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingBottom: 100, gap: Spacing.sm },
  section: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginTop: Spacing.sm },
  card: { gap: Spacing.md },
  planRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  planLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 4 },
  planStats: { alignItems: 'flex-end', gap: 2 },
  planStat: { fontSize: FontSize.xs, color: Colors.textSecondary },
  trialInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.warningBg, padding: Spacing.sm, borderRadius: BorderRadius.sm },
  trialText: { fontSize: FontSize.sm, color: Colors.warning },
  upgradeBox: { backgroundColor: Colors.surface2, padding: Spacing.md, borderRadius: BorderRadius.md, gap: Spacing.sm },
  upgradeTitle: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  upgradeSub: { fontSize: FontSize.sm, color: Colors.textSecondary },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xs },
  accountLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  accountValue: { fontSize: FontSize.base, color: Colors.textPrimary, fontWeight: FontWeight.medium },
  categoryLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  catBtn: { paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: BorderRadius.full, backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border },
  catBtnActive: { backgroundColor: Colors.schoolAdminBg, borderColor: Colors.primary },
  catText: { fontSize: FontSize.xs, color: Colors.textSecondary, textTransform: 'capitalize' },
  catTextActive: { color: Colors.primary, fontWeight: FontWeight.semibold },
});
