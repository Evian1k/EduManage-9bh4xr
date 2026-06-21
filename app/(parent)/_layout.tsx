import { Stack } from 'expo-router';
import { RequireRole } from '@/components/auth/RequireRole';
export default function ParentLayout() {
  return (<RequireRole allowed={['parent'] as any}><Stack screenOptions={{ headerShown: false }}><Stack.Screen name="index" /></Stack></RequireRole>);
}
