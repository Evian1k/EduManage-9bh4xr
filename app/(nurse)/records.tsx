import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BottomNav } from '@/components/layout/BottomNav';
import { Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
const NAV = [{ label: 'Clinic', icon: 'local-hospital' as const, route: '/(nurse)/' }, { label: 'Visits', icon: 'healing' as const, route: '/(nurse)/visits' }, { label: 'Records', icon: 'folder-shared' as const, route: '/(nurse)/records' }];
export default function NurseRecords() { return <View style={s.flex}><View style={s.center}><MaterialIcons name="folder-shared" size={56} color={Colors.textMuted} /><Text style={s.title}>Medical Records</Text><Text style={s.sub}>Full student medical records feature coming soon.</Text></View><BottomNav items={NAV} accentColor="#D32F2F" /></View>; }
const s = StyleSheet.create({ flex: { flex: 1, backgroundColor: Colors.background }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md }, title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary }, sub: { fontSize: FontSize.base, color: Colors.textMuted, textAlign: 'center', paddingHorizontal: 40 } });
