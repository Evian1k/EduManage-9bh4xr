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
  // Branding
  primary_color?: string;
  secondary_color?: string;
  theme_preference?: string;
  logo_url?: string;
  motto?: string;
  website_enabled?: boolean;
  website_plan?: string;
}

export interface SchoolUser {
  id: string;
  user_id: string;
  school_id: string;
  role: string;
  employee_id?: string;
  department?: string;
  is_active: boolean;
  employment_status?: string;
  employment_start_date?: string;
  employment_end_date?: string;
  archived?: boolean;
  notes?: string;
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
  rulebookAccepted: boolean;
  loading: boolean;
  refreshContext: () => Promise<void>;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

const RULEBOOK_VERSION = '1.0';

export function AppProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [schoolUser, setSchoolUser] = useState<SchoolUser | null>(null);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [rulebookAccepted, setRulebookAccepted] = useState(true); // default true, checked below
  const [loading, setLoading] = useState(true);

  const loadUserContext = async () => {
    if (!user) {
      setUserRole(null);
      setSchool(null);
      setSchoolUser(null);
      setStudentProfile(null);
      setRulebookAccepted(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    const supabase = getSupabaseClient();

    try {
      // 1. Check platform admin
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
        setRulebookAccepted(true);
        setLoading(false);
        return;
      }

      // 2. Check school user
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

        // 3. Rulebook check — only for admin-level roles
        const adminRoles = ['admin', 'ict_manager'];
        if (adminRoles.includes(suData.role)) {
          const { data: rbData } = await supabase
            .from('school_rule_acceptance')
            .select('id')
            .eq('school_id', suData.school_id)
            .eq('accepted_by_user_id', user.id)
            .eq('rulebook_version', RULEBOOK_VERSION)
            .eq('accepted', true)
            .maybeSingle();
          setRulebookAccepted(!!rbData);
        } else {
          setRulebookAccepted(true);
        }

        // 4. Student profile
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
        setRulebookAccepted(true);
      }
    } catch (e) {
      console.error('[AppContext] load error:', e);
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
        rulebookAccepted,
        loading,
        refreshContext: loadUserContext,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
