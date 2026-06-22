import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth, useAlert, getSupabaseClient } from '@/template';
import { verifyTOTP } from '@/lib/totp';
import { logAuditEvent } from '@/services/audit.service';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';

const MAX_ATTEMPTS = 5;

export default function MfaChallengeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { showAlert } = useAlert();

  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);
  const [loadingSecret, setLoadingSecret] = useState(true);
  const [secret, setSecret] = useState<string | null>(null);

  // Fetch the user's stored TOTP secret on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id) {
        setLoadingSecret(false);
        return;
      }
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('user_profiles')
        .select('mfa_secret, full_name')
        .eq('auth_user_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        showAlert('MFA Error', 'Unable to load your MFA settings. Please try again.');
        setLoadingSecret(false);
        return;
      }
      if (!data?.mfa_secret) {
        showAlert(
          'MFA Not Configured',
          'No MFA secret was found for your account. Please contact your administrator.',
          [{ text: 'OK', onPress: () => router.replace('/login') }],
        );
        setLoadingSecret(false);
        return;
      }
      setSecret(data.mfa_secret as string);
      setLoadingSecret(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (attempts >= MAX_ATTEMPTS) {
      setLocked(true);
      showAlert(
        'Too Many Attempts',
        'For your security, MFA has been temporarily locked. Please sign out and try again later.',
        [{ text: 'OK', onPress: () => router.replace('/login') }],
      );
    }
  }, [attempts]);

  const handleVerify = async () => {
    if (locked) return;
    if (!secret) {
      showAlert('MFA Not Ready', 'Your MFA secret is still loading. Please wait a moment.');
      return;
    }
    const trimmed = code.trim();
    if (trimmed.length !== 6 || !/^\d{6}$/.test(trimmed)) {
      showAlert('Invalid Code', 'Please enter the 6-digit code from your authenticator app.');
      return;
    }
    setVerifying(true);
    try {
      const valid = await verifyTOTP(secret, trimmed, 1);
      if (!valid) {
        const next = attempts + 1;
        setAttempts(next);
        await logAuditEvent({
          action: 'auth.mfa.failed',
          details: { attempts: next },
          severity: 'warning',
        });
        const remaining = Math.max(0, MAX_ATTEMPTS - next);
        showAlert(
          'Incorrect Code',
          remaining > 0
            ? `That code didn't match. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
            : 'Maximum attempts reached. MFA is now locked.',
        );
        setCode('');
        return;
      }

      await logAuditEvent({
        action: 'auth.mfa.success',
        severity: 'info',
      });
      showAlert('Verified', 'Two-factor authentication successful.', [
        { text: 'Continue', onPress: () => router.replace('/') },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showAlert('Verification Error', `Could not verify code: ${msg}`);
    } finally {
      setVerifying(false);
    }
  };

  const handleSignOut = () => {
    router.replace('/login');
  };

  if (loadingSecret) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.flex}>
          <Header title="Two-Factor Authentication" showBack accentColor={Colors.primary} />
          <View style={styles.centerWrap}>
            <MaterialIcons name="lock-clock" size={48} color={Colors.textMuted} />
            <Text style={styles.loadingText}>Loading secure challenge…</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.flex}>
        <Header
          title="Two-Factor Authentication"
          subtitle="Verify your identity"
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
            <View style={styles.hero}>
              <View style={styles.heroIcon}>
                <MaterialIcons name="lock-clock" size={44} color={Colors.primary} />
              </View>
              <Text style={styles.heroTitle}>Enter your authenticator code</Text>
              <Text style={styles.heroSubtitle}>
                Open your authenticator app (Google Authenticator, Authy, 1Password) and enter the
                current 6-digit code for EduManage.
              </Text>
            </View>

            <Card style={styles.formCard}>
              <Input
                label="6-Digit Code"
                value={code}
                onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                leftIcon="pin"
                placeholder="000000"
                maxLength={6}
                returnKeyType="done"
                onSubmitEditing={handleVerify}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.codePreviewRow}>
                <Text style={styles.codePreviewLabel}>You entered:</Text>
                <Text style={[styles.codePreviewValue, code.length === 6 && styles.codePreviewComplete]}>
                  {code.padEnd(6, '•').split('').join(' ')}
                </Text>
              </View>

              <Button
                label="Verify"
                onPress={handleVerify}
                fullWidth
                loading={verifying}
                disabled={locked || code.length !== 6}
                size="lg"
                icon={<MaterialIcons name="verified-user" size={18} color={Colors.textPrimary} />}
              />

              <View style={styles.attemptsRow}>
                <MaterialIcons
                  name={attempts > 0 ? 'error-outline' : 'shield'}
                  size={14}
                  color={attempts > 0 ? Colors.warning : Colors.textMuted}
                />
                <Text
                  style={[
                    styles.attemptsText,
                    attempts > 0 && { color: Colors.warning },
                  ]}
                >
                  {locked
                    ? 'MFA locked due to too many failed attempts.'
                    : `${MAX_ATTEMPTS - attempts} attempt${MAX_ATTEMPTS - attempts === 1 ? '' : 's'} remaining`}
                </Text>
              </View>
            </Card>

            <Card style={styles.helpCard}>
              <Text style={styles.helpTitle}>Lost your device?</Text>
              <Text style={styles.helpText}>
                Contact your school&apos;s ICT Manager or EduManage support to reset your two-factor
                authentication. You will need to verify your identity before MFA can be disabled.
              </Text>
              <Pressable onPress={handleSignOut} hitSlop={8}>
                <Text style={styles.signOutLink}>Sign out and use backup method</Text>
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
  container: {
    flexGrow: 1,
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
    gap: Spacing.md,
    justifyContent: 'center',
  },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xl },
  loadingText: { color: Colors.textSecondary, fontSize: FontSize.base },
  hero: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.lg },
  heroIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.schoolAdminBg, alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  heroTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, textAlign: 'center' },
  heroSubtitle: {
    fontSize: FontSize.base, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22,
    paddingHorizontal: Spacing.md,
  },
  formCard: { gap: Spacing.md },
  codePreviewRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.surface2, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  codePreviewLabel: { fontSize: FontSize.xs, color: Colors.textMuted, textTransform: 'uppercase' },
  codePreviewValue: {
    fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textSecondary,
    letterSpacing: 4, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  codePreviewComplete: { color: Colors.primary },
  attemptsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
  attemptsText: { fontSize: FontSize.xs, color: Colors.textMuted },
  helpCard: { gap: Spacing.sm },
  helpTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  helpText: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18 },
  signOutLink: {
    color: Colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.semibold, marginTop: 4,
  },
});
