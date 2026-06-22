import { Stack } from 'expo-router';
import { RequireRole } from '@/components/auth/RequireRole';

export default function CompanyLayout() {
  return (
    <RequireRole allowed={['company_ceo','company_support','company_engineering','company_security','company_sales','company_finance','company_hr','company_marketing','company_customer_success','company_maintenance','platform_admin'] as any}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="ceo" />
        <Stack.Screen name="support" />
        <Stack.Screen name="sales" />
        <Stack.Screen name="finance" />
        <Stack.Screen name="customer-success" />
        <Stack.Screen name="engineering" />
        <Stack.Screen name="security" />
        <Stack.Screen name="hr" />
        <Stack.Screen name="marketing" />
        <Stack.Screen name="maintenance" />
      </Stack>
    </RequireRole>
  );
}
