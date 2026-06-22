import { Stack } from 'expo-router';
import { RequireRole } from '@/components/auth/RequireRole';

export default function TeacherLayout() {
  return (
    <RequireRole allowed={['teacher', 'school_owner', 'principal', 'deputy_principal', 'administrator'] as any}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="assignments" />
        <Stack.Screen name="grades" />
        <Stack.Screen name="attendance" />
        <Stack.Screen name="ai-assistant" />
        <Stack.Screen name="lesson-plans" />
        <Stack.Screen name="quizzes" />
        <Stack.Screen name="resources" />
      </Stack>
    </RequireRole>
  );
}
