import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, FlatList, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, useAlert } from '@/template';
import { useAppContext } from '@/hooks/useAppContext';
import { BottomNav } from '@/components/layout/BottomNav';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { getSupabaseClient } from '@/template';
import { getVisitorLogs, logVisitor, checkoutVisitor } from '@/services/finance.service';

const NAV = [
  { label: 'Reception', icon: 'desk' as const, route: '/(secretary)/' },
  { label: 'Announce', icon: 'campaign' as const, route: '/(secretary)/announcements' },
  { label: 'Visitors', icon: 'badge' as const, route: '/(secretary)/visitors' },
  { label: 'Events', icon: 'event' as const, route: '/(secretary)/events' },
  { label: 'Messages', icon: 'mail' as const, route: '/(secretary)/messages' },
];

export default function SecretaryDashboard() {
  const { user, logout } = useAuth();
  const { showAlert } = useAlert();
  const { school, schoolUser } = useAppContext();
  const [visitors, setVisitors] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewVisitor, setShowNewVisitor] = useState(false);
  const [visitorName, setVisitorName] = useState('');
  const [visitorPhone, setVisitorPhone] = useState('');
  const [visitorPurpose, setVisitorPurpose] = useState('');
  const [visitorHost, setVisitorHost] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!school) return;
    const supabase = getSupabaseClient();
    const [visRes, annRes, evRes] = await Promise.all([
      getVisitorLogs(school.id),
      supabase.from('announcements').select('*').eq('school_id', school.id).order('created_at', { ascending: false }).limit(5),
      supabase.from('school_events').select('*').eq('school_id', school.id).gte('start_date', new Date().toISOString()).order('start_date').limit(5),
    ]);
    setVisitors((visRes.data || []).filter((v: any) => !v.check_out).slice(0, 10));
    setAnnouncements(annRes.data || []);
    setEvents(evRes.data || []);
    setLoading(false);
  }, [school]);

  useEffect(() => { load(); }, [school]);

  const handleLogVisitor = async () => {
    if (!visitorName.trim() || !visitorPurpose.trim()) {
      showAlert('Missing Info', 'Please fill visitor name and purpose.');
      return;
    }
    setSaving(true);
    const { error } = await logVisitor(school!.id, {
      visitor_name: visitorName.trim(),
      visitor_phone: visitorPhone.trim(),
      purpose: visitorPurpose.trim(),
      host_name: visitorHost.trim(),
      recorded_by: schoolUser?.id,
    });
    setSaving(false);
    if (error) { showAlert('Error', error.message); return; }
    setVisitorName(''); setVisitorPhone(''); setVisitorPurpose(''); setVisitorHost('');
    setShowNewVisitor(false);
    showAlert('Success', 'Visitor logged successfully');
    load();
  };

  const handleCheckout = async (id: string, name: string) => {
    showAlert('Check Out', `Check out ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Check Out', onPress: async () => {
        await checkoutVisitor(id);
        load();
      }},
    ]);
  };

  if (loading) return <LoadingScreen message="Loading reception..." />;

  return (
    <View style={s.flex}>
      <Header
        title="Secretary / Reception"
        subtitle={school?.name}
        accentColor="#00897B"
        rightAction={{ icon: 'logout', onPress: () => showAlert('Sign Out', 'Sign out?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign Out', style: 'destructive', onPress: () => logout() }]) }}
      />
      <ScrollView style={s.flex} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Welcome */}
        <View style={s.welcomeRow}>
          <View style={s.avatar}><MaterialIcons name="person" size={22} color="#00897B" /></View>
          <View>
            <Text style={s.welcomeName}>Welcome, {user?.username || 'Secretary'}</Text>
            <Text style={s.welcomeRole}>Reception & Administration</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={s.statsRow}>
          <View style={[s.statBox, { borderColor: '#00897B40' }]}>
            <MaterialIcons name="badge" size={22} color="#00897B" />
            <Text style={s.statNum}>{visitors.length}</Text>
            <Text style={s.statLabel}>Active Visitors</Text>
          </View>
          <View style={[s.statBox, { borderColor: `${Colors.primary}40` }]}>
            <MaterialIcons name="campaign" size={22} color={Colors.primary} />
            <Text style={s.statNum}>{announcements.length}</Text>
            <Text style={s.statLabel}>Announcements</Text>
          </View>
          <View style={[s.statBox, { borderColor: `${Colors.warning}40` }]}>
            <MaterialIcons name="event" size={22} color={Colors.warning} />
            <Text style={s.statNum}>{events.length}</Text>
            <Text style={s.statLabel}>Upcoming Events</Text>
          </View>
        </View>

        {/* Log New Visitor */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Visitor Logbook</Text>
          <Pressable style={s.addBtn} onPress={() => setShowNewVisitor(!showNewVisitor)}>
            <MaterialIcons name={showNewVisitor ? 'close' : 'add'} size={18} color={Colors.textPrimary} />
            <Text style={s.addBtnText}>{showNewVisitor ? 'Cancel' : 'Log Visitor'}</Text>
          </Pressable>
        </View>

        {showNewVisitor ? (
          <Card style={s.formCard}>
            <Text style={s.formTitle}>New Visitor</Text>
            {[
              { label: 'Visitor Name *', val: visitorName, set: setVisitorName, placeholder: 'Full name' },
              { label: 'Phone Number', val: visitorPhone, set: setVisitorPhone, placeholder: '+1 555-0000' },
              { label: 'Purpose of Visit *', val: visitorPurpose, set: setVisitorPurpose, placeholder: 'e.g., Parent meeting, Delivery...' },
              { label: 'Host / Person to See', val: visitorHost, set: setVisitorHost, placeholder: 'e.g., Mr. Chen, Admin Office' },
            ].map(field => (
              <View key={field.label} style={s.fieldWrap}>
                <Text style={s.fieldLabel}>{field.label}</Text>
                <TextInput
                  style={s.input}
                  value={field.val}
                  onChangeText={field.set}
                  placeholder={field.placeholder}
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
            ))}
            <Button label={saving ? 'Logging...' : 'Log Visitor'} onPress={handleLogVisitor} loading={saving} fullWidth />
          </Card>
        ) : null}

        {/* Active Visitors */}
        {visitors.length > 0 ? visitors.map(v => (
          <Card key={v.id} style={s.visitorCard}>
            <View style={s.visitorRow}>
              <View style={s.visitorIcon}><MaterialIcons name="person-pin" size={22} color="#00897B" /></View>
              <View style={s.visitorInfo}>
                <Text style={s.visitorName}>{v.visitor_name}</Text>
                <Text style={s.visitorPurpose}>{v.purpose}</Text>
                {v.host_name ? <Text style={s.visitorMeta}>Seeing: {v.host_name}</Text> : null}
                <Text style={s.visitorTime}>
                  In: {new Date(v.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              <Pressable style={s.checkoutBtn} onPress={() => handleCheckout(v.id, v.visitor_name)}>
                <MaterialIcons name="exit-to-app" size={16} color={Colors.warning} />
                <Text style={s.checkoutText}>Out</Text>
              </Pressable>
            </View>
          </Card>
        )) : (
          <Card><Text style={s.emptyText}>No active visitors at this time.</Text></Card>
        )}

        {/* Upcoming Events */}
        {events.length > 0 ? (
          <>
            <Text style={[s.sectionTitle, { marginTop: Spacing.md }]}>Upcoming Events</Text>
            {events.map(ev => (
              <Card key={ev.id} style={s.eventCard}>
                <View style={s.eventRow}>
                  <View style={s.eventIcon}><MaterialIcons name="event" size={18} color={Colors.warning} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.eventTitle}>{ev.title}</Text>
                    <Text style={s.eventDate}>
                      {new Date(ev.start_date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                      {ev.location ? ` · ${ev.location}` : ''}
                    </Text>
                  </View>
                  <Badge label={ev.event_type} variant="default" size="sm" />
                </View>
              </Card>
            ))}
          </>
        ) : null}

        {/* Recent Announcements */}
        {announcements.length > 0 ? (
          <>
            <Text style={[s.sectionTitle, { marginTop: Spacing.md }]}>Recent Announcements</Text>
            {announcements.slice(0, 3).map(a => (
              <Card key={a.id} style={s.annCard}>
                <Text style={s.annTitle}>{a.title}</Text>
                <Text style={s.annContent} numberOfLines={2}>{a.content}</Text>
              </Card>
            ))}
          </>
        ) : null}
      </ScrollView>
      <BottomNav items={NAV} accentColor="#00897B" />
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingBottom: 100, gap: Spacing.sm },
  welcomeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.sm },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,137,123,0.15)', alignItems: 'center', justifyContent: 'center' },
  welcomeName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  welcomeRole: { fontSize: FontSize.sm, color: Colors.textSecondary },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  statBox: { flex: 1, backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center', gap: 4, borderWidth: 1 },
  statNum: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  statLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'center' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.sm },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.surface2, paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: BorderRadius.sm },
  addBtnText: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.medium },
  formCard: { gap: Spacing.sm },
  formTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.xs },
  fieldWrap: { gap: 4 },
  fieldLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  input: { backgroundColor: Colors.surface2, borderRadius: BorderRadius.sm, padding: Spacing.md, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border, fontSize: FontSize.base },
  visitorCard: {},
  visitorRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  visitorIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,137,123,0.12)', alignItems: 'center', justifyContent: 'center' },
  visitorInfo: { flex: 1, gap: 2 },
  visitorName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  visitorPurpose: { fontSize: FontSize.sm, color: Colors.textSecondary },
  visitorMeta: { fontSize: FontSize.xs, color: Colors.textMuted },
  visitorTime: { fontSize: FontSize.xs, color: Colors.textMuted },
  checkoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.warningBg, paddingHorizontal: 8, paddingVertical: 5, borderRadius: BorderRadius.sm },
  checkoutText: { fontSize: FontSize.xs, color: Colors.warning, fontWeight: FontWeight.semibold },
  emptyText: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center', padding: Spacing.sm },
  eventCard: {},
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  eventIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.warningBg, alignItems: 'center', justifyContent: 'center' },
  eventTitle: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  eventDate: { fontSize: FontSize.xs, color: Colors.textSecondary },
  annCard: {},
  annTitle: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  annContent: { fontSize: FontSize.sm, color: Colors.textSecondary },
});
