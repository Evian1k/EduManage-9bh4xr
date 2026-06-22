# Database Schema

77 tables across 3 migrations, all tenant-scoped via `school_id` (except 6 global tables).

## Foundation (12 tables)
| Table | Purpose | school_id |
|---|---|---|
| schools | Tenant records | PK |
| user_profiles | Global user identity | — (global) |
| school_users | Tenant membership + role | ✅ |
| school_invitations | Staff invitation tokens | ✅ |
| custom_domains | Domain + DNS verification | ✅ |
| subscription_plans | Starter/Pro/Enterprise | — (global) |
| subscriptions | Per-school subscription | ✅ |
| audit_logs | Security audit trail | ✅ (partitioned by month) |
| notifications | In-app notifications | ✅ |
| notification_preferences | Per-user prefs | — (global) |
| user_devices | Device tracking | — (global) |
| rate_limit_log | Rate limiting | — (global) |

## Modules (65 tables)
- **Academic (14):** academic_years, terms, subjects, classes, streams, students, guardians, teachers, teacher_subjects, timetable_slots, attendance, exams, exam_results, report_cards
- **LMS (8):** assignments, assignment_submissions, lessons, quizzes, quiz_questions, quiz_attempts, learning_resources, student_progress
- **Finance (9):** fee_structures, invoices, payments, receipts, scholarships, fines, transport_fees, payment_provider_config, financial_reports
- **HR (7):** staff_records, payroll_runs, payroll_items, leave_requests, performance_reviews, disciplinary_records, recruitment_applications
- **Communication (8):** announcements, messages, message_groups, message_group_members, sms_logs, email_logs, events, visitors
- **Library (2):** library_books, library_borrows
- **Medical (3):** medical_records, medical_visits, medication_administrations
- **Transport (5):** transport_routes, transport_vehicles, transport_drivers, transport_assignments, transport_logs
- **Boarding (4):** dormitories, dormitory_beds, boarding_attendance, dormitory_inspections
- **AI (3):** ai_usage_logs, ai_provider_config, ai_conversations
- **Compliance (1):** school_rule_acceptance

## SQL Functions
- `current_profile_id()` — returns calling user's profile id
- `is_platform_admin()` — checks platform_admin role
- `is_school_admin(school_id)` — checks admin roles
- `is_school_staff(school_id)` — checks any active membership
- `check_and_increment_ai_usage(school_id)` — atomic AI limit check
- `enforce_school_id()` — BEFORE INSERT trigger, rejects NULL school_id
- `touch_updated_at()` — auto-update updated_at

## Enums
- `user_role` (17 values): school_owner, principal, deputy_principal, administrator, teacher, student, parent, secretary, bursar, librarian, nurse, ict_manager, driver, groundskeeper, counselor, boarding_master, boarding_mistress, platform_admin
- `subscription_plan`: starter, professional, enterprise
- `subscription_status`: trialing, active, past_due, canceled, expired
- `invitation_status`: pending, accepted, expired, revoked
- `domain_status`: pending, verified, failed, ssl_pending, active, removed
- `audit_severity`: info, warning, critical

## RLS Pattern
Every tenant table has SELECT (is_school_staff), INSERT/UPDATE/DELETE (is_school_admin) policies. Students get self-access policies. Parents get children-access policies.
