// ICT: Recent activity (audit_logs) — filter chips All/Info/Warning/Critical + FlatList
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, RefreshControl,
} from 'react-native';
import { useAppContext } from '@/hooks/useAppContext';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { getSupabaseClient } from '@/template';

interface AuditLogRow {
  id: string;
  action: string;
  entity_type?: string;
  severity?: string;
  user_email?: string;
  ip_address?: string;
  metadata?: any;
  created_at: string;
}

type Filter = 'all' | 'info' | 'warning' | 'critical';

const severityFor = (s?: string): Filter => {
  const v = (s || '').toLowerCase();
  if (v.includes('critical') || v.includes('error')) return 'critical';
  if (v.includes('warn')) return 'warning';
  return 'info';
};

const severityIcon = (sev: Filter) => {
  if (sev === 'critical') return { icon: 'error' as const, color: Colors.error, bg: Colors.errorBg };
  if (sev === 'warning') return { icon: 'warning' as const, color: Colors.warning, bg: Colors.warningBg };
  return { icon: 'info' as const, color: Colors.info, bg: Colors.infoBg };
};

export default function ICTLogsScreen() {
  const { school } = useAppContext();
  const schoolId = school?.id;
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!schoolId) return;
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('audit_logs')
      .select('id, action, entity_type, severity, user_email, ip_address, metadata, created_at')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) {
      // Fallback: try without school_id filter (some audit_logs may use school_id column differently)
      const { data: fallback } = await supabase
        .from('audit_logs')
        .select('id, action, entity_type, severity, user_email, ip_address, metadata, created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      setLogs((fallback || []) as unknown as AuditLogRow[]);
    } else {
      setLogs((data || []) as unknown as AuditLogRow[]);
    }
    setLoading(false);
    setRefreshing(false);
  }, [schoolId]);

  useEffect(() => { if (schoolId) load(); }, [schoolId]);

  if (!schoolId) return <LoadingScreen />;
  if (loading) return <LoadingScreen message="Loading audit logs..." />;

  const filtered = logs.filter((l) => filter === 'all' ? true : severityFor(l.severity) === filter);

  return (
    <View style={s.flex}>
      <Header title="Activity Logs" subtitle={`${logs.length} entries`} showBack accentColor="#7B1FA2" />
      <View style={s.filterRow}>
        {(['all', 'info', 'warning', 'critical'] as Filter[]).map((f) => (
          <Pressable key={f} style={[s.chip, filter === f && s.chipActive(f)]} onPress={() => setFilter(f)}>
            <Text style={[s.chipText, filter === f && s.chipTextActive]}>{f.charAt(0).toUpperCase() + f.slice(1)}</Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} colors={[Colors.primary]} />}
        ListEmptyComponent={<EmptyState icon="list-alt" title="No Activity Logs" description="Audit events will appear here as they occur." />}
        renderItem={({ item }) => {
          const sev = severityFor(item.severity);
          const meta = severityIcon(sev);
          return (
            <Card style={s.card}>
              <View style={s.row}>
                <View style={[s.icon, { backgroundColor: meta.bg }]}>
                  <MaterialIcons name={meta.icon} size={18} color={meta.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.action} numberOfLines={2}>{item.action}</Text>
                  <Text style={s.timestamp}>{new Date(item.created_at).toLocaleString()}</Text>
                  {item.user_email ? <Text style={s.meta}>👤 {item.user_email}</Text> : null}
                  {item.ip_address ? <Text style={s.meta}>🌐 {item.ip_address}</Text> : null}
                  {item.entity_type ? <Text style={s.meta}>📦 {item.entity_type}</Text> : null}
                </View>
                <Badge label={sev} variant={sev === 'critical' ? 'error' : sev === 'warning' ? 'warning' : 'info'} size="sm" />
              </View>
            </Card>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  filterRow: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.md, paddingBottom: 0, flexWrap: 'wrap' },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  chipActive: (f: Filter) => ({
    backgroundColor: f === 'critical' ? Colors.error : f === 'warning' ? Colors.warning : f === 'info' ? Colors.info : '#7B1FA2',
    borderColor: f === 'critical' ? Colors.error : f === 'warning' ? Colors.warning : f === 'info' ? Colors.info : '#7B1FA2',
  }),
  chipText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  chipTextActive: { color: Colors.textPrimary, fontWeight: FontWeight.semibold },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 100 },
  card: {},
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  action: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  timestamp: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  meta: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
});
