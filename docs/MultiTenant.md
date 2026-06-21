# Multi-Tenant Architecture

## Tenant Model
Each school = isolated tenant identified by `school_id` UUID. Every record belongs to a school. No cross-school data access is possible.

## Subdomain Routing
```
greenwood.edumanage.com → schools where subdomain='greenwood'
```
`resolveSchoolByHostname()` in `services/registration.service.ts`:
1. Check `custom_domains` table for exact match
2. Try `*.edumanage.com` / `*.edumanage.app` / `*.edumanage.ai` patterns
3. Return school record or null

## Custom Domains
```
portal.school.ac.ke → custom_domains table → DNS TXT verification
```
1. Admin adds domain → `custom_domains` row with `verification_token`
2. Admin adds TXT record: `@ IN TXT "edumanage-verify=<token>"`
3. Cron (every 5 min) calls `verify-domain` edge function
4. Edge function queries Google DNS-over-HTTPS (`https://dns.google/resolve`)
5. If token matches: status → `ssl_pending` → `active`

## 5-Layer Tenant Isolation
1. **UI** — `<RequireRole>` on every route group
2. **Service** — `tenantGuard(userSchoolId, requestedSchoolId)` throws on mismatch
3. **Auth** — Supabase JWT on every request
4. **RLS** — `is_school_staff(school_id)` policy on every table
5. **Trigger** — `enforce_school_id()` rejects NULL school_id

## Cross-Tenant Detection
`useTenantValidation()` hook: on school_id mismatch → writes `cross_tenant_attempt` audit log (severity=critical) → signs out user → redirects to /login.

## Onboarding Flow
1. Visitor registers at /register
2. `registerSchool()` creates: auth user, user_profile, school, school_users (school_owner), subscription (14-day trial), notification preferences, audit log
3. Owner logs in → routed to /(admin)/
4. Owner invites staff at /(admin)/invitations
5. Staff receives email → accepts at /invite/accept → account created → joined to school
