import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BottomNav } from '@/components/layout/BottomNav';
import { Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
const NAV = [{ label: 'Finance', icon: 'account-balance' as const, route: '/(bursar)/' }, { label: 'Payments', icon: 'payments' as const, route: '/(bursar)/payments' }, { label: 'Fees', icon: 'receipt-long' as const, route: '/(bursar)/fees' }, { label: 'Reports', icon: 'bar-chart' as const, route: '/(bursar)/reports' }];
export default function BursarReports() { return <View style={s.flex}><View style={s.center}><MaterialIcons name="bar-chart" size={56} color={Colors.textMuted} /><Text style={s.title}>Financial Reports</Text><Text style={s.sub}>PDF export reports coming soon.</Text></View><BottomNav items={NAV} accentColor="#43A047" /></View>; }
const s = StyleSheet.create({ flex: { flex: 1, backgroundColor: Colors.background }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md }, title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary }, sub: { fontSize: FontSize.base, color: Colors.textMuted, textAlign: 'center', paddingHorizontal: 40 } });
