import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Switch, Modal,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth, useAlert, getSupabaseClient } from '@/template';
import { useAppContext } from '@/hooks/useAppContext';
import {
  markEmailVerified,
  enableMfa,
  disableMfa,
  completePasswordReset,
} from '@/services/auth.security.service';
import {
  getNotificationPreferences,
  updateNotificationPreference,
  NotificationPreference,
} from '@/services/notification.service';
import { generateTOTPSecret, buildOTPAuthURI } from '@/lib/totp';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '@/constants/theme';

interface UserDevice {
  id: string;
  user_id: string;
  device_name: string | null;
  device_fingerprint: string;
  platform: string | null;
  last_ip: string | null;
  last_seen_at: string | null;
  trusted: boolean;
}

interface ProfileRow {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  email_verified: boolean;
  mfa_enabled: boolean;
  mfa_secret: string | null;
  avatar_url: string | null;
}

const NOTIF_CATEGORIES = ['announcements', 'messages', 'finance', 'alerts', 'events'] as const;
const NOTIF_CHANNELS = ['email', 'sms', 'push', 'in_app'] as const;

const CATEGORY_LABELS: Record<string, string> = {
  announcements: 'Announcements',
  messages: 'Messages',
  finance: 'Finance',
  alerts: 'Alerts',
  events: 'Events',
};

const CHANNEL_LABELS: Record<string, string> = {
  email: 'Email',
  sms: 'SMS',
  push: 'Push',
  in_app: 'In-App',
};

const CHANNEL_ICONS: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  email: 'email',
  sms: 'sms',
  push: 'notifications-active',
  in_app: 'inbox',
};

function formatRole(role: string): string {
  return role
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatLastSeen(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const d = new Date(dateStr).getTime();
  if (Number.isNaN(d)) return 'Never';
  const diff = Date.now() - d;
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function platformIcon(platform: string | null): keyof typeof MaterialIcons.glyphMap {
  if (!platform) return 'devices';
  const p = platform.toLowerCase();
  if (p.includes('ios') || p.includes('apple') || p.includes('iphone')) return 'phone-iphone';
  if (p.includes('android')) return 'android';
  if (p.includes('web')) return 'language';
  if (p.includes('windows')) return 'desktop-windows';
  if (p.includes('mac')) return 'laptop-mac';
  return 'devices';
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, operationLoading } = useAuth();
  const { showAlert } = useAlert();
  const { profileId, school, userRole, isPlatformAdmin, refreshContext } = useAppContext();

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState<UserDevice[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPreference[]>([]);
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [mfaToggling, setMfaToggling] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);

  // Change password modal
  const [pwModalOpen, setPwModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSubmitting, setPwSubmitting] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!profileId) {
      setLoading(false);
      return;
    }
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, full_name, email, phone, email_verified, mfa_enabled, mfa_secret, avatar_url')
      .eq('id', profileId)
      .maybeSingle();
    if (error) {
      showAlert('Error', `Could not load profile: ${error}`);
    } else if (data) {
      setProfile(data as ProfileRow);
    }
    setLoading(false);
  }, [profileId, showAlert]);

  const loadDevices = useCallback(async () => {
    if (!profileId) return;
    setDevicesLoading(true);
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('user_devices')
      .select('id, user_id, device_name, device_fingerprint, platform, last_ip, last_seen_at, trusted')
      .eq('user_id', profileId)
      .order('last_seen_at', { ascending: false, nullsFirst: false });
    setDevicesLoading(false);
    if (error) {
      showAlert('Devices', `Could not load devices: ${error}`);
      return;
    }
    setDevices((data ?? []) as unknown as UserDevice[]);
  }, [profileId, showAlert]);

  const loadPrefs = useCallback(async () => {
    if (!profileId) return;
    setPrefsLoading(true);
    const { data, error } = await getNotificationPreferences(profileId);
    setPrefsLoading(false);
    if (error) {
      showAlert('Preferences', `Could not load notification preferences: ${error}`);
      return;
    }
    setPrefs(data ?? []);
  }, [profileId, showAlert]);

  useEffect(() => {
    loadProfile();
    loadDevices();
    loadPrefs();
  }, [loadProfile, loadDevices, loadPrefs]);

  const getPref = (channel: string, category: string): boolean => {
    const found = prefs.find((p) => p.channel === channel && p.category === category);
    if (found) return found.enabled;
    // Defaults: in_app + email default on, push default on for alerts/announcements
    if (channel === 'sms') return false;
    return true;
  };

  const togglePref = async (channel: string, category: string, value: boolean) => {
    if (!profileId) return;
    // Optimistic update
    setPrefs((prev) => {
      const exists = prev.find((p) => p.channel === channel && p.category === category);
      if (exists) {
        return prev.map((p) =>
          p.channel === channel && p.category === category ? { ...p, enabled: value } : p,
        );
      }
      return [
        ...prev,
        {
          id: 'temp',
          user_id: profileId,
          channel,
          category,
          enabled: value,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];
    });
    const { error } = await updateNotificationPreference(profileId, channel, category, value);
    if (error) {
      showAlert('Error', `Could not update preference: ${error}`);
      // Rollback
      setPrefs((prev) =>
        prev.map((p) =>
          p.channel === channel && p.category === category ? { ...p, enabled: !value } : p,
        ),
      );
    }
  };

  const handleVerifyEmail = async () => {
    if (!profileId) return;
    setVerifyingEmail(true);
    const { error } = await markEmailVerified(profileId);
    setVerifyingEmail(false);
    if (error) {
      showAlert('Verification Failed', error);
      return;
    }
    setProfile((p) => (p ? { ...p, email_verified: true } : p));
    showAlert('Verified', 'Your email is now marked as verified.');
  };

  const handleToggleMfa = async (value: boolean) => {
    if (!profileId) return;
    if (!value) {
      // Disable
      showAlert(
        'Disable Two-Factor Authentication',
        'Are you sure you want to disable MFA? This will make your account less secure.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disable',
            style: 'destructive',
            onPress: async () => {
              setMfaToggling(true);
              const { error } = await disableMfa(profileId);
              setMfaToggling(false);
              if (error) {
                showAlert('Error', error);
                return;
              }
              setProfile((p) => (p ? { ...p, mfa_enabled: false, mfa_secret: null } : p));
              showAlert('MFA Disabled', 'Two-factor authentication has been turned off.');
            },
          },
        ],
      );
      return;
    }
    // Enable — generate a new TOTP secret, store it, show URI in an alert
    setMfaToggling(true);
    try {
      const secret = generateTOTPSecret(32);
      const { error } = await enableMfa(profileId, secret);
      if (error) {
        showAlert('MFA Error', error);
        return;
      }
      const account = profile?.email ?? user?.email ?? 'user';
      const otpUri = buildOTPAuthURI({
        issuer: 'EduManage',
        account,
        secret,
      });
      setProfile((p) => (p ? { ...p, mfa_enabled: true, mfa_secret: secret } : p));
      showAlert(
        'MFA Enabled — Save this secret',
        `Add EduManage to your authenticator app by scanning a QR code from this URI:\n\n${otpUri}\n\nOr manually enter the secret: ${secret}\n\nYou will need codes from your authenticator app at next sign-in.`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showAlert('MFA Error', `Could not generate TOTP secret: ${msg}`);
    } finally {
      setMfaToggling(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword) {
      showAlert('Password Required', 'Please enter a new password.');
      return;
    }
    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      showAlert('Weak Password', 'Password must be 8+ chars with upper, lower, and a number.');
      return;
    }
    if (newPassword !== confirmPassword) {
      showAlert('Mismatch', 'Passwords do not match.');
      return;
    }
    setPwSubmitting(true);
    const { error } = await completePasswordReset(newPassword);
    setPwSubmitting(false);
    if (error) {
      showAlert('Update Failed', error);
      return;
    }
    setNewPassword('');
    setConfirmPassword('');
    setPwModalOpen(false);
    showAlert('Password Changed', 'Your password has been updated successfully.');
  };

  const handleRevokeDevice = (device: UserDevice) => {
    showAlert(
      'Revoke Device',
      `Remove "${device.device_name ?? device.platform ?? 'this device'}" from your trusted devices? You may need to sign in again on that device.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            const supabase = getSupabaseClient();
            const { error } = await supabase.from('user_devices').delete().eq('id', device.id);
            if (error) {
              showAlert('Error', error);
              return;
            }
            setDevices((prev) => prev.filter((d) => d.id !== device.id));
            showAlert('Revoked', 'The device has been removed.');
          },
        },
      ],
    );
  };

  const handleAuditHistory = () => {
    if (isPlatformAdmin) {
      router.push('/(superadmin)/support' as any);
    } else {
      router.push('/(ict)/logs' as any);
    }
  };

  const handleSignOut = () => {
    showAlert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  if (loading || !profile) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.flex}>
          <Header title="Profile" showBack accentColor={Colors.primary} />
          <LoadingScreen message="Loading your profile…" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.flex}>
        <Header title="Profile" subtitle="Account & security" showBack accentColor={Colors.primary} />
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ─── USER CARD ─── */}
          <Card style={styles.userCard}>
            <View style={styles.userRow}>
              <Avatar name={profile.full_name ?? profile.email} size={72} imageUrl={profile.avatar_url ?? undefined} />
              <View style={styles.userMeta}>
                <Text style={styles.userName}>{profile.full_name ?? 'Unnamed User'}</Text>
                <Text style={styles.userEmail} numberOfLines={1}>{profile.email}</Text>
                <View style={styles.userBadges}>
                  {userRole ? (
                    <Badge label={formatRole(userRole)} variant="primary" size="sm" />
                  ) : null}
                  {school ? (
                    <Badge label={school.name} variant="default" size="sm" />
                  ) : null}
                </View>
              </View>
            </View>
            {profile.phone ? (
              <View style={styles.contactRow}>
                <MaterialIcons name="phone" size={14} color={Colors.textMuted} />
                <Text style={styles.contactText}>{profile.phone}</Text>
              </View>
            ) : null}
          </Card>

          {/* ─── ACCOUNT SECURITY ─── */}
          <Text style={styles.sectionTitle}>Account Security</Text>
          <Card style={styles.sectionCard}>
            <View style={styles.securityRow}>
              <View style={styles.securityLeft}>
                <View style={[styles.securityIcon, { backgroundColor: profile.email_verified ? Colors.successBg : Colors.warningBg }]}>
                  <MaterialIcons
                    name={profile.email_verified ? 'verified' : 'mark-email-unread'}
                    size={18}
                    color={profile.email_verified ? Colors.success : Colors.warning}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.securityLabel}>Email Verification</Text>
                  <Text style={styles.securityDesc}>
                    {profile.email_verified
                      ? `Verified — ${profile.email}`
                      : 'Your email is not yet verified.'}
                  </Text>
                </View>
              </View>
              {profile.email_verified ? (
                <Badge label="Verified" variant="success" size="sm" />
              ) : (
                <Button
                  label="Verify Now"
                  onPress={handleVerifyEmail}
                  size="sm"
                  variant="outline"
                  loading={verifyingEmail}
                />
              )}
            </View>

            <View style={styles.divider} />

            <View style={styles.securityRow}>
              <View style={styles.securityLeft}>
                <View style={[styles.securityIcon, { backgroundColor: profile.mfa_enabled ? Colors.successBg : Colors.surface2 }]}>
                  <MaterialIcons
                    name="phonelink-lock"
                    size={18}
                    color={profile.mfa_enabled ? Colors.success : Colors.textMuted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.securityLabel}>Two-Factor Authentication</Text>
                  <Text style={styles.securityDesc}>
                    {profile.mfa_enabled
                      ? 'TOTP authenticator is active for your account.'
                      : 'Add an extra layer of security with TOTP.'}
                  </Text>
                </View>
              </View>
              <Switch
                value={profile.mfa_enabled}
                onValueChange={handleToggleMfa}
                disabled={mfaToggling}
                trackColor={{ false: Colors.surface2, true: `${Colors.success}80` }}
                thumbColor={profile.mfa_enabled ? Colors.success : Colors.textMuted}
              />
            </View>

            <View style={styles.divider} />

            <Pressable
              style={({ pressed }) => [styles.securityRow, pressed && { opacity: 0.7 }]}
              onPress={() => setPwModalOpen(true)}
            >
              <View style={styles.securityLeft}>
                <View style={[styles.securityIcon, { backgroundColor: Colors.surface2 }]}>
                  <MaterialIcons name="lock-reset" size={18} color={Colors.textSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.securityLabel}>Change Password</Text>
                  <Text style={styles.securityDesc}>Update your account password.</Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={Colors.textMuted} />
            </Pressable>
          </Card>

          {/* ─── DEVICES ─── */}
          <Text style={styles.sectionTitle}>Devices</Text>
          <Card style={styles.sectionCard}>
            {devicesLoading ? (
              <View style={styles.rowCenter}>
                <ActivityIndicator color={Colors.primary} size="small" />
                <Text style={styles.mutedText}>Loading devices…</Text>
              </View>
            ) : devices.length === 0 ? (
              <View style={styles.rowCenter}>
                <MaterialIcons name="devices" size={20} color={Colors.textMuted} />
                <Text style={styles.mutedText}>No devices registered yet.</Text>
              </View>
            ) : (
              devices.map((device, idx) => (
                <View key={device.id}>
                  <View style={styles.deviceRow}>
                    <View style={[styles.securityIcon, { backgroundColor: Colors.surface2 }]}>
                      <MaterialIcons name={platformIcon(device.platform)} size={18} color={Colors.textSecondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.deviceHeader}>
                        <Text style={styles.deviceName} numberOfLines={1}>
                          {device.device_name ?? device.platform ?? 'Unknown device'}
                        </Text>
                        {device.trusted ? (
                          <Badge label="Trusted" variant="success" size="sm" />
                        ) : null}
                      </View>
                      <Text style={styles.deviceMeta}>
                        {device.platform ?? 'Unknown'} · {device.last_ip ?? 'No IP'} · {formatLastSeen(device.last_seen_at)}
                      </Text>
                    </View>
                    <Pressable onPress={() => handleRevokeDevice(device)} hitSlop={8} style={styles.revokeBtn}>
                      <MaterialIcons name="delete-outline" size={18} color={Colors.error} />
                    </Pressable>
                  </View>
                  {idx < devices.length - 1 ? <View style={styles.divider} /> : null}
                </View>
              ))
            )}
          </Card>

          {/* ─── NOTIFICATION PREFERENCES ─── */}
          <Text style={styles.sectionTitle}>Notification Preferences</Text>
          <Card style={styles.sectionCard}>
            <Text style={styles.prefIntro}>
              Choose which notifications you receive per channel. Critical alerts may still be sent regardless of your preferences.
            </Text>
            <View style={styles.prefMatrixHeader}>
              <View style={styles.prefMatrixCategoryCol}>
                <Text style={styles.prefMatrixHeaderText}>Category</Text>
              </View>
              {NOTIF_CHANNELS.map((ch) => (
                <View key={ch} style={styles.prefMatrixChannelCol}>
                  <MaterialIcons
                    name={CHANNEL_ICONS[ch]}
                    size={14}
                    color={Colors.textMuted}
                  />
                  <Text style={styles.prefMatrixHeaderText}>{CHANNEL_LABELS[ch]}</Text>
                </View>
              ))}
            </View>
            {NOTIF_CATEGORIES.map((cat) => (
              <View key={cat} style={styles.prefMatrixRow}>
                <View style={styles.prefMatrixCategoryCol}>
                  <Text style={styles.prefMatrixCategory}>{CATEGORY_LABELS[cat]}</Text>
                </View>
                {NOTIF_CHANNELS.map((ch) => (
                  <View key={ch} style={styles.prefMatrixChannelCol}>
                    <Switch
                      value={getPref(ch, cat)}
                      onValueChange={(v) => togglePref(ch, cat, v)}
                      disabled={prefsLoading}
                      trackColor={{ false: Colors.surface2, true: `${Colors.primary}80` }}
                      thumbColor={getPref(ch, cat) ? Colors.primary : Colors.textMuted}
                    />
                  </View>
                ))}
              </View>
            ))}
          </Card>

          {/* ─── ACCOUNT ACTIONS ─── */}
          <Text style={styles.sectionTitle}>Account Actions</Text>
          <Card style={styles.sectionCard}>
            <Pressable
              style={({ pressed }) => [styles.securityRow, pressed && { opacity: 0.7 }]}
              onPress={handleAuditHistory}
            >
              <View style={styles.securityLeft}>
                <View style={[styles.securityIcon, { backgroundColor: Colors.surface2 }]}>
                  <MaterialIcons name="history" size={18} color={Colors.textSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.securityLabel}>View Audit History</Text>
                  <Text style={styles.securityDesc}>
                    {isPlatformAdmin ? 'Open platform audit logs.' : 'Open your school audit logs.'}
                  </Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={Colors.textMuted} />
            </Pressable>

            <View style={styles.divider} />

            <View style={styles.signOutRow}>
              <Button
                label="Sign Out"
                onPress={handleSignOut}
                variant="danger"
                fullWidth
                loading={operationLoading}
                icon={<MaterialIcons name="logout" size={18} color={Colors.textPrimary} />}
              />
            </View>
          </Card>

          <View style={styles.footer}>
            <Text style={styles.footerText}>EduManage · Profile ID: {profile.id.slice(0, 8)}…</Text>
          </View>
        </ScrollView>

        {/* ─── CHANGE PASSWORD MODAL ─── */}
        <Modal
          visible={pwModalOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setPwModalOpen(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalOverlay}
          >
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Change Password</Text>
                <Pressable onPress={() => setPwModalOpen(false)} hitSlop={8}>
                  <MaterialIcons name="close" size={22} color={Colors.textSecondary} />
                </Pressable>
              </View>
              <Text style={styles.modalSubtitle}>
                Choose a new password. You&apos;ll stay signed in on this device.
              </Text>
              <Input
                label="New Password"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                leftIcon="lock"
                placeholder="At least 8 characters"
                autoCapitalize="none"
              />
              <Input
                label="Confirm Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                leftIcon="lock-outline"
                placeholder="Re-enter new password"
                autoCapitalize="none"
                error={
                  confirmPassword.length > 0 && newPassword !== confirmPassword
                    ? 'Passwords do not match'
                    : undefined
                }
              />
              <View style={styles.modalActions}>
                <Button
                  label="Cancel"
                  onPress={() => setPwModalOpen(false)}
                  variant="ghost"
                  fullWidth
                />
                <Button
                  label="Update Password"
                  onPress={handleChangePassword}
                  loading={pwSubmitting}
                  disabled={pwSubmitting}
                  fullWidth
                />
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  scrollContent: { padding: Spacing.md, paddingBottom: Spacing.xxl, gap: Spacing.sm },

  // User card
  userCard: { gap: Spacing.md },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  userMeta: { flex: 1, gap: 4 },
  userName: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  userEmail: { fontSize: FontSize.sm, color: Colors.textSecondary },
  userBadges: { flexDirection: 'row', gap: Spacing.xs, marginTop: 4, flexWrap: 'wrap' },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingTop: Spacing.xs, borderTopColor: Colors.border, borderTopWidth: 0.5 },
  contactText: { fontSize: FontSize.sm, color: Colors.textSecondary },

  sectionTitle: {
    fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginTop: Spacing.md, marginBottom: Spacing.xs,
  },
  sectionCard: { gap: Spacing.sm },

  // Security rows
  securityRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xs },
  securityLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
  securityIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  securityLabel: { fontSize: FontSize.base, color: Colors.textPrimary, fontWeight: FontWeight.medium },
  securityDesc: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2, lineHeight: 16 },
  divider: { height: 0.5, backgroundColor: Colors.border, marginVertical: Spacing.xs },

  // Devices
  deviceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xs },
  deviceHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flex: 1 },
  deviceName: { fontSize: FontSize.base, color: Colors.textPrimary, fontWeight: FontWeight.medium, flex: 1 },
  deviceMeta: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  revokeBtn: { padding: Spacing.xs },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm, justifyContent: 'center' },
  mutedText: { color: Colors.textMuted, fontSize: FontSize.sm },

  // Prefs matrix
  prefIntro: { fontSize: FontSize.xs, color: Colors.textMuted, lineHeight: 16, marginBottom: Spacing.xs },
  prefMatrixHeader: {
    flexDirection: 'row', paddingVertical: Spacing.xs,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  prefMatrixCategoryCol: { flex: 1.4 },
  prefMatrixChannelCol: { flex: 1, alignItems: 'center', gap: 2 },
  prefMatrixHeaderText: {
    fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: FontWeight.semibold,
    textTransform: 'uppercase', letterSpacing: 0.3,
  },
  prefMatrixRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.xs,
    borderBottomWidth: 0.5, borderBottomColor: Colors.border,
  },
  prefMatrixCategory: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.medium },

  // Sign out
  signOutRow: { paddingTop: Spacing.xs },
  footer: { alignItems: 'center', paddingVertical: Spacing.lg },
  footerText: { fontSize: FontSize.xs, color: Colors.textMuted },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
    ...Shadow.lg,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  modalSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 18 },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
});
