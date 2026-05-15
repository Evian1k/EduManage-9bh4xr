import React, { useState } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, Pressable
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, useAlert } from '@/template';
import { registerSchool } from '@/services/school.service';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';

type Step = 'school' | 'otp' | 'done';

function getRLSErrorMessage(raw: string): string {
  if (raw.includes('row-level security')) {
    return 'Permission denied. Please try logging out and signing in again before registering.';
  }
  if (raw.includes('duplicate') || raw.includes('unique')) {
    if (raw.includes('subdomain')) return 'This school ID is already taken. Please choose a different one.';
    if (raw.includes('email')) return 'An account with this email already exists.';
    return 'This school already exists. Please use a different name or ID.';
  }
  if (raw.includes('foreign key') || raw.includes('violates')) {
    return 'Account setup issue. Please sign out, sign back in, and try again.';
  }
  if (raw.includes('network') || raw.includes('fetch')) {
    return 'Network error. Please check your connection and try again.';
  }
  return raw;
}

export default function RegisterScreen() {
  const router = useRouter();
  const { sendOTP, verifyOTPAndLogin, operationLoading } = useAuth();
  const { showAlert } = useAlert();

  const [step, setStep] = useState<Step>('school');
  const [schoolName, setSchoolName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendOTP = async () => {
    if (!schoolName.trim() || !subdomain.trim() || !adminEmail.trim()) {
      showAlert('Missing Fields', 'Please fill in all school details.');
      return;
    }
    if (password.length < 6) {
      showAlert('Weak Password', 'Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      showAlert('Password Mismatch', 'Passwords do not match.');
      return;
    }
    const sub = subdomain.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (sub.length < 3) {
      showAlert('Invalid School ID', 'School ID must be at least 3 characters (letters and numbers only).');
      return;
    }

    setLoading(true);
    const { error } = await sendOTP(adminEmail.trim());
    setLoading(false);

    if (error) {
      showAlert('OTP Error', error.includes('already registered') ? 'This email is already registered. Please sign in instead.' : error);
      return;
    }
    setStep('otp');
  };

  const handleVerifyAndRegister = async () => {
    if (!otp.trim()) {
      showAlert('OTP Required', 'Please enter the verification code sent to your email.');
      return;
    }
    if (otp.length !== 4) {
      showAlert('Invalid OTP', 'Please enter the complete 4-digit verification code.');
      return;
    }

    setLoading(true);
    const { error: authError, user } = await verifyOTPAndLogin(adminEmail.trim(), otp, { password });

    if (authError || !user) {
      setLoading(false);
      showAlert('Verification Failed', authError === 'Token has expired or is invalid' ? 'Your code has expired. Please go back and request a new one.' : authError || 'Could not verify the code. Please try again.');
      return;
    }

    // Register school with the authenticated user
    const { error: schoolError } = await registerSchool(
      schoolName.trim(),
      subdomain.trim(),
      adminEmail.trim(),
      user.id
    );
    setLoading(false);

    if (schoolError) {
      const friendlyMsg = getRLSErrorMessage(schoolError.message || String(schoolError));
      showAlert('Registration Error', friendlyMsg);
      return;
    }

    setStep('done');
  };

  if (step === 'done') {
    return (
      <View style={styles.successContainer}>
        <View style={styles.successIcon}>
          <MaterialIcons name="check-circle" size={64} color={Colors.success} />
        </View>
        <Text style={styles.successTitle}>School Registered!</Text>
        <Text style={styles.successText}>
          Welcome to EduManage! {schoolName} has been set up on the Free Trial plan (50 students, 5 teachers, 30 days).
        </Text>
        <View style={styles.trialBox}>
          <MaterialIcons name="card-giftcard" size={20} color={Colors.warning} />
          <Text style={styles.trialText}>Your 30-day free trial has started. Upgrade anytime from Settings.</Text>
        </View>
        <Button
          label="Go to Dashboard"
          onPress={() => router.replace('/')}
          fullWidth
          size="lg"
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <MaterialIcons name="arrow-back" size={24} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Register School</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Progress */}
        <View style={styles.progressRow}>
          {(['school', 'otp'] as Step[]).map((s, i) => (
            <React.Fragment key={s}>
              <View style={[
                styles.progressDot,
                step === s && styles.progressDotActive,
                (step === 'otp' && i === 0) && styles.progressDotDone,
              ]}>
                {(step === 'otp' && i === 0)
                  ? <MaterialIcons name="check" size={16} color={Colors.success} />
                  : <Text style={styles.progressDotText}>{i + 1}</Text>
                }
              </View>
              {i < 1 ? <View style={[styles.progressLine, step === 'otp' && styles.progressLineDone]} /> : null}
            </React.Fragment>
          ))}
        </View>

        <View style={styles.card}>
          {step === 'school' ? (
            <>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconBg}>
                  <MaterialIcons name="business" size={22} color={Colors.primary} />
                </View>
                <View>
                  <Text style={styles.formTitle}>School Information</Text>
                  <Text style={styles.formSubtitle}>Set up your school on EduManage</Text>
                </View>
              </View>
              <View style={styles.fields}>
                <Input
                  label="School Name"
                  value={schoolName}
                  onChangeText={setSchoolName}
                  leftIcon="school"
                  placeholder="e.g. Greenfield Academy"
                />
                <Input
                  label="School ID (Subdomain)"
                  value={subdomain}
                  onChangeText={(t) => setSubdomain(t.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                  leftIcon="link"
                  placeholder="e.g. greenfield"
                  hint={`Your school URL: ${subdomain || 'yourschool'}.edumanage.com`}
                  autoCapitalize="none"
                />
                <Input
                  label="Admin Email"
                  value={adminEmail}
                  onChangeText={setAdminEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  leftIcon="email"
                  placeholder="principal@school.edu"
                />
                <Input
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  leftIcon="lock"
                  placeholder="Min. 6 characters"
                />
                <Input
                  label="Confirm Password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  leftIcon="lock"
                  placeholder="Re-enter password"
                />
              </View>
              <Button
                label="Continue — Verify Email"
                onPress={handleSendOTP}
                fullWidth
                loading={loading || operationLoading}
                size="lg"
              />
            </>
          ) : (
            <>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIconBg, { backgroundColor: Colors.successBg }]}>
                  <MaterialIcons name="verified" size={22} color={Colors.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formTitle}>Verify Email</Text>
                  <Text style={styles.formSubtitle} numberOfLines={2}>
                    Enter the 4-digit code sent to{'\n'}{adminEmail}
                  </Text>
                </View>
              </View>
              <View style={styles.otpHint}>
                <MaterialIcons name="schedule" size={14} color={Colors.textMuted} />
                <Text style={styles.otpHintText}>Code expires in 60 minutes. Check your spam folder if not received.</Text>
              </View>
              <View style={styles.fields}>
                <Input
                  label="Verification Code"
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="number-pad"
                  leftIcon="pin"
                  placeholder="4-digit code"
                  maxLength={4}
                />
              </View>
              <Button
                label="Register School"
                onPress={handleVerifyAndRegister}
                fullWidth
                loading={loading || operationLoading}
                size="lg"
              />
              <Button
                label="Back — Edit Details"
                onPress={() => { setStep('school'); setOtp(''); }}
                variant="ghost"
                fullWidth
                size="sm"
              />
            </>
          )}
        </View>

        <View style={styles.planInfo}>
          <MaterialIcons name="card-giftcard" size={16} color={Colors.warning} />
          <Text style={styles.planText}>
            Free Trial: 30 days • 50 students • 5 teachers • AI included. No credit card required.
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Pressable onPress={() => router.replace('/login')}>
            <Text style={styles.footerLink}>Sign In</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: { flexGrow: 1, padding: Spacing.lg, paddingBottom: 60, gap: Spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Spacing.lg },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 0 },
  progressDot: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.surface2, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.border,
  },
  progressDotActive: { borderColor: Colors.primary, backgroundColor: Colors.schoolAdminBg },
  progressDotDone: { borderColor: Colors.success, backgroundColor: Colors.successBg },
  progressDotText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  progressLine: { width: 48, height: 2, backgroundColor: Colors.border },
  progressLineDone: { backgroundColor: Colors.success },
  card: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.border, gap: Spacing.md,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  sectionIconBg: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: Colors.schoolAdminBg, alignItems: 'center', justifyContent: 'center',
  },
  formTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  formSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  otpHint: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: Colors.surface2, padding: Spacing.sm, borderRadius: BorderRadius.sm,
  },
  otpHintText: { flex: 1, fontSize: FontSize.xs, color: Colors.textMuted, lineHeight: 18 },
  fields: { gap: Spacing.md },
  planInfo: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs,
    backgroundColor: Colors.warningBg, padding: Spacing.md, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: `${Colors.warning}30`,
  },
  planText: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  footer: { flexDirection: 'row', justifyContent: 'center' },
  footerText: { color: Colors.textSecondary, fontSize: FontSize.base },
  footerLink: { color: Colors.primary, fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  successContainer: {
    flex: 1, backgroundColor: Colors.background, alignItems: 'center',
    justifyContent: 'center', padding: Spacing.xl, gap: Spacing.lg,
  },
  successIcon: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: Colors.successBg, alignItems: 'center', justifyContent: 'center',
  },
  successTitle: { fontSize: FontSize.xxxl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  successText: { fontSize: FontSize.base, color: Colors.textSecondary, textAlign: 'center', lineHeight: 24 },
  trialBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
    backgroundColor: Colors.warningBg, padding: Spacing.md, borderRadius: BorderRadius.md,
    width: '100%',
  },
  trialText: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
});
