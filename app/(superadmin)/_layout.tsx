import { Stack } from 'expo-router';
import { RequireRole } from '@/components/auth/RequireRole';

export default function SuperAdminLayout() {
  return (
    <RequireRole allowed={['platform_admin'] as any}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="schools" />
        <Stack.Screen name="revenue" />
        <Stack.Screen name="support" />
        <Stack.Screen name="announcements" />
        <Stack.Screen name="audit" />
        <Stack.Screen name="subscriptions" />
      </Stack>
    </RequireRole>
  );
}
