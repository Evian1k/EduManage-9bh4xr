import React, { useState } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, Pressable, ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, useAlert } from '@/template';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';

const DEMO_ACCOUNTS = [
  {
    label: 'Platform Owner',
    email: 'owner@edumanage.demo',
    password: 'Demo123!',
    icon: 'admin-panel-settings' as const,
    color: Colors.superAdmin,
    bg: Colors.superAdminBg,
    description: 'View all schools & platform revenue',
    route: 'Superadmin Dashboard',
  },
  {
    label: 'School Admin',
    email: 'admin@greenfield.demo',
    password: 'Demo123!',
    icon: 'business' as const,
    color: Colors.schoolAdmin,
    bg: Colors.schoolAdminBg,
    description: 'Manage Greenfield Academy',
    route: 'Admin Dashboard',
  },
  {
    label: 'Teacher',
    email: 'teacher@greenfield.demo',
    password: 'Demo123!',
    icon: 'cast-for-education' as const,
    color: Colors.teacher,
    bg: Colors.teacherBg,
    description: 'Classes, assignments, grades & attendance',
    route: 'Teacher Dashboard',
  },
  {
    label: 'Student',
    email: 'student@greenfield.demo',
    password: 'Demo123!',
    icon: 'school' as const,
    color: Colors.primary,
    bg: Colors.schoolAdminBg,
    description: 'Assignments, grades & AI assistant',
    route: 'Student Dashboard',
  },
  {
    label: 'Secretary',
    email: 'secretary@greenfield.demo',
    password: 'Demo123!',
    icon: 'desk' as const,
    color: '#00897B',
    bg: 'rgba(0,137,123,0.1)',
    description: 'Reception, visitors & announcements',
    route: 'Secretary Dashboard',
  },
  {
    label: 'Bursar',
    email: 'bursar@greenfield.demo',
    password: 'Demo123!',
    icon: 'account-balance-wallet' as const,
    color: '#43A047',
    bg: 'rgba(67,160,71,0.1)',
    description: 'Fee management & financial reports',
    route: 'Bursar Dashboard',
  },
  {
    label: 'ICT Manager',
    email: 'ict@greenfield.demo',
    password: 'Demo123!',
    icon: 'computer' as const,
    color: '#7B1FA2',
    bg: 'rgba(123,31,162,0.1)',
    description: 'User management & system diagnostics',
    route: 'ICT Dashboard',
  },
  {
    label: 'Librarian',
    email: 'librarian@greenfield.demo',
    password: 'Demo123!',
    icon: 'local-library' as const,
    color: '#E65100',
    bg: 'rgba(230,81,0,0.1)',
    description: 'Book catalog & borrow records',
    route: 'Library Dashboard',
  },
  {
    label: 'Nurse',
    email: 'nurse@greenfield.demo',
    password: 'Demo123!',
    icon: 'local-hospital' as const,
    color: '#D32F2F',
    bg: 'rgba(211,47,47,0.1)',
    description: 'Clinic visits & student health records',
    route: 'Health Dashboard',
  },
];

function getDemoLoginError(errorMessage: string): string {
  const msg = errorMessage.toLowerCase();
  if (msg.includes('invalid login') || msg.includes('invalid credentials') || msg.includes('email not confirmed')) {
    return 'Demo account credentials are invalid or unconfirmed. The demo data may need to be re-seeded. Please contact support.';
  }
  if (msg.includes('network') || msg.includes('fetch')) {
    return 'Network error — check your internet connection and try again.';
  }
  if (msg.includes('too many requests') || msg.includes('rate limit')) {
    return 'Too many login attempts. Please wait 60 seconds and try again.';
  }
  return `Login error: ${errorMessage}`;
}

export default function LoginScreen() {
  const router = useRouter();
  const { signInWithPassword, operationLoading } = useAuth();
  const { showAlert } = useAlert();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showDemo, setShowDemo] = useState(false);
  const [demoLoginEmail, setDemoLoginEmail] = useState<string | null>(null);
  const [showAllDemo, setShowAllDemo] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      showAlert('Missing Fields', 'Please enter your email and password.');
      return;
    }
    const { error } = await signInWithPassword(email.trim(), password);
    if (error) {
      showAlert('Login Failed', error);
      return;
    }
    router.replace('/');
  };

  const loginAsDemo = async (account: typeof DEMO_ACCOUNTS[0]) => {
    setDemoLoginEmail(account.email);
    try {
      const { error } = await signInWithPassword(account.email, account.password);
      if (error) {
        showAlert('Demo Login Failed', getDemoLoginError(error));
        return;
      }
      setShowDemo(false);
      router.replace('/');
    } finally {
      setDemoLoginEmail(null);
    }
  };

  if (showDemo) {
    return (
      <View style={styles.flex}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.demoContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.demoHeader}>
            <Pressable onPress={() => setShowDemo(false)} hitSlop={8}>
              <MaterialIcons name="arrow-back" size={24} color={Colors.textPrimary} />
            </Pressable>
            <View style={styles.demoHeaderText}>
              <Text style={styles.demoTitle}>Demo Mode</Text>
              <Text style={styles.demoSubtitle}>Choose a role to explore EduManage</Text>
            </View>
            <View style={styles.demoBadge}>
              <MaterialIcons name="science" size={12} color={Colors.warning} />
              <Text style={styles.demoBadgeText}>DEMO</Text>
            </View>
          </View>

          {/* Info Banner */}
          <View style={styles.infoBanner}>
            <MaterialIcons name="info-outline" size={16} color={Colors.info} />
            <Text style={styles.infoBannerText}>
              These are real accounts with pre-seeded data for Greenfield Academy — students, classes, assignments, and grades are all included.
            </Text>
          </View>

          {/* Demo Account Cards */}
          {(showAllDemo ? DEMO_ACCOUNTS : DEMO_ACCOUNTS.slice(0, 4)).map((account) => {
            const isLoading = demoLoginEmail === account.email;
            return (
              <Pressable
                key={account.email}
                style={({ pressed }) => [
                  styles.demoCard,
                  pressed && { opacity: 0.82 },
                  isLoading && { opacity: 0.7 },
                ]}
                onPress={() => loginAsDemo(account)}
                disabled={operationLoading || demoLoginEmail !== null}
              >
                <View style={[styles.demoIcon, { backgroundColor: account.bg }]}>
                  <MaterialIcons name={account.icon} size={26} color={account.color} />
                </View>
                <View style={styles.demoCardInfo}>
                  <View style={styles.demoCardRow}>
                    <Text style={styles.demoCardLabel}>{account.label}</Text>
                    <View style={[styles.routeBadge, { backgroundColor: `${account.color}18` }]}>
                      <Text style={[styles.routeBadgeText, { color: account.color }]}>{account.route}</Text>
                    </View>
                  </View>
                  <Text style={styles.demoCardEmail}>{account.email}</Text>
                  <Text style={styles.demoCardDesc}>{account.description}</Text>
                </View>
                {isLoading ? (
                  <ActivityIndicator size="small" color={account.color} />
                ) : (
                  <MaterialIcons name="chevron-right" size={20} color={Colors.textMuted} />
                )}
              </Pressable>
            );
          })}

          {/* Show All Toggle */}
          <Pressable
            style={({ pressed }) => [styles.showAllBtn, pressed && { opacity: 0.75 }]}
            onPress={() => setShowAllDemo(!showAllDemo)}
          >
            <MaterialIcons name={showAllDemo ? 'expand-less' : 'expand-more'} size={18} color={Colors.primary} />
            <Text style={styles.showAllText}>
              {showAllDemo ? 'Show fewer roles' : `Show all ${DEMO_ACCOUNTS.length} roles (Secretary, Bursar, ICT, Librarian, Nurse)`}
            </Text>
          </Pressable>

          {/* Password Info */}
          <View style={styles.credBox}>
            <Text style={styles.credLabel}>All demo account password:</Text>
            <View style={styles.passwordPill}>
              <MaterialIcons name="lock-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.passwordText}>Demo123!</Text>
            </View>
          </View>

          {/* School info */}
          <View style={styles.schoolInfo}>
            <MaterialIcons name="account-balance" size={16} color={Colors.textMuted} />
            <Text style={styles.schoolInfoText}>
              Demo school: <Text style={{ color: Colors.textPrimary, fontWeight: FontWeight.semibold }}>Greenfield Academy</Text> · Pro Plan · 20 students · 5 classes
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

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
        {/* Logo */}
        <View style={styles.logoArea}>
          <View style={styles.logo}>
            <MaterialIcons name="school" size={36} color={Colors.primary} />
          </View>
          <Text style={styles.appName}>EduManage</Text>
          <Text style={styles.tagline}>Smart School Management Platform</Text>
        </View>

        {/* Try Demo Banner */}
        <Pressable
          style={({ pressed }) => [styles.demoBannerBtn, pressed && { opacity: 0.85 }]}
          onPress={() => setShowDemo(true)}
        >
          <View style={styles.demoBannerLeft}>
            <View style={styles.demoStarIcon}>
              <MaterialIcons name="auto-awesome" size={18} color={Colors.warning} />
            </View>
            <View>
              <Text style={styles.demoBannerTitle}>Try Demo Mode</Text>
              <Text style={styles.demoBannerSub}>Explore with 4 pre-seeded role accounts</Text>
            </View>
          </View>
          <MaterialIcons name="play-arrow" size={22} color={Colors.warning} />
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
              placeholder="admin@school.edu"
            />
            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              leftIcon="lock"
              placeholder="Enter your password"
            />
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
          <Pressable onPress={() => router.push('/register')}>
            <Text style={styles.footerLink}>Register Your School</Text>
          </Pressable>
        </View>

        <Text style={styles.hint}>Platform Owner? Use your admin credentials above.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: {
    flexGrow: 1, padding: Spacing.lg,
    justifyContent: 'center', paddingBottom: 60, gap: Spacing.md,
  },

  // Logo
  logoArea: { alignItems: 'center', marginBottom: Spacing.sm },
  logo: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: Colors.schoolAdminBg,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm,
  },
  appName: { fontSize: 28, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  tagline: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4 },

  // Demo Banner Button (on login screen)
  demoBannerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.warningBg, borderRadius: BorderRadius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: `${Colors.warning}40`,
  },
  demoBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  demoStarIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: `${Colors.warning}20`, alignItems: 'center', justifyContent: 'center',
  },
  demoBannerTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.warning },
  demoBannerSub: { fontSize: FontSize.xs, color: Colors.textSecondary },

  // Login Card
  card: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.xl,
    padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, gap: Spacing.md,
  },
  formTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  formSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary },
  fields: { gap: Spacing.md },
  footer: { flexDirection: 'row', justifyContent: 'center' },
  footerText: { color: Colors.textSecondary, fontSize: FontSize.base },
  footerLink: { color: Colors.primary, fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  hint: { textAlign: 'center', color: Colors.textMuted, fontSize: FontSize.xs },

  // Demo Screen
  demoContainer: { padding: Spacing.lg, paddingBottom: 60, gap: Spacing.md },
  demoHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingTop: Spacing.lg,
  },
  demoHeaderText: { flex: 1 },
  demoTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  demoSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary },
  demoBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.warningBg, paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 12,
  },
  demoBadgeText: { fontSize: 10, color: Colors.warning, fontWeight: FontWeight.bold },

  // Info Banner
  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
    backgroundColor: Colors.infoBg, padding: Spacing.md, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: `${Colors.info}30`,
  },
  infoBannerText: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },

  // Demo Cards
  demoCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  demoIcon: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  demoCardInfo: { flex: 1, gap: 3 },
  demoCardRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  demoCardLabel: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  routeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  routeBadgeText: { fontSize: 10, fontWeight: FontWeight.semibold },
  demoCardEmail: { fontSize: FontSize.xs, color: Colors.textMuted },
  demoCardDesc: { fontSize: FontSize.sm, color: Colors.textSecondary },

  // Credentials
  credBox: {
    alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surface2 || Colors.surface, borderRadius: BorderRadius.md,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  credLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  passwordPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.surface, paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm, borderRadius: BorderRadius.full,
    borderWidth: 1, borderColor: Colors.border,
  },
  passwordText: {
    fontSize: FontSize.md, fontWeight: FontWeight.bold,
    color: Colors.textPrimary, letterSpacing: 1,
  },

  showAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    justifyContent: 'center', paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md, borderWidth: 1, borderColor: `${Colors.primary}30`,
    backgroundColor: `${Colors.primary}08`,
  },
  showAllText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.medium, flex: 1 },
  // School info
  schoolInfo: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md,
    padding: Spacing.sm, paddingHorizontal: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  schoolInfoText: { flex: 1, fontSize: FontSize.xs, color: Colors.textMuted, lineHeight: 18 },
});
