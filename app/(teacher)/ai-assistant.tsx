import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, KeyboardAvoidingView,
  Platform, TextInput, ActivityIndicator
} from 'react-native';
import { useAuth } from '@/template';
import { useAppContext } from '@/hooks/useAppContext';
import { getSupabaseClient } from '@/template';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';

const TEACHER_NAV = [
  { label: 'Home', icon: 'home' as const, route: '/(teacher)/' },
  { label: 'Assignments', icon: 'assignment' as const, route: '/(teacher)/assignments' },
  { label: 'Grades', icon: 'grade' as const, route: '/(teacher)/grades' },
  { label: 'Attendance', icon: 'fact-check' as const, route: '/(teacher)/attendance' },
  { label: 'AI', icon: 'auto-awesome' as const, route: '/(teacher)/ai-assistant' },
];
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';

type Message = { id: string; role: 'user' | 'assistant'; content: string };
type Feature = { id: string; label: string; icon: keyof typeof MaterialIcons.glyphMap; description: string };

const FEATURES: Feature[] = [
  { id: 'chat', label: 'AI Chat', icon: 'chat', description: 'Ask educational questions' },
  { id: 'assignment_generator', label: 'Assignment Generator', icon: 'auto-fix-high', description: 'Generate assignments automatically' },
  { id: 'grading', label: 'Grading Assistant', icon: 'grading', description: 'Get grading help and feedback' },
  { id: 'performance', label: 'Performance Insights', icon: 'insights', description: 'Analyze student performance' },
];

export default function TeacherAI() {
  const { user } = useAuth();
  const { school } = useAppContext();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState('chat');
  const flatListRef = useRef<FlatList>(null);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          feature: selectedFeature,
          school_id: school?.id,
        },
      });

      if (error) {
        let errorMsg = error.message;
        if (error instanceof FunctionsHttpError) {
          try { errorMsg = await error.context?.text() || error.message; } catch { errorMsg = error.message; }
        }
        const errResponse: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: `Error: ${errorMsg}` };
        setMessages((prev) => [...prev, errResponse]);
      } else {
        const assistantMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: data?.content || 'No response received.' };
        setMessages((prev) => [...prev, assistantMsg]);
      }
    } catch (e: any) {
      const errMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: `Error: ${e.message}` };
      setMessages((prev) => [...prev, errMsg]);
    }

    setLoading(false);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Header title="EduAssist AI" subtitle="Powered by EduManage AI" accentColor={Colors.teacher} />

      {/* Feature selector */}
      <View style={styles.featureRow}>
        {FEATURES.map((f) => (
          <Pressable
            key={f.id}
            style={[styles.featureBtn, selectedFeature === f.id && styles.featureBtnActive]}
            onPress={() => setSelectedFeature(f.id)}
          >
            <MaterialIcons name={f.icon} size={16} color={selectedFeature === f.id ? Colors.textPrimary : Colors.textMuted} />
            <Text style={[styles.featureText, selectedFeature === f.id && styles.featureTextActive]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Messages */}
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
              <MaterialIcons name="auto-awesome" size={40} color={Colors.teacher} />
            </View>
            <Text style={styles.emptyTitle}>EduAssist AI</Text>
            <Text style={styles.emptyDesc}>
              {FEATURES.find((f) => f.id === selectedFeature)?.description}
            </Text>
            <View style={styles.promptGrid}>
              {getPrompts(selectedFeature).map((p, i) => (
                <Pressable key={i} style={styles.promptCard} onPress={() => setInput(p)}>
                  <Text style={styles.promptText}>{p}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.aiBubble]}>
            {item.role === 'assistant' ? (
              <View style={styles.aiAvatar}>
                <MaterialIcons name="auto-awesome" size={14} color={Colors.teacher} />
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
          <ActivityIndicator size="small" color={Colors.teacher} />
          <Text style={styles.typingText}>EduAssist is thinking...</Text>
        </View>
      ) : null}

      {/* Input */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.textInput}
          value={input}
          onChangeText={setInput}
          placeholder="Ask anything educational..."
          placeholderTextColor={Colors.textMuted}
          multiline
          maxLength={2000}
          onSubmitEditing={sendMessage}
          returnKeyType="send"
        />
        <Pressable style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]} onPress={sendMessage} disabled={!input.trim() || loading}>
          <MaterialIcons name="send" size={20} color={Colors.textPrimary} />
        </Pressable>
      </View>
      <BottomNav items={TEACHER_NAV} accentColor={Colors.teacher} />
    </KeyboardAvoidingView>
  );
}

function getPrompts(feature: string): string[] {
  const prompts: Record<string, string[]> = {
    chat: ['How do I explain fractions to Grade 3?', 'What are good teaching strategies?', 'Suggest classroom activities for science'],
    assignment_generator: ['Create a math quiz for Grade 5', 'Generate an essay assignment on climate change', 'Design a science project for secondary students'],
    grading: ['This student wrote about photosynthesis...', 'Help me grade this math solution', 'Provide feedback on student writing'],
    performance: ['A student scores 45% consistently...', 'How to help a struggling student?', 'What do declining grades indicate?'],
  };
  return prompts[feature] || prompts.chat;
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  featureRow: { flexDirection: 'row', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.xs, flexWrap: 'wrap' },
  featureBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: BorderRadius.full, backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border },
  featureBtnActive: { backgroundColor: Colors.teacher, borderColor: Colors.teacher },
  featureText: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: FontWeight.medium },
  featureTextActive: { color: Colors.textPrimary, fontWeight: FontWeight.semibold },
  messageList: { flex: 1 },
  messageContent: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.md },
  emptyContent: { flex: 1, justifyContent: 'center' },
  emptyState: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xl },
  aiOrb: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.teacherBg, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  emptyDesc: { fontSize: FontSize.base, color: Colors.textSecondary, textAlign: 'center' },
  promptGrid: { width: '100%', gap: Spacing.xs },
  promptCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  promptText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  bubble: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.xs, marginBottom: 4 },
  userBubble: { justifyContent: 'flex-end' },
  aiBubble: { justifyContent: 'flex-start' },
  aiAvatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.teacherBg, alignItems: 'center', justifyContent: 'center' },
  bubbleContent: { maxWidth: '80%', padding: Spacing.md, borderRadius: BorderRadius.lg },
  userContent: { backgroundColor: Colors.teacher, borderBottomRightRadius: 4 },
  aiContent: { backgroundColor: Colors.surface2, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: Colors.border },
  bubbleText: { fontSize: FontSize.base, lineHeight: 22 },
  userText: { color: Colors.textPrimary },
  aiText: { color: Colors.textPrimary },
  typingIndicator: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md },
  typingText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', padding: Spacing.md, gap: Spacing.sm, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border },
  textInput: { flex: 1, backgroundColor: Colors.surface2, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, color: Colors.textPrimary, fontSize: FontSize.base, maxHeight: 120, borderWidth: 1, borderColor: Colors.border },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.teacher, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
});
