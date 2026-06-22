import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useAppContext } from '@/hooks/useAppContext';
import { getTheme, initializeWebsite, publishWebsite, unpublishWebsite } from '@/services/website.service';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';

const SECTIONS = [
  { key: 'pages', label: 'Pages', icon: 'article' as const, desc: 'Edit website pages' },
  { key: 'news', label: 'News', icon: 'feed' as const, desc: 'Publish news articles' },
  { key: 'events', label: 'Events', icon: 'event' as const, desc: 'Manage upcoming events' },
  { key: 'gallery', label: 'Gallery', icon: 'photo-library' as const, desc: 'Upload photos' },
  { key: 'staff', label: 'Staff', icon: 'people' as const, desc: 'Public staff directory' },
  { key: 'admissions', label: 'Admissions', icon: 'school' as const, desc: 'Admission info & fees' },
  { key: 'testimonials', label: 'Testimonials', icon: 'format-quote' as const, desc: 'Parent & student reviews' },
  { key: 'stats', label: 'Statistics', icon: 'bar-chart' as const, desc: 'School stats display' },
  { key: 'careers', label: 'Careers', icon: 'work' as const, desc: 'Job postings' },
  { key: 'seo', label: 'SEO', icon: 'search' as const, desc: 'Meta tags & analytics' },
  { key: 'theme', label: 'Theme', icon: 'palette' as const, desc: 'Colors & branding' },
];

export default function WebsiteDashboard() {
  const router = useRouter();
  const { school } = useAppContext();
  const [theme, setTheme] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!school) return;
    const { data } = await getTheme(school.id);
    setTheme(data);
    if (!data) {
      // Auto-initialize website
      await initializeWebsite(school.id, school.name);
      const { data: t2 } = await getTheme(school.id);
      setTheme(t2);
    }
    setLoading(false);
  }, [school]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (!school) return <LoadingScreen />;
  if (loading) return <LoadingScreen message="Loading website..." />;

  const websiteUrl = `${school.subdomain}.edumanage.com`;

  return (
    <SafeAreaView style={s.flex} edges={['bottom']}>
      <Header title="Website Builder" subtitle={school.name} showBack accentColor={Colors.secondary} rightAction={{ icon: 'launch', onPress: () => Alert.alert('Website URL', `${websiteUrl}\n\n${theme?.is_published ? 'Live' : 'Not published yet'}`) }} />
      <ScrollView contentContainerStyle={s.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}>
        <Card style={s.statusCard}>
          <View style={s.statusRow}>
            <View>
              <Text style={s.url}>{websiteUrl}</Text>
              <Text style={s.status}>{theme?.is_published ? 'Website is live' : 'Website not published'}</Text>
            </View>
            <Badge label={theme?.is_published ? 'LIVE' : 'DRAFT'} variant={theme?.is_published ? 'success' : 'warning'} />
          </View>
          <View style={s.colorRow}>
            <View style={[s.colorDot, { backgroundColor: theme?.primary_color || Colors.primary }]} />
            <View style={[s.colorDot, { backgroundColor: theme?.secondary_color || Colors.background }]} />
            <View style={[s.colorDot, { backgroundColor: theme?.accent_color || '#FFD700' }]} />
          </View>
          <Button label={theme?.is_published ? 'Unpublish' : 'Publish Website'} variant={theme?.is_published ? 'danger' : 'primary'} onPress={async () => {
            if (theme?.is_published) { await unpublishWebsite(school.id); }
            else { await publishWebsite(school.id); }
            load();
          }} fullWidth />
        </Card>

        <Text style={s.sectionTitle}>Manage Website</Text>
        <View style={s.grid}>
          {SECTIONS.map((section) => (
            <Pressable key={section.key} style={({ pressed }) => [s.sectionCard, pressed && s.pressed]} onPress={() => router.push(`/(admin)/website/${section.key}` as any)}>
              <View style={[s.sectionIcon, { backgroundColor: `${Colors.secondary}15` }]}>
                <MaterialIcons name={section.icon} size={24} color={Colors.secondary} />
              </View>
              <Text style={s.sectionLabel}>{section.label}</Text>
              <Text style={s.sectionDesc}>{section.desc}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: { padding: Spacing.md, gap: Spacing.md },
  statusCard: { gap: Spacing.md },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  url: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  status: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4 },
  colorRow: { flexDirection: 'row', gap: 8 },
  colorDot: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: Colors.border },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginTop: Spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  sectionCard: { width: '48%', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: 6, borderWidth: 1, borderColor: Colors.border },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  sectionIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  sectionDesc: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 16 },
});
