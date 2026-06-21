// Parent: Children list — guardians where user_id = profileId, joined to students
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
} from 'react-native';
import { useAppContext } from '@/hooks/useAppContext';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Badge, getStatusBadgeVariant } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useAlert } from '@/template';
import { Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { getSupabaseClient } from '@/template';

interface Child {
  id: string;
  full_name: string;
  admission_number: string;
  gender?: string;
  status: string;
  classes?: { name: string } | null;
  streams?: { name: string } | null;
  blood_group?: string;
  enrollment_date?: string;
}

export default function ParentChildrenScreen() {
  const { showAlert } = useAlert();
  const { school, profileId } = useAppContext();
  const schoolId = school?.id;
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!schoolId || !profileId) return;
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('guardians')
      .select('relationship, students(id, full_name, admission_number, gender, status, blood_group, enrollment_date, classes(name), streams(name))')
      .eq('user_id', profileId);
    if (error) { setLoading(false); setRefreshing(false); return; }
    const kids = (data || []).map((g: any) => g.students).filter(Boolean);
    setChildren(kids);
    setLoading(false);
    setRefreshing(false);
  }, [schoolId, profileId]);

  useEffect(() => { if (schoolId && profileId) load(); }, [schoolId, profileId]);

  if (!schoolId) return <LoadingScreen />;
  if (loading) return <LoadingScreen message="Loading children..." />;

  return (
    <View style={s.flex}>
      <Header
        title="My Children"
        subtitle={`${children.length} enrolled`}
        showBack
        accentColor="#FF9800"
      />
      <FlatList
        data={children}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} colors={[Colors.primary]} />}
        ListEmptyComponent={
          <EmptyState icon="child-care" title="No Children Linked" description="Your account is not linked to any students yet. Please contact the school." />
        }
        renderItem={({ item }) => (
          <Card style={s.card} onPress={() => showAlert(item.full_name, [
            `Admission: ${item.admission_number}`,
            `Class: ${item.classes?.name || '—'}${item.streams?.name ? ` (${item.streams.name})` : ''}`,
            `Gender: ${item.gender || '—'}`,
            `Blood group: ${item.blood_group || '—'}`,
            `Enrolled: ${item.enrollment_date ? new Date(item.enrollment_date).toLocaleDateString() : '—'}`,
            `Status: ${item.status}`,
          ].join('\n'))}>
            <View style={s.row}>
              <Avatar name={item.full_name} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{item.full_name}</Text>
                <Text style={s.adm}>{item.admission_number}</Text>
                <Text style={s.cls}>{item.classes?.name || 'No class'}{item.streams?.name ? ` · ${item.streams.name}` : ''}</Text>
              </View>
              <Badge label={item.status || 'active'} variant={getStatusBadgeVariant(item.status || 'active')} size="sm" />
            </View>
          </Card>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 100 },
  card: {},
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  name: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  adm: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  cls: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
});
