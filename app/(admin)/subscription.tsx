import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useAlert } from '@/template';
import { useAppContext } from '@/hooks/useAppContext';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge, getPlanBadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { getPlans, getSchoolSubscription, checkUsage, changePlan, Plan, Subscription, UsageCheck } from '@/services/subscription.service';
import { SubscriptionPlan } from '@/lib/types';

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

const PLAN_COLORS: Record<string, string> = {
  starter: Colors.success,
  professional: Colors.primary,
  enterprise: Colors.superAdmin,
};

export default function SubscriptionScreen() {
  const { school, profileId, refreshContext } = useAppContext();
  const { showAlert } = useAlert();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<UsageCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [changing, setChanging] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!school) return;
    const [plansRes, subRes, usageRes] = await Promise.all([
      getPlans(),
      getSchoolSubscription(school.id),
      checkUsage(school.id),
    ]);
    setPlans(plansRes.data || []);
    if (subRes.error) {
      // No subscription found is okay; just leave null
      setSubscription(null);
    } else {
      setSubscription(subRes.data);
    }
    setUsage(usageRes.data);
    setLoading(false);
    setRefreshing(false);
  }, [school]);

  useEffect(() => { load(); }, [school]);

  const handleChangePlan = (tier: SubscriptionPlan) => {
    if (!school || !profileId) return;
    if (tier === school.plan_tier) return;
    showAlert('Change Plan', `Switch to ${tier} plan? This will update your limits immediately.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Change Plan',
        onPress: async () => {
          setChanging(tier);
          const { error } = await changePlan(school.id, tier, profileId);
          setChanging(null);
          if (error) { showAlert('Error', error); return; }
          await refreshContext();
          showAlert('Plan Updated', `Your subscription is now ${tier}.`);
          load();
        },
      },
    ]);
  };

  if (loading) return <LoadingScreen message="Loading subscription..." />;

  const currentTier = school?.plan_tier;
  const trialDaysLeft = school?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(school.trial_ends_at).getTime() - Date.now()) / 86400000))
    : 0;

  return (
    <View style={styles.flex}>
      <Header title="Subscription" subtitle={school?.name} showBack accentColor={Colors.primary} />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={undefined}
      >
        {/* Current plan card */}
        <Card>
          <View style={styles.currentRow}>
            <View>
              <Text style={styles.labelText}>Current Plan</Text>
              <Text style={[styles.currentPlan, { color: PLAN_COLORS[currentTier || 'starter'] || Colors.primary }]}>
                {(currentTier || 'free').toUpperCase()}
              </Text>
            </View>
            <Badge label={(currentTier || 'free').toUpperCase()} variant={getPlanBadgeVariant(currentTier || 'free_trial')} />
          </View>
          <View style={styles.statusRow}>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Status</Text>
              <Text style={styles.statusVal}>{subscription?.status || school?.plan_status || 'active'}</Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Renews</Text>
              <Text style={styles.statusVal}>{formatDate(subscription?.current_period_end || school?.plan_renews_at)}</Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Trial Ends</Text>
              <Text style={styles.statusVal}>{formatDate(school?.trial_ends_at)}</Text>
            </View>
          </View>
          {trialDaysLeft > 0 && school?.plan_status === 'trialing' ? (
            <View style={styles.trialBanner}>
              <MaterialIcons name="access-time" size={16} color={Colors.warning} />
              <Text style={styles.trialText}>Trial ends in {trialDaysLeft} days. Upgrade to keep your access.</Text>
            </View>
          ) : null}
        </Card>

        {/* Usage */}
        <Text style={styles.sectionTitle}>Plan Usage</Text>
        {usage ? (
          <Card>
            <UsageBar
              label="AI Usage"
              icon="smart-toy"
              used={usage.ai.used}
              limit={usage.ai.limit}
              percent={usage.ai.percent}
              color={Colors.secondary}
            />
            <UsageBar
              label="Students"
              icon="people"
              used={usage.students.used}
              limit={usage.students.limit}
              percent={usage.students.percent}
              color={Colors.primary}
            />
            <UsageBar
              label="Staff"
              icon="badge"
              used={usage.staff.used}
              limit={usage.staff.limit}
              percent={usage.staff.percent}
              color={Colors.teacher}
              last
            />
          </Card>
        ) : null}

        {/* Plans */}
        <Text style={styles.sectionTitle}>Available Plans</Text>
        {plans.map((plan) => {
          const isCurrent = plan.tier === currentTier;
          const color = PLAN_COLORS[plan.tier] || Colors.primary;
          return (
            <Card key={plan.tier} style={[styles.planCard, isCurrent && { borderColor: color, borderWidth: 2 }]}>
              <View style={styles.planHeader}>
                <View style={[styles.planIcon, { backgroundColor: `${color}18` }]}>
                  <MaterialIcons name={plan.tier === 'starter' ? 'rocket-launch' : plan.tier === 'professional' ? 'business-center' : 'enterprise'} size={20} color={color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.planName}>{plan.name}</Text>
                  <Text style={styles.planTier}>{plan.tier.toUpperCase()}</Text>
                </View>
                {isCurrent ? <Badge label="Current" variant="success" size="sm" /> : null}
              </View>
              <View style={styles.priceRow}>
                <Text style={[styles.price, { color }]}>${plan.price_monthly_usd}</Text>
                <Text style={styles.priceUnit}>/month</Text>
              </View>
              <Text style={styles.priceYearly}>or ${plan.price_yearly_usd}/year</Text>
              <View style={styles.featureList}>
                <FeatureItem text={`Up to ${plan.max_students.toLocaleString()} students`} />
                <FeatureItem text={`Up to ${plan.max_staff.toLocaleString()} staff`} />
                <FeatureItem text={`${plan.ai_usage_limit.toLocaleString()} AI requests/mo`} />
                <FeatureItem text={`${plan.max_storage_mb.toLocaleString()} MB storage`} />
              </View>
              {isCurrent ? (
                <Button label="Current Plan" onPress={() => {}} variant="outline" fullWidth disabled style={{ marginTop: Spacing.sm }} />
              ) : (
                <Button
                  label={changing === plan.tier ? 'Changing...' : 'Upgrade'}
                  onPress={() => handleChangePlan(plan.tier)}
                  loading={changing === plan.tier}
                  fullWidth
                  style={{ marginTop: Spacing.sm }}
                />
              )}
            </Card>
          );
        })}

        {plans.length === 0 ? (
          <Card>
            <Text style={styles.emptyText}>No plans available. Please contact support.</Text>
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}

function UsageBar({ label, icon, used, limit, percent, color, last }: { label: string; icon: keyof typeof MaterialIcons.glyphMap; used: number; limit: number; percent: number; color: string; last?: boolean }) {
  return (
    <View style={[styles.usageBox, !last && styles.usageBoxMargin]}>
      <View style={styles.usageHeader}>
        <View style={styles.usageLabelWrap}>
          <MaterialIcons name={icon} size={16} color={color} />
          <Text style={styles.usageLabel}>{label}</Text>
        </View>
        <Text style={styles.usageCount}>{used.toLocaleString()} / {limit.toLocaleString()}</Text>
      </View>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${Math.min(100, percent)}%`, backgroundColor: percent >= 90 ? Colors.error : color }]} />
      </View>
      <Text style={styles.usagePercent}>{percent}% used</Text>
    </View>
  );
}

function FeatureItem({ text }: { text: string }) {
  return (
    <View style={styles.featureRow}>
      <MaterialIcons name="check-circle" size={14} color={Colors.success} />
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl, gap: Spacing.sm },
  currentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  labelText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  currentPlan: { fontSize: FontSize.xxxl, fontWeight: FontWeight.bold, marginTop: 4 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statusItem: { flex: 1 },
  statusLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 2 },
  statusVal: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.semibold, textTransform: 'capitalize' },
  trialBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, backgroundColor: Colors.warningBg, padding: Spacing.sm, borderRadius: BorderRadius.md, marginTop: Spacing.md, borderWidth: 1, borderColor: `${Colors.warning}30` },
  trialText: { flex: 1, fontSize: FontSize.xs, color: Colors.warning, fontWeight: FontWeight.medium },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginTop: Spacing.sm, marginBottom: Spacing.xs },
  usageBox: {},
  usageBoxMargin: { marginBottom: Spacing.md },
  usageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  usageLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  usageLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  usageCount: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.semibold },
  progressBar: { height: 8, backgroundColor: Colors.surface2, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  usagePercent: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 4 },
  planCard: {},
  planHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.sm },
  planIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  planName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  planTier: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  price: { fontSize: FontSize.xxxl, fontWeight: FontWeight.bold },
  priceUnit: { fontSize: FontSize.sm, color: Colors.textSecondary },
  priceYearly: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  featureList: { marginTop: Spacing.md, gap: Spacing.xs },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  featureText: { fontSize: FontSize.sm, color: Colors.textSecondary, flex: 1 },
  emptyText: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center', padding: Spacing.sm },
});
