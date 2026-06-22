import { Stack } from 'expo-router';
import { RequireRole } from '@/components/auth/RequireRole';

export default function ParentLayout() {
  return (
    <RequireRole allowed={['parent'] as any}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="children" />
        <Stack.Screen name="grades" />
        <Stack.Screen name="attendance" />
        <Stack.Screen name="fees" />
        <Stack.Screen name="messages" />
        <Stack.Screen name="announcements" />
      </Stack>
    </RequireRole>
  );
}
