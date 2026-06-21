// Parent: Messaging — conversations list + thread view with reply
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useAppContext } from '@/hooks/useAppContext';
import {
  getConversations, getMessages, sendMessage,
  ConversationPreview, Message,
} from '@/services/communication.service';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { getSupabaseClient } from '@/template';

export default function ParentMessagesScreen() {
  const { school, profileId } = useAppContext();
  const schoolId = school?.id;
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [active, setActive] = useState<ConversationPreview | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const loadConversations = useCallback(async () => {
    if (!schoolId || !profileId) return;
    const { data, error } = await getConversations(schoolId, profileId);
    if (error) { setLoading(false); return; }
    // Enrich name with user profile lookup
    const supabase = getSupabaseClient();
    const ids = (data || []).filter((c) => c.type === 'direct' && !c.name).map((c) => c.id);
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from('user_profiles')
        .select('id, full_name')
        .in('id', ids);
      const profMap: Record<string, string> = {};
      (profs || []).forEach((p: any) => { profMap[p.id] = p.full_name; });
      (data || []).forEach((c) => { if (!c.name && profMap[c.id]) c.name = profMap[c.id]; });
    }
    setConversations(data || []);
    setLoading(false);
  }, [schoolId, profileId]);

  const loadMessages = useCallback(async () => {
    if (!schoolId || !profileId || !active) return;
    const opts = active.type === 'group' ? { groupId: active.id } : { withUserId: active.id };
    const { data } = await getMessages(schoolId, opts);
    setMessages(data || []);
  }, [schoolId, profileId, active]);

  useEffect(() => { if (schoolId && profileId) loadConversations(); }, [schoolId, profileId]);
  useEffect(() => { if (active) loadMessages(); }, [active]);

  const handleSend = async () => {
    if (!reply.trim() || !schoolId || !profileId || !active) return;
    setSending(true);
    const input = active.type === 'group' ? { group_id: active.id, body: reply.trim() } : { recipient_id: active.id, body: reply.trim() };
    const { error } = await sendMessage(schoolId, profileId, input);
    setSending(false);
    if (error) return;
    setReply('');
    loadMessages();
  };

  if (!schoolId || !profileId) return <LoadingScreen />;
  if (loading) return <LoadingScreen message="Loading messages..." />;

  if (active) {
    return (
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <Header
          title={active.name || 'Conversation'}
          subtitle={active.type === 'group' ? 'Group chat' : 'Direct message'}
          showBack
          accentColor="#FF9800"
          rightAction={{ icon: 'arrow-back', onPress: () => setActive(null) }}
        />
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.threadList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<EmptyState icon="chat-bubble-outline" title="No Messages" description="Start the conversation below." />}
          renderItem={({ item }) => {
            const mine = item.sender_id === profileId;
            return (
              <View style={[s.bubbleWrap, mine ? s.bubbleWrapMine : s.bubbleWrapTheirs]}>
                <View style={[s.bubble, mine ? s.bubbleMine : s.bubbleTheirs]}>
                  <Text style={[s.bubbleText, mine ? s.bubbleTextMine : s.bubbleTextTheirs]}>{item.body}</Text>
                  <Text style={[s.bubbleTime, mine ? s.bubbleTimeMine : s.bubbleTimeTheirs]}>
                    {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </View>
            );
          }}
        />
        <View style={s.replyBar}>
          <TextInput
            style={s.replyInput}
            value={reply}
            onChangeText={setReply}
            placeholder="Type a message..."
            placeholderTextColor={Colors.textMuted}
            multiline
          />
          <Pressable style={[s.sendBtn, (!reply.trim() || sending) && s.sendBtnDisabled]} onPress={handleSend} disabled={!reply.trim() || sending}>
            <MaterialIcons name="send" size={20} color={Colors.textPrimary} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={s.flex}>
      <Header title="Messages" subtitle={`${conversations.length} conversations`} showBack accentColor="#FF9800" />
      <FlatList
        data={conversations}
        keyExtractor={(item) => `${item.type}:${item.id}`}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<EmptyState icon="chat" title="No Conversations" description="Messages with teachers and staff will appear here." />}
        renderItem={({ item }) => (
          <Card style={s.convCard} onPress={() => setActive(item)}>
            <View style={s.convRow}>
              <Avatar name={item.name || '?'} size={48} />
              <View style={{ flex: 1 }}>
                <View style={s.convTop}>
                  <Text style={s.convName} numberOfLines={1}>{item.name || 'Unknown'}</Text>
                  <Text style={s.convTime}>{new Date(item.lastAt).toLocaleDateString()}</Text>
                </View>
                <Text style={s.convPreview} numberOfLines={1}>{item.lastMessage || 'No messages'}</Text>
              </View>
              {item.unreadCount > 0 ? <Badge label={`${item.unreadCount}`} variant="error" size="sm" /> : null}
            </View>
          </Card>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 100 },
  convCard: {},
  convRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  convTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  convName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary, flex: 1 },
  convTime: { fontSize: FontSize.xs, color: Colors.textMuted },
  convPreview: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  threadList: { padding: Spacing.md, gap: Spacing.xs, paddingBottom: 100 },
  bubbleWrap: { flexDirection: 'row', marginBottom: Spacing.xs },
  bubbleWrapMine: { justifyContent: 'flex-end' },
  bubbleWrapTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%', padding: Spacing.sm + 2, borderRadius: BorderRadius.lg },
  bubbleMine: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: Colors.surface2, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: FontSize.base },
  bubbleTextMine: { color: Colors.textPrimary },
  bubbleTextTheirs: { color: Colors.textPrimary },
  bubbleTime: { fontSize: 10, marginTop: 4, opacity: 0.7 },
  bubbleTimeMine: { color: Colors.textPrimary, textAlign: 'right' },
  bubbleTimeTheirs: { color: Colors.textSecondary },
  replyBar: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm, padding: Spacing.md, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border },
  replyInput: { flex: 1, backgroundColor: Colors.surface2, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, color: Colors.textPrimary, fontSize: FontSize.base, maxHeight: 100, borderWidth: 1, borderColor: Colors.border },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
});
