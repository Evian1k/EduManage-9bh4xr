import { Stack } from 'expo-router';
import { RequireRole } from '@/components/auth/RequireRole';

export default function AdminLayout() {
  return (
    <RequireRole allowed={[school_owner, principal, deputy_principal, administrator'] as any}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="students" />
        <Stack.Screen name="teachers" />
        <Stack.Screen name="classes" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="finance" />
        <Stack.Screen name="timetable" />
      </Stack>
    </RequireRole>
  );
}
