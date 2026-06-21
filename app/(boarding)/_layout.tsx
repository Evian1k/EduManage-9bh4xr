import { Stack } from 'expo-router';
import { RequireRole } from '@/components/auth/RequireRole';
export default function BoardingLayout() {
  return (<RequireRole allowed={['boarding_master','boarding_mistress','school_owner','principal','administrator'] as any}><Stack screenOptions={{ headerShown: false }}><Stack.Screen name="index" /></Stack></RequireRole>);
}
