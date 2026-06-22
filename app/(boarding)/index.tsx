// Boarding dashboard — stats + dormitory occupancy + recent inspections
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppContext } from '@/hooks/useAppContext';
import {
  getBoardingStats, getDormitories, getInspections, BoardingStats, Dormitory, DormitoryInspection,
} from '@/services/boarding.service';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { getSupabaseClient } from '@/template';

export default function BoardingDashboard() {
  const router = useRouter();
  const { school } = useAppContext();
  const schoolId = school?.id;
  const [stats, setStats] = useState<BoardingStats | null>(null);
  const [dorms, setDorms] = useState<Dormitory[]>([]);
  const [occupiedMap, setOccupiedMap] = useState<Record<string, number>>({});
  const [insp, setInsp] = useState<DormitoryInspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!schoolId) return;
    const supabase = getSupabaseClient();
    const [statsRes, dormsRes, inspRes] = await Promise.all([
      getBoardingStats(schoolId),
      getDormitories(schoolId, true),
      getInspections(schoolId, { limit: 5 }),
    ]);
    setStats(statsRes.data);
    setDorms(dormsRes.data || []);
    setInsp(inspRes.data || []);
    if (dormsRes.data && dormsRes.data.length > 0) {
      const bedsRes = await supabase
        .from('dormitory_beds')
        .select('dormitory_id, is_occupied')
        .eq('school_id', schoolId)
        .eq('is_occupied', true);
      const occ: Record<string, number> = {};
      (bedsRes.data || []).forEach((b: any) => { occ[b.dormitory_id] = (occ[b.dormitory_id] || 0) + 1; });
      setOccupiedMap(occ);
    }
    setLoading(false);
    setRefreshing(false);
  }, [schoolId]);

  useEffect(() => { if (schoolId) load(); }, [schoolId]);

  if (!schoolId) return <LoadingScreen />;
  if (loading) return <LoadingScreen message="Loading boarding dashboard..." />;

  return (
    <View style={s.flex}>
      <Header
        title="Boarding"
        subtitle={school?.name}
        accentColor={Colors.secondary}
        rightAction={{ icon: 'bedroom-parent', onPress: () => router.push('/(boarding)/dormitories') }}
      />
      <ScrollView
        style={s.flex}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} colors={[Colors.primary]} />}
      >
        {/* Quick actions */}
        <View style={s.quickRow}>
          {[
            { label: 'Dormitories', icon: 'king-bed' as const, route: '/(boarding)/dormitories' },
            { label: 'Attendance', icon: 'fact-check' as const, route: '/(boarding)/attendance' },
            { label: 'Inspections', icon: 'assignment' as const, route: '/(boarding)/inspections' },
            { label: 'Discipline', icon: 'gavel' as const, route: '/(boarding)/discipline' },
          ].map((q) => (
            <Pressable key={q.label} style={s.quickBtn} onPress={() => router.push(q.route as any)}>
              <View style={s.quickIcon}>
                <MaterialIcons name={q.icon} size={20} color={Colors.secondary} />
              </View>
              <Text style={s.quickLabel}>{q.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Stats */}
        <View style={s.statsRow}>
          <StatCard label="Dormitories" value={stats?.totalDormitories ?? 0} icon="king-bed" color={Colors.secondary} />
        </View>
        <View style={s.statsRow}>
          <StatCard label="Beds" value={stats?.totalBeds ?? 0} icon="single-bed" color={Colors.primary} />
          <StatCard label="Occupied" value={stats?.occupiedBeds ?? 0} icon="check-circle" color={Colors.success} subtitle={`${stats?.occupancyRate ?? 0}% rate`} />
        </View>
        <View style={s.statsRow}>
          <StatCard label="Follow-ups" value={stats?.pendingInspectionsFollowUp ?? 0} icon="pending-actions" color={Colors.warning} subtitle="inspection follow-ups" />
        </View>

        {/* Dormitory occupancy */}
        <Text style={s.sectionTitle}>Dormitory Occupancy</Text>
        {dorms.length === 0 ? (
          <Card><Text style={s.emptyText}>No dormitories yet.</Text></Card>
        ) : (
          dorms.map((d) => {
            const occupied = occupiedMap[d.id] || 0;
            const pct = d.capacity > 0 ? Math.min(100, Math.round((occupied / d.capacity) * 100)) : 0;
            return (
              <Card key={d.id} style={s.dormCard} onPress={() => router.push({ pathname: '/(boarding)/beds', params: { dormId: d.id, dormName: d.name } })}>
                <View style={s.dormRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.dormName}>{d.name}</Text>
                    <Text style={s.dormMeta}>{d.gender || 'mixed'} · {d.location || 'no location'}</Text>
                  </View>
                  <Badge label={`${occupied}/${d.capacity}`} variant="default" size="sm" />
                </View>
                <View style={s.occBar}>
                  <View style={[s.occFill, { width: `${pct}%`, backgroundColor: pct >= 90 ? Colors.error : pct >= 60 ? Colors.warning : Colors.success }]} />
                </View>
              </Card>
            );
          })
        )}

        {/* Recent inspections */}
        <Text style={[s.sectionTitle, { marginTop: Spacing.md }]}>Recent Inspections</Text>
        {insp.length === 0 ? (
          <Card><Text style={s.emptyText}>No inspections logged.</Text></Card>
        ) : (
          insp.map((i) => (
            <Card key={i.id} style={s.inspCard}>
              <View style={s.inspRow}>
                <View style={s.inspIcon}>
                  <MaterialIcons name="assignment" size={16} color={Colors.secondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.inspDorm}>{(i as any).dormitories?.name || 'Dormitory'}</Text>
                  <Text style={s.inspDate}>{new Date(i.inspection_date).toLocaleDateString()}</Text>
                </View>
                <View style={s.inspScores}>
                  <Text style={s.scoreText}>C: {i.cleanliness_score ?? '—'}</Text>
                  <Text style={s.scoreText}>D: {i.discipline_score ?? '—'}</Text>
                </View>
                {i.follow_up_required ? <Badge label="Follow-up" variant="warning" size="sm" /> : null}
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingBottom: 100, gap: Spacing.sm },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.sm },
  quickBtn: { flex: 1, minWidth: '47%', backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: Colors.border },
  quickIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: `${Colors.secondary}20`, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.medium },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginTop: Spacing.xs, marginBottom: Spacing.xs },
  dormCard: { gap: Spacing.sm },
  dormRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dormName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  dormMeta: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  occBar: { height: 6, backgroundColor: Colors.surface2, borderRadius: 3, overflow: 'hidden' },
  occFill: { height: 6, borderRadius: 3 },
  inspCard: {},
  inspRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  inspIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: `${Colors.secondary}20`, alignItems: 'center', justifyContent: 'center' },
  inspDorm: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  inspDate: { fontSize: FontSize.xs, color: Colors.textSecondary },
  inspScores: { flexDirection: 'row', gap: Spacing.xs },
  scoreText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  emptyText: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center', padding: Spacing.sm },
});
