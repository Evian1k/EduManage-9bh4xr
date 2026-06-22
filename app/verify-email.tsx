import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth, useAlert } from '@/template';
import { useAppContext } from '@/hooks/useAppContext';
import { sendEmailVerification } from '@/services/auth.security.service';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';

const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const { refreshContext } = useAppContext();

  const [sending, setSending] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [secondsLeft]);

  const handleResend = async () => {
    if (secondsLeft > 0 || sending) return;
    setSending(true);
    const { error } = await sendEmailVerification();
    setSending(false);
    if (error) {
      showAlert('Resend Failed', error);
      return;
    }
    setSecondsLeft(RESEND_COOLDOWN_SECONDS);
    showAlert('Email Sent', 'A fresh verification link has been sent to your inbox.');
  };

  const handleContinue = async () => {
    setContinuing(true);
    try {
      await refreshContext();
    } finally {
      setContinuing(false);
    }
    router.replace('/');
  };

  const handleBackToLogin = () => {
    router.replace('/login');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.flex}>
        <Header
          title="Verify Email"
          subtitle="Confirm your email address"
          showBack
          accentColor={Colors.primary}
        />
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <MaterialIcons name="mark-email-unread" size={48} color={Colors.primary} />
            </View>
            <Text style={styles.heroTitle}>Check your inbox</Text>
            <Text style={styles.heroSubtitle}>
              We sent a verification link to your email address. Click the link in the email to
              activate your EduManage account.
            </Text>
            {user?.email ? (
              <View style={styles.emailPill}>
                <MaterialIcons name="alternate-email" size={14} color={Colors.primary} />
                <Text style={styles.emailText}>{user.email}</Text>
              </View>
            ) : null}
          </View>

          <Card style={styles.stepsCard}>
            <Text style={styles.stepsTitle}>How verification works</Text>
            {[
              { icon: 'inbox' as const, text: 'Open the email from EduManage in your inbox.' },
              { icon: 'touch-app' as const, text: 'Tap the "Verify Email Address" button inside the email.' },
              { icon: 'login' as const, text: 'Come back here and tap "I\'ve verified — continue".' },
            ].map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepIconWrap}>
                  <MaterialIcons name={step.icon} size={18} color={Colors.primary} />
                </View>
                <Text style={styles.stepText}>{step.text}</Text>
              </View>
            ))}
          </Card>

          <Card style={styles.actionsCard}>
            <Button
              label="I've verified — continue"
              onPress={handleContinue}
              fullWidth
              loading={continuing}
              size="lg"
              icon={<MaterialIcons name="arrow-forward" size={18} color={Colors.textPrimary} />}
            />
            <Button
              label={
                secondsLeft > 0
                  ? `Resend verification email (${secondsLeft}s)`
                  : 'Resend verification email'
              }
              onPress={handleResend}
              fullWidth
              variant="outline"
              loading={sending}
              disabled={secondsLeft > 0 || sending}
              size="md"
            />
            <View style={styles.tipRow}>
              <MaterialIcons name="info-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.tipText}>
                If you don&apos;t see the email, check your spam or junk folder. The link expires in 24 hours.
              </Text>
            </View>
          </Card>

          <Pressable onPress={handleBackToLogin} style={styles.backLink} hitSlop={8}>
            <MaterialIcons name="arrow-back" size={14} color={Colors.textSecondary} />
            <Text style={styles.backText}>Back to login</Text>
          </Pressable>
        </ScrollView>
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
  },
  hero: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.lg },
  heroIcon: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: Colors.schoolAdminBg, alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  heroTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  heroSubtitle: {
    fontSize: FontSize.base, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22,
    paddingHorizontal: Spacing.md,
  },
  emailPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.surface2, paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs, borderRadius: BorderRadius.full,
    borderWidth: 1, borderColor: Colors.border, marginTop: Spacing.xs,
  },
  emailText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.semibold },
  stepsCard: { gap: Spacing.md },
  stepsTitle: {
    fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: FontWeight.semibold,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  stepIconWrap: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.schoolAdminBg, alignItems: 'center', justifyContent: 'center',
  },
  stepText: { flex: 1, fontSize: FontSize.base, color: Colors.textPrimary, lineHeight: 22, paddingTop: 4 },
  actionsCard: { gap: Spacing.md },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingTop: Spacing.xs },
  tipText: { flex: 1, fontSize: FontSize.xs, color: Colors.textMuted, lineHeight: 18 },
  backLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: Spacing.sm },
  backText: { color: Colors.textSecondary, fontSize: FontSize.base },
});
