import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BottomNav } from '@/components/layout/BottomNav';
import { Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
const NAV = [{ label: 'Dashboard', icon: 'dashboard' as const, route: '/(ict)/' }, { label: 'Users', icon: 'manage-accounts' as const, route: '/(ict)/users' }, { label: 'Logs', icon: 'list-alt' as const, route: '/(ict)/logs' }, { label: 'Settings', icon: 'settings' as const, route: '/(ict)/settings' }];
export default function ICTUsers() { return <View style={s.flex}><View style={s.center}><MaterialIcons name="manage-accounts" size={56} color={Colors.textMuted} /><Text style={s.title}>User Management</Text><Text style={s.sub}>Full user management on ICT dashboard.</Text></View><BottomNav items={NAV} accentColor="#7B1FA2" /></View>; }
const s = StyleSheet.create({ flex: { flex: 1, backgroundColor: Colors.background }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md }, title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary }, sub: { fontSize: FontSize.base, color: Colors.textMuted, textAlign: 'center', paddingHorizontal: 40 } });
