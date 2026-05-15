import { Stack } from 'expo-router';

export default function AdminLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="students" />
      <Stack.Screen name="teachers" />
      <Stack.Screen name="classes" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="finance" />
      <Stack.Screen name="timetable" />
    </Stack>
  );
}
