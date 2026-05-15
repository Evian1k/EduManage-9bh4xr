import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BottomNav } from '@/components/layout/BottomNav';
import { Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
const NAV = [{ label: 'Reception', icon: 'desk' as const, route: '/(secretary)/' }, { label: 'Announce', icon: 'campaign' as const, route: '/(secretary)/announcements' }, { label: 'Visitors', icon: 'badge' as const, route: '/(secretary)/visitors' }, { label: 'Events', icon: 'event' as const, route: '/(secretary)/events' }, { label: 'Messages', icon: 'mail' as const, route: '/(secretary)/messages' }];
export default function SecretaryEvents() {
  return <View style={s.flex}><View style={s.center}><MaterialIcons name="event" size={56} color={Colors.textMuted} /><Text style={s.title}>School Events</Text><Text style={s.sub}>Events visible on the Reception dashboard.</Text></View><BottomNav items={NAV} accentColor="#00897B" /></View>;
}
const s = StyleSheet.create({ flex: { flex: 1, backgroundColor: Colors.background }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md }, title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary }, sub: { fontSize: FontSize.base, color: Colors.textMuted, textAlign: 'center', paddingHorizontal: 40 } });
