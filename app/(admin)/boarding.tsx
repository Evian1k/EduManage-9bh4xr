import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useAlert } from '@/template';
import { useAppContext } from '@/hooks/useAppContext';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { getDormitories, getBoardingStats, getInspections, Dormitory, BoardingStats, DormitoryInspection } from '@/services/boarding.service';
import { getSupabaseClient } from '@/template';

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function BoardingScreen() {
  const { school } = useAppContext();
  const { showAlert } = useAlert();
  const [dorms, setDorms] = useState<Dormitory[]>([]);
  const [stats, setStats] = useState<BoardingStats | null>(null);
  const [inspections, setInspections] = useState<DormitoryInspection[]>([]);
  const [bedCounts, setBedCounts] = useState<Record<string, { total: number; occupied: number }>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!school) return;
    const supabase = getSupabaseClient();
    const [dormRes, statsRes, inspRes] = await Promise.all([
      getDormitories(school.id),
      getBoardingStats(school.id),
      getInspections(school.id, { limit: 5 }),
    ]);
    if (dormRes.error) { showAlert('Error', dormRes.error); }
    setDorms(dormRes.data || []);
    setStats(statsRes.data);
    setInspections(inspRes.data || []);

    // Get bed counts per dorm
    if ((dormRes.data || []).length > 0) {
      const bedResults = await Promise.all(
        (dormRes.data || []).map(async (d) => {
          const { count: total } = await supabase.from('dormitory_beds').select('id', { count: 'exact', head: true }).eq('school_id', school.id).eq('dormitory_id', d.id);
          const { count: occupied } = await supabase.from('dormitory_beds').select('id', { count: 'exact', head: true }).eq('school_id', school.id).eq('dormitory_id', d.id).eq('is_occupied', true);
          return [d.id, { total: total ?? 0, occupied: occupied ?? 0 }] as [string, { total: number; occupied: number }];
        }),
      );
      setBedCounts(Object.fromEntries(bedResults));
    }
    setLoading(false);
    setRefreshing(false);
  }, [school]);

  useEffect(() => { load(); }, [school]);

  if (loading) return <LoadingScreen message="Loading boarding..." />;

  return (
    <View style={styles.flex}>
      <Header title="Boarding" subtitle={school?.name} showBack accentColor={Colors.secondary} />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={undefined}
      >
        <View style={styles.statsRow}>
          <StatCard label="Dormitories" value={stats?.totalDormitories ?? 0} icon="home" color={Colors.primary} />
          <StatCard label="Beds" value={stats?.totalBeds ?? 0} icon="bed" color={Colors.secondary} />
        </View>
        <View style={styles.statsRow}>
          <StatCard label="Occupied" value={stats?.occupiedBeds ?? 0} icon="king-bed" color={Colors.warning} subtitle={`${stats?.occupancyRate ?? 0}% full`} />
          <StatCard label="Vacant" value={stats?.availableBeds ?? 0} icon="airline-seat-individual-suite" color={Colors.success} />
        </View>

        {/* Dormitories list with capacity bars */}
        <Text style={styles.sectionTitle}>Dormitories</Text>
        {dorms.length === 0 ? (
          <Card>
            <EmptyState icon="home" title="No Dormitories" description="Add dormitories and beds to start managing boarding." />
          </Card>
        ) : (
          dorms.map((d) => {
            const counts = bedCounts[d.id] || { total: 0, occupied: 0 };
            const pct = counts.total > 0 ? Math.round((counts.occupied / counts.total) * 100) : 0;
            return (
              <Card key={d.id}>
                <View style={styles.dormHeader}>
                  <View style={[styles.dormIcon, { backgroundColor: d.gender === 'male' ? Colors.schoolAdminBg : d.gender === 'female' ? Colors.teacherBg : Colors.surface2 }]}>
                    <MaterialIcons name="home" size={20} color={d.gender === 'male' ? Colors.primary : d.gender === 'female' ? Colors.teacher : Colors.textSecondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dormName}>{d.name}</Text>
                    <Text style={styles.dormMeta}>
                      {[d.gender && d.gender.charAt(0).toUpperCase() + d.gender.slice(1), d.location, `Cap. ${d.capacity}`].filter(Boolean).join(' • ')}
                    </Text>
                  </View>
                  {d.is_active ? <Badge label="Active" variant="success" size="sm" /> : <Badge label="Inactive" variant="default" size="sm" />}
                </View>
                <View style={styles.capacityRow}>
                  <Text style={styles.capacityLabel}>Bed Occupancy</Text>
                  <Text style={styles.capacityVal}>{counts.occupied} / {counts.total} ({pct}%)</Text>
                </View>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${Math.min(100, pct)}%`, backgroundColor: pct >= 90 ? Colors.error : pct >= 70 ? Colors.warning : Colors.success }]} />
                </View>
              </Card>
            );
          })
        )}

        {/* Recent inspections */}
        <Text style={styles.sectionTitle}>Recent Inspections</Text>
        {inspections.length === 0 ? (
          <Card>
            <Text style={styles.emptyText}>No inspection records yet.</Text>
          </Card>
        ) : (
          inspections.map((insp) => {
            const dormName = (insp as any).dormitories?.name || 'Dormitory';
            const totalScore = (insp.cleanliness_score || 0) + (insp.discipline_score || 0);
            const maxScore = 20;
            const pct = Math.round((totalScore / maxScore) * 100);
            return (
              <Card key={insp.id}>
                <View style={styles.inspRow}>
                  <View style={[styles.inspIcon, { backgroundColor: insp.follow_up_required ? Colors.errorBg : Colors.successBg }]}>
                    <MaterialIcons name="fact-check" size={18} color={insp.follow_up_required ? Colors.error : Colors.success} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.inspDorm}>{dormName}</Text>
                    <Text style={styles.inspDate}>{formatDate(insp.inspection_date)}</Text>
                    <View style={styles.inspScores}>
                      {insp.cleanliness_score != null ? <Text style={styles.scoreText}>Cleanliness: <Text style={styles.scoreVal}>{insp.cleanliness_score}/10</Text></Text> : null}
                      {insp.discipline_score != null ? <Text style={styles.scoreText}>Discipline: <Text style={styles.scoreVal}>{insp.discipline_score}/10</Text></Text> : null}
                    </View>
                    {insp.notes ? <Text style={styles.inspNotes}>{insp.notes}</Text> : null}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={[styles.inspPct, { color: pct >= 80 ? Colors.success : pct >= 60 ? Colors.warning : Colors.error }]}>{pct}%</Text>
                    {insp.follow_up_required ? <Badge label="Follow-up" variant="error" size="sm" /> : null}
                  </View>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl, gap: Spacing.sm },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginTop: Spacing.sm, marginBottom: Spacing.xs },
  dormHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
  dormIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  dormName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  dormMeta: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  capacityRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  capacityLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  capacityVal: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  progressBar: { height: 8, backgroundColor: Colors.surface2, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  emptyText: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center', padding: Spacing.sm },
  inspRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  inspIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  inspDorm: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  inspDate: { fontSize: FontSize.xs, color: Colors.textMuted },
  inspScores: { flexDirection: 'row', gap: Spacing.md, marginTop: 2 },
  scoreText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  scoreVal: { color: Colors.textPrimary, fontWeight: FontWeight.semibold },
  inspNotes: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 4, fontStyle: 'italic' },
  inspPct: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
});
