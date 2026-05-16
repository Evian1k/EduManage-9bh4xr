import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, useAlert } from '@/template';
import { useAppContext } from '@/hooks/useAppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';

const RULEBOOK_VERSION = '1.0';

const RULES = [
  {
    title: '1. Ethical Use & Legal Compliance',
    icon: 'gavel' as const,
    color: Colors.primary,
    items: [
      'EduManage may only be used for lawful educational administration purposes.',
      'You must not enter fabricated, fraudulent, or misleading student, staff, or financial data.',
      'All data must belong to real persons who have given appropriate consent where required.',
      'You must comply with all applicable data protection, privacy, and education laws in your jurisdiction.',
    ],
  },
  {
    title: '2. Student Data Protection',
    icon: 'security' as const,
    color: '#D32F2F',
    items: [
      'Student data is strictly confidential and protected under your school\'s data governance policy.',
      'Grades, medical records, attendance, and personal details must not be shared outside authorized channels.',
      'Staff must only access data relevant to their assigned role and responsibilities.',
      'Unauthorized export, copying, or distribution of student data is strictly prohibited.',
    ],
  },
  {
    title: '3. Account & Access Security',
    icon: 'lock' as const,
    color: Colors.warning,
    items: [
      'You are responsible for maintaining the confidentiality of your login credentials.',
      'Account sharing is prohibited. Each person must have their own unique account.',
      'Suspicious account activity must be reported to your school ICT Manager immediately.',
      'EduManage enforces role-based access control. Attempting to bypass permissions is grounds for account termination.',
    ],
  },
  {
    title: '4. AI Feature Usage',
    icon: 'psychology' as const,
    color: Colors.secondary,
    items: [
      'AI features (assignment generation, grading assistance, tutoring) are for legitimate educational purposes only.',
      'AI-generated content must be reviewed by qualified educators before official use.',
      'Misuse of AI tools to produce inappropriate, illegal, or deceptive content is strictly prohibited.',
      'AI usage is tracked per school and subject to monthly quota limits based on your subscription plan.',
    ],
  },
  {
    title: '5. Billing & Subscription',
    icon: 'credit-card' as const,
    color: Colors.success,
    items: [
      'Access to premium features requires an active paid subscription.',
      'Free trial accounts are limited in capacity and time. No billing commitment during trial.',
      'Non-payment may result in feature restriction or account suspension after due notice.',
      'Subscription fees are non-refundable except where required by applicable consumer law.',
    ],
  },
  {
    title: '6. Data Ownership & Accountability',
    icon: 'folder-shared' as const,
    color: '#7B1FA2',
    items: [
      'All data entered into EduManage remains the property of your school institution.',
      'Your school administration is accountable for the accuracy and integrity of all data entered.',
      'EduManage provides audit trails to help schools monitor data changes and access history.',
      'EduManage does not sell or share your school\'s data with third parties.',
    ],
  },
  {
    title: '7. Acceptable Use Policy',
    icon: 'verified-user' as const,
    color: Colors.teacher,
    items: [
      'The platform must not be used to harass, bully, or discriminate against any student, parent, or staff member.',
      'Uploading or sharing illegal, harmful, or age-inappropriate content is strictly prohibited.',
      'Deliberate disruption of the platform\'s services or other users\' access is grounds for immediate suspension.',
      'Automated scraping, botting, or unauthorized API access is not permitted.',
    ],
  },
  {
    title: '8. Platform Rights & Enforcement',
    icon: 'admin-panel-settings' as const,
    color: '#E65100',
    items: [
      'EduManage reserves the right to investigate suspected abuse, fraud, or policy violations.',
      'Accounts found in violation of these rules may be suspended without prior notice.',
      'EduManage may update these terms. Schools will be notified and required to re-accept updated versions.',
      'Continued use of the platform constitutes acceptance of the current rulebook version.',
    ],
  },
];

export default function RulebookScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const { school, refreshContext } = useAppContext();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleScroll = (e: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const isAtBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 80;
    if (isAtBottom) setHasScrolled(true);
  };

  const handleAccept = async () => {
    if (!school || !user) return;
    if (!accepted) {
      showAlert('Checkbox Required', 'Please check the acceptance checkbox to continue.');
      return;
    }
    setSaving(true);
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('school_rule_acceptance').upsert({
      school_id: school.id,
      accepted_by_user_id: user.id,
      rulebook_version: RULEBOOK_VERSION,
      accepted: true,
      accepted_at: new Date().toISOString(),
    }, { onConflict: 'school_id,accepted_by_user_id,rulebook_version' });
    setSaving(false);
    if (error) {
      showAlert('Error', error.message);
      return;
    }
    await refreshContext();
    router.replace('/(admin)/');
  };

  return (
    <View style={[styles.flex, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <View style={styles.logoIcon}>
            <MaterialIcons name="school" size={26} color={Colors.primary} />
          </View>
          <View>
            <Text style={styles.headerTitle}>EduManage</Text>
            <Text style={styles.headerSub}>Platform Terms & Rulebook</Text>
          </View>
        </View>
        <View style={styles.versionBadge}>
          <Text style={styles.versionText}>v{RULEBOOK_VERSION}</Text>
        </View>
      </View>

      {/* Intro Banner */}
      <View style={styles.banner}>
        <MaterialIcons name="policy" size={20} color={Colors.primary} />
        <Text style={styles.bannerText}>
          Before accessing your school dashboard, you must read and accept the EduManage platform rules. Scroll to the bottom to enable the acceptance checkbox.
        </Text>
      </View>

      {/* Rules Content */}
      <ScrollView
        ref={scrollRef}
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        onScroll={handleScroll}
        scrollEventThrottle={100}
        showsVerticalScrollIndicator={true}
      >
        <Text style={styles.introPara}>
          These rules govern your use of the EduManage multi-tenant school management platform. By accepting, you confirm that you are an authorized representative of your school institution and that you agree to abide by all policies outlined below.
        </Text>

        {RULES.map((section) => (
          <View key={section.title} style={styles.ruleSection}>
            <View style={[styles.ruleTitleRow, { borderLeftColor: section.color }]}>
              <MaterialIcons name={section.icon} size={20} color={section.color} />
              <Text style={[styles.ruleTitle, { color: section.color }]}>{section.title}</Text>
            </View>
            {section.items.map((item, i) => (
              <View key={i} style={styles.ruleItem}>
                <View style={[styles.ruleDot, { backgroundColor: section.color }]} />
                <Text style={styles.ruleText}>{item}</Text>
              </View>
            ))}
          </View>
        ))}

        {/* Scroll prompt */}
        {!hasScrolled ? (
          <View style={styles.scrollPrompt}>
            <MaterialIcons name="keyboard-arrow-down" size={20} color={Colors.textMuted} />
            <Text style={styles.scrollPromptText}>Continue scrolling to reach the acceptance section</Text>
          </View>
        ) : null}

        {/* Acceptance Section */}
        <View style={[styles.acceptSection, !hasScrolled && { opacity: 0.35 }]}>
          <View style={styles.divider} />
          <Text style={styles.acceptTitle}>Acceptance Declaration</Text>
          <Text style={styles.acceptPara}>
            By checking the box below, {user?.username || 'you'} confirm that you have read, understood, and agree to comply with all EduManage platform rules and policies on behalf of {school?.name || 'your school'}.
          </Text>
          <Pressable
            style={styles.checkRow}
            onPress={() => { if (hasScrolled) setAccepted(!accepted); }}
            disabled={!hasScrolled}
          >
            <View style={[styles.checkbox, accepted && styles.checkboxChecked]}>
              {accepted ? <MaterialIcons name="check" size={16} color="#fff" /> : null}
            </View>
            <Text style={styles.checkLabel}>
              I have read and accept the EduManage Platform Rules & Terms of Use (Version {RULEBOOK_VERSION})
            </Text>
          </Pressable>
          <Pressable
            style={[styles.acceptBtn, (!accepted || !hasScrolled) && styles.acceptBtnDisabled]}
            onPress={handleAccept}
            disabled={!accepted || !hasScrolled || saving}
          >
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.acceptBtnText}>Accept & Continue to Dashboard</Text>
            }
          </Pressable>
          {!hasScrolled ? (
            <Text style={styles.readFirst}>You must scroll through the entire rulebook before accepting.</Text>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  logoIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: `${Colors.primary}20`, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  headerSub: { fontSize: FontSize.xs, color: Colors.textSecondary },
  versionBadge: {
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
    backgroundColor: Colors.surface2, borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.border,
  },
  versionText: { fontSize: FontSize.xs, color: Colors.textMuted },
  banner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
    backgroundColor: `${Colors.primary}12`, borderBottomWidth: 1, borderBottomColor: `${Colors.primary}30`,
    padding: Spacing.md,
  },
  bannerText: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  scrollArea: { flex: 1 },
  scrollContent: { padding: Spacing.lg, paddingBottom: 60, gap: Spacing.lg },
  introPara: {
    fontSize: FontSize.base, color: Colors.textSecondary, lineHeight: 24,
    backgroundColor: Colors.surface, padding: Spacing.md, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  ruleSection: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  ruleTitleRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    borderLeftWidth: 4, padding: Spacing.md, backgroundColor: Colors.surface2,
  },
  ruleTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, flex: 1 },
  ruleItem: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  ruleDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7, flexShrink: 0 },
  ruleText: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  scrollPrompt: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.xs, padding: Spacing.md,
  },
  scrollPromptText: { fontSize: FontSize.sm, color: Colors.textMuted },
  acceptSection: { gap: Spacing.md },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.sm },
  acceptTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  acceptPara: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 22 },
  checkRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface2, flexShrink: 0,
  },
  checkboxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkLabel: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  acceptBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingVertical: 16, alignItems: 'center',
  },
  acceptBtnDisabled: { backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border },
  acceptBtnText: { color: '#fff', fontSize: FontSize.base, fontWeight: FontWeight.bold },
  readFirst: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center' },
});
