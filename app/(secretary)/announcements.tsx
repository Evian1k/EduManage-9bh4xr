// Secretary: Announcement CRUD — create modal + FlatList + long-press delete
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Modal, Pressable, ScrollView, RefreshControl, TextInput,
} from 'react-native';
import { useAppContext } from '@/hooks/useAppContext';
import {
  getAnnouncements, createAnnouncement, deleteAnnouncement, Announcement,
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

const CATEGORIES = ['general', 'urgent', 'academic', 'event', 'sports', 'holiday', 'meeting'];
const AUDIENCES = ['all', 'parents', 'staff', 'students', 'teachers'];

export default function SecretaryAnnouncementsScreen() {
  const { showAlert } = useAlert();
  const { school, profileId } = useAppContext();
  const schoolId = school?.id;
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [catPickerOpen, setCatPickerOpen] = useState(false);
  const [audPickerOpen, setAudPickerOpen] = useState(false);
  const [form, setForm] = useState({ title: '', body: '', category: 'general', audience: 'all', is_pinned: false });

  const load = useCallback(async () => {
    if (!schoolId) return;
    const { data, error } = await getAnnouncements(schoolId, { limit: 200 });
    if (error) showAlert('Error', error);
    setItems(data || []);
    setLoading(false);
    setRefreshing(false);
  }, [schoolId]);

  useEffect(() => { if (schoolId) load(); }, [schoolId]);

  const handleCreate = async () => {
    if (!form.title.trim() || !form.body.trim() || !schoolId) {
      showAlert('Missing Fields', 'Title and body are required.');
      return;
    }
    setSaving(true);
    const { error } = await createAnnouncement(schoolId, {
      title: form.title.trim(),
      body: form.body.trim(),
      category: form.category,
      audience: form.audience,
      created_by: profileId || undefined,
      is_pinned: form.is_pinned,
    });
    setSaving(false);
    if (error) { showAlert('Error', error); return; }
    setShowModal(false);
    setForm({ title: '', body: '', category: 'general', audience: 'all', is_pinned: false });
    load();
  };

  const handleDelete = (a: Announcement) => {
    showAlert('Delete Announcement', `Delete "${a.title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        if (!schoolId) return;
        const { error } = await deleteAnnouncement(schoolId, a.id);
        if (error) { showAlert('Error', error); return; }
        load();
      } },
    ]);
  };

  if (!schoolId) return <LoadingScreen />;
  if (loading) return <LoadingScreen message="Loading announcements..." />;

  return (
    <View style={s.flex}>
      <Header
        title="Announcements"
        subtitle={`${items.length} posted`}
        showBack
        accentColor="#00897B"
        rightAction={{ icon: 'add', onPress: () => setShowModal(true) }}
      />
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} colors={[Colors.primary]} />}
        ListEmptyComponent={<EmptyState icon="campaign" title="No Announcements" description="Create your first announcement." actionLabel="New Announcement" onAction={() => setShowModal(true)} />}
        renderItem={({ item }) => (
          <Card style={s.card} onLongPress={() => handleDelete(item)} delayLongPress={500}>
            <View style={s.row}>
              <View style={s.icon}>
                <MaterialIcons name={item.is_pinned ? 'push-pin' : 'campaign'} size={18} color={item.is_pinned ? Colors.warning : '#00897B'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.title} numberOfLines={1}>{item.title}{item.is_pinned ? ' 📌' : ''}</Text>
                <Text style={s.date}>{new Date(item.published_at || item.created_at).toLocaleString()}</Text>
              </View>
              <Pressable onPress={() => handleDelete(item)} hitSlop={8}>
                <MaterialIcons name="delete-outline" size={20} color={Colors.error} />
              </Pressable>
            </View>
            <Text style={s.body} numberOfLines={3}>{item.body}</Text>
            <View style={s.badgeRow}>
              {item.category ? <Badge label={item.category} variant="info" size="sm" /> : null}
              {item.audience ? <Badge label={`to: ${item.audience}`} variant="default" size="sm" /> : null}
            </View>
          </Card>
        )}
      />

      <Modal visible={showModal} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={s.overlay}>
          <View style={s.modal}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>New Announcement</Text>
              <Pressable onPress={() => setShowModal(false)} hitSlop={8}>
                <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={s.form}>
                <Input label="Title *" value={form.title} onChangeText={(v) => setForm((f) => ({ ...f, title: v }))} placeholder="Announcement title" />
                <View>
                  <Text style={s.label}>Body *</Text>
                  <TextInput
                    style={[s.input, s.textarea]}
                    value={form.body}
                    onChangeText={(v) => setForm((f) => ({ ...f, body: v }))}
                    placeholder="Write the announcement..."
                    placeholderTextColor={Colors.textMuted}
                    multiline
                    numberOfLines={5}
                    textAlignVertical="top"
                  />
                </View>
                <View>
                  <Text style={s.label}>Category</Text>
                  <Pressable style={s.selectBtn} onPress={() => setCatPickerOpen(true)}>
                    <Text style={s.selectText}>{form.category}</Text>
                    <MaterialIcons name="arrow-drop-down" size={20} color={Colors.textSecondary} />
                  </Pressable>
                </View>
                <View>
                  <Text style={s.label}>Audience</Text>
                  <Pressable style={s.selectBtn} onPress={() => setAudPickerOpen(true)}>
                    <Text style={s.selectText}>{form.audience}</Text>
                    <MaterialIcons name="arrow-drop-down" size={20} color={Colors.textSecondary} />
                  </Pressable>
                </View>
                <Pressable style={s.checkRow} onPress={() => setForm((f) => ({ ...f, is_pinned: !f.is_pinned }))}>
                  <MaterialIcons name={form.is_pinned ? 'check-box' : 'check-box-outline-blank'} size={22} color={form.is_pinned ? Colors.primary : Colors.textMuted} />
                  <Text style={s.checkLabel}>Pin to top</Text>
                </Pressable>
                <Button label="Publish Announcement" onPress={handleCreate} fullWidth loading={saving} size="lg" />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={catPickerOpen} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={s.overlay}>
          <View style={s.modal}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>Select Category</Text>
              <Pressable onPress={() => setCatPickerOpen(false)} hitSlop={8}>
                <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
              </Pressable>
            </View>
            <ScrollView>
              {CATEGORIES.map((c) => (
                <Pressable
                  key={c}
                  style={[s.pickItem, form.category === c && s.pickItemActive]}
                  onPress={() => { setForm((f) => ({ ...f, category: c })); setCatPickerOpen(false); }}
                >
                  <Text style={[s.pickItemText, form.category === c && s.pickItemTextActive]}>{c}</Text>
                  {form.category === c ? <MaterialIcons name="check" size={20} color={Colors.primary} /> : null}
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
              <Text style={s.modalTitle}>Select Audience</Text>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.infoBg, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary, flex: 1 },
  date: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  body: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, maxHeight: '88%' },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  form: { gap: Spacing.md, paddingBottom: Spacing.xl },
  label: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium, marginBottom: 6 },
  input: { backgroundColor: Colors.surface2, borderRadius: BorderRadius.md, padding: Spacing.md, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border, fontSize: FontSize.base },
  textarea: { minHeight: 120, textAlignVertical: 'top' },
  selectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface2, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, minHeight: 48 },
  selectText: { color: Colors.textPrimary, fontSize: FontSize.base, flex: 1, textTransform: 'capitalize' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  checkLabel: { fontSize: FontSize.base, color: Colors.textPrimary },
  pickItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  pickItemActive: { backgroundColor: Colors.infoBg },
  pickItemText: { fontSize: FontSize.base, color: Colors.textPrimary, textTransform: 'capitalize' },
  pickItemTextActive: { color: Colors.primary, fontWeight: FontWeight.semibold },
});
