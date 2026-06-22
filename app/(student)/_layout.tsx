import { Stack } from 'expo-router';
import { RequireRole } from '@/components/auth/RequireRole';

export default function StudentLayout() {
  return (
    <RequireRole allowed={['student'] as any}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="assignments" />
        <Stack.Screen name="grades" />
        <Stack.Screen name="attendance" />
        <Stack.Screen name="timetable" />
        <Stack.Screen name="fees" />
        <Stack.Screen name="library" />
        <Stack.Screen name="ai-assistant" />
        <Stack.Screen name="quizzes" />
        <Stack.Screen name="resources" />
      </Stack>
    </RequireRole>
  );
}
