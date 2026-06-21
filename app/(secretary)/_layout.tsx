import { Stack } from 'expo-router';
import { RequireRole } from '@/components/auth/RequireRole';

export default function SecretaryLayout() {
  return (
    <RequireRole allowed={[secretary, school_owner, principal, administrator'] as any}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="announcements" />
        <Stack.Screen name="visitors" />
        <Stack.Screen name="events" />
        <Stack.Screen name="messages" />
      </Stack>
    </RequireRole>
  );
}
