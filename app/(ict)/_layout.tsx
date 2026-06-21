import { Stack } from 'expo-router';
import { RequireRole } from '@/components/auth/RequireRole';

export default function IctLayout() {
  return (
    <RequireRole allowed={[ict_manager, school_owner, platform_admin'] as any}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="users" />
        <Stack.Screen name="logs" />
        <Stack.Screen name="settings" />
      </Stack>
    </RequireRole>
  );
}
