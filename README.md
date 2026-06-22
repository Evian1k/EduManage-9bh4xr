# EduManage

**Production-ready multi-tenant School Management SaaS platform.**

Built with React Native (Expo) + Supabase. Each school operates as an isolated tenant with subdomain routing, custom domains, role-based access control, configurable AI providers (OpenAI / Anthropic / Gemini), and a 77-table schema enforced by Row-Level Security.

---

## Table of Contents

1. [What is EduManage](#what-is-edumanage)
2. [Architecture Diagram](#architecture-diagram)
3. [How It Works](#how-it-works)
4. [Tech Stack](#tech-stack)
5. [Project Structure](#project-structure)
6. [Multi-Tenant Flow](#multi-tenant-flow)
17. [Database Schema](#database-schema)
18. [Roles & Permissions](#roles--permissions)
19. [Quick Start](#quick-start)
20. [Deployment](#deployment)
21. [Environment Variables](#environment-variables)
22. [Documentation](#documentation)

---

## What is EduManage

EduManage is a complete school management platform that serves **multiple schools** from a single deployment. Each school (tenant) gets:

- **Isolated data** — no school can see another school's students, staff, or finances
- **Custom branding** — logo, colors, motto
- **Custom domain** — `portal.yourschool.edu` or `yourschool.edumanage.com`
- **17 role types** — from school owner down to groundskeeper
- **Full module suite** — academics, finance, HR, LMS, library, medical, transport, boarding, AI, analytics
- **Multi-language support (i18n)** — English, Swahili, French, Arabic (RTL), Spanish
- **Real-time notifications** — live unread counts via Supabase Realtime WebSocket

The platform scales to **10 million+ users worldwide** with partitioned audit logs, materialized views, and 5-layer tenant isolation.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER DEVICES                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │  Mobile   │  │  Mobile  │  │  Tablet  │  │  Web     │  │  Web     │ │
│  │ (Android) │  │  (iOS)   │  │          │  │ Browser  │  │ Browser  │ │
│  └─────┬─────┘  └─────┬────┘  └─────┬────┘  └─────┬────┘  └─────┬────┘ │
└────────┼──────────────┼─────────────┼─────────────┼─────────────┼──────┘
         │              │             │             │             │
         └──────────────┴─────────────┴─────────────┴─────────────┘
                                    │
                                    │ HTTPS (REST + Realtime WebSocket)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (Expo RN)                              │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  expo-router (file-based routing, 11 role groups)                │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐         │   │
│  │  │(admin) │ │(teacher)│ │(student)│ │(parent)│ │(bursar)│  ...    │   │
│  │  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘         │   │
│  │  Each group wrapped in <RequireRole allowed={[...]} />           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Contexts:  AppContext (school/role) + NotificationsProvider     │   │
│  │  Hooks:     usePushNotifications, useRealtimeNotifications       │   │
│  │  Lib:       tenant.ts (guards), totp.ts (MFA), rateLimiter.ts    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  35 Service Files (TypeScript)                                   │   │
│  │  finance.service · hr.service · lms.service · ai.service · ...   │   │
│  │  Every function: schoolId first param → tenantGuard enforced     │   │
│  └────────────────────────────┬────────────────────────────────────┘   │
└───────────────────────────────┼─────────────────────────────────────────┘
                                │
                                │ Supabase JS SDK
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        SUPABASE BACKEND                                  │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  AUTH (Supabase Auth)                                            │   │
│  │  Email/Password · MFA (TOTP) · Email Verification · Lockout     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  DATABASE (PostgreSQL 15)                                        │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │   │
│  │  │  77 Tables   │  │  RLS Policies │  │  Triggers    │           │   │
│  │  │  (all with   │  │  (every table)│  │  (school_id  │           │   │
│  │  │  school_id)  │  │              │  │   enforced)  │           │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘           │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │   │
│  │  │  22 Indexes  │  │  Full-Text   │  │  Materialized│           │   │
│  │  │  (composite) │  │  Search (GIN)│  │  Views       │           │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘           │   │
│  │  ┌──────────────┐                                                 │   │
│  │  │  audit_logs  │  ← Partitioned by month (scales to billions)   │   │
│  │  └──────────────┘                                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  EDGE FUNCTIONS (Deno · TypeScript)                              │   │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────────┐  │   │
│  │  │ai-assistant│ │send-notifs │ │verify-domain│ │send-push-notif│  │   │
│  │  └────────────┘ └────────────┘ └────────────┘ └──────────────┘  │   │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────────┐  │   │
│  │  │stripe-     │ │stripe-     │ │mpesa-stk   │ │mpesa-callback│  │   │
│  │  │checkout    │ │webhook     │ │            │ │              │  │   │
│  │  └────────────┘ └────────────┘ └────────────┘ └──────────────┘  │   │
│  │  ┌────────────┐ ┌────────────────────────────────────────────┐  │   │
│  │  │seed-demo   │ │ _shared/middleware.ts (auth + rate limit)  │  │   │
│  │  │(onboarding)│ │  authenticate() · verifyTenant()           │  │   │
│  │  └────────────┘ └────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  STORAGE (9 buckets)                                             │   │
│  │  school-logos · user-avatars · student-photos · library-covers  │   │
│  │  assignment-attachments · announcement-attachments (public)      │   │
│  │  medical-documents · financial-documents · staff-documents (priv)│   │
│  └─────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  REALTIME (WebSocket)                                            │   │
│  │  notifications:{userId} channel → live unread count              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│  AI Providers  │  │    Payments    │  │  Comms         │
│                │  │                │  │                │
│  · OpenAI      │  │  · Stripe      │  │  · SendGrid    │
│  · Anthropic   │  │  · M-Pesa      │  │  · Mailgun     │
│  · Gemini      │  │    Daraja      │  │  · Africa's    │
│                │  │                │  │    Talking     │
│ (configurable  │  │ (webhooks for  │  │  · Twilio      │
│  per school)   │  │  callbacks)    │  │  · Expo Push   │
└────────────────┘  └────────────────┘  └────────────────┘
```

---

## How It Works

### 1. School Registration Flow

```
┌──────────┐     ┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│ Visitor  │────▶│  Register   │────▶│  Creates:    │────▶│  Owner can  │
│ visits   │     │  School at  │     │  · auth user │     │  now invite │
│ edumanage│     │  /register  │     │  · user      │     │  staff      │
│ .com     │     │             │     │    profile   │     │             │
└──────────┘     └─────────────┘     │  · school    │     └─────────────┘
                                     │    record    │
                                     │  · school_   │
                                     │    users     │
                                     │    (owner)   │
                                     │  · subscript │
                                     │    ion (14d  │
                                     │    trial)    │
                                     │  · notif     │
                                     │    prefs     │
                                     │  · audit log │
                                     └──────────────┘
```

### 2. Staff Invitation Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  School  │────▶│  Invite  │────▶│  Email   │────▶│  Staff   │────▶│  Staff   │
│  Owner   │     │  Staff   │     │  sent    │     │  clicks  │     │  joins   │
│          │     │  (email  │     │  with    │     │  accept  │     │  school  │
│  /admin/ │     │  + role) │     │  token   │     │  link    │     │  with    │
│  invites │     │          │     │          │     │          │     │  assigned│
└──────────┘     └──────────┘     └──────────┘     └──────────┘     └──────────┘
                                                       │
                                                       ▼
                                               ┌──────────────┐
                                               │  Creates:    │
                                               │  · auth user │
                                               │  · profile   │
                                               │  · school_   │
                                               │    users     │
                                               │    (role)    │
                                               │  · notif     │
                                               │    prefs     │
                                               │  · audit log │
                                               └──────────────┘
```

### 3. Request Flow (5-Layer Security)

```
User action (e.g. "Create Student")
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│  LAYER 1: UI Route Guard                                │
│  <RequireRole allowed={['administrator', ...]} />       │
│  → If role not allowed: redirect to /login              │
└────────────────────────┬────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│  LAYER 2: Service Layer                                 │
│  services/student.service.ts → admitStudent(schoolId,…) │
│  → tenantGuard(userSchoolId, schoolId) throws on mismatch│
└────────────────────────┬────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│  LAYER 3: Supabase Auth (JWT)                           │
│  Supabase client attaches Bearer token automatically    │
│  → Invalid/expired token: 401 Unauthorized              │
└────────────────────────┬────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│  LAYER 4: Database RLS Policies                         │
│  SELECT/INSERT/UPDATE/DELETE policies check:            │
│  is_school_admin(school_id) OR is_platform_admin()      │
│  → Silent empty result or error if not authorized       │
└────────────────────────┬────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│  LAYER 5: DB Trigger (BEFORE INSERT)                    │
│  enforce_school_id() raises exception if school_id NULL │
└─────────────────────────────────────────────────────────┘
```

### 4. AI Request Flow

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────┐
│  User    │────▶│  ai.service  │────▶│  Edge Func   │────▶│  OpenAI  │
│  opens   │     │  invokeAI()  │     │  ai-assistant│     │  OR      │
│  AI chat │     │              │     │              │     │  Anthropic│
└──────────┘     └──────────────┘     └──────┬───────┘     │  OR      │
                                              │             │  Gemini  │
                                              ▼             └──────────┘
                                    ┌──────────────┐
                                    │  1. Auth     │
                                    │  2. Rate     │
                                    │     limit    │
                                    │     (60/min) │
                                    │  3. Tenant   │
                                    │     verify   │
                                    │  4. Atomic   │
                                    │     AI limit │
                                    │     check    │
                                    │  5. Call AI  │
                                    │  6. Log usage│
                                    └──────────────┘
```

### 5. Payment Flow (M-Pesa Example)

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────┐
│  Parent  │────▶│  mpesa-stk   │────▶│  Safaricom   │────▶│  Parent  │
│  pays    │     │  edge func   │     │  Daraja API  │     │  phone   │
│  fees    │     │              │     │              │     │  prompts │
└──────────┘     └──────────────┘     └──────────────┘     │  for PIN │
                                                           └─────┬────┘
                                                                 │
                                                                 ▼
                                                           ┌──────────┐
                                                           │  Parent  │
                                                           │  enters  │
                                                           │  PIN     │
                                                           └─────┬────┘
                                                                 │
                                                                 ▼
┌──────────────────┐     ┌──────────────┐     ┌──────────────────────┐
│  Database        │◀────│  mpesa-      │◀────│  Safaricom callback  │
│  updated:        │     │  callback    │     │  (with transaction   │
│  · payment=done  │     │  edge func   │     │   reference)         │
│  · invoice=paid  │     └──────────────┘     └──────────────────────┘
│  · receipt gen   │
│  · audit logged  │
└──────────────────┘
```

---

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React Native | 0.79.3 | Cross-platform mobile framework |
| Expo | ~53.0.9 | Build tooling + OTA updates |
| expo-router | ~5.0.7 | File-based navigation |
| React | 19.0.0 | UI library |
| TypeScript | ~5.8.3 | Type safety |
| Supabase JS SDK | ^2.50.0 | Backend client |
| i18n (custom) | 5 languages | English, Swahili, French, Arabic (RTL), Spanish |

### Backend
| Technology | Purpose |
|---|---|
| Supabase (PostgreSQL 15) | Database + Auth + Storage + Realtime |
| Deno Edge Functions | Serverless backend logic |
| Row-Level Security | Database-level tenant isolation |

### External Integrations
| Service | Purpose | Required? |
|---|---|---|
| OpenAI / Anthropic / Gemini | AI features (pick 1) | ✅ |
| Stripe | International payments | ✅ |
| M-Pesa Daraja | Kenyan mobile money | ✅ for Kenya |
| SendGrid / Mailgun | Email (pick 1) | ✅ |
| Africa's Talking / Twilio | SMS (pick 1) | ✅ |
| Expo Push | Mobile push notifications | ✅ |
| Sentry | Error tracking | Recommended |

---

## Project Structure

```
EduManage/
├── app/                          # Screens (expo-router file-based routing)
│   ├── _layout.tsx              # Root layout (ErrorBoundary + providers)
│   ├── index.tsx                # Role-based redirect
│   ├── login.tsx                # Login screen
│   ├── register.tsx             # School registration
│   ├── forgot-password.tsx      # Password reset request
│   ├── reset-password.tsx       # New password entry
│   ├── verify-email.tsx         # Email verification
│   ├── mfa-challenge.tsx        # TOTP MFA verification
│   ├── invite/accept.tsx        # Staff invitation acceptance
│   ├── notifications.tsx        # Notification center
│   ├── profile.tsx              # User profile + MFA + devices
│   ├── settings.tsx             # App settings
│   ├── search.tsx               # Global search
│   ├── rulebook.tsx             # Compliance rulebook
│   ├── (admin)/                 # Admin role group (RequireRole guarded)
│   │   ├── _layout.tsx
│   │   ├── index.tsx            # Admin dashboard
│   │   ├── students.tsx
│   │   ├── teachers.tsx
│   │   ├── classes.tsx
│   │   ├── finance.tsx
│   │   ├── hr.tsx
│   │   ├── payroll.tsx
│   │   ├── leave.tsx
│   │   ├── staff.tsx
│   │   ├── invitations.tsx
│   │   ├── domains.tsx
│   │   ├── subscription.tsx
│   │   ├── analytics.tsx
│   │   ├── academic.tsx
│   │   ├── transport.tsx
│   │   ├── boarding.tsx
│   │   ├── settings.tsx
│   │   └── timetable.tsx
│   ├── (bursar)/                # Bursar role group
│   ├── (ict)/                   # ICT manager role group
│   ├── (librarian)/             # Librarian role group
│   ├── (nurse)/                 # Nurse role group
│   ├── (secretary)/             # Secretary role group
│   ├── (student)/               # Student role group
│   ├── (teacher)/               # Teacher role group
│   ├── (parent)/                # Parent role group
│   ├── (boarding)/              # Boarding master/mistress role group
│   └── (superadmin)/            # Platform admin role group
│
├── components/                   # Reusable UI components
│   ├── auth/
│   │   └── RequireRole.tsx      # Route guard component
│   ├── ErrorBoundary.tsx        # Catches runtime errors
│   ├── layout/
│   │   ├── Header.tsx
│   │   ├── BottomNav.tsx
│   │   └── ScreenWrapper.tsx
│   └── ui/
│       ├── Button.tsx
│       ├── Card.tsx
│       ├── Input.tsx
│       ├── Avatar.tsx
│       ├── Badge.tsx
│       ├── EmptyState.tsx
│       ├── LoadingScreen.tsx
│       └── StatCard.tsx
│
├── contexts/                     # React Context providers
│   ├── AppContext.tsx           # School + role + profile state
│   ├── NotificationContext.tsx  # Unread count + latest notification
│   └── NotificationsProvider.tsx # Wraps app with push + realtime
│
├── hooks/                        # Custom React hooks
│   ├── useAppContext.ts
│   ├── useRealtimeNotifications.ts  # Supabase Realtime subscription
│   └── usePushNotifications.ts      # Expo push token registration
│
├── lib/                          # Core utilities
│   ├── tenant.ts                # tenantGuard + useTenantValidation
│   ├── totp.ts                  # RFC 6238 TOTP (MFA)
│   ├── rateLimiter.ts           # Rate limiting + RATE_LIMITS config
│   └── types.ts                 # Shared TypeScript types
│
├── services/                     # Backend service layer (35 files)
│   ├── audit.service.ts         # Audit logging + rate limit helpers
│   ├── auth.security.service.ts # Lockout, MFA, password reset
│   ├── registration.service.ts  # School registration
│   ├── invitation.service.ts    # Staff invitations (16 roles)
│   ├── domain.service.ts        # Custom domain management
│   ├── ai.service.ts            # AI dispatch (OpenAI/Anthropic/Gemini)
│   ├── finance.service.ts       # Fees, invoices, payments, receipts
│   ├── hr.service.ts            # Staff, payroll, leave, performance
│   ├── communication.service.ts # Announcements, messages, SMS, email
│   ├── lms.service.ts           # Assignments, quizzes, lessons
│   ├── library.service.ts       # Books, borrows, fines
│   ├── medical.service.ts       # Medical records, visits
│   ├── transport.service.ts     # Routes, vehicles, drivers
│   ├── boarding.service.ts      # Dormitories, beds, attendance
│   ├── notification.service.ts  # In-app notifications
│   ├── analytics.service.ts     # 7 analytics dashboards
│   ├── subscription.service.ts  # Plan management
│   ├── school_management.service.ts # Academic years, terms, exams
│   ├── search.service.ts        # Global FTS search
│   ├── email.service.ts         # Email queue + templates
│   ├── sms.service.ts           # SMS queue + templates
│   ├── push.service.ts          # Push notification sender
│   ├── pdf.service.ts           # Receipt/report card PDF generation
│   ├── student.service.ts       # Student CRUD
│   └── ... (11 more legacy services)
│
├── supabase/                     # Supabase backend
│   ├── migrations/              # SQL migrations (3 files)
│   │   ├── 20250101000001_foundation.sql  (12 tables: schools, users, auth, billing)
│   │   ├── 20250101000002_modules.sql     (65 tables: all modules)
│   │   └── 20250101000003_storage_and_extras.sql (rulebook, storage, cron)
│   └── functions/               # Edge functions (Deno)
│       ├── _shared/
│       │   ├── cors.ts
│       │   └── middleware.ts    # authenticate, verifyTenant, rate limit
│       ├── ai-assistant/        # AI dispatcher (3 providers)
│       ├── send-notifications/  # Email/SMS queue drainer
│       ├── verify-domain/       # DNS TXT verification
│       ├── send-push-notification/ # Expo push
│       ├── seed-demo/           # Platform admin onboarding
│       ├── stripe-checkout/     # Stripe Checkout session
│       ├── stripe-webhook/      # Stripe event handler
│       ├── mpesa-stk/           # M-Pesa STK push
│       └── mpesa-callback/      # M-Pesa callback handler
│
├── .github/workflows/           # CI/CD (6 workflows)
│   ├── ci.yml                   # Test + build
│   ├── deploy-functions.yml     # Deploy all edge functions
│   ├── migrate-db.yml           # Run migrations
│   ├── health-check.yml         # Every 15 min
│   ├── load-test.yml            # Nightly k6
│   └── backup-db.yml            # Daily pg_dump
│
├── docs/                        # Documentation
├── tests/                       # Test suites
├── loadtest/                    # k6 load test config
└── scripts/                     # Utility scripts
```

---

## Multi-Tenant Flow

### Subdomain Routing

```
User visits: greenwood.edumanage.com
                    │
                    ▼
        ┌───────────────────────┐
        │ resolveSchoolByHostname│
        │                       │
        │ 1. Check custom_domains│
        │    table for exact    │
        │    domain match       │
        │                       │
        │ 2. If not found, try  │
        │    subdomain pattern: │
        │    *.edumanage.com    │
        │    *.edumanage.app    │
        │    *.edumanage.ai     │
        │                       │
        │ 3. Extract 'greenwood'│
        │    → query schools    │
        │    where subdomain=   │
        │    'greenwood'        │
        └───────────┬───────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │ School record found:  │
        │ {                     │
        │   id: "uuid-...",     │
        │   name: "Greenwood",  │
        │   subdomain: "greenwood"│
        │ }                     │
        │                       │
        │ → App loads with this │
        │   school's branding,  │
        │   data, and users     │
        └───────────────────────┘
```

### Custom Domain Flow

```
1. School admin adds domain: portal.school.ac.ke
   → custom_domains row created with verification_token

2. Admin adds TXT record to their DNS:
   @ IN TXT "edumanage-verify=abc123..."

3. Cron job (every 5 min) calls verify-domain edge function
   → Queries Google DNS-over-HTTPS for TXT records
   → If token matches: status → ssl_pending

4. SSL certificate issued
   → status → active

5. School's portal now live at portal.school.ac.ke
```

---

## Database Schema

**77 tables** across 3 migrations. All tenant-scoped tables have `school_id`.

### Foundation (12 tables)
| Table | Purpose |
|---|---|
| `schools` | Tenant records (subdomain, branding, plan) |
| `user_profiles` | Global user identity (auth_user_id → profile) |
| `school_users` | Tenant membership + role |
| `school_invitations` | Staff invitation tokens |
| `custom_domains` | Custom domain + DNS verification |
| `subscription_plans` | Starter / Professional / Enterprise |
| `subscriptions` | Per-school subscription state |
| `audit_logs` | Security audit trail (partitioned by month) |
| `notifications` | In-app notification center |
| `notification_preferences` | Per-user delivery prefs |
| `user_devices` | Device tracking for security |
| `rate_limit_log` | Rate limiting support |

### Modules (65 tables)
- **Academic:** academic_years, terms, subjects, classes, streams, students, guardians, teachers, teacher_subjects, timetable_slots, attendance, exams, exam_results, report_cards
- **LMS:** assignments, assignment_submissions, lessons, quizzes, quiz_questions, quiz_attempts, learning_resources, student_progress
- **Finance:** fee_structures, invoices, payments, receipts, scholarships, fines, transport_fees, payment_provider_config, financial_reports
- **HR:** staff_records, payroll_runs, payroll_items, leave_requests, performance_reviews, disciplinary_records, recruitment_applications
- **Communication:** announcements, messages, message_groups, message_group_members, sms_logs, email_logs, events, visitors
- **Library:** library_books, library_borrows
- **Medical:** medical_records, medical_visits, medication_administrations
- **Transport:** transport_routes, transport_vehicles, transport_drivers, transport_assignments, transport_logs
- **Boarding:** dormitories, dormitory_beds, boarding_attendance, dormitory_inspections
- **AI:** ai_usage_logs, ai_provider_config, ai_conversations
- **Compliance:** school_rule_acceptance

### RLS Pattern (every tenant table)
```sql
-- SELECT: any staff member of the school OR platform admin
CREATE POLICY select_policy ON students
  FOR SELECT USING (
    is_platform_admin() OR is_school_staff(school_id)
  );

-- INSERT/UPDATE/DELETE: school admins only
CREATE POLICY insert_policy ON students
  FOR INSERT WITH CHECK (
    is_platform_admin() OR is_school_admin(school_id)
  );
```

---

## Roles & Permissions

17 roles in the `user_role` enum:

| Role | Route Group | Can Manage School | Can Manage Staff | Finance | Academics |
|---|---|---|---|---|---|
| `platform_admin` | (superadmin) | All schools | All | All | All |
| `school_owner` | (admin) | ✅ | ✅ | ✅ | ✅ |
| `principal` | (admin) | ✅ | ✅ | ✅ | ✅ |
| `deputy_principal` | (admin) | ✅ | ✅ | ✅ | ✅ |
| `administrator` | (admin) | ✅ | ✅ | ✅ | ✅ |
| `ict_manager` | (ict) | ✅ | ✅ | ❌ | ❌ |
| `bursar` | (bursar) | ❌ | ❌ | ✅ | ❌ |
| `teacher` | (teacher) | ❌ | ❌ | ❌ | ✅ |
| `student` | (student) | ❌ | ❌ | view | view |
| `parent` | (parent) | ❌ | ❌ | view fees | view grades |
| `secretary` | (secretary) | ❌ | ❌ | ❌ | ❌ |
| `librarian` | (librarian) | ❌ | ❌ | ❌ | ❌ |
| `nurse` | (nurse) | ❌ | ❌ | ❌ | ❌ |
| `boarding_master` | (boarding) | ❌ | ❌ | ❌ | ❌ |
| `boarding_mistress` | (boarding) | ❌ | ❌ | ❌ | ❌ |
| `driver` | (admin) | ❌ | ❌ | ❌ | ❌ |
| `groundskeeper` | (admin) | ❌ | ❌ | ❌ | ❌ |
| `counselor` | (admin) | ❌ | ❌ | ❌ | ❌ |

---

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your Supabase URL + anon key

# 3. Run the app
pnpm start
# Scan QR with Expo Go (mobile) or press w for web
```

### First-time setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com)
2. **Run migrations:**
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push
   ```
3. **Deploy edge functions:**
   ```bash
   supabase functions deploy ai-assistant
   supabase functions deploy send-notifications
   supabase functions deploy verify-domain
   supabase functions deploy send-push-notification
   supabase functions deploy stripe-checkout
   supabase functions deploy stripe-webhook
   supabase functions deploy mpesa-stk
   supabase functions deploy mpesa-callback
   ```
4. **Set secrets:**
   ```bash
   supabase secrets set AI_PROVIDER=openai OPENAI_API_KEY=sk-...
   # (see .env.example for full list)
   ```
5. **Register your first school** at `/register`

---

## Deployment

### Mobile (Android + iOS)
```bash
eas build --platform android --profile production
eas build --platform ios --profile production
eas submit -p android --latest
eas submit -p ios --latest
```

### Web
```bash
pnpm web
# Deploy web-build/ to Vercel or Netlify
```

### Database
Migrations run automatically via GitHub Actions on push to main (`.github/workflows/migrate-db.yml`).

### Edge Functions
Deploy automatically via GitHub Actions on push to main (`.github/workflows/deploy-functions.yml`).

---

## Environment Variables

See [`.env.example`](.env.example) for the complete list. Categories:

| Category | Variables |
|---|---|
| **Supabase** | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` |
| **AI** | `AI_PROVIDER`, `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` |
| **Email** | `EMAIL_PROVIDER`, `SENDGRID_API_KEY` / `MAILGUN_API_KEY` |
| **SMS** | `SMS_PROVIDER`, `AFRICAS_TALKING_*` / `TWILIO_*` |
| **Payments** | `STRIPE_*`, `MPESA_*` |
| **Cron** | `CRON_API_KEY` |
| **Monitoring** | `EXPO_PUBLIC_SENTRY_DSN` |

---

## Documentation

| Document | Description |
|---|---|
| [Architecture](docs/Architecture.md) | Detailed architecture + tech stack |
| [Database](docs/Database.md) | All 77 tables + RLS policies |
| [MultiTenant](docs/MultiTenant.md) | Tenant isolation + domain routing |
| [Security](docs/Security.md) | 5-layer security model |
| [API](docs/API.md) | Service + edge function reference |
| [Deployment](docs/Deployment.md) | Step-by-step deployment |
| [AI](docs/AI.md) | Provider-agnostic AI architecture |
| [AdminGuide](docs/AdminGuide.md) | For school administrators |
| [UserGuide](docs/UserGuide.md) | For all users |
| [DeveloperGuide](docs/DeveloperGuide.md) | For developers extending the platform |
| [ProductionOps](docs/operations/ProductionOps.md) | Running at 10M+ scale |

---

## License

Proprietary — EduManage © 2025
