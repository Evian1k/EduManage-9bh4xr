// EduManage — Messaging service (legacy compatibility shim)
//
// Re-exports the messaging functions from `communication.service.ts` so
// older screens that import from `services/messaging.service` keep working.

export {
  getConversations,
  getMessages,
  sendMessage,
  markMessageRead,
  sendBulkSMS,
  type ConversationPreview,
  type Message,
} from './communication.service';

import { getSupabaseClient } from '@/template';
import { ServiceResult } from '@/lib/types';

// ─── Legacy aliases (older signatures) ───────────────────────────────────────

export async function getInbox(
  schoolId: string,
  userId: string,
): Promise<ServiceResult<any[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('messages')
    .select('*, sender:sender_id(id, email), recipient:recipient_id(id, email)')
    .eq('school_id', schoolId)
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false });
  if (error) return { data: null, error: error.message };
  return { data: data ?? [], error: null };
}

export async function getSent(
  schoolId: string,
  userId: string,
): Promise<ServiceResult<any[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('messages')
    .select('*, sender:sender_id(id, email), recipient:recipient_id(id, email)')
    .eq('school_id', schoolId)
    .eq('sender_id', userId)
    .order('created_at', { ascending: false });
  if (error) return { data: null, error: error.message };
  return { data: data ?? [], error: null };
}

export async function markAsRead(
  schoolId: string,
  messageId: string,
): Promise<ServiceResult<{ updated: boolean }>> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('id', messageId)
    .eq('school_id', schoolId);
  if (error) return { data: null, error: error.message };
  return { data: { updated: true }, error: null };
}

export async function getUnreadMessageCount(
  schoolId: string,
  userId: string,
): Promise<ServiceResult<number>> {
  const supabase = getSupabaseClient();
  const { count, error } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId)
    .eq('recipient_id', userId)
    .is('read_at', null);
  if (error) return { data: null, error: error.message };
  return { data: count ?? 0, error: null };
}

export async function getSchoolUsers(
  schoolId: string,
  roles?: string[],
): Promise<ServiceResult<any[]>> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from('school_users')
    .select('id, user_id, role, is_active, user_profiles(id, email, full_name)')
    .eq('school_id', schoolId)
    .eq('is_active', true);
  if (roles && roles.length > 0) q = q.in('role', roles);
  q = q.order('role', { ascending: true });
  const { data, error } = await q;
  if (error) return { data: null, error: error.message };
  return { data: data ?? [], error: null };
}
