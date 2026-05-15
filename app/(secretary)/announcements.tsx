// Stub screens for new role groups
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BottomNav } from '@/components/layout/BottomNav';
import { Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';

const NAV = [
  { label: 'Reception', icon: 'desk' as const, route: '/(secretary)/' },
  { label: 'Announce', icon: 'campaign' as const, route: '/(secretary)/announcements' },
  { label: 'Visitors', icon: 'badge' as const, route: '/(secretary)/visitors' },
  { label: 'Events', icon: 'event' as const, route: '/(secretary)/events' },
  { label: 'Messages', icon: 'mail' as const, route: '/(secretary)/messages' },
];

function ComingSoon({ title, icon }: { title: string; icon: string }) {
  return (
    <View style={s.flex}>
      <View style={s.center}>
        <MaterialIcons name={icon as any} size={56} color={Colors.textMuted} />
        <Text style={s.title}>{title}</Text>
        <Text style={s.sub}>This screen is being built.</Text>
      </View>
      <BottomNav items={NAV} accentColor="#00897B" />
    </View>
  );
}

export default function SecretaryAnnouncements() {
  return <ComingSoon title="Announcements" icon="campaign" />;
}
const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  sub: { fontSize: FontSize.base, color: Colors.textMuted },
});
