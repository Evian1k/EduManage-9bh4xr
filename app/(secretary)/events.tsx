// Secretary: Events CRUD — create modal + FlatList sorted by start_at
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Modal, Pressable, ScrollView, RefreshControl,
} from 'react-native';
import { useAppContext } from '@/hooks/useAppContext';
import {
  getEvents, createEvent, SchoolEvent,
} from '@/services/communication.service';
import { useAlert } from '@/template';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';

const EVENT_TYPES = ['meeting', 'ceremony', 'sports', 'holiday', 'exam', 'trip', 'workshop', 'other'];
const AUDIENCES = ['all', 'parents', 'staff', 'students', 'teachers'];

function toLocalDatetimeInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function SecretaryEventsScreen() {
  const { showAlert } = useAlert();
  const { school, profileId } = useAppContext();
  const schoolId = school?.id;
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [audPickerOpen, setAudPickerOpen] = useState(false);
  const defaultStart = toLocalDatetimeInput(new Date(Date.now() + 60 * 60 * 1000));
  const defaultEnd = toLocalDatetimeInput(new Date(Date.now() + 2 * 60 * 60 * 1000));
  const [form, setForm] = useState({
    title: '', description: '', event_type: 'meeting',
    start_at: defaultStart, end_at: defaultEnd,
    location: '', audience: 'all',
  });

  const load = useCallback(async () => {
    if (!schoolId) return;
    const { data, error } = await getEvents(schoolId);
    if (error) showAlert('Error', error);
    setEvents(data || []);
    setLoading(false);
    setRefreshing(false);
  }, [schoolId]);

  useEffect(() => { if (schoolId) load(); }, [schoolId]);

  const toISO = (v: string) => {
    // Accept "YYYY-MM-DDTHH:MM" or "YYYY-MM-DD HH:MM" or full ISO
    if (!v) return undefined;
    const d = new Date(v.replace(' ', 'T'));
    return isNaN(d.getTime()) ? undefined : d.toISOString();
  };

  const handleCreate = async () => {
    if (!form.title.trim() || !schoolId) {
      showAlert('Missing Fields', 'Title is required.');
      return;
    }
    const startIso = toISO(form.start_at);
    if (!startIso) { showAlert('Invalid Date', 'Please enter a valid start date/time.'); return; }
    setSaving(true);
    const { error } = await createEvent(schoolId, {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      event_type: form.event_type,
      start_at: startIso,
      end_at: toISO(form.end_at),
      location: form.location.trim() || undefined,
      audience: form.audience,
      created_by: profileId || undefined,
    });
    setSaving(false);
    if (error) { showAlert('Error', error); return; }
    setShowModal(false);
    setForm({ title: '', description: '', event_type: 'meeting', start_at: defaultStart, end_at: defaultEnd, location: '', audience: 'all' });
    load();
  };

  if (!schoolId) return <LoadingScreen />;
  if (loading) return <LoadingScreen message="Loading events..." />;

  const fmtDateTime = (iso: string) => new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <View style={s.flex}>
      <Header
        title="Events"
        subtitle={`${events.length} scheduled`}
        showBack
        accentColor="#00897B"
        rightAction={{ icon: 'add', onPress: () => setShowModal(true) }}
      />
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} colors={[Colors.primary]} />}
        ListEmptyComponent={<EmptyState icon="event" title="No Events" description="Schedule your first event." actionLabel="New Event" onAction={() => setShowModal(true)} />}
        renderItem={({ item }) => (
          <Card style={s.card}>
            <View style={s.row}>
              <View style={s.dateBox}>
                <Text style={s.dateDay}>{new Date(item.start_at).getDate()}</Text>
                <Text style={s.dateMon}>{new Date(item.start_at).toLocaleDateString([], { month: 'short' })}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.title} numberOfLines={1}>{item.title}</Text>
                <Text style={s.datetime}>{fmtDateTime(item.start_at)}{item.end_at ? ` → ${fmtDateTime(item.end_at)}` : ''}</Text>
                {item.location ? <Text style={s.location}>📍 {item.location}</Text> : null}
              </View>
              {item.event_type ? <Badge label={item.event_type} variant="info" size="sm" /> : null}
            </View>
            {item.description ? <Text style={s.desc}>{item.description}</Text> : null}
            {item.audience ? <Text style={s.audience}>Audience: {item.audience}</Text> : null}
          </Card>
        )}
      />

      <Modal visible={showModal} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={s.overlay}>
          <View style={s.modal}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>New Event</Text>
              <Pressable onPress={() => setShowModal(false)} hitSlop={8}>
                <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={s.form}>
                <Input label="Title *" value={form.title} onChangeText={(v) => setForm((f) => ({ ...f, title: v }))} placeholder="Event title" />
                <Input label="Description" value={form.description} onChangeText={(v) => setForm((f) => ({ ...f, description: v }))} placeholder="Brief description..." multiline numberOfLines={3} />
                <View>
                  <Text style={s.label}>Event Type</Text>
                  <Pressable style={s.selectBtn} onPress={() => setTypePickerOpen(true)}>
                    <Text style={s.selectText}>{form.event_type}</Text>
                    <MaterialIcons name="arrow-drop-down" size={20} color={Colors.textSecondary} />
                  </Pressable>
                </View>
                <Input label="Start (YYYY-MM-DDTHH:MM)" value={form.start_at} onChangeText={(v) => setForm((f) => ({ ...f, start_at: v }))} placeholder="2025-06-15T09:00" />
                <Input label="End (YYYY-MM-DDTHH:MM)" value={form.end_at} onChangeText={(v) => setForm((f) => ({ ...f, end_at: v }))} placeholder="2025-06-15T11:00" />
                <Input label="Location" value={form.location} onChangeText={(v) => setForm((f) => ({ ...f, location: v }))} placeholder="e.g. School Hall" />
                <View>
                  <Text style={s.label}>Audience</Text>
                  <Pressable style={s.selectBtn} onPress={() => setAudPickerOpen(true)}>
                    <Text style={s.selectText}>{form.audience}</Text>
                    <MaterialIcons name="arrow-drop-down" size={20} color={Colors.textSecondary} />
                  </Pressable>
                </View>
                <Button label="Create Event" onPress={handleCreate} fullWidth loading={saving} size="lg" />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={typePickerOpen} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={s.overlay}>
          <View style={s.modal}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>Event Type</Text>
              <Pressable onPress={() => setTypePickerOpen(false)} hitSlop={8}>
                <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
              </Pressable>
            </View>
            <ScrollView>
              {EVENT_TYPES.map((t) => (
                <Pressable
                  key={t}
                  style={[s.pickItem, form.event_type === t && s.pickItemActive]}
                  onPress={() => { setForm((f) => ({ ...f, event_type: t })); setTypePickerOpen(false); }}
                >
                  <Text style={[s.pickItemText, form.event_type === t && s.pickItemTextActive]}>{t}</Text>
                  {form.event_type === t ? <MaterialIcons name="check" size={20} color={Colors.primary} /> : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={audPickerOpen} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={s.overlay}>
          <View style={s.modal}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>Audience</Text>
              <Pressable onPress={() => setAudPickerOpen(false)} hitSlop={8}>
                <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
              </Pressable>
            </View>
            <ScrollView>
              {AUDIENCES.map((a) => (
                <Pressable
                  key={a}
                  style={[s.pickItem, form.audience === a && s.pickItemActive]}
                  onPress={() => { setForm((f) => ({ ...f, audience: a })); setAudPickerOpen(false); }}
                >
                  <Text style={[s.pickItemText, form.audience === a && s.pickItemTextActive]}>{a}</Text>
                  {form.audience === a ? <MaterialIcons name="check" size={20} color={Colors.primary} /> : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 100 },
  card: { gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  dateBox: { width: 48, height: 48, borderRadius: BorderRadius.md, backgroundColor: '#00897B' + '20', alignItems: 'center', justifyContent: 'center' },
  dateDay: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: '#00897B' },
  dateMon: { fontSize: FontSize.xs, color: '#00897B', textTransform: 'uppercase' },
  title: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary, flex: 1 },
  datetime: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  location: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  desc: { fontSize: FontSize.sm, color: Colors.textSecondary },
  audience: { fontSize: FontSize.xs, color: Colors.textMuted, fontStyle: 'italic' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, maxHeight: '88%' },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  form: { gap: Spacing.md, paddingBottom: Spacing.xl },
  label: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium, marginBottom: 6 },
  selectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface2, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, minHeight: 48 },
  selectText: { color: Colors.textPrimary, fontSize: FontSize.base, flex: 1, textTransform: 'capitalize' },
  pickItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  pickItemActive: { backgroundColor: Colors.infoBg },
  pickItemText: { fontSize: FontSize.base, color: Colors.textPrimary, textTransform: 'capitalize' },
  pickItemTextActive: { color: Colors.primary, fontWeight: FontWeight.semibold },
});
