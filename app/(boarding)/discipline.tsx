// Discipline records — list view of disciplinary_records
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
} from 'react-native';
import { useAppContext } from '@/hooks/useAppContext';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge, getStatusBadgeVariant } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { getSupabaseClient } from '@/template';

interface DisciplinaryRecord {
  id: string;
  student_id?: string;
  staff_id?: string;
  person_name?: string;
  incident_date: string;
  severity: string;
  description?: string;
  action_taken?: string;
  status?: string;
  students?: { full_name: string; admission_number: string } | null;
  staff?: { full_name: string } | null;
}

const severityVariant = (sev: string) => {
  const s = (sev || '').toLowerCase();
  if (s.includes('minor')) return 'info' as const;
  if (s.includes('major')) return 'warning' as const;
  if (s.includes('critical') || s.includes('severe')) return 'error' as const;
  return 'default' as const;
};

export default function DisciplineScreen() {
  const { school } = useAppContext();
  const schoolId = school?.id;
  const [records, setRecords] = useState<DisciplinaryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!schoolId) return;
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('disciplinary_records')
      .select('*, students(full_name, admission_number), staff(full_name)')
      .eq('school_id', schoolId)
      .order('incident_date', { ascending: false })
      .limit(200);
    if (!error) setRecords((data || []) as unknown as DisciplinaryRecord[]);
    setLoading(false);
  }, [schoolId]);

  useEffect(() => { if (schoolId) load(); }, [schoolId]);

  if (!schoolId) return <LoadingScreen />;
  if (loading) return <LoadingScreen message="Loading discipline records..." />;

  return (
    <View style={s.flex}>
      <Header
        title="Discipline"
        subtitle={`${records.length} records`}
        showBack
        accentColor={Colors.secondary}
      />
      <FlatList
        data={records}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState icon="gavel" title="No Discipline Records" description="Disciplinary incidents will appear here." />
        }
        renderItem={({ item }) => {
          const person = item.students?.full_name || item.staff?.full_name || item.person_name || 'Unknown';
          return (
            <Card style={s.card}>
              <View style={s.row}>
                <View style={s.icon}>
                  <MaterialIcons name="gavel" size={18} color={Colors.warning} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.person}>{person}</Text>
                  <Text style={s.date}>{new Date(item.incident_date).toLocaleDateString()}</Text>
                </View>
                <Badge label={item.severity || 'N/A'} variant={severityVariant(item.severity)} size="sm" />
              </View>
              {item.description ? <Text style={s.desc}>{item.description}</Text> : null}
              {item.action_taken ? (
                <View style={s.actionRow}>
                  <MaterialIcons name="task-alt" size={14} color={Colors.success} />
                  <Text style={s.action}>{item.action_taken}</Text>
                </View>
              ) : null}
              {item.status ? <Badge label={item.status} variant={getStatusBadgeVariant(item.status)} size="sm" /> : null}
            </Card>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 100 },
  card: { gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.warningBg, alignItems: 'center', justifyContent: 'center' },
  person: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  date: { fontSize: FontSize.xs, color: Colors.textSecondary },
  desc: { fontSize: FontSize.sm, color: Colors.textSecondary },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  action: { fontSize: FontSize.sm, color: Colors.success, flex: 1 },
});
