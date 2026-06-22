import React, { useState } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAlert } from '@/template';
import { requestPasswordReset } from '@/services/auth.security.service';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { showAlert } = useAlert();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const validateEmail = (value: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());
  };

  const handleSendReset = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      showAlert('Email Required', 'Please enter your account email address.');
      return;
    }
    if (!validateEmail(trimmed)) {
      showAlert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    setLoading(true);
    const webOrigin =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.location.origin
        : undefined;
    const redirectTo = webOrigin
      ? `${webOrigin}/reset-password`
      : 'edumanage://reset-password';
    const { error } = await requestPasswordReset(trimmed, redirectTo);
    setLoading(false);

    if (error) {
      showAlert('Request Failed', error);
      return;
    }
    setSent(true);
  };

  const handleBackToLogin = () => {
    router.replace('/login');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.flex}>
        <Header title="Reset Password" subtitle="Recover your account" showBack accentColor={Colors.primary} />
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
            {sent ? (
              <Card style={styles.successCard}>
                <View style={styles.successIconWrap}>
                  <MaterialIcons name="mark-email-read" size={48} color={Colors.success} />
                </View>
                <Text style={styles.successTitle}>Check your email</Text>
                <Text style={styles.successText}>
                  We sent a password reset link to{'\n'}
                  <Text style={styles.emailHighlight}>{email.trim()}</Text>
                  {'\n\n'}Tap the link in the email to set a new password. The link expires in 60 minutes.
                </Text>
                <View style={styles.tipBox}>
                  <MaterialIcons name="lightbulb-outline" size={16} color={Colors.warning} />
                  <Text style={styles.tipText}>
                    Didn&apos;t get the email? Check your spam folder, then try again in a minute.
                  </Text>
                </View>
                <Button
                  label="Back to Login"
                  onPress={handleBackToLogin}
                  fullWidth
                  size="lg"
                  variant="primary"
                />
                <Button
                  label="Resend Reset Link"
                  onPress={handleSendReset}
                  fullWidth
                  size="sm"
                  variant="ghost"
                  loading={loading}
                />
              </Card>
            ) : (
              <>
                <View style={styles.intro}>
                  <View style={styles.introIcon}>
                    <MaterialIcons name="lock-reset" size={32} color={Colors.primary} />
                  </View>
                  <Text style={styles.introTitle}>Forgot your password?</Text>
                  <Text style={styles.introSubtitle}>
                    Enter your account email and we&apos;ll send you a secure link to reset your password.
                  </Text>
                </View>

                <Card style={styles.formCard}>
                  <Input
                    label="Account Email"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    leftIcon="email"
                    placeholder="you@school.edu"
                    returnKeyType="go"
                    onSubmitEditing={handleSendReset}
                  />
                  <Button
                    label="Send Reset Link"
                    onPress={handleSendReset}
                    fullWidth
                    loading={loading}
                    size="lg"
                  />
                  <Text style={styles.hintText}>
                    You&apos;ll receive an email with instructions. If you no longer have access to
                    your email, contact your school&apos;s ICT Manager.
                  </Text>
                </Card>

                <View style={styles.footerRow}>
                  <Text style={styles.footerText}>Remembered your password? </Text>
                  <Pressable onPress={handleBackToLogin} hitSlop={8}>
                    <Text style={styles.footerLink}>Sign In</Text>
                  </Pressable>
                </View>
              </>
            )}
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
  intro: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.lg },
  introIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.schoolAdminBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  introTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  introSubtitle: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.md,
  },
  formCard: { gap: Spacing.md },
  hintText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.sm },
  footerText: { color: Colors.textSecondary, fontSize: FontSize.base },
  footerLink: { color: Colors.primary, fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  successCard: { gap: Spacing.md, alignItems: 'center', padding: Spacing.xl },
  successIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  successText: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  emailHighlight: { color: Colors.textPrimary, fontWeight: FontWeight.semibold },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
    backgroundColor: Colors.warningBg,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: `${Colors.warning}30`,
    width: '100%',
  },
  tipText: { flex: 1, fontSize: FontSize.xs, color: Colors.warning, lineHeight: 18 },
});
