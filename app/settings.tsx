import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth, useAlert } from '@/template';
import { useAppContext } from '@/hooks/useAppContext';
import * as Clipboard from 'expo-clipboard';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';

const APP_VERSION = '1.0.0';
const BUILD_TYPE = 'production';

const GITHUB_REPO = 'https://github.com/edumanage/edumanage-app';
const GITHUB_ISSUES = 'https://github.com/edumanage/edumanage-app/issues';
const DOCS_URL = 'https://github.com/edumanage/edumanage-app#readme';
const SUPPORT_EMAIL = 'support@edumanage.com';
const TERMS_URL = 'https://edumanage.com/terms';
const PRIVACY_URL = 'https://edumanage.com/privacy';

// Admin roles that can access subscription management
const ADMIN_ROLES = ['school_owner', 'principal', 'deputy_principal', 'administrator', 'ict_manager'];

interface RowProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  iconColor?: string;
  iconBg?: string;
  label: string;
  value?: string;
  hint?: string;
  chevron?: boolean;
  onPress?: () => void;
  rightSlot?: React.ReactNode;
  showDivider?: boolean;
}

function SettingRow({
  icon, iconColor = Colors.textSecondary, iconBg = Colors.surface2,
  label, value, hint, chevron, onPress, rightSlot, showDivider = true,
}: RowProps) {
  const content = (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
        <MaterialIcons name={icon} size={18} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {value ? <Text style={styles.rowValue} numberOfLines={1}>{value}</Text> : null}
        {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
      </View>
      {rightSlot}
      {chevron ? <MaterialIcons name="chevron-right" size={20} color={Colors.textMuted} /> : null}
    </View>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
        {content}
        {showDivider ? <View style={styles.divider} /> : null}
      </Pressable>
    );
  }
  return (
    <>
      {content}
      {showDivider ? <View style={styles.divider} /> : null}
    </>
  );
}

function SectionCard({
  title, children, action,
}: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {action}
      </View>
      <Card style={styles.sectionCard}>{children}</Card>
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { logout, operationLoading } = useAuth();
  const { showAlert } = useAlert();
  const { school, userRole } = useAppContext();
  const [copying, setCopying] = useState(false);

  const isAdmin = userRole ? ADMIN_ROLES.includes(userRole) : false;

  const handleCopySubdomain = async () => {
    if (!school?.subdomain) return;
    setCopying(true);
    try {
      await Clipboard.setStringAsync(`${school.subdomain}.edumanage.com`);
      showAlert('Copied', 'School URL copied to clipboard.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showAlert('Copy Failed', msg);
    } finally {
      setCopying(false);
    }
  };

  const handleOpenDocs = () => {
    Linking.openURL(DOCS_URL).catch(() =>
      showAlert('Error', 'Could not open documentation in your browser.'),
    );
  };

  const handleContactSupport = () => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() =>
      showAlert('Error', 'Could not open your email app.'),
    );
  };

  const handleReportBug = () => {
    Linking.openURL(GITHUB_ISSUES).catch(() =>
      showAlert('Error', 'Could not open bug tracker.'),
    );
  };

  const handleManageSchool = () => {
    router.push('/(admin)/settings' as any);
  };

  const handleSignOut = () => {
    showAlert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const handleOpenTerms = () => {
    Linking.openURL(TERMS_URL).catch(() => showAlert('Error', 'Could not open Terms of Service.'));
  };

  const handleOpenPrivacy = () => {
    Linking.openURL(PRIVACY_URL).catch(() => showAlert('Error', 'Could not open Privacy Policy.'));
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.flex}>
        <Header title="Settings" subtitle="App preferences" accentColor={Colors.primary} />
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ─── APPEARANCE ─── */}
          <SectionCard title="Appearance">
            <SettingRow
              icon="dark-mode"
              iconColor={Colors.primary}
              iconBg={Colors.schoolAdminBg}
              label="Theme"
              value="Dark (locked)"
              hint="EduManage uses an optimized dark theme for low-light use."
              showDivider
            />
            <SettingRow
              icon="palette"
              iconColor={Colors.primary}
              iconBg={Colors.schoolAdminBg}
              label="Primary Color"
              showDivider={false}
              rightSlot={
                <View style={[styles.colorDot, { backgroundColor: Colors.primary }]} />
              }
            />
            <View style={styles.divider} />
            <SettingRow
              icon="auto-awesome"
              iconColor={Colors.secondary}
              iconBg={Colors.infoBg}
              label="Accent Color"
              hint="Personalized accent colors are coming soon."
              showDivider={false}
              rightSlot={
                <View style={[styles.colorDot, { backgroundColor: Colors.secondary }]} />
              }
            />
          </SectionCard>

          {/* ─── SCHOOL ─── */}
          {school ? (
            <SectionCard title="School">
              <SettingRow
                icon="business"
                iconColor={Colors.primary}
                iconBg={Colors.schoolAdminBg}
                label="School Name"
                value={school.name}
                showDivider
              />
              <SettingRow
                icon="link"
                iconColor={Colors.primary}
                iconBg={Colors.schoolAdminBg}
                label="Subdomain"
                value={`${school.subdomain}.edumanage.com`}
                showDivider={false}
                rightSlot={
                  <Pressable onPress={handleCopySubdomain} hitSlop={8} style={styles.copyBtn}>
                    <MaterialIcons
                      name={copying ? 'check' : 'content-copy'}
                      size={16}
                      color={Colors.primary}
                    />
                    <Text style={styles.copyText}>{copying ? 'Copied' : 'Copy'}</Text>
                  </Pressable>
                }
              />
              {isAdmin ? (
                <>
                  <View style={styles.divider} />
                  <SettingRow
                    icon="admin-panel-settings"
                    iconColor={Colors.warning}
                    iconBg={Colors.warningBg}
                    label="Manage School"
                    hint="Subscription, branding, users, integrations."
                    chevron
                    onPress={handleManageSchool}
                    showDivider={false}
                  />
                </>
              ) : null}
            </SectionCard>
          ) : null}

          {/* ─── HELP & SUPPORT ─── */}
          <SectionCard title="Help & Support">
            <SettingRow
              icon="menu-book"
              iconColor={Colors.info}
              iconBg={Colors.infoBg}
              label="Documentation"
              hint="Read the user & admin guides on GitHub."
              chevron
              onPress={handleOpenDocs}
              showDivider
            />
            <SettingRow
              icon="support-agent"
              iconColor={Colors.success}
              iconBg={Colors.successBg}
              label="Contact Support"
              value={SUPPORT_EMAIL}
              hint="Email our support team — replies within 24 hours."
              chevron
              onPress={handleContactSupport}
              showDivider
            />
            <SettingRow
              icon="bug-report"
              iconColor={Colors.error}
              iconBg={Colors.errorBg}
              label="Report a Bug"
              hint="Open an issue on our GitHub tracker."
              chevron
              onPress={handleReportBug}
              showDivider={false}
            />
          </SectionCard>

          {/* ─── ABOUT ─── */}
          <SectionCard title="About">
            <SettingRow
              icon="info"
              iconColor={Colors.primary}
              iconBg={Colors.schoolAdminBg}
              label="Version"
              value={`v${APP_VERSION}`}
              showDivider
            />
            <SettingRow
              icon="build"
              iconColor={Colors.textSecondary}
              iconBg={Colors.surface2}
              label="Build"
              value={BUILD_TYPE}
              showDivider
            />
            <SettingRow
              icon="logout"
              iconColor={Colors.error}
              iconBg={Colors.errorBg}
              label="Sign Out"
              hint="Sign out of your EduManage account on this device."
              onPress={handleSignOut}
              showDivider={false}
            />
          </SectionCard>

          {/* ─── LEGAL ─── */}
          <SectionCard title="Legal">
            <SettingRow
              icon="description"
              iconColor={Colors.textSecondary}
              iconBg={Colors.surface2}
              label="Terms of Service"
              hint="View the EduManage terms of use."
              chevron
              onPress={handleOpenTerms}
              showDivider
            />
            <SettingRow
              icon="privacy-tip"
              iconColor={Colors.textSecondary}
              iconBg={Colors.surface2}
              label="Privacy Policy"
              hint="How we handle your data."
              chevron
              onPress={handleOpenPrivacy}
              showDivider={false}
            />
          </SectionCard>

          <View style={styles.footer}>
            <Text style={styles.footerApp}>EduManage</Text>
            <Text style={styles.footerVersion}>v{APP_VERSION} · {BUILD_TYPE}</Text>
            <Text style={styles.footerCopy}>© {new Date().getFullYear()} EduManage. All rights reserved.</Text>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  scrollContent: { padding: Spacing.md, paddingBottom: Spacing.xxl, gap: Spacing.md },

  section: { gap: Spacing.xs },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: {
    fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  sectionCard: { paddingVertical: Spacing.xs },

  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm },
  rowIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  rowLabel: { fontSize: FontSize.base, color: Colors.textPrimary, fontWeight: FontWeight.medium },
  rowValue: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  rowHint: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2, lineHeight: 16 },
  divider: { height: 0.5, backgroundColor: Colors.border, marginVertical: Spacing.xs },

  colorDot: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: Colors.surface,
    marginRight: Spacing.xs,
  },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.schoolAdminBg,
    paddingHorizontal: Spacing.sm, paddingVertical: 6,
    borderRadius: BorderRadius.full, borderWidth: 1, borderColor: `${Colors.primary}30`,
  },
  copyText: { color: Colors.primary, fontSize: FontSize.xs, fontWeight: FontWeight.semibold },

  footer: { alignItems: 'center', paddingVertical: Spacing.lg, gap: 4 },
  footerApp: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  footerVersion: { fontSize: FontSize.xs, color: Colors.textMuted },
  footerCopy: { fontSize: FontSize.xs, color: Colors.textMuted },
});
