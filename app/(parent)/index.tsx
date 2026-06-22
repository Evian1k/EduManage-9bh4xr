// Parent dashboard — children list + quick links grid
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppContext } from '@/hooks/useAppContext';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { getSupabaseClient } from '@/template';

interface Child {
  id: string;
  full_name: string;
  admission_number: string;
  class_id?: string;
  status: string;
  classes?: { name: string } | null;
}

export default function ParentDashboard() {
  const router = useRouter();
  const { school, profileId } = useAppContext();
  const schoolId = school?.id;
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!schoolId || !profileId) return;
    const supabase = getSupabaseClient();
    // Guardians → student_id; join students + classes
    const { data, error } = await supabase
      .from('guardians')
      .select('student_id, students(id, full_name, admission_number, class_id, status, classes(name))')
      .eq('user_id', profileId);
    if (error) { setLoading(false); setRefreshing(false); return; }
    const kids: Child[] = (data || [])
      .map((g: any) => g.students)
      .filter(Boolean)
      .filter((st: any) => st.school_id === undefined || st.school_id === schoolId);
    setChildren(kids);
    setLoading(false);
    setRefreshing(false);
  }, [schoolId, profileId]);

  useEffect(() => { if (schoolId && profileId) load(); }, [schoolId, profileId]);

  if (!schoolId) return <LoadingScreen />;
  if (loading) return <LoadingScreen message="Loading parent dashboard..." />;

  const quickLinks = [
    { label: 'Grades', icon: 'school' as const, route: '/(parent)/grades', color: Colors.primary },
    { label: 'Attendance', icon: 'event-available' as const, route: '/(parent)/attendance', color: Colors.success },
    { label: 'Fees', icon: 'payments' as const, route: '/(parent)/fees', color: Colors.warning },
    { label: 'Messages', icon: 'mail' as const, route: '/(parent)/messages', color: Colors.secondary },
    { label: 'Announcements', icon: 'campaign' as const, route: '/(parent)/announcements', color: '#AB47BC' },
    { label: 'My Children', icon: 'family-restroom' as const, route: '/(parent)/children', color: '#FF9800' },
  ];

  return (
    <View style={s.flex}>
      <Header title="Parent" subtitle={school?.name} accentColor="#FF9800" />
      <ScrollView
        style={s.flex}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} colors={[Colors.primary]} />}
      >
        <View style={s.welcomeRow}>
          <View style={s.avatar}><MaterialIcons name="family-restroom" size={22} color="#FF9800" /></View>
          <View>
            <Text style={s.welcomeName}>Welcome, Parent</Text>
            <Text style={s.welcomeSub}>{children.length} {children.length === 1 ? 'child' : 'children'} enrolled</Text>
          </View>
        </View>

        {/* My Children */}
        <Text style={s.sectionTitle}>My Children</Text>
        {children.length === 0 ? (
          <Card><Text style={s.emptyText}>No children linked to your account yet.</Text></Card>
        ) : (
          children.map((c) => (
            <Card key={c.id} style={s.childCard} onPress={() => router.push('/(parent)/children')}>
              <View style={s.childRow}>
                <Avatar name={c.full_name} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={s.childName}>{c.full_name}</Text>
                  <Text style={s.childAdm}>{c.admission_number} · {c.classes?.name || 'No class'}</Text>
                </View>
                <Badge label={c.status || 'active'} variant={c.status === 'active' ? 'success' : 'default'} size="sm" />
              </View>
            </Card>
          ))
        )}

        {/* Quick Links */}
        <Text style={[s.sectionTitle, { marginTop: Spacing.md }]}>Quick Links</Text>
        <View style={s.grid}>
          {quickLinks.map((q) => (
            <Pressable key={q.label} style={s.gridItem} onPress={() => router.push(q.route as any)}>
              <View style={[s.gridIcon, { backgroundColor: `${q.color}20` }]}>
                <MaterialIcons name={q.icon} size={22} color={q.color} />
              </View>
              <Text style={s.gridLabel}>{q.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingBottom: 100, gap: Spacing.sm },
  welcomeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.sm },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,152,0,0.15)', alignItems: 'center', justifyContent: 'center' },
  welcomeName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  welcomeSub: { fontSize: FontSize.sm, color: Colors.textSecondary },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginBottom: Spacing.xs },
  childCard: {},
  childRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  childName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  childAdm: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  gridItem: { flex: 1, minWidth: '31%', backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: Colors.border },
  gridIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  gridLabel: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.medium, textAlign: 'center' },
  emptyText: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center', padding: Spacing.sm },
});
