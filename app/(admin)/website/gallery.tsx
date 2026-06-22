import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Modal, ScrollView } from 'react-native';
import { useAppContext } from '@/hooks/useAppContext';
import { useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';

const SECTION_TITLE = "Gallery";
const TABLE_NAME = "website_gallery";

export default function WebsiteSectionPage() {
  const { school } = useAppContext();
  const { showAlert } = useAlert();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({});

  const load = useCallback(async () => {
    if (!school) return;
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from(TABLE_NAME).select("*").eq("school_id", school.id).order("created_at", { ascending: false });
    if (error) { console.warn("Load error:", error.message); }
    setItems(Array.isArray(data) ? data : (data ? [data] : []));
    setLoading(false);
  }, [school]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const handleSave = async () => {
    if (!school) return;
    const supabase = getSupabaseClient();
    const { error } = await supabase.from(TABLE_NAME).insert({ school_id: school.id, ...form });
    if (error) { showAlert("Error", error.message); return; }
    setShowForm(false);
    setForm({});
    load();
    showAlert("Saved", "Item added successfully!");
  };

  const handleDelete = async (id: string) => {
    if (!school) return;
    const supabase = getSupabaseClient();
    await supabase.from(TABLE_NAME).delete().eq("id", id).eq("school_id", school.id);
    load();
  };

  if (!school) return <LoadingScreen />;
  if (loading) return <LoadingScreen message={"Loading " + SECTION_TITLE + "..."} />;

  return (
    <SafeAreaView style={s.flex} edges={["bottom"]}>
      <Header title={SECTION_TITLE} subtitle={school.name} showBack accentColor={Colors.secondary} rightAction={{ icon: "add", onPress: () => setShowForm(true) }} />
      <FlatList
        data={items}
        keyExtractor={(item, i) => item.id || i.toString()}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        renderItem={({ item }) => (
          <Card style={s.card}>
            <View style={s.cardRow}>
              <View style={s.cardInfo}>
                <Text style={s.cardTitle}>{item.title || item.full_name || item.author_name || item.label || item.name || "Item"}</Text>
                {item.category && <Badge label={item.category} size="sm" />}
                {item.position && <Text style={s.cardSub}>{item.position}</Text>}
                {item.description && <Text style={s.cardSub} numberOfLines={2}>{item.description}</Text>}
                {item.quote && <Text style={s.cardSub} numberOfLines={2}>“{item.quote}”</Text>}
                {item.excerpt && <Text style={s.cardSub} numberOfLines={2}>{item.excerpt}</Text>}
                {item.value && <Text style={s.cardSub}>{item.value}</Text>}
                {item.footer_text && <Text style={s.cardSub}>{item.footer_text}</Text>}
                {item.site_title && <Text style={s.cardSub}>{item.site_title}</Text>}
              </View>
              <Pressable onPress={() => handleDelete(item.id)}>
                <Text style={s.delete}>Delete</Text>
              </Pressable>
            </View>
          </Card>
        )}
        ListEmptyComponent={<EmptyState icon="article" title="No items yet" description={"Add " + SECTION_TITLE.toLowerCase() + " to get started"} />}
      />
      <Modal visible={showForm} transparent animationType="slide" onRequestClose={() => setShowForm(false)}>
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Add {SECTION_TITLE}</Text>
            <ScrollView style={s.modalForm}>
              <Input label="Title / Name" value={form.title || form.full_name || form.author_name || form.label || ""} onChangeText={(v) => setForm({ ...form, title: v, full_name: v, author_name: v, label: v })} />
              <Input label="Description / Body" value={form.description || form.body || form.quote || form.bio || form.excerpt || form.intro_text || form.site_description || ""} onChangeText={(v) => setForm({ ...form, description: v, body: v, quote: v, bio: v, excerpt: v, intro_text: v, site_description: v })} multiline />
              <Input label="Category" value={form.category || ""} onChangeText={(v) => setForm({ ...form, category: v })} />
              <Input label="Image URL" value={form.image_url || form.photo_url || ""} onChangeText={(v) => setForm({ ...form, image_url: v, photo_url: v })} />
            </ScrollView>
            <View style={s.actions}>
              <Button label="Cancel" variant="ghost" onPress={() => setShowForm(false)} />
              <Button label="Save" onPress={handleSave} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.md, gap: Spacing.sm },
  card: { padding: Spacing.md },
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  cardSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4 },
  delete: { color: Colors.error, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", padding: Spacing.lg },
  modal: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.lg, maxHeight: "80%" },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.md },
  modalForm: { gap: Spacing.md, marginBottom: Spacing.md },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: Spacing.sm },
});
