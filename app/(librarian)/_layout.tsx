import { Stack } from 'expo-router';
import { RequireRole } from '@/components/auth/RequireRole';

export default function LibrarianLayout() {
  return (
    <RequireRole allowed={[librarian, school_owner, principal, administrator'] as any}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="books" />
        <Stack.Screen name="borrow" />
      </Stack>
    </RequireRole>
  );
}
