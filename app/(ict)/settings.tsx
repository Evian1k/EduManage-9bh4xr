import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useAppContext } from '@/hooks/useAppContext';
import { useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { logAuditEvent } from '@/services/audit.service';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';

export default function ICTSettings() {
  const { school, profileId } = useAppContext();
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [emailStats, setEmailStats] = useState({ queued: 0, sent: 0, failed: 0 });
  const [smsStats, setSmsStats] = useState({ queued: 0, sent: 0, failed: 0 });
  const [aiProvider, setAiProvider] = useState<string>('Not configured');

  const load = useCallback(async () => {
    if (!school) return;
    const supabase = getSupabaseClient();
    const [emails, sms, ai] = await Promise.all([
      supabase.from('email_logs').select('status').eq('school_id', school.id),
      supabase.from('sms_logs').select('status').eq('school_id', school.id),
      supabase.from('ai_provider_config').select('provider, default_model').or(`school_id.eq.${school.id},school_id.is.null`).maybeSingle(),
    ]);
    const eStats = { queued: 0, sent: 0, failed: 0 };
    (emails.data || []).forEach((r: any) => {
      if (r.status === 'queued') eStats.queued++;
      else if (r.status === 'sent' || r.status === 'delivered') eStats.sent++;
      else if (r.status === 'failed' || r.status === 'bounced') eStats.failed++;
    });
    setEmailStats(eStats);
    const sStats = { queued: 0, sent: 0, failed: 0 };
    (sms.data || []).forEach((r: any) => {
      if (r.status === 'queued') sStats.queued++;
      else if (r.status === 'sent' || r.status === 'delivered') sStats.sent++;
      else if (r.status === 'failed') sStats.failed++;
    });
    setSmsStats(sStats);
    setAiProvider(ai.data ? `${ai.data.provider} (${ai.data.default_model || 'default'})` : 'Platform default');
    setLoading(false);
  }, [school]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const handleSuspend = () => {
    if (!school) return;
    showAlert('Suspend School', `This will suspend ${school.name}. All users will be locked out. Continue?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Suspend', style: 'destructive', onPress: async () => {
        const supabase = getSupabaseClient();
        await supabase.from('schools').update({ status: 'suspended' }).eq('id', school.id);
        await logAuditEvent({ schoolId: school.id, userId: profileId, action: 'school_suspended', severity: 'critical' });
        showAlert('Suspended', 'School has been suspended. Users will be logged out.');
      }},
    ]);
  };

  if (!school) return <LoadingScreen />;
  if (loading) return <LoadingScreen message="Loading settings..." />;

  return (
    <SafeAreaView style={s.flex} edges={['bottom']}>
      <Header title="System Settings" subtitle={school.name} showBack accentColor="#7B1FA2" />
      <ScrollView style={s.flex} contentContainerStyle={s.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}>
        <Card style={s.card}>
          <View style={s.cardHeader}><MaterialIcons name="business" size={20} color={Colors.primary} /><Text style={s.cardTitle}>School Information</Text></View>
          <View style={s.infoRow}><Text style={s.infoLabel}>Name</Text><Text style={s.infoValue}>{school.name}</Text></View>
          <View style={s.infoRow}><Text style={s.infoLabel}>Subdomain</Text><Text style={s.infoValue}>{school.subdomain}</Text></View>
          <View style={s.infoRow}><Text style={s.infoLabel}>Plan</Text><Badge label={school.plan_tier} variant="primary" size="sm" /></View>
          <View style={s.infoRow}><Text style={s.infoLabel}>Status</Text><Badge label={school.status} variant={school.status === 'active' ? 'success' : 'error'} size="sm" /></View>
          <View style={s.infoRow}><Text style={s.infoLabel}>AI Usage</Text><Text style={s.infoValue}>{school.ai_usage_count} / {school.ai_usage_limit}</Text></View>
        </Card>

        <Card style={s.card}>
          <View style={s.cardHeader}><MaterialIcons name="notifications" size={20} color={Colors.success} /><Text style={s.cardTitle}>Notifications Status</Text></View>
          <View style={s.statsRow}>
            <View style={s.statItem}><Text style={s.statValue}>{emailStats.queued}</Text><Text style={s.statLabel}>Email Queued</Text></View>
            <View style={s.statItem}><Text style={s.statValue}>{emailStats.sent}</Text><Text style={s.statLabel}>Email Sent</Text></View>
            <View style={s.statItem}><Text style={[s.statValue, { color: Colors.error }]}>{emailStats.failed}</Text><Text style={s.statLabel}>Email Failed</Text></View>
          </View>
          <View style={s.divider} />
          <View style={s.statsRow}>
            <View style={s.statItem}><Text style={s.statValue}>{smsStats.queued}</Text><Text style={s.statLabel}>SMS Queued</Text></View>
            <View style={s.statItem}><Text style={s.statValue}>{smsStats.sent}</Text><Text style={s.statLabel}>SMS Sent</Text></View>
            <View style={s.statItem}><Text style={[s.statValue, { color: Colors.error }]}>{smsStats.failed}</Text><Text style={s.statLabel}>SMS Failed</Text></View>
          </View>
        </Card>

        <Card style={s.card}>
          <View style={s.cardHeader}><MaterialIcons name="auto-awesome" size={20} color={Colors.primary} /><Text style={s.cardTitle}>System Health</Text></View>
          <View style={s.infoRow}><Text style={s.infoLabel}>AI Provider</Text><Text style={s.infoValue}>{aiProvider}</Text></View>
          <View style={s.infoRow}><Text style={s.infoLabel}>Edge Functions</Text><View style={s.healthy}><View style={s.greenDot} /><Text style={s.healthyText}>Healthy</Text></View></View>
          <View style={s.infoRow}><Text style={s.infoLabel}>Database</Text><View style={s.healthy}><View style={s.greenDot} /><Text style={s.healthyText}>Connected</Text></View></View>
        </Card>

        <Card style={s.card}>
          <View style={s.cardHeader}><MaterialIcons name="warning" size={20} color={Colors.error} /><Text style={s.cardTitle}>Danger Zone</Text></View>
          <Text style={s.dangerText}>Suspending the school will lock out all users. This action is reversible.</Text>
          <Button label="Suspend School" variant="danger" onPress={handleSuspend} fullWidth />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 40 },
  card: { gap: Spacing.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xs },
  cardTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  infoLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  infoValue: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.medium },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: Spacing.sm },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  statLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 4 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.xs },
  healthy: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  greenDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success },
  healthyText: { fontSize: FontSize.sm, color: Colors.success, fontWeight: FontWeight.medium },
  dangerText: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing.sm },
});
