import React, { useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppContext } from '@/hooks/useAppContext';
import { logAuditEvent } from '@/services/audit.service';

type Role = 'school_owner'|'principal'|'deputy_principal'|'administrator'|'teacher'|'student'|'parent'|'secretary'|'bursar'|'librarian'|'nurse'|'ict_manager'|'driver'|'groundskeeper'|'counselor'|'boarding_master'|'boarding_mistress'|'platform_admin';

interface RequireRoleProps { allowed: Role[]; children: React.ReactNode; }

export function RequireRole({ allowed, children }: RequireRoleProps) {
  const { userRole, loading } = useAppContext();
  const router = useRouter();
  useEffect(() => {
    if (loading) return;
    if (!userRole) { router.replace('/login?reason=access_denied' as any); return; }
    if (!allowed.includes(userRole as Role)) {
      logAuditEvent({ action: 'suspicious_activity', details: { attempted_roles: allowed, actual_role: userRole }, severity: 'warning' });
      router.replace('/login?reason=access_denied' as any);
    }
  }, [userRole, loading, allowed, router]);
  if (loading) return <View style={s.c}><ActivityIndicator size="large" color="#FFD700" /><Text style={s.t}>Checking permissions…</Text></View>;
  if (!userRole || !allowed.includes(userRole as Role)) return <View style={s.c}><Text style={s.d}>Access denied</Text></View>;
  return <>{children}</>;
}

const s = StyleSheet.create({ c: { flex:1, justifyContent:'center', alignItems:'center', backgroundColor:'#0B1426', padding:24 }, t: { color:'#FFFFFF', marginTop:12 }, d: { color:'#FFFFFF', fontSize:22, fontWeight:'700' } });
