import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };
  static getDerivedStateFromError(error: Error): State { return { hasError: true, error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('[ErrorBoundary]', error, info.componentStack); }
  reset = () => this.setState({ hasError: false, error: null });
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={s.c}><ScrollView contentContainerStyle={s.s}>
        <MaterialIcons name="error-outline" size={64} color="#EF4444" />
        <Text style={s.t}>Something went wrong</Text>
        <Text style={s.sub}>An unexpected error occurred. You can try again or restart the app.</Text>
        {this.state.error && <View style={s.b}><Text style={s.e}>{this.state.error.message}</Text></View>}
        <Pressable style={s.btn} onPress={this.reset}><MaterialIcons name="refresh" size={18} color="#0B1426" /><Text style={s.bt}>Try Again</Text></Pressable>
      </ScrollView></View>
    );
  }
}
const s = StyleSheet.create({ c:{flex:1,backgroundColor:'#0B1426'}, s:{flexGrow:1,justifyContent:'center',alignItems:'center',padding:20,gap:16}, t:{fontSize:22,fontWeight:'700',color:'#FFFFFF',textAlign:'center'}, sub:{fontSize:14,color:'#9CA3AF',textAlign:'center',lineHeight:22}, b:{backgroundColor:'#1A2332',borderRadius:8,padding:12,borderWidth:1,borderColor:'#2A3548',width:'100%'}, e:{fontSize:12,color:'#EF4444',fontFamily:'monospace'}, btn:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:'#FFD700',paddingHorizontal:20,paddingVertical:12,borderRadius:8}, bt:{color:'#0B1426',fontWeight:'700'} });
