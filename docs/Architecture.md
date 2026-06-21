# Architecture

## Tech Stack
- **Frontend:** Expo ~53, React Native 0.79, React 19, expo-router ~5.0.7, TypeScript ~5.8
- **Backend:** Supabase (PostgreSQL 15 + Auth + Storage + Realtime + Edge Functions/Deno)
- **AI:** Provider-agnostic (OpenAI / Anthropic / Gemini) via edge function
- **Payments:** Stripe (international) + M-Pesa Daraja (Kenya)
- **Notifications:** SendGrid/Mailgun (email), Africa's Talking/Twilio (SMS), Expo Push

## Directory Structure
```
app/           107 screens across 11 role groups
components/    13 reusable UI + layout components
contexts/      3 React Context providers
hooks/         6 custom hooks
lib/           4 utility modules (tenant, totp, rateLimiter, types)
services/      35 service files (backend API layer)
supabase/      3 migrations + 10 edge functions
.github/       6 CI/CD workflows
docs/          12 documentation files
tests/         5 test suites
```

## Architecture Diagram
```
┌─────────────────────────────────┐
│     Mobile / Web (Expo RN)      │
│  107 screens · 11 role groups   │
│  <RequireRole> on every route   │
└───────────────┬─────────────────┘
                │
┌───────────────▼─────────────────┐
│     Service Layer (35 files)    │
│  tenantGuard() on every call    │
│  schoolId first param enforced  │
└───────────────┬─────────────────┘
                │
┌───────────────▼─────────────────┐
│        Supabase Backend         │
│  ┌─────────────────────────┐    │
│  │ Auth (JWT + MFA + TOTP) │    │
│  │ 77 Tables (RLS on all)  │    │
│  │ 10 Edge Functions       │    │
│  │ 9 Storage Buckets       │    │
│  │ Realtime (WebSocket)    │    │
│  └─────────────────────────┘    │
└───────────────┬─────────────────┘
                │
    ┌───────────┼───────────┐
    ▼           ▼           ▼
┌───────┐ ┌─────────┐ ┌─────────┐
│  AI   │ │ Payments │ │  Comms  │
│OpenAI │ │ Stripe   │ │SendGrid │
│Anthropic│ │ M-Pesa  │ │Twilio   │
│Gemini │ │          │ │Expo Push│
└───────┘ └─────────┘ └─────────┘
```

## 5-Layer Tenant Isolation
1. **UI Route Guard** — `<RequireRole allowed={[...]} />` on every route group
2. **Service Layer** — `tenantGuard(userSchoolId, requestedSchoolId)` throws on mismatch
3. **Supabase Auth** — JWT token attached to every request
4. **Database RLS** — `is_school_staff(school_id)` policy on every table
5. **DB Trigger** — `enforce_school_id()` raises exception if school_id is NULL
