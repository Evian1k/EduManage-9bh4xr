import React, { createContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from '@/template';
import { getSupabaseClient } from '@/template';

export interface School {
  id: string;
  name: string;
  subdomain: string;
  email: string;
  phone?: string;
  address?: string;
  plan: string;
  plan_status: string;
  max_students: number;
  max_teachers: number;
  ai_usage_limit: number;
  ai_usage_count: number;
  is_active: boolean;
  trial_ends_at: string;
  created_at: string;
}

export interface SchoolUser {
  id: string;
  user_id: string;
  school_id: string;
  role: string;
  employee_id?: string;
  department?: string;
  is_active: boolean;
}

export interface StudentProfile {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  class_id?: string;
  email?: string;
}

export interface AppContextType {
  userRole: string | null;
  school: School | null;
  schoolUser: SchoolUser | null;
  studentProfile: StudentProfile | null;
  isPlatformAdmin: boolean;
  loading: boolean;
  refreshContext: () => Promise<void>;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [schoolUser, setSchoolUser] = useState<SchoolUser | null>(null);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUserContext = async () => {
    if (!user) {
      setUserRole(null);
      setSchool(null);
      setSchoolUser(null);
      setStudentProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const supabase = getSupabaseClient();

    try {
      // Check platform admin first
      const { data: adminData } = await supabase
        .from('platform_admins')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (adminData) {
        setUserRole('platform_admin');
        setSchool(null);
        setSchoolUser(null);
        setStudentProfile(null);
        setLoading(false);
        return;
      }

      // Check school user
      const { data: schoolUserData } = await supabase
        .from('school_users')
        .select('*, schools(*)')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (schoolUserData) {
        const { schools, ...suData } = schoolUserData as any;
        setSchoolUser(suData as SchoolUser);
        setUserRole(suData.role);
        setSchool(schools as School);

        if (suData.role === 'student') {
          const { data: stuData } = await supabase
            .from('students')
            .select('id, first_name, last_name, admission_number, class_id, email')
            .eq('user_id', user.id)
            .eq('school_id', suData.school_id)
            .maybeSingle();
          setStudentProfile(stuData as StudentProfile | null);
        }
      } else {
        setUserRole(null);
        setSchool(null);
        setSchoolUser(null);
      }
    } catch (e) {
      console.error('AppContext load error:', e);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadUserContext();
  }, [user?.id]);

  return (
    <AppContext.Provider
      value={{
        userRole,
        school,
        schoolUser,
        studentProfile,
        isPlatformAdmin: userRole === 'platform_admin',
        loading,
        refreshContext: loadUserContext,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
