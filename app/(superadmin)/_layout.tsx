import { Stack } from 'expo-router';

export default function SuperAdminLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="schools" />
      <Stack.Screen name="revenue" />
      <Stack.Screen name="support" />
      <Stack.Screen name="announcements" />
    </Stack>
  );
}
