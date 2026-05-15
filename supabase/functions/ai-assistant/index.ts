import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('ONSPACE_AI_API_KEY');
    const baseUrl = Deno.env.get('ONSPACE_AI_BASE_URL');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      console.error('Auth error:', userError?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized — invalid or expired session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { messages, feature, school_id } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Invalid request: messages array required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check AI usage limit before processing
    if (school_id) {
      const { data: school } = await supabaseAdmin
        .from('schools')
        .select('ai_usage_count, ai_usage_limit, plan_status')
        .eq('id', school_id)
        .single();

      if (school && school.ai_usage_count >= school.ai_usage_limit) {
        return new Response(JSON.stringify({
          error: `AI usage limit reached (${school.ai_usage_count}/${school.ai_usage_limit}). Please upgrade your plan or contact support.`
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const systemPrompt = getSystemPrompt(feature);

    console.log(`AI request: feature=${feature}, school=${school_id}, user=${user.id}`);

    const aiResponse = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          ...(messages || []),
        ],
        max_tokens: 2048,
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('OnSpace AI error:', errText);
      return new Response(JSON.stringify({ error: `AI service error: ${errText}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content ?? 'I could not generate a response. Please try again.';
    const tokensUsed = aiData.usage?.total_tokens ?? 200;

    // Log AI usage and increment counter
    if (school_id) {
      await Promise.all([
        supabaseAdmin.from('ai_usage_logs').insert({
          school_id,
          user_id: user.id,
          feature: feature || 'chat',
          tokens_used: tokensUsed,
        }),
        supabaseAdmin.rpc('increment_school_ai_usage', { p_school_id: school_id }),
      ]);
    }

    console.log(`AI response: tokens=${tokensUsed}, feature=${feature}`);

    return new Response(JSON.stringify({ content, tokens_used: tokensUsed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('AI assistant error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function getSystemPrompt(feature: string): string {
  const prompts: Record<string, string> = {
    chat: `You are EduAssist, an intelligent AI assistant built into EduManage — a professional school management SaaS platform.
You help teachers, students, school admins, and staff with academic questions, study guidance, curriculum planning, administrative tasks, and educational best practices.
Be concise, friendly, and educational. Use bullet points and clear structure. Format responses with markdown where appropriate.
Always stay professional and appropriate for a school environment.`,

    assignment_generator: `You are an expert curriculum designer and educator with 20+ years of experience.
Generate a comprehensive, well-structured assignment based on the subject, topic, and grade level provided.
Format your response exactly as:

## [Assignment Title]

**Subject:** | **Grade Level:** | **Duration:** | **Type:**

### Learning Objectives
- List 3-4 specific learning outcomes

### Assignment Instructions
Provide clear, step-by-step instructions

### Resources & References
List helpful resources students may use

### Grading Criteria (Total: 100 points)
| Criteria | Points |
|---|---|
| [criterion] | [points] |

### Submission Guidelines
- Format, deadline, and submission method

### Teacher Notes
Tips for marking and common student mistakes to watch for`,

    grading: `You are an expert educational assessor with deep knowledge of formative and summative assessment.
Analyze the student submission thoroughly and provide detailed, constructive feedback.
Format your response as:

## Assessment Report

**Score:** X/100 | **Grade:** Letter | **Assessment Date:** Today

### Executive Summary
One paragraph overview of student performance

### Strengths Identified
- List specific strong points with examples from submission

### Areas Requiring Improvement  
- List specific weaknesses with constructive guidance

### Detailed Feedback
Paragraph of detailed, personalized feedback

### Recommended Next Steps
1. Specific action items for the student
2. Resources to consult
3. Practice recommendations

### Teacher Comments
Space for additional notes`,

    performance: `You are an educational data analyst specializing in student performance and academic outcomes.
Analyze the provided performance data comprehensively and generate actionable insights.
Format as:

## Student Performance Analysis Report

### Performance Summary
Overview of overall academic standing

### Key Metrics Analysis
- Grade trends across subjects
- Attendance correlation with performance
- Comparison to class average

### Risk Indicators
🔴 High Risk | 🟡 At Risk | 🟢 On Track
Flag students or subjects of concern

### Top Performing Areas
Subjects and skills where student excels

### Recommended Interventions
Prioritized list of specific actions for teachers/admin

### Parent Communication Recommendations
What to discuss at the next parent meeting

### Projected Outcomes
If current trends continue...`,

    lesson_planner: `You are an expert educational consultant and lesson planning specialist.
Create a comprehensive, engaging lesson plan based on the topic, grade level, and duration provided.
Format as:

## Lesson Plan

**Subject:** | **Topic:** | **Grade:** | **Duration:** | **Date:**

### Learning Objectives
By the end of this lesson, students will be able to:

### Materials & Resources
- Equipment, handouts, technology needed

### Lesson Structure

**Warm-Up (X min)**
Engaging activity to activate prior knowledge

**Introduction (X min)**  
How to introduce the new concept

**Main Activity (X min)**
Detailed activity descriptions with differentiation

**Group Work / Discussion (X min)**
Collaborative learning components

**Assessment (X min)**
How to check understanding

**Conclusion (X min)**
Summarize key points, preview next lesson

### Differentiation Strategies
- For advanced learners:
- For struggling learners:
- For ELL students:

### Homework Assignment
Optional follow-up task

### Assessment Criteria`,

    quiz_generator: `You are an expert assessment designer. Generate a comprehensive quiz based on the topic provided.
Format as:

## Quiz: [Topic]

**Subject:** | **Grade:** | **Time Allowed:** | **Total Marks:**

### Section A: Multiple Choice (X marks)
For each question provide 4 options labeled A, B, C, D with the correct answer marked.

### Section B: Short Answer (X marks)
Questions requiring 2-3 sentence answers.

### Section C: Extended Response (X marks)
Questions requiring paragraph answers.

---
## Answer Key (Teacher Copy)
Provide all correct answers with explanations.`,
  };
  return prompts[feature] || prompts.chat;
}
