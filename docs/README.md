# EduManage Documentation

Documentation for EduManage — a production-ready multi-tenant school management SaaS platform.

## Quick Start
```bash
pnpm install
cp .env.example .env   # fill in Supabase credentials
pnpm start
```

## Documentation Index
| Document | Description |
|---|---|
| [Architecture](Architecture.md) | Tech stack, directory structure, multi-tenant model |
| [Database](Database.md) | All 77 tables, RLS policies, SQL functions |
| [MultiTenant](MultiTenant.md) | Tenant isolation, domain routing, 5-layer security |
| [Security](Security.md) | MFA, rate limiting, audit logs, RBAC |
| [API](API.md) | Service + edge function reference |
| [Deployment](Deployment.md) | Step-by-step deployment guide |
| [AI](AI.md) | Provider-agnostic AI (OpenAI/Anthropic/Gemini) |
| [AdminGuide](AdminGuide.md) | For school administrators |
| [UserGuide](UserGuide.md) | For all users (teachers, students, parents) |
| [DeveloperGuide](DeveloperGuide.md) | For developers extending the platform |
| [ProductionOps](operations/ProductionOps.md) | Running at 10M+ user scale |
