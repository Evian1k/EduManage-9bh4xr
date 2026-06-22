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
  const rulebookRoles = ['administrator','ict_manager','school_owner','principal','deputy_principal','bursar'];
  if (!rulebookAccepted && rulebookRoles.includes(userRole)) return <Redirect href={'/rulebook' as any} />;
  switch (userRole) {
    case 'platform_admin': return <Redirect href={'/(superadmin)/' as any} />;
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
    case 'school_owner': case 'principal': case 'deputy_principal': case 'administrator': return <Redirect href={'/(admin)/' as any} />;
    case 'ict_manager': return <Redirect href={'/(ict)/' as any} />;
    case 'teacher': return <Redirect href={'/(teacher)/' as any} />;
    case 'student': return <Redirect href={'/(student)/' as any} />;
    case 'parent': return <Redirect href={'/(parent)/' as any} />;
    case 'secretary': return <Redirect href={'/(secretary)/' as any} />;
    case 'bursar': return <Redirect href={'/(bursar)/' as any} />;
    case 'librarian': return <Redirect href={'/(librarian)/' as any} />;
    case 'nurse': return <Redirect href={'/(nurse)/' as any} />;
    case 'boarding_master': case 'boarding_mistress': return <Redirect href={'/(boarding)/' as any} />;
    case 'company_ceo': case 'company_support': case 'company_engineering': case 'company_security': case 'company_sales': case 'company_finance': case 'company_hr': case 'company_marketing': case 'company_customer_success': case 'company_maintenance': return <Redirect href={'/(company)/' as any} />;
    default: return <Redirect href={'/(admin)/' as any} />;
  }
}
