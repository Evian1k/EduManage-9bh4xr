import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/layout/Header';
import { Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';
export default function BoardingDashboard() {
  return (<SafeAreaView style={s.f} edges={['bottom']}><Header title="Boarding Dashboard" subtitle="EduManage" accentColor={Colors.primary} /><View style={s.c}><Text style={s.t}>Boarding Management</Text><Text style={s.sub}>Manage dormitories, beds, and attendance.</Text></View></SafeAreaView>);
}
const s = StyleSheet.create({ f:{flex:1,backgroundColor:Colors.background}, c:{flex:1,justifyContent:'center',alignItems:'center',padding:20,gap:12}, t:{fontSize:FontSize.xl,fontWeight:FontWeight.bold,color:Colors.textPrimary}, sub:{fontSize:FontSize.base,color:Colors.textSecondary,textAlign:'center'} });
