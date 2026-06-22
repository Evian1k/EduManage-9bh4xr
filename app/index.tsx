import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '@/template';
import { useAppContext } from '@/hooks/useAppContext';
import { LoadingScreen } from '@/components/ui/LoadingScreen';

export default function RootScreen() {
  const { user, loading: authLoading } = useAuth();
  const { userRole, rulebookAccepted, loading: contextLoading } = useAppContext();
  const loading = authLoading || contextLoading;
  if (loading) return <LoadingScreen message="Starting EduManage..." />;
  if (!user) return <Redirect href={'/login' as any} />;
  if (!userRole) return <Redirect href={'/register' as any} />;
  const rulebookRoles = ['administrator','ict_manager','school_owner','principal','deputy_principal','bursar','head_teacher','academic_director','accountant','security_officer','hostel_warden'];
  if (!rulebookAccepted && rulebookRoles.includes(userRole)) return <Redirect href={'/rulebook' as any} />;
  switch (userRole) {
    // Company platform roles
    case 'platform_admin':
    case 'company_ceo':
    case 'company_support':
    case 'company_engineering':
    case 'company_security':
    case 'company_sales':
    case 'company_finance':
    case 'company_hr':
    case 'company_marketing':
    case 'company_customer_success':
    case 'company_maintenance':
      return <Redirect href={'/(company)/' as any} />;
    // School admin roles
    case 'school_owner':
    case 'principal':
    case 'deputy_principal':
    case 'administrator':
    case 'head_teacher':
    case 'academic_director':
    case 'board_member':
      return <Redirect href={'/(admin)/' as any} />;
    // ICT
    case 'ict_manager':
      return <Redirect href={'/(ict)/' as any} />;
    // Teacher
    case 'teacher':
      return <Redirect href={'/(teacher)/' as any} />;
    // Student
    case 'student':
      return <Redirect href={'/(student)/' as any} />;
    // Parent
    case 'parent':
      return <Redirect href={'/(parent)/' as any} />;
    // Secretary
    case 'secretary':
      return <Redirect href={'/(secretary)/' as any} />;
    // Finance roles
    case 'bursar':
    case 'accountant':
      return <Redirect href={'/(bursar)/' as any} />;
    // Library
    case 'librarian':
      return <Redirect href={'/(librarian)/' as any} />;
    // Medical
    case 'nurse':
      return <Redirect href={'/(nurse)/' as any} />;
    // Boarding
    case 'boarding_master':
    case 'boarding_mistress':
    case 'hostel_warden':
      return <Redirect href={'/(boarding)/' as any} />;
    // Security officer — admin dashboard
    case 'security_officer':
      return <Redirect href={'/(ict)/' as any} />;
    // Driver, groundskeeper, counselor — admin fallback
    case 'driver':
    case 'groundskeeper':
    case 'counselor':
      return <Redirect href={'/(admin)/' as any} />;
    default:
      return <Redirect href={'/(admin)/' as any} />;
  }
}
