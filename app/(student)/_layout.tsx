import { Stack } from 'expo-router';
import { RequireRole } from '@/components/auth/RequireRole';

export default function StudentLayout() {
  return (
    <RequireRole allowed={[student'] as any}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="assignments" />
        <Stack.Screen name="grades" />
        <Stack.Screen name="ai-assistant" />
      </Stack>
    </RequireRole>
  );
}
