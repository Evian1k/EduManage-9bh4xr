# Security

## Authentication
- Supabase Auth (email/password)
- MFA via RFC 6238 TOTP (`lib/totp.ts`) — `verifyTOTP(secret, code, windowSteps=1)`
- Account lockout: 5 failed logins → 15-min lockout (`auth.security.service.ts`)
- Email verification flow
- Password reset with rate limiting (5/hour)

## Authorization (RBAC)
17 roles in `user_role` enum. Every route group wrapped in `<RequireRole allowed={[...]} />`. Database RLS enforces:
- `is_platform_admin()` — platform-wide access
- `is_school_admin(school_id)` — school_owner, principal, deputy_principal, administrator, ict_manager
- `is_school_staff(school_id)` — any active member
- Self-access for students (own records)
- Parent access for children's records

## Audit Logging
`services/audit.service.ts` — 30+ action types logged to `audit_logs` table (partitioned by month). Severities: info, warning, critical. Critical events: `cross_tenant_attempt`, `student_deleted`.

## Rate Limiting
`lib/rateLimiter.ts` with `RATE_LIMITS` config:
- LOGIN: 20 per 5 min
- PASSWORD_RESET: 5 per hour
- AI_REQUEST: 60 per min
- INVITATION_SEND: 50 per hour
- MESSAGE_SEND: 100 per min
- STUDENT_CREATE: 100 per hour
- INVOICE_CREATE: 200 per hour
- PAYMENT_RECORD: 200 per hour

## Device Tracking
`user_devices` table stores device fingerprint, platform, last IP, last seen, trusted status.

## Session Management
- Default: 60 minutes
- Remember-me: 30 days
- Forced logout on cross-tenant attempt

## Storage Security
9 storage buckets with RLS:
- Public (CDN): school-logos, user-avatars, student-photos, library-covers, attachments
- Private: medical-documents (nurse+admin), financial-documents (bursar+admin), staff-documents (admin only)
