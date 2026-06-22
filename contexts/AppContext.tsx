import React, { createContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from '@/template';
import { getSupabaseClient } from '@/template';

export interface School {
  id: string;
  name: string;
  subdomain: string;
  email?: string;
  phone?: string;
  address?: string;
  country?: string;
  county?: string;
  city?: string;
  motto?: string;
  logo_url?: string;
  primary_color?: string;
  accent_color?: string;
  status: string;
  plan_status: string;
  plan_tier: string;
  max_students: number;
  max_staff: number;
  max_storage_mb: number;
  ai_usage_limit: number;
  ai_usage_count: number;
  trial_ends_at?: string;
  plan_renews_at?: string;
  settings?: Record<string, any>;
  created_at: string;
}

export interface SchoolUser {
  id: string;
  user_id: string;
  school_id: string;
  role: string;
  is_active: boolean;
  invited_by?: string;
  joined_at: string;
  metadata?: Record<string, any>;
}

export interface StudentProfile {
  id: string;
  full_name: string;
  admission_number: string;
  class_id?: string;
  stream_id?: string;
  status?: string;
}

export interface AppContextType {
  userRole: string | null;
  school: School | null;
  schoolUser: SchoolUser | null;
  studentProfile: StudentProfile | null;
  profileId: string | null;
  isPlatformAdmin: boolean;
  rulebookAccepted: boolean;
  loading: boolean;
  refreshContext: () => Promise<void>;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

const RULEBOOK_VERSION = '1.0';
const RULEBOOK_ROLES = ['administrator', 'ict_manager', 'school_owner', 'principal', 'deputy_principal', 'bursar'];

export function AppProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [schoolUser, setSchoolUser] = useState<SchoolUser | null>(null);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [rulebookAccepted, setRulebookAccepted] = useState(true);
  const [loading, setLoading] = useState(true);

  const loadUserContext = async () => {
    if (!user) {
      setUserRole(null); setSchool(null); setSchoolUser(null);
      setStudentProfile(null); setProfileId(null); setLoading(false);
      return;
    }
    setLoading(true);
    const supabase = getSupabaseClient();
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id, email, full_name, status')
        .eq('auth_user_id', user.id)
        .maybeSingle();
      if (!profile) {
        setUserRole(null); setSchool(null); setSchoolUser(null); setProfileId(null);
        setLoading(false); return;
      }
      setProfileId(profile.id);

      const { data: memberships } = await supabase
        .from('school_users')
        .select('*, schools(*)')
        .eq('user_id', profile.id)
        .eq('is_active', true)
        .order('joined_at', { ascending: false })
        .limit(1);
      const schoolUserData = memberships?.[0];
      if (!schoolUserData) {
        setUserRole(null); setSchool(null); setSchoolUser(null);
        setLoading(false); return;
      }
      const { schools, ...suData } = schoolUserData as any;
      setSchoolUser(suData as SchoolUser);
      setUserRole(suData.role);
      setSchool(schools as School);

      if (RULEBOOK_ROLES.includes(suData.role)) {
        const { data: rbData } = await supabase
          .from('school_rule_acceptance')
          .select('id')
          .eq('school_id', suData.school_id)
          .eq('accepted_by_user_id', profile.id)
          .eq('rulebook_version', RULEBOOK_VERSION)
          .eq('accepted', true)
          .maybeSingle();
        setRulebookAccepted(!!rbData);
      } else { setRulebookAccepted(true); }

      if (suData.role === 'student') {
        const { data: stuData } = await supabase
          .from('students')
          .select('id, full_name, admission_number, class_id, stream_id, status')
          .eq('user_id', profile.id)
          .eq('school_id', suData.school_id)
          .maybeSingle();
        setStudentProfile(stuData as StudentProfile | null);
      } else { setStudentProfile(null); }
    } catch (e) { console.error('[AppContext] load error:', e); }
    setLoading(false);
  };

  useEffect(() => { loadUserContext(); }, [user?.id]);

  return (
    <AppContext.Provider value={{ userRole, school, schoolUser, studentProfile, profileId, isPlatformAdmin: userRole === 'platform_admin', rulebookAccepted, loading, refreshContext: loadUserContext }}>
      {children}
    </AppContext.Provider>
  );
}
