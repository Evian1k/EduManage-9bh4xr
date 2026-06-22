import { Stack } from 'expo-router';
import { RequireRole } from '@/components/auth/RequireRole';

export default function MarketplaceLayout() {
  return (
    <RequireRole allowed={['school_owner','principal','deputy_principal','administrator','teacher','student','parent','bursar','librarian','ict_manager'] as any}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="product" />
        <Stack.Screen name="cart" />
        <Stack.Screen name="orders" />
      </Stack>
    </RequireRole>
  );
}
