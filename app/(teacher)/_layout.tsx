import { Stack } from 'expo-router';

export default function TeacherLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="assignments" />
      <Stack.Screen name="grades" />
      <Stack.Screen name="attendance" />
      <Stack.Screen name="ai-assistant" />
    </Stack>
  );
}
