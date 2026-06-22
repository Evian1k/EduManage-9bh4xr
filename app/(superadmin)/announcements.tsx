import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Modal, Pressable } from 'react-native';
import { useAuth, useAlert } from '@/template';
import { getPlatformAnnouncements, createPlatformAnnouncement } from '@/services/platform.service';
import { BottomNav } from '@/components/layout/BottomNav';

const SUPER_ADMIN_NAV = [
  { label: 'Dashboard', icon: 'dashboard' as const, route: '/(superadmin)/' },
  { label: 'Schools', icon: 'business' as const, route: '/(superadmin)/schools' },
  { label: 'Revenue', icon: 'attach-money' as const, route: '/(superadmin)/revenue' },
  { label: 'Support', icon: 'support-agent' as const, route: '/(superadmin)/support' },
  { label: 'Announce', icon: 'campaign' as const, route: '/(superadmin)/announcements' },
];
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Header } from '@/components/layout/Header';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { formatDate } from '@/constants/config';

export default function AnnouncementsScreen() {
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const { data } = await getPlatformAnnouncements();
    setAnnouncements(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!title.trim() || !content.trim()) {
      showAlert('Missing Fields', 'Please fill in the title and content.');
      return;
    }
    if (!user) return;
    setCreating(true);
    const { error } = await createPlatformAnnouncement(title.trim(), content.trim(), user.id);
    setCreating(false);
    if (error) {
      showAlert('Error', error.message);
      return;
    }
    setTitle('');
    setContent('');
    setShowCreate(false);
    load();
    showAlert('Sent', 'Announcement sent to all schools.');
  };

  if (loading) return <LoadingScreen message="Loading announcements..." />;

  return (
    <View style={styles.flex}>
      <Header
        title="Announcements"
        subtitle="Platform-wide messages"
        accentColor={Colors.superAdmin}
        rightAction={{ icon: 'add', onPress: () => setShowCreate(true) }}
      />
      <FlatList
        data={announcements}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="campaign"
            title="No Announcements"
            description="Send platform-wide announcements to all schools."
            actionLabel="Create Announcement"
            onAction={() => setShowCreate(true)}
          />
        }
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconBg}>
                <MaterialIcons name="campaign" size={18} color={Colors.superAdmin} />
              </View>
              <View style={styles.cardTitleArea}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardDate}>{formatDate(item.created_at)}</Text>
              </View>
              {item.is_pinned ? <MaterialIcons name="push-pin" size={16} color={Colors.superAdmin} /> : null}
            </View>
            <Text style={styles.cardContent}>{item.content}</Text>
            <View style={styles.cardFooter}>
              <View style={styles.platformBadge}>
                <MaterialIcons name="public" size={12} color={Colors.superAdmin} />
                <Text style={styles.platformBadgeText}>Platform-Wide</Text>
              </View>
            </View>
          </Card>
        )}
      />

      <Modal visible={showCreate} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Announcement</Text>
              <Pressable onPress={() => setShowCreate(false)} hitSlop={8}>
                <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
              </Pressable>
            </View>
            <View style={styles.form}>
              <Input label="Title" value={title} onChangeText={setTitle} placeholder="Announcement title" />
              <Input
                label="Message"
                value={content}
                onChangeText={setContent}
                placeholder="Write your announcement..."
                multiline
                numberOfLines={5}
                style={{ height: 120, textAlignVertical: 'top' }}
              />
              <View style={styles.formFooter}>
                <View style={styles.audienceBadge}>
                  <MaterialIcons name="public" size={14} color={Colors.textSecondary} />
                  <Text style={styles.audienceText}>Sent to all registered schools</Text>
                </View>
                <Button label="Send Announcement" onPress={handleCreate} fullWidth loading={creating} />
              </View>
            </View>
          </View>
        </View>
      </Modal>
      <BottomNav items={SUPER_ADMIN_NAV} accentColor={Colors.superAdmin} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 100 },
  card: { gap: Spacing.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  iconBg: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.superAdminBg, alignItems: 'center', justifyContent: 'center',
  },
  cardTitleArea: { flex: 1 },
  cardTitle: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  cardDate: { fontSize: FontSize.xs, color: Colors.textMuted },
  cardContent: { fontSize: FontSize.base, color: Colors.textSecondary, lineHeight: 22 },
  cardFooter: { flexDirection: 'row', justifyContent: 'flex-end' },
  platformBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.superAdminBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  platformBadgeText: { fontSize: FontSize.xs, color: Colors.superAdmin, fontWeight: FontWeight.medium },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  form: { gap: Spacing.md },
  formFooter: { gap: Spacing.sm },
  audienceBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.infoBg, padding: Spacing.sm, borderRadius: BorderRadius.sm },
  audienceText: { fontSize: FontSize.sm, color: Colors.textSecondary },
});
