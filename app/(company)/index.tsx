import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useAppContext } from '@/hooks/useAppContext';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';

const DASHBOARDS = [
  { key: 'ceo', label: 'CEO', icon: 'analytics' as const, color: Colors.superAdmin, desc: 'Global overview, KPIs, revenue' },
  { key: 'support', label: 'Support', icon: 'support-agent' as const, color: Colors.success, desc: 'Tickets, knowledge base' },
  { key: 'sales', label: 'Sales', icon: 'trending-up' as const, color: Colors.primary, desc: 'Leads, pipeline, conversions' },
  { key: 'finance', label: 'Finance', icon: 'account-balance' as const, color: Colors.warning, desc: 'Revenue, MRR, ARR, taxes' },
  { key: 'customer-success', label: 'Customer Success', icon: 'handshake' as const, color: Colors.secondary, desc: 'Onboarding, health scores' },
  { key: 'engineering', label: 'Engineering', icon: 'engineering' as const, color: '#7B1FA2', desc: 'Deploys, bugs, API health' },
  { key: 'security', label: 'Security', icon: 'security' as const, color: Colors.error, desc: 'Audit logs, incidents' },
  { key: 'hr', label: 'HR', icon: 'badge' as const, color: '#00897B', desc: 'Employees, payroll, leave' },
  { key: 'marketing', label: 'Marketing', icon: 'campaign' as const, color: '#E65100', desc: 'Campaigns, analytics' },
  { key: 'maintenance', label: 'Maintenance', icon: 'build' as const, color: '#607D8B', desc: 'System health, uptime' },
];

export default function CompanyIndex() {
  const router = useRouter();
  const { userRole } = useAppContext();
  if (!userRole) return <LoadingScreen />;

  return (
    <SafeAreaView style={s.flex} edges={['bottom']}>
      <Header title="EduManage Company" subtitle="Internal Platform" accentColor={Colors.primary} />
      <ScrollView contentContainerStyle={s.container}>
        <Text style={s.welcome}>Welcome back. Select a dashboard:</Text>
        <View style={s.grid}>
          {DASHBOARDS.map((d) => (
            <Pressable key={d.key} style={({ pressed }) => [s.card, pressed && s.pressed]} onPress={() => router.push(`/(company)/${d.key}` as any)}>
              <View style={[s.iconWrap, { backgroundColor: `${d.color}20` }]}>
                <MaterialIcons name={d.icon} size={28} color={d.color} />
              </View>
              <Text style={s.label}>{d.label}</Text>
              <Text style={s.desc}>{d.desc}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: { padding: Spacing.md, gap: Spacing.md },
  welcome: { fontSize: FontSize.base, color: Colors.textSecondary, marginBottom: Spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  card: { width: '48%', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: 8, borderWidth: 1, borderColor: Colors.border },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  iconWrap: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  desc: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 16 },
});
