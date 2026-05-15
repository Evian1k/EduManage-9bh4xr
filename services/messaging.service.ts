import { getSupabaseClient } from '@/template';

export async function sendMessage(schoolId: string, senderId: string, data: {
  recipient_id: string;
  subject?: string;
  content: string;
  parent_message_id?: string;
}) {
  const supabase = getSupabaseClient();
  return supabase
    .from('messages')
    .insert({ ...data, sender_id: senderId, school_id: schoolId })
    .select()
    .single();
}

export async function getInbox(schoolId: string, userId: string) {
  const supabase = getSupabaseClient();
  return supabase
    .from('messages')
    .select('*, sender:sender_id(id, email, username)')
    .eq('school_id', schoolId)
    .eq('recipient_id', userId)
    .is('parent_message_id', null)
    .order('created_at', { ascending: false });
}

export async function getSent(schoolId: string, userId: string) {
  const supabase = getSupabaseClient();
  return supabase
    .from('messages')
    .select('*, recipient:recipient_id(id, email, username)')
    .eq('school_id', schoolId)
    .eq('sender_id', userId)
    .is('parent_message_id', null)
    .order('created_at', { ascending: false });
}

export async function markAsRead(messageId: string) {
  const supabase = getSupabaseClient();
  return supabase
    .from('messages')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('id', messageId);
}

export async function getUnreadCount(schoolId: string, userId: string) {
  const supabase = getSupabaseClient();
  const { count } = await supabase
    .from('messages')
    .select('id', { count: 'exact' })
    .eq('school_id', schoolId)
    .eq('recipient_id', userId)
    .eq('is_read', false);
  return count || 0;
}

export async function getSchoolUsers(schoolId: string, roles?: string[]) {
  const supabase = getSupabaseClient();
  let query = supabase
    .from('school_users')
    .select('id, user_id, role, user_profiles(id, email, username)')
    .eq('school_id', schoolId)
    .eq('is_active', true);
  if (roles && roles.length > 0) query = query.in('role', roles);
  return query;
}
