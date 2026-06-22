import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, KeyboardAvoidingView, Platform, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useAppContext } from '@/hooks/useAppContext';
import { getSupabaseClient } from '@/template';
import { getConversations, getMessages, sendMessage, markMessageRead } from '@/services/communication.service';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';

interface Conversation { partner_id: string; partner_name: string; last_message: any; }
interface Message { id: string; sender_id: string; body: string; created_at: string; }

export default function SecretaryMessages() {
  const { school, profileId } = useAppContext();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activePartner, setActivePartner] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const loadConversations = useCallback(async () => {
    if (!school || !profileId) return;
    const { data } = await getConversations(school.id, profileId);
    setConversations(data || []);
    setLoading(false);
  }, [school, profileId]);

  const loadMessages = useCallback(async () => {
    if (!school || !profileId || !activePartner) return;
    const { data } = await getMessages(school.id, profileId, activePartner);
    setMessages(data || []);
    // Mark unread as read
    (data || []).forEach((m: any) => {
      if (!m.read_at && m.sender_id === activePartner) {
        markMessageRead(m.id);
      }
    });
  }, [school, profileId, activePartner]);

  useEffect(() => { loadConversations(); }, [loadConversations]);
  useEffect(() => { if (activePartner) loadMessages(); }, [loadMessages]);

  const handleSend = async () => {
    if (!input.trim() || !school || !profileId || !activePartner) return;
    setSending(true);
    const { error } = await sendMessage(school.id, { sender_id: profileId, recipient_id: activePartner, body: input.trim() });
    if (!error) { setInput(''); loadMessages(); }
    setSending(false);
  };

  if (!school || !profileId) return <LoadingScreen />;
  if (loading) return <LoadingScreen message="Loading messages..." />;

  return (
    <SafeAreaView style={s.flex} edges={['bottom']}>
      <Header title="Messages" subtitle={school.name} showBack accentColor="#00897B" />
      {!activePartner ? (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.partner_id}
          contentContainerStyle={s.list}
          renderItem={({ item }) => (
            <Card style={s.convCard} onPress={() => setActivePartner(item.partner_id)}>
              <View style={s.convRow}>
                <View style={s.avatar}><Text style={s.avatarText}>{item.partner_name?.[0]?.toUpperCase() || '?'}</Text></View>
                <View style={s.convInfo}>
                  <Text style={s.convName}>{item.partner_name}</Text>
                  <Text style={s.convPreview} numberOfLines={1}>{item.last_message?.body || 'No messages'}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={Colors.textMuted} />
              </View>
            </Card>
          )}
          ListEmptyComponent={<EmptyState icon="mail" title="No conversations" description="Messages from staff and parents will appear here" />}
        />
      ) : (
        <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={s.backBar} onPress={() => setActivePartner(null)}>
            <MaterialIcons name="arrow-back" size={20} color={Colors.textPrimary} />
            <Text style={s.backText}>{conversations.find(c => c.partner_id === activePartner)?.partner_name || 'Chat'}</Text>
          </Pressable>
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={s.msgList}
            renderItem={({ item }) => (
              <View style={[s.msgBubble, item.sender_id === profileId ? s.msgSent : s.msgReceived]}>
                <Text style={s.msgText}>{item.body}</Text>
                <Text style={s.msgTime}>{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
            )}
            ListEmptyComponent={<EmptyState icon="chat-bubble-outline" title="No messages yet" description="Start the conversation" />}
          />
          <View style={s.inputBar}>
            <TextInput
              style={s.input}
              value={input}
              onChangeText={setInput}
              placeholder="Type a message..."
              placeholderTextColor={Colors.textMuted}
              multiline
            />
            <Pressable style={[s.sendBtn, !input.trim() && s.sendDisabled]} onPress={handleSend} disabled={!input.trim() || sending}>
              <MaterialIcons name="send" size={20} color={Colors.textPrimary} />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.md, gap: Spacing.sm },
  convCard: { padding: Spacing.md },
  convRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: Colors.textPrimary, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  convInfo: { flex: 1 },
  convName: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  convPreview: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  backBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  msgList: { padding: Spacing.md, gap: Spacing.xs },
  msgBubble: { maxWidth: '75%', padding: Spacing.sm + 2, borderRadius: BorderRadius.lg, gap: 4 },
  msgSent: { alignSelf: 'flex-end', backgroundColor: Colors.primary },
  msgReceived: { alignSelf: 'flex-start', backgroundColor: Colors.surface2 },
  msgText: { color: Colors.textPrimary, fontSize: FontSize.sm },
  msgTime: { fontSize: 10, color: Colors.textMuted, alignSelf: 'flex-end' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm, padding: Spacing.md, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border },
  input: { flex: 1, backgroundColor: Colors.surface2, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, color: Colors.textPrimary, fontSize: FontSize.sm, maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendDisabled: { opacity: 0.4 },
});
