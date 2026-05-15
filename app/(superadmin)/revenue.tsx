import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { getAllSchools, getAiUsageStats } from '@/services/platform.service';
import { BottomNav } from '@/components/layout/BottomNav';

const SUPER_ADMIN_NAV = [
  { label: 'Dashboard', icon: 'dashboard' as const, route: '/(superadmin)/' },
  { label: 'Schools', icon: 'business' as const, route: '/(superadmin)/schools' },
  { label: 'Revenue', icon: 'attach-money' as const, route: '/(superadmin)/revenue' },
  { label: 'Support', icon: 'support-agent' as const, route: '/(superadmin)/support' },
  { label: 'Announce', icon: 'campaign' as const, route: '/(superadmin)/announcements' },
];
import { StatCard } from '@/components/ui/StatCard';
import { Card } from '@/components/ui/Card';
import { Badge, getPlanBadgeVariant } from '@/components/ui/Badge';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Header } from '@/components/layout/Header';
import { Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { getPlanLabel, PLAN_PRICES } from '@/constants/config';

export default function RevenueScreen() {
  const [schools, setSchools] = useState<any[]>([]);
  const [aiLogs, setAiLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getAllSchools(), getAiUsageStats()]).then(([sRes, aRes]) => {
      setSchools(sRes.data || []);
      setAiLogs(aRes.data || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingScreen message="Loading revenue data..." />;

  const paidSchools = schools.filter((s) => s.plan !== 'free_trial');
  const monthlyRevenue = paidSchools.reduce((sum, s) => {
    const price = PLAN_PRICES[s.plan as keyof typeof PLAN_PRICES];
    return sum + (price?.monthly || 0);
  }, 0);

  const totalAiTokens = aiLogs.reduce((sum, l) => sum + (l.tokens_used || 0), 0);

  const planBreakdown = ['basic', 'pro', 'enterprise'].map((plan) => {
    const count = schools.filter((s) => s.plan === plan).length;
    const price = PLAN_PRICES[plan as keyof typeof PLAN_PRICES];
    return { plan, count, monthly: count * (price?.monthly || 0) };
  });

  return (
    <View style={styles.flex}>
      <Header title="Revenue" subtitle="Financial Overview" accentColor={Colors.superAdmin} />
      <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* MRR */}
        <View style={styles.mrrCard}>
          <Text style={styles.mrrLabel}>Monthly Recurring Revenue</Text>
          <Text style={styles.mrrValue}>${monthlyRevenue.toLocaleString()}</Text>
          <Text style={styles.mrrSub}>{paidSchools.length} paying schools</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatCard label="Total Schools" value={schools.length} icon="business" color={Colors.primary} />
          <StatCard label="Paid Schools" value={paidSchools.length} icon="star" color={Colors.superAdmin} />
        </View>
        <View style={styles.statsRow}>
          <StatCard label="Free Trial" value={schools.filter((s) => s.plan === 'free_trial').length} icon="card-giftcard" color={Colors.textMuted} />
          <StatCard label="AI Tokens" value={totalAiTokens.toLocaleString()} icon="auto-awesome" color={Colors.secondary} />
        </View>

        {/* Plan Revenue Breakdown */}
        <Text style={styles.sectionTitle}>Revenue by Plan</Text>
        <Card>
          {planBreakdown.map((p, i) => (
            <View key={p.plan} style={[styles.planRow, i < planBreakdown.length - 1 && styles.planRowBorder]}>
              <Badge label={getPlanLabel(p.plan)} variant={getPlanBadgeVariant(p.plan)} />
              <View style={styles.planStats}>
                <Text style={styles.planCount}>{p.count} schools</Text>
                <Text style={styles.planRevenue}>${p.monthly}/mo</Text>
              </View>
            </View>
          ))}
        </Card>

        {/* Subscription Status */}
        <Text style={styles.sectionTitle}>Schools by Status</Text>
        <Card>
          {[
            { label: 'Active', count: schools.filter((s) => s.is_active && s.plan !== 'free_trial').length, color: Colors.success },
            { label: 'Trial', count: schools.filter((s) => s.plan === 'free_trial').length, color: Colors.warning },
            { label: 'Suspended', count: schools.filter((s) => !s.is_active).length, color: Colors.error },
          ].map((item, i) => (
            <View key={item.label} style={[styles.statusRow, i < 2 && styles.planRowBorder]}>
              <View style={[styles.statusDot, { backgroundColor: item.color }]} />
              <Text style={styles.statusLabel}>{item.label}</Text>
              <Text style={styles.statusCount}>{item.count}</Text>
            </View>
          ))}
        </Card>

        {/* AI Usage by School */}
        <Text style={styles.sectionTitle}>AI Usage by School</Text>
        {schools
          .filter((s) => (s.ai_usage_count || 0) > 0)
          .sort((a, b) => (b.ai_usage_count || 0) - (a.ai_usage_count || 0))
          .slice(0, 10)
          .map((school) => (
            <Card key={school.id} style={styles.aiRow}>
              <Text style={styles.aiSchool}>{school.name}</Text>
              <View style={styles.aiBar}>
                <View style={[styles.aiProgress, { width: `${Math.min(100, ((school.ai_usage_count || 0) / school.ai_usage_limit) * 100)}%` }]} />
              </View>
              <Text style={styles.aiCount}>{school.ai_usage_count || 0} / {school.ai_usage_limit}</Text>
            </Card>
          ))}
      </ScrollView>
      <BottomNav items={SUPER_ADMIN_NAV} accentColor={Colors.superAdmin} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingBottom: 100, gap: Spacing.sm },
  mrrCard: {
    backgroundColor: Colors.superAdminBg, borderRadius: 16, padding: Spacing.xl,
    alignItems: 'center', borderWidth: 1, borderColor: `${Colors.superAdmin}30`,
  },
  mrrLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  mrrValue: { fontSize: 48, fontWeight: FontWeight.bold, color: Colors.superAdmin },
  mrrSub: { fontSize: FontSize.sm, color: Colors.textSecondary },
  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginTop: Spacing.sm },
  planRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.sm },
  planRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  planStats: { alignItems: 'flex-end' },
  planCount: { fontSize: FontSize.sm, color: Colors.textSecondary },
  planRevenue: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusLabel: { flex: 1, fontSize: FontSize.base, color: Colors.textPrimary },
  statusCount: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  aiRow: { paddingVertical: Spacing.sm, gap: 6 },
  aiSchool: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textPrimary },
  aiBar: { height: 6, backgroundColor: Colors.surface2, borderRadius: 3, overflow: 'hidden' },
  aiProgress: { height: '100%', backgroundColor: Colors.secondary, borderRadius: 3 },
  aiCount: { fontSize: FontSize.xs, color: Colors.textSecondary },
});
