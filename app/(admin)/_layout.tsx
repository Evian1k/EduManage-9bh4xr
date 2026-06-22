import { Stack } from 'expo-router';
import { RequireRole } from '@/components/auth/RequireRole';

export default function AdminLayout() {
  return (
    <RequireRole allowed={['school_owner', 'principal', 'deputy_principal', 'administrator', 'ict_manager'] as any}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="students" />
        <Stack.Screen name="teachers" />
        <Stack.Screen name="classes" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="finance" />
        <Stack.Screen name="timetable" />
        <Stack.Screen name="analytics" />
        <Stack.Screen name="academic" />
        <Stack.Screen name="staff" />
        <Stack.Screen name="invitations" />
        <Stack.Screen name="domains" />
        <Stack.Screen name="subscription" />
        <Stack.Screen name="hr" />
        <Stack.Screen name="payroll" />
        <Stack.Screen name="leave" />
        <Stack.Screen name="transport" />
        <Stack.Screen name="boarding" />
      </Stack>
    </RequireRole>
  );
}
