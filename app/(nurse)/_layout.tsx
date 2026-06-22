import { Stack } from 'expo-router';
import { RequireRole } from '@/components/auth/RequireRole';

export default function NurseLayout() {
  return (
    <RequireRole allowed={['nurse', 'school_owner', 'principal', 'administrator'] as any}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="visits" />
        <Stack.Screen name="records" />
      </Stack>
    </RequireRole>
  );
}
