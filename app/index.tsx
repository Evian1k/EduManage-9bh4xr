import React, { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '@/template';
import { useAppContext } from '@/hooks/useAppContext';
import { LoadingScreen } from '@/components/ui/LoadingScreen';

export default function RootScreen() {
  const { user, loading: authLoading } = useAuth();
  const { userRole, loading: contextLoading } = useAppContext();

  const loading = authLoading || contextLoading;

  if (loading) return <LoadingScreen message="Starting EduManage..." />;

  if (!user) return <Redirect href="/login" />;

  if (!userRole) return <Redirect href="/register" />;

  if (userRole === 'platform_admin') return <Redirect href="/(superadmin)/" />;
  if (userRole === 'admin' || userRole === 'ict_manager') return <Redirect href="/(admin)/" />;
  if (userRole === 'teacher' || userRole === 'timetable_officer' || userRole === 'discipline_officer') return <Redirect href="/(teacher)/" />;
  if (userRole === 'student') return <Redirect href="/(student)/" />;
  if (userRole === 'secretary' || userRole === 'receptionist' || userRole === 'clerk') return <Redirect href="/(secretary)/" />;
  if (userRole === 'bursar' || userRole === 'accountant') return <Redirect href="/(bursar)/" />;
  if (userRole === 'librarian') return <Redirect href="/(librarian)/" />;
  if (userRole === 'nurse' || userRole === 'health_officer') return <Redirect href="/(nurse)/" />;

  // Fallback for unknown roles
  return <Redirect href="/(admin)/" />;
}
