import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BottomNav } from '@/components/layout/BottomNav';
import { Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
const NAV = [{ label: 'Library', icon: 'local-library' as const, route: '/(librarian)/' }, { label: 'Books', icon: 'menu-book' as const, route: '/(librarian)/books' }, { label: 'Borrow', icon: 'import-contacts' as const, route: '/(librarian)/borrow' }];
export default function LibrarianBorrow() { return <View style={s.flex}><View style={s.center}><MaterialIcons name="import-contacts" size={56} color={Colors.textMuted} /><Text style={s.title}>Borrow / Return</Text><Text style={s.sub}>Borrow records visible on the Library dashboard.</Text></View><BottomNav items={NAV} accentColor="#E65100" /></View>; }
const s = StyleSheet.create({ flex: { flex: 1, backgroundColor: Colors.background }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md }, title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary }, sub: { fontSize: FontSize.base, color: Colors.textMuted, textAlign: 'center', paddingHorizontal: 40 } });
