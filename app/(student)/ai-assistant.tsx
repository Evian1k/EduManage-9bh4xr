import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, KeyboardAvoidingView,
  Platform, TextInput, ActivityIndicator
} from 'react-native';
import { useAuth } from '@/template';
import { useAppContext } from '@/hooks/useAppContext';
import { getSupabaseClient } from '@/template';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { BottomNav } from '@/components/layout/BottomNav';

const STUDENT_NAV = [
  { label: 'Home', icon: 'home' as const, route: '/(student)/' },
  { label: 'Assignments', icon: 'assignment' as const, route: '/(student)/assignments' },
  { label: 'Grades', icon: 'grade' as const, route: '/(student)/grades' },
  { label: 'AI Tutor', icon: 'auto-awesome' as const, route: '/(student)/ai-assistant' },
];
import { Header } from '@/components/layout/Header';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';

type Message = { id: string; role: 'user' | 'assistant'; content: string };

const STUDENT_PROMPTS = [
  'Explain the water cycle simply',
  'Help me understand photosynthesis',
  'How do I solve quadratic equations?',
  'What is the French Revolution?',
  'Explain Newton\'s laws of motion',
  'Help me write a summary for my essay',
];

export default function StudentAI() {
  const { user } = useAuth();
  const { school } = useAppContext();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const sendMessage = async (text?: string) => {
    const messageText = (text || input).trim();
    if (!messageText || loading) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: messageText };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          feature: 'chat',
          school_id: school?.id,
        },
      });

      if (error) {
        let errorMsg = error.message;
        if (error instanceof FunctionsHttpError) {
          try { errorMsg = await error.context?.text() || error.message; } catch { errorMsg = error.message; }
        }
        setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: `Sorry, I encountered an error: ${errorMsg}` }]);
      } else {
        setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: data?.content || 'No response received.' }]);
      }
    } catch (e: any) {
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: `Error: ${e.message}` }]);
    }

    setLoading(false);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Header title="AI Tutor" subtitle="Your personal study assistant" accentColor={Colors.student} />

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        style={styles.messageList}
        contentContainerStyle={[styles.messageContent, messages.length === 0 && styles.emptyContent]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.aiOrb}>
              <MaterialIcons name="school" size={40} color={Colors.student} />
            </View>
            <Text style={styles.emptyTitle}>AI Study Tutor</Text>
            <Text style={styles.emptyDesc}>Ask me anything about your studies. I am here to help!</Text>
            <View style={styles.promptGrid}>
              {STUDENT_PROMPTS.map((p, i) => (
                <Pressable key={i} style={styles.promptCard} onPress={() => sendMessage(p)}>
                  <Text style={styles.promptText}>{p}</Text>
                  <MaterialIcons name="arrow-forward" size={14} color={Colors.student} />
                </Pressable>
              ))}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.aiBubble]}>
            {item.role === 'assistant' ? (
              <View style={styles.aiAvatar}>
                <MaterialIcons name="school" size={14} color={Colors.student} />
              </View>
            ) : null}
            <View style={[styles.bubbleContent, item.role === 'user' ? styles.userContent : styles.aiContent]}>
              <Text style={[styles.bubbleText, item.role === 'user' ? styles.userText : styles.aiText]}>
                {item.content}
              </Text>
            </View>
          </View>
        )}
      />

      {loading ? (
        <View style={styles.typingIndicator}>
          <ActivityIndicator size="small" color={Colors.student} />
          <Text style={styles.typingText}>AI Tutor is thinking...</Text>
        </View>
      ) : null}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.textInput}
          value={input}
          onChangeText={setInput}
          placeholder="Ask your tutor anything..."
          placeholderTextColor={Colors.textMuted}
          multiline
          maxLength={2000}
          returnKeyType="send"
        />
        <Pressable
          style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
          onPress={() => sendMessage()}
          disabled={!input.trim() || loading}
        >
          <MaterialIcons name="send" size={20} color={Colors.textPrimary} />
        </Pressable>
      </View>
      <BottomNav items={STUDENT_NAV} accentColor={Colors.student} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  messageList: { flex: 1 },
  messageContent: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.md },
  emptyContent: { flex: 1, justifyContent: 'center' },
  emptyState: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xl },
  aiOrb: { width: 88, height: 88, borderRadius: 44, backgroundColor: Colors.studentBg, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  emptyDesc: { fontSize: FontSize.base, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  promptGrid: { width: '100%', gap: Spacing.xs },
  promptCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  promptText: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary },
  bubble: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.xs, marginBottom: 4 },
  userBubble: { justifyContent: 'flex-end' },
  aiBubble: { justifyContent: 'flex-start' },
  aiAvatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.studentBg, alignItems: 'center', justifyContent: 'center' },
  bubbleContent: { maxWidth: '80%', padding: Spacing.md, borderRadius: BorderRadius.lg },
  userContent: { backgroundColor: Colors.student, borderBottomRightRadius: 4 },
  aiContent: { backgroundColor: Colors.surface2, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: Colors.border },
  bubbleText: { fontSize: FontSize.base, lineHeight: 22 },
  userText: { color: Colors.textPrimary },
  aiText: { color: Colors.textPrimary },
  typingIndicator: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md },
  typingText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', padding: Spacing.md, gap: Spacing.sm, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border },
  textInput: { flex: 1, backgroundColor: Colors.surface2, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, color: Colors.textPrimary, fontSize: FontSize.base, maxHeight: 120, borderWidth: 1, borderColor: Colors.border },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.student, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
});
