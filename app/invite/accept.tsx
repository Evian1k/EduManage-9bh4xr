import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAlert } from '@/template';
import {
  getInvitationByToken,
  acceptInvitation,
  SchoolInvitationRow,
} from '@/services/invitation.service';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { EmptyState } from '@/components/ui/EmptyState';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';

type InvitationData = SchoolInvitationRow & {
  schools: { name: string; subdomain: string };
};

type ScreenState = 'loading' | 'invalid' | 'ready';

function formatRole(role: string): string {
  return role
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function isStrongPassword(pw: string): boolean {
  return pw.length >= 8 && /[A-Z]/.test(pw) && /[a-z]/.test(pw) && /[0-9]/.test(pw);
}

export default function AcceptInvitationScreen() {
  const router = useRouter();
  const { showAlert } = useAlert();
  const params = useLocalSearchParams<{ token?: string }>();

  const token = typeof params.token === 'string' ? params.token : Array.isArray(params.token) ? params.token[0] : '';

  const [state, setState] = useState<ScreenState>('loading');
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [loadError, setLoadError] = useState<string>('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const loadInvitation = useCallback(async () => {
    if (!token) {
      setState('invalid');
      setLoadError('No invitation token was provided. Please use the link from your invitation email.');
      return;
    }
    setState('loading');
    const { data, error } = await getInvitationByToken(token);
    if (error || !data) {
      setState('invalid');
      setLoadError(error ?? 'Invitation not found');
      return;
    }
    setInvitation(data);
    setState('ready');
  }, [token]);

  useEffect(() => {
    loadInvitation();
  }, [loadInvitation]);

  const handleAccept = async () => {
    if (!invitation) return;
    if (!fullName.trim()) {
      showAlert('Name Required', 'Please enter your full name as you want it shown in EduManage.');
      return;
    }
    if (!isStrongPassword(password)) {
      showAlert('Weak Password', 'Password must be at least 8 characters with upper, lower, and a number.');
      return;
    }
    if (password !== confirmPassword) {
      showAlert('Passwords Do Not Match', 'Please make sure both passwords match.');
      return;
    }
    setSubmitting(true);
    const { error } = await acceptInvitation({
      token,
      fullName: fullName.trim(),
      password,
      phone: phone.trim() || undefined,
    });
    setSubmitting(false);
    if (error) {
      showAlert('Acceptance Failed', error);
      return;
    }
    setSuccess(true);
  };

  const handleContinueToLogin = () => {
    router.replace('/login');
  };

  // ─── SUCCESS VIEW ────────────────────────────────────────────────────────
  if (success) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.flex}>
          <Header title="Welcome Aboard" accentColor={Colors.success} />
          <View style={styles.centerWrap}>
            <View style={styles.successIcon}>
              <MaterialIcons name="celebration" size={56} color={Colors.success} />
            </View>
            <Text style={styles.successTitle}>Account Created!</Text>
            <Text style={styles.successText}>
              Your staff account for{' '}
              <Text style={styles.successSchoolName}>
                {invitation?.schools?.name ?? 'your school'}
              </Text>{' '}
              is ready. Sign in with your email and new password to get started.
            </Text>
            <Button
              label="Continue to Sign In"
              onPress={handleContinueToLogin}
              fullWidth
              size="lg"
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ─── LOADING VIEW ────────────────────────────────────────────────────────
  if (state === 'loading') {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.flex}>
          <Header title="Accept Invitation" showBack accentColor={Colors.primary} />
          <LoadingScreen message="Verifying your invitation…" />
        </View>
      </SafeAreaView>
    );
  }

  // ─── INVALID / EXPIRED VIEW ──────────────────────────────────────────────
  if (state === 'invalid') {
    const isExpired = loadError.toLowerCase().includes('expired');
    const isRevoked = loadError.toLowerCase().includes('revoked');
    const isAccepted = loadError.toLowerCase().includes('accepted');
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.flex}>
          <Header title="Accept Invitation" showBack accentColor={Colors.error} />
          <View style={styles.centerWrap}>
            <EmptyState
              icon={
                isExpired
                  ? 'schedule'
                  : isRevoked
                    ? 'block'
                    : isAccepted
                      ? 'task-alt'
                      : 'error-outline'
              }
              title={
                isExpired
                  ? 'Invitation Expired'
                  : isRevoked
                    ? 'Invitation Revoked'
                    : isAccepted
                      ? 'Already Accepted'
                      : 'Invitation Not Found'
              }
              description={
                isExpired
                  ? 'This invitation link has expired. Please ask your school administrator to send a new invitation.'
                  : isRevoked
                    ? 'This invitation has been cancelled by the school administrator.'
                    : isAccepted
                      ? 'This invitation has already been used. You can sign in with the account you created.'
                      : loadError || 'The invitation link is invalid.'
              }
              actionLabel="Go to Login"
              onAction={() => router.replace('/login')}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ─── READY / FORM VIEW ──────────────────────────────────────────────────
  const canSubmit =
    fullName.trim().length > 0 &&
    isStrongPassword(password) &&
    password === confirmPassword &&
    !submitting;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.flex}>
        <Header
          title="Accept Invitation"
          subtitle="Create your staff account"
          showBack
          accentColor={Colors.primary}
        />
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
        >
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.container}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Invitation Summary Card */}
            <Card style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <View style={styles.schoolIconWrap}>
                  <MaterialIcons name="business" size={24} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.schoolName}>{invitation?.schools?.name ?? 'School'}</Text>
                  <Text style={styles.schoolSub}>
                    {invitation?.schools?.subdomain
                      ? `${invitation.schools.subdomain}.edumanage.com`
                      : 'EduManage'}
                  </Text>
                </View>
              </View>
              <View style={styles.summaryRow}>
                <MaterialIcons name="alternate-email" size={16} color={Colors.textMuted} />
                <Text style={styles.summaryLabel}>Invited email</Text>
                <Text style={styles.summaryValue} numberOfLines={1}>
                  {invitation?.email}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <MaterialIcons name="badge" size={16} color={Colors.textMuted} />
                <Text style={styles.summaryLabel}>Role</Text>
                <Badge label={formatRole(invitation?.role ?? '')} variant="primary" size="sm" />
              </View>
              <View style={styles.summaryRow}>
                <MaterialIcons name="event-available" size={16} color={Colors.textMuted} />
                <Text style={styles.summaryLabel}>Expires</Text>
                <Text style={styles.summaryValue}>
                  {invitation?.expires_at
                    ? new Date(invitation.expires_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : 'N/A'}
                </Text>
              </View>
            </Card>

            {/* Account Creation Form */}
            <Card style={styles.formCard}>
              <Text style={styles.formTitle}>Set up your account</Text>
              <Text style={styles.formSubtitle}>
                Choose a strong password — you&apos;ll use these credentials to sign in.
              </Text>
              <View style={styles.fields}>
                <Input
                  label="Full Name"
                  value={fullName}
                  onChangeText={setFullName}
                  leftIcon="person"
                  placeholder="e.g. Jane Doe"
                  autoCapitalize="words"
                />
                <Input
                  label="Email"
                  value={invitation?.email ?? ''}
                  leftIcon="email"
                  editable={false}
                  hint="Email is locked to the invited address."
                />
                <Input
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  leftIcon="lock"
                  placeholder="At least 8 characters"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Input
                  label="Confirm Password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  leftIcon="lock-outline"
                  placeholder="Re-enter your password"
                  autoCapitalize="none"
                  autoCorrect={false}
                  error={
                    confirmPassword.length > 0 && password !== confirmPassword
                      ? 'Passwords do not match'
                      : undefined
                  }
                />
                <Input
                  label="Phone (optional)"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  leftIcon="phone"
                  placeholder="+254 700 000 000"
                />
              </View>

              <Button
                label="Accept Invitation & Create Account"
                onPress={handleAccept}
                fullWidth
                loading={submitting}
                disabled={!canSubmit}
                size="lg"
              />

              <Pressable
                onPress={() => router.replace('/login')}
                style={styles.cancelLink}
                hitSlop={8}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </Card>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  container: { flexGrow: 1, padding: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.md },
  centerWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: Spacing.xl, gap: Spacing.lg,
  },
  successIcon: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: Colors.successBg, alignItems: 'center', justifyContent: 'center',
  },
  successTitle: { fontSize: FontSize.xxxl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  successText: {
    fontSize: FontSize.base, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22,
  },
  successSchoolName: { color: Colors.textPrimary, fontWeight: FontWeight.semibold },

  summaryCard: { gap: Spacing.sm },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.xs },
  schoolIconWrap: {
    width: 44, height: 44, borderRadius: BorderRadius.md,
    backgroundColor: Colors.schoolAdminBg, alignItems: 'center', justifyContent: 'center',
  },
  schoolName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  schoolSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  summaryRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderTopColor: Colors.border, borderTopWidth: 0.5,
  },
  summaryLabel: { fontSize: FontSize.sm, color: Colors.textMuted, flex: 1 },
  summaryValue: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.medium, flex: 1 },

  formCard: { gap: Spacing.md },
  formTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  formSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 18 },
  fields: { gap: Spacing.md },
  cancelLink: { alignItems: 'center', paddingVertical: Spacing.xs },
  cancelText: { color: Colors.textSecondary, fontSize: FontSize.base },
});
