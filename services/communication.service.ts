// EduManage — Communication service
//
// CRUD for announcements, conversations (1:1 + group messages), bulk SMS/
// email (dispatched via edge functions), events, and visitor logs.

import { getSupabaseClient } from '@/template';
import { ServiceResult } from '@/lib/types';
import { logAuditEvent } from './audit.service';

// ─── Announcements ───────────────────────────────────────────────────────────

export interface Announcement {
  id: string;
  school_id: string;
  title: string;
  body: string;
  category?: string | null;
  audience?: string | null;
  class_id?: string | null;
  created_by?: string | null;
  is_pinned: boolean;
  published_at: string;
  expires_at?: string | null;
  attachment_url?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export async function getAnnouncements(
  schoolId: string,
  filters: { category?: string; audience?: string; classId?: string; limit?: number } = {},
): Promise<ServiceResult<Announcement[]>> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from('announcements')
    .select('*')
    .eq('school_id', schoolId)
    .order('is_pinned', { ascending: false })
    .order('published_at', { ascending: false });
  if (filters.category) q = q.eq('category', filters.category);
  if (filters.audience) q = q.eq('audience', filters.audience);
  if (filters.classId) q = q.eq('class_id', filters.classId);
  if (filters.limit) q = q.limit(filters.limit);
  const { data, error } = await q;
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as Announcement[], error: null };
}

export async function createAnnouncement(
  schoolId: string,
  input: {
    title: string;
    body: string;
    category?: string;
    audience?: string;
    class_id?: string;
    created_by?: string;
    is_pinned?: boolean;
    expires_at?: string;
    attachment_url?: string;
  },
): Promise<ServiceResult<Announcement>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('announcements')
    .insert({
      school_id: schoolId,
      title: input.title,
      body: input.body,
      category: input.category ?? null,
      audience: input.audience ?? null,
      class_id: input.class_id ?? null,
      created_by: input.created_by ?? null,
      is_pinned: input.is_pinned ?? false,
      published_at: new Date().toISOString(),
      expires_at: input.expires_at ?? null,
      attachment_url: input.attachment_url ?? null,
    })
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as Announcement, error: null };
}

export async function deleteAnnouncement(
  schoolId: string,
  announcementId: string,
): Promise<ServiceResult<{ deleted: boolean }>> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('announcements')
    .delete()
    .eq('id', announcementId)
    .eq('school_id', schoolId);
  if (error) return { data: null, error: error.message };
  return { data: { deleted: true }, error: null };
}

// ─── Conversations + messages ────────────────────────────────────────────────

export interface ConversationPreview {
  /** For 1:1 chats this is the partner's profile id; for groups it's the group id. */
  id: string;
  type: 'direct' | 'group';
  name: string;
  lastMessage: string;
  lastAt: string;
  unreadCount: number;
}

export async function getConversations(
  schoolId: string,
  userId: string,
): Promise<ServiceResult<ConversationPreview[]>> {
  const supabase = getSupabaseClient();
  // Pull messages where the user is sender or recipient, plus groups they're in.
  const [directRes, groupMembershipsRes] = await Promise.all([
    supabase
      .from('messages')
      .select('id, sender_id, recipient_id, group_id, body, created_at, read_at')
      .eq('school_id', schoolId)
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('message_group_members')
      .select('group_id, message_groups(id, name)')
      .eq('user_id', userId),
  ]);
  if (directRes.error) return { data: null, error: directRes.error.message };
  if (groupMembershipsRes.error) return { data: null, error: groupMembershipsRes.error.message };

  const directMsgs = (directRes.data ?? []) as Array<{
    id: string;
    sender_id: string;
    recipient_id: string | null;
    group_id: string | null;
    body: string;
    created_at: string;
    read_at: string | null;
  }>;

  const conversations = new Map<string, ConversationPreview>();

  for (const m of directMsgs) {
    const isSender = m.sender_id === userId;
    const partnerId = isSender ? m.recipient_id : m.sender_id;
    if (!partnerId) continue;
    const key = `direct:${partnerId}`;
    const existing = conversations.get(key);
    const unreadIncrement = !isSender && !m.read_at ? 1 : 0;
    if (!existing || new Date(m.created_at) > new Date(existing.lastAt)) {
      conversations.set(key, {
        id: partnerId,
        type: 'direct',
        name: '', // caller can enrich via user lookup
        lastMessage: m.body,
        lastAt: m.created_at,
        unreadCount: (existing?.unreadCount ?? 0) + unreadIncrement,
      });
    } else {
      existing.unreadCount += unreadIncrement;
    }
  }

  // Group conversations
  for (const row of (groupMembershipsRes.data ?? []) as Array<{
    group_id: string;
    message_groups: { id: string; name: string } | null;
  }>) {
    const g = row.message_groups;
    if (!g) continue;
    // Fetch latest message + unread count for the group
    const [latestRes, unreadRes] = await Promise.all([
      supabase
        .from('messages')
        .select('body, created_at')
        .eq('school_id', schoolId)
        .eq('group_id', g.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('group_id', g.id)
        .neq('sender_id', userId)
        .is('read_at', null),
    ]);
    conversations.set(`group:${g.id}`, {
      id: g.id,
      type: 'group',
      name: g.name,
      lastMessage: (latestRes.data as { body?: string } | null)?.body ?? '',
      lastAt: (latestRes.data as { created_at?: string } | null)?.created_at ?? new Date(0).toISOString(),
      unreadCount: unreadRes.count ?? 0,
    });
  }

  return {
    data: Array.from(conversations.values()).sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()),
    error: null,
  };
}

export interface Message {
  id: string;
  school_id: string;
  sender_id: string;
  recipient_id?: string | null;
  group_id?: string | null;
  body?: string | null;
  attachment_url?: string | null;
  message_type: string;
  read_at?: string | null;
  created_at: string;
}

export async function getMessages(
  schoolId: string,
  opts: { withUserId?: string; groupId?: string; limit?: number } = {},
): Promise<ServiceResult<Message[]>> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from('messages')
    .select('*')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: true });
  if (opts.groupId) q = q.eq('group_id', opts.groupId);
  if (opts.withUserId) {
    q = q.or(`and(sender_id.eq.${opts.withUserId}),and(recipient_id.eq.${opts.withUserId})`);
  }
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as Message[], error: null };
}

export async function sendMessage(
  schoolId: string,
  senderId: string,
  input: { recipient_id?: string; group_id?: string; body?: string; attachment_url?: string; message_type?: string },
): Promise<ServiceResult<Message>> {
  const supabase = getSupabaseClient();
  if (!input.recipient_id && !input.group_id) {
    return { data: null, error: 'recipient_id or group_id is required' };
  }
  const { data, error } = await supabase
    .from('messages')
    .insert({
      school_id: schoolId,
      sender_id: senderId,
      recipient_id: input.recipient_id ?? null,
      group_id: input.group_id ?? null,
      body: input.body ?? null,
      attachment_url: input.attachment_url ?? null,
      message_type: input.message_type ?? 'text',
    })
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as Message, error: null };
}

export async function markMessageRead(
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

// ─── Bulk SMS / Email ────────────────────────────────────────────────────────

export async function sendBulkSMS(
  schoolId: string,
  input: { recipients: string[]; message: string; sent_by?: string },
): Promise<ServiceResult<{ queued: number }>> {
  const supabase = getSupabaseClient();
  const rows = input.recipients.map((phone) => ({
    school_id: schoolId,
    recipient_phone: phone,
    message: input.message,
    status: 'queued',
    sent_by: input.sent_by ?? null,
    sent_at: new Date().toISOString(),
  }));
  const { data, error } = await supabase.from('sms_logs').insert(rows).select('id');
  if (error) return { data: null, error: error.message };
  return { data: { queued: data?.length ?? 0 }, error: null };
}

export async function sendBulkEmail(
  schoolId: string,
  input: { recipients: string[]; subject: string; body: string; sent_by?: string },
): Promise<ServiceResult<{ queued: number }>> {
  const supabase = getSupabaseClient();
  const rows = input.recipients.map((email) => ({
    school_id: schoolId,
    recipient_email: email,
    subject: input.subject,
    body: input.body,
    status: 'queued',
    sent_by: input.sent_by ?? null,
    sent_at: new Date().toISOString(),
  }));
  const { data, error } = await supabase.from('email_logs').insert(rows).select('id');
  if (error) return { data: null, error: error.message };
  return { data: { queued: data?.length ?? 0 }, error: null };
}

// ─── Events ──────────────────────────────────────────────────────────────────

export interface SchoolEvent {
  id: string;
  school_id: string;
  title: string;
  description?: string | null;
  event_type?: string | null;
  start_at: string;
  end_at?: string | null;
  location?: string | null;
  audience?: string | null;
  class_id?: string | null;
  created_by?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export async function getEvents(
  schoolId: string,
  filters: { from?: string; to?: string; eventType?: string } = {},
): Promise<ServiceResult<SchoolEvent[]>> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from('events')
    .select('*')
    .eq('school_id', schoolId)
    .order('start_at', { ascending: true });
  if (filters.from) q = q.gte('start_at', filters.from);
  if (filters.to) q = q.lte('start_at', filters.to);
  if (filters.eventType) q = q.eq('event_type', filters.eventType);
  const { data, error } = await q;
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as SchoolEvent[], error: null };
}

export async function createEvent(
  schoolId: string,
  input: {
    title: string;
    description?: string;
    event_type?: string;
    start_at: string;
    end_at?: string;
    location?: string;
    audience?: string;
    class_id?: string;
    created_by?: string;
  },
): Promise<ServiceResult<SchoolEvent>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('events')
    .insert({
      school_id: schoolId,
      title: input.title,
      description: input.description ?? null,
      event_type: input.event_type ?? null,
      start_at: input.start_at,
      end_at: input.end_at ?? null,
      location: input.location ?? null,
      audience: input.audience ?? null,
      class_id: input.class_id ?? null,
      created_by: input.created_by ?? null,
    })
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as SchoolEvent, error: null };
}

// ─── Visitors ────────────────────────────────────────────────────────────────

export interface Visitor {
  id: string;
  school_id: string;
  visitor_name: string;
  visitor_phone?: string | null;
  visitor_id_number?: string | null;
  purpose: string;
  host_name?: string | null;
  host_id?: string | null;
  check_in_at: string;
  check_out_at?: string | null;
  vehicle_plate?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

export async function getVisitors(
  schoolId: string,
  filters: { checkedIn?: boolean; limit?: number } = {},
): Promise<ServiceResult<Visitor[]>> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from('visitors')
    .select('*')
    .eq('school_id', schoolId)
    .order('check_in_at', { ascending: false });
  if (filters.checkedIn === true) q = q.is('check_out_at', null);
  if (filters.checkedIn === false) q = q.not('check_out_at', 'is', null);
  if (filters.limit) q = q.limit(filters.limit);
  const { data, error } = await q;
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as Visitor[], error: null };
}

export async function checkInVisitor(
  schoolId: string,
  input: {
    visitor_name: string;
    visitor_phone?: string;
    visitor_id_number?: string;
    purpose: string;
    host_name?: string;
    host_id?: string;
    vehicle_plate?: string;
  },
): Promise<ServiceResult<Visitor>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('visitors')
    .insert({
      school_id: schoolId,
      visitor_name: input.visitor_name,
      visitor_phone: input.visitor_phone ?? null,
      visitor_id_number: input.visitor_id_number ?? null,
      purpose: input.purpose,
      host_name: input.host_name ?? null,
      host_id: input.host_id ?? null,
      vehicle_plate: input.vehicle_plate ?? null,
      check_in_at: new Date().toISOString(),
    })
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as Visitor, error: null };
}

export async function checkOutVisitor(
  schoolId: string,
  visitorId: string,
): Promise<ServiceResult<Visitor>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('visitors')
    .update({ check_out_at: new Date().toISOString() })
    .eq('id', visitorId)
    .eq('school_id', schoolId)
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as Visitor, error: null };
}
