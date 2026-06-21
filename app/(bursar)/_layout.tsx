import { Stack } from 'expo-router';
import { RequireRole } from '@/components/auth/RequireRole';

export default function BursarLayout() {
  return (
    <RequireRole allowed={['bursar', 'school_owner', 'principal', 'administrator'] as any}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="payments" />
        <Stack.Screen name="fees" />
        <Stack.Screen name="reports" />
        <Stack.Screen name="invoices" />
        <Stack.Screen name="receipts" />
        <Stack.Screen name="scholarships" />
      </Stack>
    </RequireRole>
  );
}
