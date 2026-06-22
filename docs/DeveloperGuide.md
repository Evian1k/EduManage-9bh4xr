# Developer Guide

## Local Setup
```bash
pnpm install
cp .env.example .env  # fill in Supabase credentials
pnpm start
```

## Conventions
- Every service function: `schoolId` first param, returns `{ data, error: string | null }`
- Every screen: `Header` + `SafeAreaView` + `LoadingScreen` guard if no schoolId
- Every route group: wrapped in `<RequireRole allowed={[...]} />`
- Never hardcode school_id — always from `useAppContext()`

## Adding a New Module
1. Add table to `supabase/migrations/` (with school_id, RLS policy)
2. Create `services/<module>.service.ts`
3. Create `app/(role)/<module>.tsx` screens
4. Register route in `app/(role)/_layout.tsx`
5. Add to role's bottom nav if needed

## Adding a New Role
1. Add to `user_role` enum in migration
2. Create `app/(role)/_layout.tsx` with RequireRole
3. Add Stack.Screen in `app/_layout.tsx`
4. Add route case in `app/index.tsx`

## Database Migrations
Write new SQL files in `supabase/migrations/` with timestamp prefix. Apply with `supabase db push`.

## Testing
```bash
pnpm test              # all tests
pnpm test:tenant       # tenant isolation tests (needs Supabase)
```

## Deployment
See [Deployment.md](Deployment.md)
