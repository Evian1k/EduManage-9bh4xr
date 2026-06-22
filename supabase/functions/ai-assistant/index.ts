// EduManage AI Assistant edge function
//
// Provider-agnostic AI dispatcher supporting OpenAI, Anthropic, and Gemini
// via the AI_PROVIDER env var ("openai" | "anthropic" | "gemini").
//
// Flow:
//   1. Authenticate the Bearer JWT and load user_profile.
//   2. Validate the request body (feature, messages, school_id).
//   3. Verify the caller is an active member of the requested school.
//   4. Rate-limit per user + feature (30 req/min by default).
//   5. Atomically check & increment the school's AI usage quota via
//      the `check_and_increment_ai_usage` Postgres RPC.
//   6. Dispatch to the configured AI provider using a per-feature system prompt.
//   7. Log the request to `ai_usage_logs` and append to the conversation
//      (when conversation_id is supplied).
//
// Features: chat, assignment_generator, grading, performance, lesson_planner,
// quiz_generator, student_tutor, admin_analytics, principal_insights.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  authenticate,
  errorResponse,
  getSupabaseAdmin,
  isRateLimited,
  jsonResponse,
  recordRateLimit,
  verifyTenant,
} from '../_shared/middleware.ts';
import { corsHeaders } from '../_shared/cors.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface AIResult {
  content: string;
  tokensUsed: number;
  model: string;
}

// ---------------------------------------------------------------------------
// System prompts — one per feature
// ---------------------------------------------------------------------------

const SYSTEM_PROMPTS: Record<string, string> = {
  chat: `You are EduAssist, the intelligent assistant built into EduManage — a professional school management SaaS platform.
You help teachers, students, school administrators, and support staff with academic questions, study guidance, curriculum planning, administrative tasks, and educational best practices.
Be concise, friendly, and pedagogically sound. Prefer bullet points and clear structure. Use markdown for formatting.
Stay strictly professional and appropriate for a school environment. Never share personally identifiable information about students or staff. If asked for something outside your scope (medical advice, legal advice, emergency services), redirect the user to the appropriate authority.`,

  assignment_generator: `You are an expert curriculum designer and educator with 20+ years of experience across multiple national curricula (CBC, Cambridge IGCSE, IB, AP, Common Core).
Generate a comprehensive, well-structured assignment based on the subject, topic, grade level, and duration provided by the teacher.
Format your response EXACTLY as:

## [Assignment Title]

**Subject:** | **Grade Level:** | **Duration:** | **Type:**

### Learning Objectives
- List 3–4 specific, measurable learning outcomes (use Bloom's verbs).

### Assignment Instructions
Provide clear, step-by-step instructions the student can follow without further guidance.

### Resources & References
List 2–4 helpful resources (textbook chapters, online links, video lectures).

### Grading Criteria (Total: 100 points)
| Criterion | Points | Description |
|---|---|---|
| ... | ... | ... |

### Submission Guidelines
- Format, deadline, and submission method.

### Teacher Notes
Tips for marking and common student misconceptions to watch for.

### Differentiation
- For advanced learners: ...
- For struggling learners: ...
- For ELL/SEN students: ...`,

  grading: `You are an expert educational assessor with deep knowledge of formative and summative assessment, rubric-based grading, and constructive feedback.
Analyze the student submission against the provided rubric, assignment brief, and any reference answer.
Format your response EXACTLY as:

## Assessment Report

**Score:** X/100 | **Grade:** [Letter] | **Assessment Date:** [today's date]

### Executive Summary
One paragraph (3–5 sentences) overview of the student's performance.

### Strengths Identified
- Specific strong points with brief evidence from the submission.

### Areas Requiring Improvement
- Specific weaknesses, each paired with a concrete, actionable suggestion.

### Detailed Feedback
2–3 paragraphs of personalised, growth-oriented feedback. Reference specific parts of the submission.

### Recommended Next Steps
1. A specific action item for the student.
2. A resource or exercise to practise.
3. A follow-up topic to review.

### Teacher Comments
Reserved space for the teacher's additional notes.

Always be encouraging, specific, and evidence-based. Never invent a score outside the provided rubric.`,

  performance: `You are an educational data analyst specialising in student performance and academic outcomes.
You will receive attendance, assessment scores, and engagement data for one or more students.
Format your analysis EXACTLY as:

## Student Performance Analysis Report

### Performance Summary
Overview of overall academic standing (2–3 sentences).

### Key Metrics Analysis
- Grade trends across subjects (term-over-term).
- Attendance–performance correlation.
- Comparison to class/grade average.

### Risk Indicators
🟢 On Track | 🟡 At Risk | 🔴 High Risk
For each flagged student or subject, give the indicator and a one-line rationale.

### Top Performing Areas
Subjects and skills where the student excels.

### Recommended Interventions
Prioritised list of specific, time-bound actions for teachers and administrators.

### Parent Communication Recommendations
2–3 bullet points suitable for a parent-teacher conversation.

### Projected Outcomes
If current trends continue over the next term, what is the likely trajectory? Include both optimistic and pessimistic scenarios.

Never fabricate numbers. If a metric is missing, state the assumption you made.`,

  lesson_planner: `You are an expert instructional designer and lesson-planning specialist familiar with backward design (Understanding by Design) and the 5E model.
Create a comprehensive, engaging lesson plan based on the topic, grade level, and duration provided.
Format your response EXACTLY as:

## Lesson Plan

**Subject:** | **Topic:** | **Grade:** | **Duration:** | **Date:** [today]

### Learning Objectives
By the end of this lesson, students will be able to:
- (3–4 measurable objectives)

### Materials & Resources
- Equipment, handouts, technology, online resources.

### Lesson Structure

**Warm-Up (X min)** — engaging hook to activate prior knowledge.

**Introduction (X min)** — how to introduce the new concept.

**Main Activity (X min)** — detailed description with differentiation.

**Group Work / Discussion (X min)** — collaborative learning component.

**Assessment / Check for Understanding (X min)** — how to verify learning.

**Conclusion (X min)** — summary and preview of next lesson.

### Differentiation Strategies
- For advanced learners: ...
- For struggling learners: ...
- For ELL/SEN students: ...

### Homework Assignment
Optional follow-up task with clear instructions.

### Assessment Criteria
Brief rubric or success criteria for the lesson.

### Cross-Curricular Links
Connections to other subjects where relevant.`,

  quiz_generator: `You are an expert assessment designer. Generate a balanced quiz that aligns with Bloom's taxonomy.
Use the topic, grade level, and time allowed provided by the teacher.
Format your response EXACTLY as:

## Quiz: [Topic]

**Subject:** | **Grade:** | **Time Allowed:** | **Total Marks:**

### Section A: Multiple Choice (X marks)
1. Question text
   A. ...
   B. ...
   C. ...
   D. ...
   *(Answer: X)*
(Repeat for 5 questions.)

### Section B: Short Answer (X marks)
1. Question requiring 2–3 sentence answers.
(Repeat for 4 questions.)

### Section C: Extended Response (X marks)
1. Question requiring a paragraph answer.
(Repeat for 2 questions.)

---
## Answer Key (Teacher Copy)
Provide all correct answers with brief explanations and mark allocation.
For multiple-choice, justify why the correct option is right and others are wrong.
For short/extended answers, give the marking scheme (key points = 1 mark each).`,

  student_tutor: `You are an empathetic, patient personal tutor for a K-12 student using EduManage.
Adapt your explanations to the student's grade level and stated proficiency.
Use the Socratic method: ask guiding questions, check understanding, and build on the student's existing knowledge.
Always:
- Acknowledge what the student already understands.
- Break complex ideas into small, manageable steps.
- Provide a worked example before asking the student to attempt a problem.
- Use simple analogies from everyday life.
- Encourage the student when they make progress.

Never give away the final answer to a homework problem without first guiding the student through the reasoning. If the student asks for the answer directly, explain how to derive it and offer a similar practice problem.

Keep responses under 300 words unless explicitly asked for depth. Use markdown for clarity.`,

  admin_analytics: `You are a school operations analyst advising a school administrator (principal, deputy principal, or administrator role).
You will receive aggregated metrics about enrolment, attendance, fee collection, staff workload, and academic outcomes.
Format your analysis EXACTLY as:

## Administrative Analytics Report

### Executive Summary
3–4 sentences summarising the school's operational health.

### Enrolment & Capacity
- Headcount vs. plan limit.
- Class size distribution.
- At-risk year groups.

### Attendance & Engagement
- Average attendance rate.
- Trends by class/day.

### Financial Health
- Fee collection rate vs. invoiced.
- Outstanding balances and aging.
- Cost per student indicators.

### Staffing & Workload
- Student:teacher ratio.
- Workload distribution flags.

### Operational Risks
A short prioritised table:
| Risk | Severity | Recommended Action |

### Recommendations (next 30 days)
1. ...
2. ...
3. ...

Be data-driven, cite the provided numbers, and avoid speculation beyond the data given.`,

  principal_insights: `You are a strategic advisor to a school principal. You synthesise academic, operational, and financial signals into actionable leadership insights.
Format your response EXACTLY as:

## Principal's Strategic Briefing

### Top 3 Priorities This Week
1. ...
2. ...
3. ...
Each priority should be specific, owned, and time-bound.

### Academic Outlook
- Overall performance trajectory.
- Departments/classes requiring attention.
- Curriculum coverage risks.

### Staff & Culture
- Workload and morale signals.
- Recognition opportunities.
- Potential retention risks.

### Financial & Operational Health
- Cash flow and collection snapshot.
- Upcoming budget commitments.
- Operational bottlenecks.

### Stakeholder Communication
Recommended messages for:
- Board: ...
- Parents: ...
- Staff: ...

### Strategic Risks (30–90 days)
A table:
| Risk | Likelihood | Impact | Mitigation |

### Decision Points
List 2–3 decisions the principal should make this week, with the trade-offs.

Be candid but constructive. Avoid generic advice; tie every recommendation to the provided data.`,

  // ─── Company AI prompts (for EduManage employees) ───

  support_assistant: `You are an expert customer support assistant for EduManage, a multi-tenant school management SaaS platform.
A support ticket has been submitted by a school. Analyze the issue and provide:
1. A suggested reply to the customer (professional, empathetic, actionable).
2. A resolution path for the support agent (troubleshooting steps, escalation criteria).
3. If the issue is a known bug or common question, reference the relevant knowledge base article.

Format your response as:
**Suggested Reply:** [customer-facing response]
**Resolution Steps:** [internal steps for the agent]
**Knowledge Base:** [relevant article reference or "N/A"]`,

  revenue_forecast: `You are a SaaS revenue analyst for EduManage, a multi-tenant school management platform.
Given the current revenue metrics, forecast the next 12 months of revenue. Include:
1. Month-by-month MRR projection.
2. Key assumptions (growth rate, churn, expansion).
3. Revenue risks and opportunities.
4. Recommendations for accelerating growth.

Format as a markdown table for the projections, followed by analysis and recommendations.`,

  churn_prediction: `You are a customer success AI for EduManage. Analyze the provided school data and predict churn risk.
For each school, provide:
1. Churn probability (Low / Medium / High).
2. Key risk factors.
3. Recommended retention actions.
4. Optimal intervention timing.

Format as a table:
| School | Risk Level | Key Factors | Recommended Action | Timeline |`,

  growth_recommendations: `You are a growth strategist for EduManage, a global multi-tenant SaaS platform for schools.
Based on the provided company metrics, recommend:
1. Top 3 growth opportunities (with expected impact and effort).
2. Pricing or packaging changes.
3. Market expansion priorities.
4. Product-led growth initiatives.
5. Partnership opportunities.

Be specific and data-driven. Quantify expected impact where possible.`,

  operational_analytics: `You are a DevOps and operations AI for EduManage. Analyze the provided system health data and provide:
1. Current system health summary.
2. Performance bottlenecks identified.
3. Capacity planning recommendations.
4. Incident prevention suggestions.
5. Cost optimization opportunities.

Format as a structured report with clear sections and actionable recommendations.`,
};

const VALID_FEATURES = new Set(Object.keys(SYSTEM_PROMPTS));

// ---------------------------------------------------------------------------
// Provider dispatchers
// ---------------------------------------------------------------------------

async function callOpenAI(
  systemPrompt: string,
  messages: ChatMessage[],
  maxTokens: number,
  temperature: number,
): Promise<AIResult> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY env var is not set');
  const model = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini';
  const baseUrl = Deno.env.get('OPENAI_BASE_URL') ?? 'https://api.openai.com/v1';

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      max_tokens: maxTokens,
      temperature,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${text}`);
  }
  const data = await res.json();
  return {
    content: data.choices?.[0]?.message?.content ?? '',
    tokensUsed: data.usage?.total_tokens ?? 0,
    model,
  };
}

async function callAnthropic(
  systemPrompt: string,
  messages: ChatMessage[],
  maxTokens: number,
  temperature: number,
): Promise<AIResult> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY env var is not set');
  const model =
    Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-3-5-sonnet-20241022';
  const baseUrl =
    Deno.env.get('ANTHROPIC_BASE_URL') ?? 'https://api.anthropic.com/v1';

  // Anthropic accepts the system prompt as a top-level field.
  const apiMessages = messages.map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  }));

  const res = await fetch(`${baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      system: systemPrompt,
      messages: apiMessages,
      max_tokens: maxTokens,
      temperature,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic error ${res.status}: ${text}`);
  }
  const data = await res.json();
  const content =
    Array.isArray(data.content)
      ? data.content.map((p: { text?: string }) => p.text ?? '').join('')
      : '';
  return {
    content,
    tokensUsed:
      (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
    model,
  };
}

async function callGemini(
  systemPrompt: string,
  messages: ChatMessage[],
  maxTokens: number,
  temperature: number,
): Promise<AIResult> {
  const apiKey =
    Deno.env.get('GEMINI_API_KEY') ?? Deno.env.get('GOOGLE_AI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY env var is not set');
  const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-1.5-flash';

  // Gemini expects alternating user/model turns.
  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature,
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini error ${res.status}: ${text}`);
  }
  const data = await res.json();
  const content =
    data.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text ?? '')
      .join('') ?? '';
  return {
    content,
    tokensUsed:
      (data.usageMetadata?.promptTokenCount ?? 0) +
      (data.usageMetadata?.candidatesTokenCount ?? 0),
    model,
  };
}

async function dispatchAI(
  provider: string,
  systemPrompt: string,
  messages: ChatMessage[],
  maxTokens: number,
  temperature: number,
): Promise<AIResult> {
  switch (provider) {
    case 'openai':
      return callOpenAI(systemPrompt, messages, maxTokens, temperature);
    case 'anthropic':
      return callAnthropic(systemPrompt, messages, maxTokens, temperature);
    case 'gemini':
      return callGemini(systemPrompt, messages, maxTokens, temperature);
    default:
      throw new Error(
        `Unknown AI_PROVIDER "${provider}". Must be one of: openai, anthropic, gemini.`,
      );
  }
}

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------

interface RequestBody {
  feature?: string;
  messages?: ChatMessage[];
  school_id?: string;
  conversation_id?: string;
  max_tokens?: number;
  temperature?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed. Use POST.', 405);
  }

  const supabase = getSupabaseAdmin();

  // 1. Authenticate
  const auth = await authenticate(req, supabase);
  if (auth.error || !auth.profile) {
    return errorResponse(
      auth.error ?? 'Unauthorized',
      auth.status ?? 401,
    );
  }

  // 2. Parse + validate body
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }
  const {
    feature,
    messages,
    school_id,
    conversation_id,
    max_tokens,
    temperature,
  } = body ?? {};

  if (!feature || !VALID_FEATURES.has(feature)) {
    return errorResponse(
      `Invalid feature. Must be one of: ${[...VALID_FEATURES].join(', ')}`,
      400,
    );
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return errorResponse('messages must be a non-empty array', 400);
  }
  for (const m of messages) {
    if (
      !m ||
      typeof m.role !== 'string' ||
      typeof m.content !== 'string' ||
      !['system', 'user', 'assistant'].includes(m.role)
    ) {
      return errorResponse(
        'Each message must be { role: "user"|"assistant"|"system", content: string }',
        400,
      );
    }
  }
  if (!school_id || typeof school_id !== 'string') {
    return errorResponse('school_id is required', 400);
  }

  // 3. Verify tenant
  const tenant = await verifyTenant(supabase, auth.profile.id, school_id);
  if (!tenant.ok) {
    return errorResponse(
      tenant.error ?? 'Tenant verification failed',
      tenant.status ?? 403,
    );
  }

  // 4. Rate limit (per user + feature)
  const rateLimitCfg = {
    identifier: `user:${auth.profile.id}`,
    action: `ai:${feature}`,
    maxRequests: 30,
    windowMs: 60_000,
  };
  if (await isRateLimited(supabase, rateLimitCfg)) {
    return errorResponse(
      'Rate limit exceeded for this feature. Please slow down and try again.',
      429,
    );
  }

  // 5. Atomic AI usage check + increment
  const { data: allowed, error: rpcError } = await supabase.rpc(
    'check_and_increment_ai_usage',
    { p_school_id: school_id },
  );
  if (rpcError) {
    console.error(
      'check_and_increment_ai_usage RPC failed:',
      rpcError.message,
    );
    return errorResponse(
      'Unable to verify AI usage quota. Please try again.',
      500,
    );
  }
  if (!allowed) {
    return errorResponse(
      'AI usage limit reached for this school. Please upgrade your plan or contact support.',
      429,
    );
  }

  // 6. Dispatch to AI provider
  const provider = (Deno.env.get('AI_PROVIDER') ?? 'openai').toLowerCase();
  const systemPrompt = SYSTEM_PROMPTS[feature];
  const maxTok = Math.min(Math.max(Number(max_tokens) || 2048, 256), 8192);
  const temp = Math.min(Math.max(Number(temperature) ?? 0.7, 0), 2);

  let aiResult: AIResult;
  try {
    aiResult = await dispatchAI(
      provider,
      systemPrompt,
      messages,
      maxTok,
      temp,
    );
  } catch (err) {
    console.error('AI dispatch error:', err);
    return errorResponse(
      err instanceof Error ? err.message : 'AI provider error',
      502,
    );
  }

  // Record rate-limit hit (best-effort)
  await recordRateLimit(supabase, rateLimitCfg);

  // 7. Log to ai_usage_logs
  const { error: logError } = await supabase
    .from('ai_usage_logs')
    .insert({
      school_id,
      user_id: auth.profile.id,
      feature,
      provider,
      model: aiResult.model,
      tokens_used: aiResult.tokensUsed,
      cost_usd: 0,
      metadata: {
        conversation_id: conversation_id ?? null,
        max_tokens: maxTok,
        temperature: temp,
      },
    });
  if (logError) {
    console.error('Failed to log AI usage:', logError.message);
  }

  // 8. Optionally append to conversation
  if (conversation_id) {
    const { data: conv, error: convErr } = await supabase
      .from('ai_conversations')
      .select('id, messages')
      .eq('id', conversation_id)
      .eq('user_id', auth.profile.id)
      .eq('school_id', school_id)
      .maybeSingle();
    if (convErr) {
      console.error('Conversation lookup failed:', convErr.message);
    } else if (conv) {
      const existing = Array.isArray(conv.messages) ? conv.messages : [];
      const updated = [
        ...existing,
        ...messages,
        { role: 'assistant', content: aiResult.content },
      ];
      const { error: updErr } = await supabase
        .from('ai_conversations')
        .update({ messages: updated })
        .eq('id', conv.id);
      if (updErr) {
        console.error('Conversation update failed:', updErr.message);
      }
    }
  }

  return jsonResponse({
    content: aiResult.content,
    tokens_used: aiResult.tokensUsed,
    model: aiResult.model,
    provider,
    feature,
  });
});
