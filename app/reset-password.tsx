import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAlert } from '@/template';
import { completePasswordReset } from '@/services/auth.security.service';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';

interface PasswordChecks {
  length: boolean;
  upper: boolean;
  lower: boolean;
  number: boolean;
}

function evaluatePassword(pw: string): PasswordChecks {
  return {
    length: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    number: /[0-9]/.test(pw),
  };
}

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { showAlert } = useAlert();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const checks = useMemo(() => evaluatePassword(password), [password]);
  const allValid = checks.length && checks.upper && checks.lower && checks.number;
  const passwordsMatch = password.length > 0 && password === confirm;
  const canSubmit = allValid && passwordsMatch && !loading;

  const handleReset = async () => {
    if (!password) {
      showAlert('Password Required', 'Please enter a new password.');
      return;
    }
    if (!allValid) {
      showAlert('Weak Password', 'Password must be at least 8 characters and contain upper, lower, and a number.');
      return;
    }
    if (password !== confirm) {
      showAlert('Passwords Do Not Match', 'Please make sure both passwords are identical.');
      return;
    }
    setLoading(true);
    const { error } = await completePasswordReset(password);
    setLoading(false);

    if (error) {
      showAlert('Reset Failed', error);
      return;
    }
    setDone(true);
  };

  const handleContinue = () => {
    router.replace('/login');
  };

  if (done) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.flex}>
          <Header title="Set New Password" showBack accentColor={Colors.success} />
          <View style={styles.centerWrap}>
            <View style={styles.successIconWrap}>
              <MaterialIcons name="verified-user" size={56} color={Colors.success} />
            </View>
            <Text style={styles.successTitle}>Password Updated</Text>
            <Text style={styles.successText}>
              Your password has been changed successfully. You can now sign in with your new password.
            </Text>
            <Button
              label="Continue to Login"
              onPress={handleContinue}
              fullWidth
              size="lg"
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const CheckRow = ({ label, ok }: { label: string; ok: boolean }) => (
    <View style={styles.checkRow}>
      <MaterialIcons
        name={ok ? 'check-circle' : 'radio-button-unchecked'}
        size={16}
        color={ok ? Colors.success : Colors.textMuted}
      />
      <Text style={[styles.checkLabel, ok && styles.checkLabelOk]}>{label}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.flex}>
        <Header title="Set New Password" subtitle="Choose a strong password" showBack accentColor={Colors.primary} />
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
            <Card style={styles.formCard}>
              <View style={styles.introRow}>
                <View style={styles.introIcon}>
                  <MaterialIcons name="lock" size={24} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formTitle}>Create a new password</Text>
                  <Text style={styles.formSubtitle}>
                    Your new password must meet the security requirements below.
                  </Text>
                </View>
              </View>

              <Input
                label="New Password"
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
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry
                leftIcon="lock-outline"
                placeholder="Re-enter your password"
                autoCapitalize="none"
                autoCorrect={false}
                error={
                  confirm.length > 0 && !passwordsMatch
                    ? 'Passwords do not match'
                    : undefined
                }
              />

              <View style={styles.checksBox}>
                <Text style={styles.checksTitle}>Password requirements</Text>
                <CheckRow label="At least 8 characters" ok={checks.length} />
                <CheckRow label="One uppercase letter (A–Z)" ok={checks.upper} />
                <CheckRow label="One lowercase letter (a–z)" ok={checks.lower} />
                <CheckRow label="One number (0–9)" ok={checks.number} />
              </View>

              <Button
                label="Reset Password"
                onPress={handleReset}
                fullWidth
                loading={loading}
                disabled={!canSubmit}
                size="lg"
              />
            </Card>

            <Pressable onPress={handleContinue} style={styles.cancelLink} hitSlop={8}>
              <Text style={styles.cancelText}>Cancel and sign in</Text>
            </Pressable>
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
  formCard: { gap: Spacing.md },
  introRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, marginBottom: Spacing.xs },
  introIcon: {
    width: 44, height: 44, borderRadius: BorderRadius.md,
    backgroundColor: Colors.schoolAdminBg, alignItems: 'center', justifyContent: 'center',
  },
  formTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  formSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2, lineHeight: 18 },
  checksBox: {
    backgroundColor: Colors.surface2,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  checksTitle: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  checkLabel: { fontSize: FontSize.sm, color: Colors.textMuted },
  checkLabelOk: { color: Colors.success },
  cancelLink: { alignItems: 'center', paddingVertical: Spacing.sm },
  cancelText: { color: Colors.textSecondary, fontSize: FontSize.base },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  successIconWrap: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: Colors.successBg, alignItems: 'center', justifyContent: 'center',
  },
  successTitle: { fontSize: FontSize.xxxl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  successText: {
    fontSize: FontSize.base, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22,
  },
});
