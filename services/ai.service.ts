// EduManage — AI service
//
// All AI requests go through the `ai-assistant` Supabase edge function which
// enforces per-feature system prompts, rate limits, and school usage quotas
// (atomic via the `check_and_increment_ai_usage` RPC). This module is the
// thin client-side wrapper that constructs request payloads for each feature
// and exposes type-safe helpers for the most common operations.

import { getSupabaseClient } from '@/template';
import { AIFeature, AIMessage, AIResponse, ServiceResult } from '@/lib/types';
import { logAuditEvent } from './audit.service';

interface InvokeAIOpts {
  conversationId?: string;
  temperature?: number;
  maxTokens?: number;
  /** Extra context to inject after the system prompt (e.g. student submission text). */
  context?: Record<string, unknown>;
  model?: string;
}

/**
 * Low-level helper that calls the `ai-assistant` edge function. All other
 * helpers in this file compose on top of this.
 */
export async function invokeAI(
  schoolId: string,
  feature: AIFeature | string,
  messages: AIMessage[],
  opts: InvokeAIOpts = {},
): Promise<ServiceResult<AIResponse>> {
  const supabase = getSupabaseClient();
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) {
      return { data: null, error: 'Not authenticated' };
    }

    const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ai-assistant`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        school_id: schoolId,
        feature,
        messages,
        conversation_id: opts.conversationId,
        temperature: opts.temperature,
        max_tokens: opts.maxTokens,
        context: opts.context,
        model: opts.model,
      }),
    });

    const json = (await res.json().catch(() => ({}))) as {
      content?: string;
      provider?: string;
      model?: string;
      tokens_used?: number;
      cost_usd?: number;
      metadata?: Record<string, unknown>;
      error?: string;
    };

    if (!res.ok) {
      const msg = json.error ?? `AI request failed (${res.status})`;
      // Audit the usage-limit-exceeded case so admins can see it
      if (msg.toLowerCase().includes('usage limit') || msg.toLowerCase().includes('quota')) {
        await logAuditEvent({
          schoolId,
          action: 'ai.usage_limit_exceeded',
          details: { feature, status: res.status },
          severity: 'warning',
        });
      }
      return { data: null, error: msg };
    }

    if (!json.content) {
      return { data: null, error: 'AI returned no content' };
    }

    const response: AIResponse = {
      content: json.content,
      provider: (json.provider as AIResponse['provider']) ?? 'openai',
      model: json.model ?? 'unknown',
      tokensUsed: json.tokens_used ?? 0,
      costUsd: json.cost_usd ?? 0,
      metadata: json.metadata,
    };

    await logAuditEvent({
      schoolId,
      action: 'ai.request',
      resourceType: 'ai',
      details: { feature, model: response.model, tokens: response.tokensUsed },
      severity: 'info',
    });

    return { data: response, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── High-level feature helpers ──────────────────────────────────────────────

export interface GenerateAssignmentInput {
  subject: string;
  topic: string;
  gradeLevel: string;
  duration: string;
  assignmentType?: string;
  specialInstructions?: string;
}

export async function generateAssignment(
  schoolId: string,
  input: GenerateAssignmentInput,
): Promise<ServiceResult<string>> {
  const userMessage = `Subject: ${input.subject}
Topic: ${input.topic}
Grade Level: ${input.gradeLevel}
Duration: ${input.duration}
Type: ${input.assignmentType ?? 'Assignment'}
Special Instructions: ${input.specialInstructions ?? 'None'}`;
  const res = await invokeAI(schoolId, 'assignment_generator', [
    { role: 'user', content: userMessage },
  ]);
  if (res.error) return { data: null, error: res.error };
  return { data: res.data?.content ?? '', error: null };
}

export interface AIGradeSubmissionInput {
  assignmentTitle: string;
  assignmentDescription: string;
  rubric: string;
  submissionText: string;
  maxScore?: number;
}

export async function aiGradeSubmission(
  schoolId: string,
  input: AIGradeSubmissionInput,
): Promise<ServiceResult<string>> {
  const userMessage = `Assignment: ${input.assignmentTitle}
Description: ${input.assignmentDescription}
Rubric: ${input.rubric}
Max Score: ${input.maxScore ?? 100}

Student Submission:
${input.submissionText}`;
  const res = await invokeAI(schoolId, 'grading', [
    { role: 'user', content: userMessage },
  ]);
  if (res.error) return { data: null, error: res.error };
  return { data: res.data?.content ?? '', error: null };
}

export interface GenerateLessonPlanInput {
  subject: string;
  topic: string;
  gradeLevel: string;
  duration: string;
  objectives?: string;
}

export async function generateLessonPlan(
  schoolId: string,
  input: GenerateLessonPlanInput,
): Promise<ServiceResult<string>> {
  const userMessage = `Subject: ${input.subject}
Topic: ${input.topic}
Grade Level: ${input.gradeLevel}
Duration: ${input.duration}
Learning Objectives: ${input.objectives ?? 'Auto-generate'}`;
  const res = await invokeAI(schoolId, 'lesson_planner', [
    { role: 'user', content: userMessage },
  ]);
  if (res.error) return { data: null, error: res.error };
  return { data: res.data?.content ?? '', error: null };
}

export interface GenerateQuizInput {
  subject: string;
  topic: string;
  gradeLevel: string;
  numQuestions: number;
  questionType?: 'multiple_choice' | 'true_false' | 'short_answer' | 'mixed';
  difficulty?: 'easy' | 'medium' | 'hard';
}

export async function generateQuiz(
  schoolId: string,
  input: GenerateQuizInput,
): Promise<ServiceResult<string>> {
  const userMessage = `Subject: ${input.subject}
Topic: ${input.topic}
Grade Level: ${input.gradeLevel}
Number of Questions: ${input.numQuestions}
Question Type: ${input.questionType ?? 'mixed'}
Difficulty: ${input.difficulty ?? 'medium'}`;
  const res = await invokeAI(schoolId, 'quiz_generator', [
    { role: 'user', content: userMessage },
  ]);
  if (res.error) return { data: null, error: res.error };
  return { data: res.data?.content ?? '', error: null };
}

export async function studentTutorChat(
  schoolId: string,
  studentQuestion: string,
  conversationId?: string,
): Promise<ServiceResult<string>> {
  const res = await invokeAI(
    schoolId,
    'student_tutor',
    [{ role: 'user', content: studentQuestion }],
    { conversationId },
  );
  if (res.error) return { data: null, error: res.error };
  return { data: res.data?.content ?? '', error: null };
}

export async function adminAnalyticsInsights(
  schoolId: string,
  metrics: Record<string, unknown>,
): Promise<ServiceResult<string>> {
  const res = await invokeAI(schoolId, 'admin_analytics', [
    { role: 'user', content: `Analyze these school metrics and provide actionable insights:\n${JSON.stringify(metrics, null, 2)}` },
  ]);
  if (res.error) return { data: null, error: res.error };
  return { data: res.data?.content ?? '', error: null };
}

export async function principalInsights(
  schoolId: string,
  reportData: Record<string, unknown>,
): Promise<ServiceResult<string>> {
  const res = await invokeAI(schoolId, 'principal_insights', [
    { role: 'user', content: `Provide strategic leadership insights based on this school report:\n${JSON.stringify(reportData, null, 2)}` },
  ]);
  if (res.error) return { data: null, error: res.error };
  return { data: res.data?.content ?? '', error: null };
}

// ─── Provider config + usage stats ──────────────────────────────────────────

export interface AIProviderConfig {
  id: string;
  school_id: string | null;
  provider: string;
  default_model: string;
  is_active: boolean;
  max_tokens_per_request: number;
  temperature: number;
  metadata: Record<string, unknown> | null;
}

/**
 * Return the first active AI provider config for the school. Returns null
 * (no error) when no provider is configured — callers can decide whether
 * to fall back to the platform default.
 */
export async function getConfiguredProvider(
  schoolId: string,
): Promise<ServiceResult<AIProviderConfig | null>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('ai_provider_config')
    .select('*')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  return { data: (data as unknown as AIProviderConfig) ?? null, error: null };
}

export interface AIUsageStats {
  totalRequests: number;
  totalTokens: number;
  totalCostUsd: number;
  byFeature: Record<string, { count: number; tokens: number; cost: number }>;
  byUser: Array<{ userId: string; count: number; tokens: number }>;
}

export async function getAIUsageStats(
  schoolId: string,
  days = 30,
): Promise<ServiceResult<AIUsageStats>> {
  const supabase = getSupabaseClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('ai_usage_logs')
    .select('feature, user_id, tokens_used, cost_usd')
    .eq('school_id', schoolId)
    .gte('created_at', since);
  if (error) return { data: null, error: error.message };

  const rows = data ?? [];
  const byFeature: Record<string, { count: number; tokens: number; cost: number }> = {};
  const byUserMap: Record<string, { count: number; tokens: number }> = {};
  let totalTokens = 0;
  let totalCost = 0;

  for (const r of rows) {
    const f = (r.feature as string) ?? 'unknown';
    if (!byFeature[f]) byFeature[f] = { count: 0, tokens: 0, cost: 0 };
    byFeature[f].count += 1;
    byFeature[f].tokens += r.tokens_used ?? 0;
    byFeature[f].cost += Number(r.cost_usd ?? 0);
    totalTokens += r.tokens_used ?? 0;
    totalCost += Number(r.cost_usd ?? 0);

    const u = r.user_id as string;
    if (!byUserMap[u]) byUserMap[u] = { count: 0, tokens: 0 };
    byUserMap[u].count += 1;
    byUserMap[u].tokens += r.tokens_used ?? 0;
  }

  const byUser = Object.entries(byUserMap).map(([userId, v]) => ({ userId, ...v }));
  byUser.sort((a, b) => b.count - a.count);

  return {
    data: {
      totalRequests: rows.length,
      totalTokens,
      totalCostUsd: totalCost,
      byFeature,
      byUser: byUser.slice(0, 20),
    },
    error: null,
  };
}

// ============================================================================
// Company AI — for EduManage employees (CEO, Support, Finance, etc.)
// These features use a separate endpoint and are billed to the company,
// not to individual schools.
// ============================================================================

export type CompanyAIFeature =
  | 'support_assistant'
  | 'revenue_forecast'
  | 'churn_prediction'
  | 'growth_recommendations'
  | 'operational_analytics';

export async function invokeCompanyAI(
  feature: CompanyAIFeature,
  messages: AIMessage[],
  opts?: { model?: string; temperature?: number; max_tokens?: number }
): Promise<{ data: AIResponse | null; error: string | null }> {
  const supabase = getSupabaseClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) return { data: null, error: 'Not authenticated' };
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return { data: null, error: 'Supabase URL not configured' };
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/ai-assistant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        messages,
        feature: feature as any,
        school_id: undefined, // Company AI is not school-scoped
        model: opts?.model,
        temperature: opts?.temperature,
        max_tokens: opts?.max_tokens,
      }),
    });
    if (!res.ok) { const errBody = await res.json().catch(() => ({})); return { data: null, error: errBody.error ?? `AI request failed (${res.status})` }; }
    const data = await res.json();
    return { data: data as AIResponse, error: null };
  } catch (e: any) { return { data: null, error: e?.message ?? 'Network error' }; }
}

export async function supportTicketAssistant(ticketDescription: string): Promise<{ content: string | null; error: string | null }> {
  const { data, error } = await invokeCompanyAI('support_assistant', [{ role: 'user', content: `Support ticket: ${ticketDescription}\n\nSuggest a response and resolution steps.` }]);
  return { content: data?.content ?? null, error };
}

export async function revenueForecast(currentRevenue: number, growthRate: number): Promise<{ content: string | null; error: string | null }> {
  const { data, error } = await invokeCompanyAI('revenue_forecast', [{ role: 'user', content: `Current MRR: $${currentRevenue}. Growth rate: ${growthRate}%/month. Forecast revenue for next 12 months and identify risks.` }]);
  return { content: data?.content ?? null, error };
}

export async function churnPrediction(schoolData: string): Promise<{ content: string | null; error: string | null }> {
  const { data, error } = await invokeCompanyAI('churn_prediction', [{ role: 'user', content: `Analyze this school data and predict churn risk:\n${schoolData}` }]);
  return { content: data?.content ?? null, error };
}

export async function growthRecommendations(metrics: string): Promise<{ content: string | null; error: string | null }> {
  const { data, error } = await invokeCompanyAI('growth_recommendations', [{ role: 'user', content: `Company metrics:\n${metrics}\n\nProvide growth recommendations.` }]);
  return { content: data?.content ?? null, error };
}
