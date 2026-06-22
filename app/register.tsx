import React, { useState } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAlert } from '@/template';
import { registerSchool } from '@/services/registration.service';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';

type Step = 'form' | 'done';

export default function RegisterScreen() {
  const router = useRouter();
  const { showAlert } = useAlert();
  const [step, setStep] = useState<Step>('form');
  const [loading, setLoading] = useState(false);

  const [schoolName, setSchoolName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [motto, setMotto] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');

  const [ownerFullName, setOwnerFullName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = async () => {
    // Validate
    if (!schoolName.trim()) return showAlert('Missing Field', 'Please enter your school name.');
    // Sanitize subdomain: lowercase + strip everything except a-z, 0-9, hyphens
    const cleanSubdomain = subdomain.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!cleanSubdomain)
      return showAlert('Invalid Subdomain', 'Subdomain can only contain lowercase letters, numbers, and hyphens.');
    if (cleanSubdomain.length < 3)
      return showAlert('Subdomain Too Short', 'Subdomain must be at least 3 characters.');
    if (!ownerFullName.trim()) return showAlert('Missing Field', 'Please enter your full name.');
    if (!ownerEmail.trim()) return showAlert('Missing Field', 'Please enter your email.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail.trim()))
      return showAlert('Invalid Email', 'Please enter a valid email address.');
    if (password.length < 8)
      return showAlert('Weak Password', 'Password must be at least 8 characters.');
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password))
      return showAlert('Weak Password', 'Password must include uppercase, lowercase, and a number.');
    if (password !== confirmPassword)
      return showAlert('Passwords Do Not Match', 'Please re-enter your password.');

    setLoading(true);
    try {
      const result = await registerSchool({
        schoolName: schoolName.trim(),
        subdomain: cleanSubdomain,
        ownerEmail: ownerEmail.trim(),
        ownerPassword: password,
        ownerFullName: ownerFullName.trim(),
        ownerPhone: ownerPhone.trim() || undefined,
        country: country.trim() || undefined,
        city: city.trim() || undefined,
        phone: phone.trim() || undefined,
        motto: motto.trim() || undefined,
      });
      if (result.error) {
        showAlert('Registration Failed', result.error);
        return;
      }
      setStep('done');
    } catch (e: any) {
      showAlert('Error', e?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'done') {
    return (
      <View style={styles.flex}>
        <ScrollView contentContainerStyle={styles.doneContainer}>
          <View style={styles.doneIcon}>
            <MaterialIcons name="check-circle" size={64} color={Colors.success} />
          </View>
          <Text style={styles.doneTitle}>School Registered!</Text>
          <Text style={styles.doneSubtitle}>
            Welcome, {ownerFullName.split(' ')[0]}! Your school{' '}
            <Text style={styles.schoolName}>{schoolName}</Text> has been created.
          </Text>
          <View style={styles.doneCard}>
            <View style={styles.doneRow}>
              <MaterialIcons name="language" size={18} color={Colors.primary} />
              <View>
                <Text style={styles.doneLabel}>Your school URL</Text>
                <Text style={styles.doneValue}>{subdomain.trim().toLowerCase()}.edumanage.com</Text>
              </View>
            </View>
            <View style={styles.doneRow}>
              <MaterialIcons name="mail" size={18} color={Colors.primary} />
              <View>
                <Text style={styles.doneLabel}>Verify your email</Text>
                <Text style={styles.doneValue}>{ownerEmail}</Text>
              </View>
            </View>
            <View style={styles.doneRow}>
              <MaterialIcons name="card-giftcard" size={18} color={Colors.success} />
              <View>
                <Text style={styles.doneLabel}>Trial plan</Text>
                <Text style={styles.doneValue}>14 days free · Starter plan</Text>
              </View>
            </View>
          </View>
          <Text style={styles.doneHint}>
            We sent a verification link to your email. Click it, then sign in to start inviting staff.
          </Text>
          <Button label="Continue to Sign In" onPress={() => router.replace('/login' as any)} fullWidth size="lg" />
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
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>

        <View style={styles.logoArea}>
          <View style={styles.logo}>
            <MaterialIcons name="school" size={32} color={Colors.primary} />
          </View>
          <Text style={styles.appName}>Register Your School</Text>
          <Text style={styles.tagline}>Start your 14-day free trial — no credit card required</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>School Details</Text>
          <Input label="School Name" value={schoolName} onChangeText={setSchoolName} leftIcon="business" placeholder="Greenwood Academy" />
          <Input
            label="Subdomain"
            value={subdomain}
            onChangeText={setSubdomain}
            leftIcon="language"
            placeholder="greenwood"
            autoCapitalize="none"
            hint={`${subdomain || 'your-school'}.edumanage.com`}
          />
          <Input label="Motto (optional)" value={motto} onChangeText={setMotto} leftIcon="format-quote" placeholder="Education for Excellence" />
          <Input label="Country" value={country} onChangeText={setCountry} placeholder="Kenya" />
          <Input label="City" value={city} onChangeText={setCity} placeholder="Nairobi" />
          <Input label="School Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+254 700 000 000" />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Owner Account</Text>
          <Text style={styles.sectionSub}>You will be the school owner with full administrative access.</Text>
          <Input label="Your Full Name" value={ownerFullName} onChangeText={setOwnerFullName} leftIcon="person" placeholder="Jane Doe" />
          <Input label="Email Address" value={ownerEmail} onChangeText={setOwnerEmail} leftIcon="email" keyboardType="email-address" autoCapitalize="none" placeholder="jane@greenwood.edu" />
          <Input label="Phone (optional)" value={ownerPhone} onChangeText={setOwnerPhone} leftIcon="phone" keyboardType="phone-pad" placeholder="+254 700 000 000" />
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            leftIcon="lock"
            placeholder="Min 8 chars, 1 upper, 1 lower, 1 number"
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

        <Button label="Create School & Start Trial" onPress={handleSubmit} fullWidth loading={loading} size="lg" />

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Pressable onPress={() => router.push('/login' as any)}>
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
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xs },
  logoArea: { alignItems: 'center', marginBottom: Spacing.md },
  logo: {
    width: 64, height: 64, borderRadius: 18,
    backgroundColor: Colors.schoolAdminBg,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm,
  },
  appName: { fontSize: 24, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  tagline: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4, textAlign: 'center' },
  card: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.xl,
    padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, gap: Spacing.md,
  },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  sectionSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: -4 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.sm },
  footerText: { color: Colors.textSecondary, fontSize: FontSize.base },
  footerLink: { color: Colors.primary, fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  doneContainer: { flexGrow: 1, padding: Spacing.lg, justifyContent: 'center', gap: Spacing.md },
  doneIcon: { alignItems: 'center', marginBottom: Spacing.md },
  doneTitle: { fontSize: 28, fontWeight: FontWeight.bold, color: Colors.textPrimary, textAlign: 'center' },
  doneSubtitle: { fontSize: FontSize.base, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  schoolName: { color: Colors.primary, fontWeight: FontWeight.semibold },
  doneCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, gap: Spacing.md,
  },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  doneLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 2 },
  doneValue: { fontSize: FontSize.base, color: Colors.textPrimary, fontWeight: FontWeight.semibold },
  doneHint: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});
