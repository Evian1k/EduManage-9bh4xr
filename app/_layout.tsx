import { AlertProvider, AuthProvider } from '@/template';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from '@/contexts/AppContext';
import { NotificationsProvider } from '@/contexts/NotificationsProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <AlertProvider>
        <SafeAreaProvider>
          <AuthProvider>
            <AppProvider>
              <NotificationsProvider>
                <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0B1426' } }}>
                  <Stack.Screen name="index" />
                  <Stack.Screen name="login" />
                  <Stack.Screen name="register" />
                  <Stack.Screen name="forgot-password" />
                  <Stack.Screen name="reset-password" />
                  <Stack.Screen name="verify-email" />
                  <Stack.Screen name="mfa-challenge" />
                  <Stack.Screen name="invite/accept" />
                  <Stack.Screen name="notifications" />
                  <Stack.Screen name="profile" />
                  <Stack.Screen name="settings" />
                  <Stack.Screen name="search" />
                  <Stack.Screen name="(superadmin)" />
                  <Stack.Screen name="(admin)" />
                  <Stack.Screen name="(teacher)" />
                  <Stack.Screen name="(student)" />
                  <Stack.Screen name="(parent)" />
                  <Stack.Screen name="(secretary)" />
                  <Stack.Screen name="(bursar)" />
                  <Stack.Screen name="(ict)" />
                  <Stack.Screen name="(librarian)" />
                  <Stack.Screen name="(nurse)" />
                  <Stack.Screen name="(boarding)" />
                  <Stack.Screen name="(company)" />
                  <Stack.Screen name="(marketplace)" />
                  <Stack.Screen name="rulebook" />
                </Stack>
              </NotificationsProvider>
            </AppProvider>
          </AuthProvider>
        </SafeAreaProvider>
      </AlertProvider>
    </ErrorBoundary>
  );
}
