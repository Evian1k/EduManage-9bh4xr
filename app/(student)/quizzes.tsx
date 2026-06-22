import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useAppContext } from '@/hooks/useAppContext';
import { getSupabaseClient } from '@/template';
import { useAlert } from '@/template';
import { Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';

export default function StudentQuizzes() {
  const { school, studentProfile } = useAppContext();
  const { showAlert } = useAlert();
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!school || !studentProfile?.class_id) { setLoading(false); return; }
    const supabase = getSupabaseClient();
    const [q, a] = await Promise.all([
      supabase.from('quizzes').select('*').eq('school_id', school.id).eq('class_id', studentProfile.class_id).eq('is_published', true).order('created_at', { ascending: false }),
      supabase.from('quiz_attempts').select('*').eq('school_id', school.id).eq('student_id', studentProfile.id),
    ]);
    setQuizzes(q.data || []);
    setAttempts(a.data || []);
    setLoading(false);
  }, [school, studentProfile]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const startQuiz = async (quiz: any) => {
    if (!school) return;
    const supabase = getSupabaseClient();
    const { data } = await supabase.from('quiz_questions').select('*').eq('quiz_id', quiz.id).order('position');
    setQuestions(data || []);
    setAnswers({});
    setActiveQuiz(quiz);
  };

  const submitQuiz = async () => {
    if (!school || !studentProfile || !activeQuiz) return;
    const supabase = getSupabaseClient();
    let score = 0;
    for (const q of questions) { if (answers[q.id] === q.correct_answer) score += q.marks || 1; }
    const totalMarks = questions.reduce((s, q) => s + (q.marks || 1), 0);
    const { error } = await supabase.from('quiz_attempts').insert({ school_id: school.id, quiz_id: activeQuiz.id, student_id: studentProfile.id, answers, score, total_marks: totalMarks, submitted_at: new Date().toISOString(), passed: score >= (activeQuiz.pass_mark || 50) });
    if (error) { showAlert('Error', error); return; }
    showAlert('Submitted!', `You scored ${score}/${totalMarks}`);
    setActiveQuiz(null);
    load();
  };

  if (!school) return <LoadingScreen />;
  if (loading) return <LoadingScreen message="Loading quizzes..." />;

  return (
    <SafeAreaView style={s.flex} edges={['bottom']}>
      <Header title="Quizzes" subtitle={school.name} showBack accentColor={Colors.student} />
      <FlatList data={quizzes} keyExtractor={(item) => item.id} contentContainerStyle={s.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        renderItem={({ item }) => {
          const attempt = attempts.find(a => a.quiz_id === item.id);
          return (
            <Card style={s.card}><View style={s.row}><View style={s.info}><Text style={s.title}>{item.title}</Text>{item.description && <Text style={s.desc}>{item.description}</Text>}<Text style={s.meta}>{item.total_marks} marks - {item.duration_minutes}min</Text></View>{attempt ? <Badge label={`Done: ${attempt.score}/${attempt.total_marks}`} variant={attempt.passed ? 'success' : 'error'} size="sm" /> : <Button label="Take" size="sm" onPress={() => startQuiz(item)} />}</View></Card>
          );
        }}
        ListEmptyComponent={<EmptyState icon="quiz" title="No quizzes" description="Your quizzes will appear here" />}
      />
      <Modal visible={!!activeQuiz} transparent animationType="slide" onRequestClose={() => setActiveQuiz(null)}>
        <View style={s.overlay}><View style={s.modal}>
          <Text style={s.modalTitle}>{activeQuiz?.title}</Text>
          <FlatList data={questions} keyExtractor={(item) => item.id} renderItem={({ item: q, index }) => (
            <View style={s.question}><Text style={s.qText}>{index + 1}. {q.question_text}</Text>
              {Array.isArray(q.options) && q.options.map((opt: string, i: number) => (
                <Pressable key={i} style={[s.option, answers[q.id] === opt && s.optionSelected]} onPress={() => setAnswers({ ...answers, [q.id]: opt })}><Text style={s.optionText}>{opt}</Text></Pressable>
              ))}
            </View>
          )} />
          <Button label="Submit Quiz" onPress={submitQuiz} fullWidth />
        </View></View>
      </Modal>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({ flex: { flex: 1, backgroundColor: Colors.background }, list: { padding: Spacing.md, gap: 8 }, card: { padding: Spacing.md }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, info: { flex: 1 }, title: { fontSize: 16, fontWeight: FontWeight.bold, color: Colors.textPrimary }, desc: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 }, meta: { fontSize: 12, color: Colors.textMuted, marginTop: 4 }, overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 }, modal: { backgroundColor: Colors.surface, borderRadius: 16, padding: 20, maxHeight: '80%' }, modalTitle: { fontSize: 18, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: 16 }, question: { marginBottom: 16 }, qText: { fontSize: 14, color: Colors.textPrimary, marginBottom: 8 }, option: { padding: 12, backgroundColor: Colors.surface2, borderRadius: 8, marginBottom: 6 }, optionSelected: { backgroundColor: Colors.primary }, optionText: { color: Colors.textPrimary, fontSize: 13 } });