import React, { useState } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, Pressable, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, useAlert } from '@/template';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { signInWithLockout } from '@/services/auth.security.service';

// Dev-only demo accounts — accessible by long-pressing the logo 3 times.
// These only work if you've seeded them via the seed-demo edge function.
const DEV_DEMO_ACCOUNTS = [
  { label: 'Platform Owner', email: 'owner@edumanage.demo', password: 'Demo123!', icon: 'admin-panel-settings' as const, color: Colors.superAdmin },
  { label: 'School Admin', email: 'admin@greenfield.demo', password: 'Demo123!', icon: 'business' as const, color: Colors.schoolAdmin },
  { label: 'Teacher', email: 'teacher@greenfield.demo', password: 'Demo123!', icon: 'cast-for-education' as const, color: Colors.teacher },
  { label: 'Student', email: 'student@greenfield.demo', password: 'Demo123!', icon: 'school' as const, color: Colors.student },
];

function getLoginErrorMessage(errorMessage: string): string {
  const msg = errorMessage.toLowerCase();
  if (msg.includes('invalid login') || msg.includes('invalid credentials')) {
    return 'Invalid email or password. Please try again.';
  }
  if (msg.includes('email not confirmed')) {
    return 'Your email has not been verified. Please check your inbox for the verification link.';
  }
  if (msg.includes('network') || msg.includes('fetch')) {
    return 'Network error — check your internet connection and try again.';
  }
  if (msg.includes('too many requests') || msg.includes('rate limit')) {
    return 'Too many login attempts. Please wait a few minutes and try again.';
  }
  if (msg.includes('locked')) {
    return 'Your account is temporarily locked due to too many failed login attempts. Please try again later.';
  }
  return errorMessage;
}

export default function LoginScreen() {
  const router = useRouter();
  const { setOperationLoading, operationLoading } = useAuth();
  const { showAlert } = useAlert();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [logoPressCount, setLogoPressCount] = useState(0);
  const [showDevAccounts, setShowDevAccounts] = useState(false);
  const [devLoading, setDevLoading] = useState<string | null>(null);

  const handleLogoPress = () => {
    const newCount = logoPressCount + 1;
    setLogoPressCount(newCount);
    if (newCount >= 3) {
      setShowDevAccounts(true);
      setLogoPressCount(0);
    }
  };

  const loginAsDemo = async (account: typeof DEV_DEMO_ACCOUNTS[0]) => {
    setDevLoading(account.email);
    setOperationLoading(true);
    try {
      const { error, needsMfa } = await signInWithLockout(account.email, account.password, {
        deviceFingerprint: `${Platform.OS}-dev-${Date.now()}`,
        deviceName: `${Platform.OS} Dev Device`,
        platform: Platform.OS,
      });
      if (error) {
        showAlert('Demo Login Failed', `${error}\n\nNote: Demo accounts must be seeded first using the seed-demo edge function.`);
        return;
      }
      if (needsMfa) {
        router.replace('/mfa-challenge' as any);
        return;
      }
      router.replace('/' as any);
    } finally {
      setDevLoading(null);
      setOperationLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      showAlert('Missing Fields', 'Please enter your email and password.');
      return;
    }
    setOperationLoading(true);
    try {
      const { error, needsMfa } = await signInWithLockout(email.trim(), password, {
        deviceFingerprint: `${Platform.OS}-${Date.now().toString(36)}`,
        deviceName: Platform.OS === 'web' ? 'Web Browser' : `${Platform.OS} device`,
        platform: Platform.OS,
      });
      if (error) {
        showAlert('Login Failed', getLoginErrorMessage(error));
        return;
      }
      if (needsMfa) {
        router.replace('/mfa-challenge' as any);
        return;
      }
      router.replace('/' as any);
    } finally {
      setOperationLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo — long press 3x for dev demo accounts */}
        <Pressable onPress={handleLogoPress} style={styles.logoArea}>
          <View style={styles.logo}>
            <MaterialIcons name="school" size={36} color={Colors.primary} />
          </View>
          <Text style={styles.appName}>EduManage</Text>
          <Text style={styles.tagline}>Multi-tenant School Management Platform</Text>
        </Pressable>

        {/* Login Card */}
        <View style={styles.card}>
          <Text style={styles.formTitle}>Welcome Back</Text>
          <Text style={styles.formSubtitle}>Sign in to your EduManage account</Text>
          <View style={styles.fields}>
            <Input
              label="Email Address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              leftIcon="email"
              placeholder="you@school.edu"
            />
            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              leftIcon="lock"
              placeholder="Enter your password"
              onSubmitEditing={handleLogin}
            />
            <View style={styles.row}>
              <Pressable style={styles.rememberRow} onPress={() => setRememberMe(!rememberMe)}>
                <MaterialIcons
                  name={rememberMe ? 'check-box' : 'check-box-outline-blank'}
                  size={18}
                  color={rememberMe ? Colors.primary : Colors.textMuted}
                />
                <Text style={styles.rememberText}>Keep me signed in</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/forgot-password' as any)}>
                <Text style={styles.forgotLink}>Forgot password?</Text>
              </Pressable>
            </View>
          </View>
          <Button
            label="Sign In"
            onPress={handleLogin}
            fullWidth
            loading={operationLoading}
            size="lg"
          />
        </View>

        {/* Register Link */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>New school? </Text>
          <Pressable onPress={() => router.push('/register' as any)}>
            <Text style={styles.footerLink}>Register Your School</Text>
          </Pressable>
        </View>

        <Text style={styles.hint}>
          By signing in, you agree to EduManage's Terms of Service and Privacy Policy.
        </Text>
      </ScrollView>

      {/* Dev Demo Accounts Modal — hidden, only accessible via 3x logo press */}
      <Modal visible={showDevAccounts} transparent animationType="slide" onRequestClose={() => setShowDevAccounts(false)}>
        <View style={styles.devOverlay}>
          <View style={styles.devModal}>
            <View style={styles.devHeader}>
              <View>
                <Text style={styles.devTitle}>Dev Mode</Text>
                <Text style={styles.devSub}>Demo accounts (must be seeded first)</Text>
              </View>
              <Pressable onPress={() => setShowDevAccounts(false)} hitSlop={8}>
                <MaterialIcons name="close" size={22} color={Colors.textSecondary} />
              </Pressable>
            </View>
            <Text style={styles.devHint}>
              These accounts only work after running the seed-demo edge function.
              Use the registration form to create real accounts.
            </Text>
            {DEV_DEMO_ACCOUNTS.map((account) => (
              <Pressable
                key={account.email}
                style={styles.devAccount}
                onPress={() => loginAsDemo(account)}
                disabled={!!devLoading}
              >
                <View style={[styles.devIcon, { backgroundColor: `${account.color}20` }]}>
                  <MaterialIcons name={account.icon} size={22} color={account.color} />
                </View>
                <View style={styles.devAccountInfo}>
                  <Text style={styles.devAccountLabel}>{account.label}</Text>
                  <Text style={styles.devAccountEmail}>{account.email}</Text>
                </View>
                {devLoading === account.email ? (
                  <Text style={styles.devLoading}>...</Text>
                ) : (
                  <MaterialIcons name="chevron-right" size={20} color={Colors.textMuted} />
                )}
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: {
    flexGrow: 1, padding: Spacing.lg,
    justifyContent: 'center', paddingBottom: 60, gap: Spacing.md,
  },
  logoArea: { alignItems: 'center', marginBottom: Spacing.sm },
  logo: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: Colors.schoolAdminBg,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm,
  },
  appName: { fontSize: 28, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  tagline: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4, textAlign: 'center' },
  card: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.xl,
    padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, gap: Spacing.md,
  },
  formTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  formSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary },
  fields: { gap: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rememberRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rememberText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  forgotLink: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.semibold },
  footer: { flexDirection: 'row', justifyContent: 'center' },
  footerText: { color: Colors.textSecondary, fontSize: FontSize.base },
  footerLink: { color: Colors.primary, fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  hint: { textAlign: 'center', color: Colors.textMuted, fontSize: FontSize.xs },
  // Dev modal
  devOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: Spacing.lg },
  devModal: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.lg, gap: Spacing.sm },
  devHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  devTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  devSub: { fontSize: FontSize.sm, color: Colors.textSecondary },
  devHint: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: Spacing.sm, lineHeight: 18 },
  devAccount: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  devIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  devAccountInfo: { flex: 1 },
  devAccountLabel: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  devAccountEmail: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  devLoading: { color: Colors.textSecondary, fontSize: FontSize.md },
});
