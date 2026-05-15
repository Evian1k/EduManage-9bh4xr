import { Stack } from 'expo-router';

export default function SecretaryLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="announcements" />
      <Stack.Screen name="visitors" />
      <Stack.Screen name="events" />
      <Stack.Screen name="messages" />
    </Stack>
  );
}
