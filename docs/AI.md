# AI Module

## Provider-Agnostic Architecture
`AI_PROVIDER` env var selects: `openai` | `anthropic` | `gemini`

## Edge Function
`supabase/functions/ai-assistant/index.ts`:
1. `authenticate()` — verify JWT
2. `isRateLimited()` — 60 requests/min/user
3. `verifyTenant()` — verify user belongs to requested school
4. `check_and_increment_ai_usage()` — atomic limit check (race-condition free)
5. Call AI provider (OpenAI/Anthropic/Gemini)
6. Log to `ai_usage_logs`

## 9 AI Features
| Feature | Use Case |
|---|---|
| chat | General Q&A |
| assignment_generator | Generate assignments |
| grading | AI-assisted grading |
| performance | Student performance analysis |
| lesson_planner | Generate lesson plans |
| quiz_generator | Generate quizzes |
| student_tutor | Student tutoring |
| admin_analytics | Admin insights |
| principal_insights | Strategic forecasting |

## Per-School Config
`ai_provider_config` table — schools can override provider, model, API key.

## Usage Limits
`schools.ai_usage_count` vs `ai_usage_limit`. Atomic increment via `check_and_increment_ai_usage` RPC prevents race conditions.

## Client API
```typescript
import { invokeAI } from '@/services/ai.service';
const { data, error } = await invokeAI(schoolId, 'chat', messages);
```
