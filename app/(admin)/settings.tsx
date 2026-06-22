import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch } from 'react-native';
import { useAuth, useAlert } from '@/template';
import { useAppContext } from '@/hooks/useAppContext';
import { updateSchool, createTicket } from '@/services/school.service';
import { updateSchoolBranding, BRAND_PALETTES } from '@/services/branding.service';
import { BottomNav } from '@/components/layout/BottomNav';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge, getPlanBadgeVariant } from '@/components/ui/Badge';
import { Header } from '@/components/layout/Header';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { getPlanLabel, formatDate } from '@/constants/config';

const ADMIN_NAV = [
  { label: 'Dashboard', icon: 'dashboard' as const, route: '/(admin)/' },
  { label: 'Students', icon: 'people' as const, route: '/(admin)/students' },
  { label: 'Staff', icon: 'badge' as const, route: '/(admin)/teachers' },
  { label: 'Classes', icon: 'class' as const, route: '/(admin)/classes' },
  { label: 'Settings', icon: 'settings' as const, route: '/(admin)/settings' },
];

type SettingsTab = 'general' | 'branding' | 'plan' | 'support';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const { showAlert } = useAlert();
  const { school, refreshContext } = useAppContext();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [saving, setSaving] = useState(false);

  // General fields
  const [name, setName] = useState(school?.name || '');
  const [phone, setPhone] = useState(school?.phone || '');
  const [address, setAddress] = useState(school?.address || '');
  const [motto, setMotto] = useState((school as any)?.motto || '');

  // Branding fields
  const [primaryColor, setPrimaryColor] = useState((school as any)?.primary_color || Colors.primary);
  const [secondaryColor, setSecondaryColor] = useState((school as any)?.secondary_color || Colors.secondary);

  // Support ticket
  const [ticketTitle, setTicketTitle] = useState('');
  const [ticketDesc, setTicketDesc] = useState('');
  const [ticketCategory, setTicketCategory] = useState('general');
  const [sendingTicket, setSendingTicket] = useState(false);

  const TABS: { id: SettingsTab; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
    { id: 'general', label: 'General', icon: 'settings' },
    { id: 'branding', label: 'Branding', icon: 'palette' },
    { id: 'plan', label: 'Plan', icon: 'star' },
    { id: 'support', label: 'Support', icon: 'headset-mic' },
  ];

  const handleSaveGeneral = async () => {
    if (!school) return;
    setSaving(true);
    const { error } = await updateSchool(school.id, { name, phone, address });
    if (!error && motto !== (school as any)?.motto) {
      await updateSchoolBranding(school.id, { motto });
    }
    setSaving(false);
    if (error) { showAlert('Error', error.message); return; }
    await refreshContext();
    showAlert('Saved', 'School settings updated successfully.');
  };

  const handleApplyPalette = async (palette: typeof BRAND_PALETTES[0]) => {
    if (!school) return;
    setSaving(true);
    const { error } = await updateSchoolBranding(school.id, {
      primary_color: palette.primary,
      secondary_color: palette.secondary,
    });
    setSaving(false);
    if (error) { showAlert('Error', error.message); return; }
    setPrimaryColor(palette.primary);
    setSecondaryColor(palette.secondary);
    await refreshContext();
    showAlert('Branding Updated', `${palette.name} palette applied to your school.`);
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
    showAlert('Ticket Submitted', 'Your support request has been sent to EduManage support.');
  };

  return (
    <View style={styles.flex}>
      <Header title="Settings" subtitle={school?.name} accentColor={Colors.primary} />

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {TABS.map(tab => (
          <Pressable
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <MaterialIcons name={tab.icon} size={16} color={activeTab === tab.id ? Colors.primary : Colors.textMuted} />
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>{tab.label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ---- GENERAL TAB ---- */}
        {activeTab === 'general' ? (
          <>
            <Text style={styles.section}>School Information</Text>
            <Card style={styles.card}>
              <Input label="School Name" value={name} onChangeText={setName} leftIcon="business" />
              <Input label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" leftIcon="phone" placeholder="+1 555-0100" />
              <Input label="Address" value={address} onChangeText={setAddress} leftIcon="location-on" placeholder="School address" />
              <Input label="School Motto" value={motto} onChangeText={setMotto} leftIcon="format-quote" placeholder="e.g., Excellence Through Knowledge" />
              <Button label={saving ? 'Saving...' : 'Save Changes'} onPress={handleSaveGeneral} loading={saving} fullWidth />
            </Card>

            <Text style={styles.section}>Account</Text>
            <Card style={styles.card}>
              <View style={styles.infoRow}>
                <MaterialIcons name="email" size={18} color={Colors.textSecondary} />
                <View>
                  <Text style={styles.infoLabel}>Account Email</Text>
                  <Text style={styles.infoValue}>{user?.email}</Text>
                </View>
              </View>
              <View style={styles.infoRow}>
                <MaterialIcons name="link" size={18} color={Colors.textSecondary} />
                <View>
                  <Text style={styles.infoLabel}>Subdomain</Text>
                  <Text style={styles.infoValue}>{school?.subdomain}.edumanage.com</Text>
                </View>
              </View>
              <Button label="Sign Out" onPress={handleLogout} variant="danger" fullWidth />
            </Card>
          </>
        ) : null}

        {/* ---- BRANDING TAB ---- */}
        {activeTab === 'branding' ? (
          <>
            <Text style={styles.section}>School Branding</Text>
            <Card>
              <Text style={styles.brandingNote}>
                Your school branding determines the colors displayed across dashboards, reports, and communications. Choose a palette that matches your school's identity.
              </Text>

              {/* Current Colors Preview */}
              <View style={styles.colorPreview}>
                <View style={[styles.colorSwatch, { backgroundColor: primaryColor }]}>
                  <Text style={styles.swatchLabel}>Primary</Text>
                  <Text style={styles.swatchHex}>{primaryColor}</Text>
                </View>
                <View style={[styles.colorSwatch, { backgroundColor: secondaryColor }]}>
                  <Text style={styles.swatchLabel}>Secondary</Text>
                  <Text style={styles.swatchHex}>{secondaryColor}</Text>
                </View>
              </View>

              {/* Color Palettes */}
              <Text style={styles.paletteTitle}>Choose a Palette</Text>
              <View style={styles.paletteGrid}>
                {BRAND_PALETTES.map(palette => (
                  <Pressable
                    key={palette.name}
                    style={[styles.paletteCard, primaryColor === palette.primary && styles.paletteCardActive]}
                    onPress={() => handleApplyPalette(palette)}
                  >
                    <View style={styles.paletteColors}>
                      <View style={[styles.paletteSwatch, { backgroundColor: palette.primary }]} />
                      <View style={[styles.paletteSwatch, { backgroundColor: palette.secondary }]} />
                    </View>
                    <Text style={styles.paletteName}>{palette.name}</Text>
                    {primaryColor === palette.primary ? (
                      <MaterialIcons name="check-circle" size={14} color={Colors.success} />
                    ) : null}
                  </Pressable>
                ))}
              </View>
            </Card>

            {/* Logo Upload Note */}
            <Card>
              <View style={styles.infoRow}>
                <MaterialIcons name="image" size={20} color={Colors.textSecondary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoLabel}>School Logo</Text>
                  <Text style={styles.brandingNote}>Logo upload support coming in a future update. Contact support to upload your logo manually.</Text>
                </View>
              </View>
            </Card>
          </>
        ) : null}

        {/* ---- PLAN TAB ---- */}
        {activeTab === 'plan' ? (
          <>
            <Text style={styles.section}>Subscription Plan</Text>
            <Card style={styles.card}>
              <View style={styles.planHeader}>
                <View>
                  <Text style={styles.planCurrentLabel}>Current Plan</Text>
                  <Badge label={getPlanLabel(school?.plan || 'free_trial')} variant={getPlanBadgeVariant(school?.plan || 'free_trial')} />
                </View>
                <View style={[styles.planStatusBadge, { backgroundColor: school?.plan_status === 'active' ? `${Colors.success}20` : `${Colors.warning}20` }]}>
                  <Text style={[styles.planStatusText, { color: school?.plan_status === 'active' ? Colors.success : Colors.warning }]}>
                    {school?.plan_status?.toUpperCase()}
                  </Text>
                </View>
              </View>
              {school?.plan === 'free_trial' ? (
                <View style={styles.trialBox}>
                  <MaterialIcons name="access-time" size={16} color={Colors.warning} />
                  <Text style={styles.trialText}>Trial ends {formatDate(school.trial_ends_at)}</Text>
                </View>
              ) : null}
              <View style={styles.quotaGrid}>
                {[
                  { label: 'Students', used: 0, max: school?.max_students || 50, icon: 'people', color: Colors.primary },
                  { label: 'Teachers', used: 0, max: school?.max_teachers || 5, icon: 'badge', color: Colors.teacher },
                  { label: 'AI Calls', used: school?.ai_usage_count || 0, max: school?.ai_usage_limit || 100, icon: 'psychology', color: Colors.secondary },
                ].map(q => (
                  <View key={q.label} style={styles.quotaCard}>
                    <MaterialIcons name={q.icon as any} size={18} color={q.color} />
                    <Text style={styles.quotaLabel}>{q.label}</Text>
                    <Text style={[styles.quotaUsed, { color: q.color }]}>{q.used} / {q.max}</Text>
                    <View style={styles.quotaBar}>
                      <View style={[styles.quotaFill, { width: `${Math.min(100, (q.used / q.max) * 100)}%` as any, backgroundColor: q.color }]} />
                    </View>
                  </View>
                ))}
              </View>
            </Card>

            <Text style={styles.section}>Available Plans</Text>
            {[
              { name: 'Basic', price: '$29/mo', students: 150, teachers: 15, ai: 200, color: Colors.primary },
              { name: 'Pro', price: '$79/mo', students: 1000, teachers: 100, ai: 500, color: Colors.secondary },
              { name: 'Enterprise', price: 'Custom', students: 'Unlimited', teachers: 'Unlimited', ai: 'Unlimited', color: '#F57F17' },
            ].map(plan => (
              <Card key={plan.name} style={[styles.planCard, { borderLeftColor: plan.color }]}>
                <View style={styles.planCardRow}>
                  <View>
                    <Text style={[styles.planCardName, { color: plan.color }]}>{plan.name}</Text>
                    <Text style={styles.planCardPrice}>{plan.price}</Text>
                  </View>
                  <View style={styles.planCardFeatures}>
                    <Text style={styles.planFeat}>{plan.students} students</Text>
                    <Text style={styles.planFeat}>{plan.teachers} teachers</Text>
                    <Text style={styles.planFeat}>{plan.ai} AI calls</Text>
                  </View>
                </View>
              </Card>
            ))}
            <Button label="Contact Sales to Upgrade" onPress={() => setActiveTab('support')} variant="outline" fullWidth />
          </>
        ) : null}

        {/* ---- SUPPORT TAB ---- */}
        {activeTab === 'support' ? (
          <>
            <Text style={styles.section}>Submit Support Ticket</Text>
            <Card style={styles.card}>
              <Input label="Subject" value={ticketTitle} onChangeText={setTicketTitle} placeholder="e.g., Upgrade to Pro plan" />
              <Input label="Description" value={ticketDesc} onChangeText={setTicketDesc} placeholder="Describe your issue or request in detail..." multiline numberOfLines={5} style={{ height: 120, textAlignVertical: 'top' }} />
              <Text style={styles.catLabel}>Category</Text>
              <View style={styles.catRow}>
                {['general', 'billing', 'technical', 'account', 'feature_request'].map(cat => (
                  <Pressable key={cat} style={[styles.catBtn, ticketCategory === cat && styles.catBtnActive]} onPress={() => setTicketCategory(cat)}>
                    <Text style={[styles.catText, ticketCategory === cat && styles.catTextActive]}>{cat.replace('_', ' ')}</Text>
                  </Pressable>
                ))}
              </View>
              <Button label={sendingTicket ? 'Submitting...' : 'Submit Ticket'} onPress={handleSubmitTicket} loading={sendingTicket} fullWidth />
            </Card>

            <Card>
              <Text style={styles.section}>Contact Information</Text>
              {[
                { icon: 'email' as const, label: 'Email Support', value: 'support@edumanage.app' },
                { icon: 'language' as const, label: 'Documentation', value: 'docs.edumanage.app' },
                { icon: 'schedule' as const, label: 'Response Time', value: 'Within 24 hours' },
              ].map(item => (
                <View key={item.label} style={styles.infoRow}>
                  <MaterialIcons name={item.icon} size={18} color={Colors.textSecondary} />
                  <View>
                    <Text style={styles.infoLabel}>{item.label}</Text>
                    <Text style={styles.infoValue}>{item.value}</Text>
                  </View>
                </View>
              ))}
            </Card>
          </>
        ) : null}
      </ScrollView>
      <BottomNav items={ADMIN_NAV} accentColor={Colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  tabBar: { flexDirection: 'row', backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: Spacing.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.primary },
  tabText: { fontSize: FontSize.xs, color: Colors.textMuted },
  tabTextActive: { color: Colors.primary, fontWeight: FontWeight.semibold },
  content: { padding: Spacing.md, paddingBottom: 100, gap: Spacing.sm },
  section: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginTop: Spacing.sm },
  card: { gap: Spacing.md },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xs },
  infoLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  infoValue: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.medium },
  // Branding
  brandingNote: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing.sm },
  colorPreview: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  colorSwatch: { flex: 1, height: 64, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', gap: 4 },
  swatchLabel: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.8)' },
  swatchHex: { fontSize: FontSize.sm, color: '#fff', fontWeight: FontWeight.bold },
  paletteTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textSecondary, marginBottom: Spacing.sm },
  paletteGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  paletteCard: { alignItems: 'center', gap: 5, padding: Spacing.sm, borderRadius: BorderRadius.md, backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border, minWidth: 80 },
  paletteCardActive: { borderColor: Colors.success },
  paletteColors: { flexDirection: 'row', gap: 4 },
  paletteSwatch: { width: 20, height: 20, borderRadius: 4 },
  paletteName: { fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'center' },
  // Plan
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.sm },
  planCurrentLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 4 },
  planStatusBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.full },
  planStatusText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  trialBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.warningBg, padding: Spacing.sm, borderRadius: BorderRadius.sm, marginBottom: Spacing.sm },
  trialText: { fontSize: FontSize.sm, color: Colors.warning },
  quotaGrid: { gap: Spacing.sm },
  quotaCard: { backgroundColor: Colors.surface2, borderRadius: BorderRadius.md, padding: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  quotaLabel: { flex: 1, fontSize: FontSize.sm, color: Colors.textPrimary },
  quotaUsed: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  quotaBar: { width: 60, height: 4, backgroundColor: Colors.border, borderRadius: 2, overflow: 'hidden' },
  quotaFill: { height: 4, borderRadius: 2 },
  planCard: { borderLeftWidth: 3, gap: 0 },
  planCardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planCardName: { fontSize: FontSize.base, fontWeight: FontWeight.bold },
  planCardPrice: { fontSize: FontSize.sm, color: Colors.textSecondary },
  planCardFeatures: { alignItems: 'flex-end', gap: 2 },
  planFeat: { fontSize: FontSize.xs, color: Colors.textSecondary },
  // Support
  catLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  catBtn: { paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: BorderRadius.full, backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border },
  catBtnActive: { backgroundColor: `${Colors.primary}20`, borderColor: Colors.primary },
  catText: { fontSize: FontSize.xs, color: Colors.textSecondary, textTransform: 'capitalize' },
  catTextActive: { color: Colors.primary, fontWeight: FontWeight.semibold },
});
