import { Stack } from 'expo-router';

export default function BursarLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="payments" />
      <Stack.Screen name="fees" />
      <Stack.Screen name="reports" />
    </Stack>
  );
}
