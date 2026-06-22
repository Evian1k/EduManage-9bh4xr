-- EduManage — Multi-tenant SaaS Foundation

create extension if not exists "pgcrypto";

do $$ begin
  create type user_role as enum ('school_owner','principal','deputy_principal','administrator','teacher','student','parent','secretary','bursar','librarian','nurse','ict_manager','driver','groundskeeper','counselor','boarding_master','boarding_mistress','platform_admin');
exception when duplicate_object then null; end $$;
do $$ begin create type subscription_plan as enum ('starter', 'professional', 'enterprise'); exception when duplicate_object then null; end $$;
do $$ begin create type subscription_status as enum ('trialing', 'active', 'past_due', 'canceled', 'expired'); exception when duplicate_object then null; end $$;
do $$ begin create type invitation_status as enum ('pending', 'accepted', 'expired', 'revoked'); exception when duplicate_object then null; end $$;
do $$ begin create type domain_status as enum ('pending', 'verified', 'failed', 'ssl_pending', 'active', 'removed'); exception when duplicate_object then null; end $$;
do $$ begin create type audit_severity as enum ('info', 'warning', 'critical'); exception when duplicate_object then null; end $$;

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null, slug text not null unique, subdomain text not null unique,
  country text, county text, city text, address text, phone text, email text, website text, motto text, logo_url text,
  primary_color text default '#0B1426', accent_color text default '#FFD700',
  status text default 'active', plan_status subscription_status default 'trialing', plan_tier subscription_plan default 'starter',
  trial_ends_at timestamptz, plan_renews_at timestamptz,
  ai_usage_count integer default 0, ai_usage_limit integer default 1000,
  max_students integer default 500, max_staff integer default 50, max_storage_mb integer default 1024,
  settings jsonb default '{}'::jsonb, created_at timestamptz default now(), updated_at timestamptz default now()
);
create index if not exists idx_schools_subdomain on public.schools(subdomain);

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique, email text not null unique, full_name text, phone text, avatar_url text,
  default_school_id uuid references public.schools(id) on delete set null,
  mfa_enabled boolean default false, mfa_secret text,
  email_verified boolean default false, phone_verified boolean default false,
  failed_login_count integer default 0, locked_until timestamptz,
  last_login_at timestamptz, last_login_ip text, last_device_fingerprint text,
  status text default 'active', metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create index if not exists idx_user_profiles_auth_user on public.user_profiles(auth_user_id);

create table if not exists public.school_users (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  role user_role not null, is_active boolean default true, invited_by uuid references public.user_profiles(id),
  joined_at timestamptz default now(), metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  unique(school_id, user_id)
);
create index if not exists idx_school_users_school on public.school_users(school_id);
create index if not exists idx_school_users_user on public.school_users(user_id);

create table if not exists public.school_invitations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  email text not null, role user_role not null, token text not null unique,
  invited_by uuid not null references public.user_profiles(id),
  status invitation_status default 'pending', expires_at timestamptz not null,
  accepted_at timestamptz, accepted_by uuid references public.user_profiles(id),
  metadata jsonb default '{}'::jsonb, created_at timestamptz default now()
);
create index if not exists idx_invitations_school on public.school_invitations(school_id);
create index if not exists idx_invitations_token on public.school_invitations(token);

create table if not exists public.custom_domains (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  domain text not null, domain_type text not null, verification_token text,
  verification_method text default 'txt', status domain_status default 'pending',
  verified_at timestamptz, ssl_status text default 'none', ssl_expires_at timestamptz,
  is_primary boolean default false, created_at timestamptz default now(), updated_at timestamptz default now()
);
create unique index if not exists idx_custom_domains_domain on public.custom_domains(domain);

create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  tier subscription_plan not null unique, name text not null, description text,
  price_monthly_usd numeric(10,2) default 0, price_yearly_usd numeric(10,2) default 0,
  max_students integer default 500, max_staff integer default 50, max_storage_mb integer default 1024,
  ai_usage_limit integer default 1000, features jsonb default '{}'::jsonb, is_active boolean default true,
  created_at timestamptz default now()
);
insert into public.subscription_plans (tier, name, description, price_monthly_usd, price_yearly_usd, max_students, max_staff, max_storage_mb, ai_usage_limit, features) values
  ('starter', 'Starter', 'For small schools getting started', 29.00, 290.00, 500, 50, 1024, 1000, '{"modules":["academics","finance","attendance","messaging"]}'),
  ('professional', 'Professional', 'For growing schools with advanced needs', 99.00, 990.00, 5000, 200, 10240, 10000, '{"modules":["all"]}'),
  ('enterprise', 'Enterprise', 'For large institutions & school groups', 299.00, 2990.00, 50000, 1000, 102400, 100000, '{"modules":["all"],"custom_domain":true,"sso":true}')
on conflict (tier) do nothing;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  plan_tier subscription_plan not null default 'starter', status subscription_status not null default 'trialing',
  current_period_start timestamptz default now(), current_period_end timestamptz, trial_ends_at timestamptz,
  canceled_at timestamptz, payment_provider text, provider_customer_id text, provider_subscription_id text,
  amount_usd numeric(10,2), currency text default 'USD', metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create index if not exists idx_subscriptions_school on public.subscriptions(school_id);

create table if not exists public.audit_logs (
  id uuid default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  user_id uuid references public.user_profiles(id) on delete set null,
  action text not null, resource_type text, resource_id text, details jsonb default '{}'::jsonb,
  ip_address text, user_agent text, severity audit_severity default 'info',
  created_at timestamptz not null default now(), primary key (id, created_at)
) partition by range (created_at);
do $$ declare m date := date_trunc('month', current_date); i int; p_start date; p_end date; p_name text;
begin for i in -1..12 loop p_start := (m + (i || ' months')::interval)::date; p_end := (m + ((i+1) || ' months')::interval)::date;
p_name := 'audit_logs_' || to_char(p_start, 'YYYY_MM');
execute format('create table if not exists public.%I partition of public.audit_logs for values from (%L) to (%L)', p_name, p_start, p_end); end loop; end $$;
create index if not exists idx_audit_school_created on public.audit_logs(school_id, created_at desc);
create index if not exists idx_audit_action_created on public.audit_logs(action, created_at desc);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  user_id uuid references public.user_profiles(id) on delete cascade,
  title text not null, body text, type text, category text, data jsonb default '{}'::jsonb,
  read_at timestamptz, created_at timestamptz default now()
);
create index if not exists idx_notifications_user on public.notifications(user_id);

create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  channel text not null, category text not null, enabled boolean default true,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  unique(user_id, channel, category)
);

create table if not exists public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  device_fingerprint text not null, device_name text, platform text,
  last_ip text, last_seen_at timestamptz default now(), trusted boolean default false,
  created_at timestamptz default now(), unique(user_id, device_fingerprint)
);
create index if not exists idx_user_devices_user on public.user_devices(user_id);

create table if not exists public.rate_limit_log (
  id uuid primary key default gen_random_uuid(),
  identifier text not null, action text not null, created_at timestamptz default now()
);
create index if not exists idx_rate_limit_lookup on public.rate_limit_log(identifier, action, created_at);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create or replace function public.increment_school_ai_usage(p_school_id uuid) returns void language plpgsql security definer as $$
begin update public.schools set ai_usage_count = ai_usage_count + 1 where id = p_school_id; end $$;
create or replace function public.current_profile_id() returns uuid language sql security definer stable as $$
  select id from public.user_profiles where auth_user_id = auth.uid(); $$;
create or replace function public.is_platform_admin() returns boolean language sql security definer stable as $$
  select exists (select 1 from public.school_users where user_id = public.current_profile_id() and role = 'platform_admin'); $$;
create or replace function public.is_school_admin(p_school_id uuid) returns boolean language sql security definer stable as $$
  select exists (select 1 from public.school_users where school_id = p_school_id and user_id = public.current_profile_id() and role in ('school_owner','principal','deputy_principal','administrator','ict_manager')); $$;
create or replace function public.is_school_staff(p_school_id uuid) returns boolean language sql security definer stable as $$
  select exists (select 1 from public.school_users where school_id = p_school_id and user_id = public.current_profile_id() and is_active = true); $$;

alter table public.schools enable row level security;
alter table public.user_profiles enable row level security;
alter table public.school_users enable row level security;
alter table public.school_invitations enable row level security;
alter table public.custom_domains enable row level security;
alter table public.subscriptions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.user_devices enable row level security;
alter table public.rate_limit_log enable row level security;

drop policy if exists schools_select on public.schools;
create policy schools_select on public.schools for select using (public.is_platform_admin() or id in (select school_id from public.school_users where user_id = public.current_profile_id()));
drop policy if exists schools_insert on public.schools;
create policy schools_insert on public.schools for insert with check (true);
drop policy if exists schools_update on public.schools;
create policy schools_update on public.schools for update using (public.is_platform_admin() or id in (select school_id from public.school_users su where su.user_id = public.current_profile_id() and su.role in ('school_owner','principal','administrator','ict_manager')));
drop policy if exists user_profiles_select on public.user_profiles;
create policy user_profiles_select on public.user_profiles for select using (id = public.current_profile_id() or public.is_platform_admin());
drop policy if exists user_profiles_insert on public.user_profiles;
create policy user_profiles_insert on public.user_profiles for insert with check (true);
drop policy if exists user_profiles_update on public.user_profiles;
create policy user_profiles_update on public.user_profiles for update using (id = public.current_profile_id() or public.is_platform_admin());
drop policy if exists school_users_select on public.school_users;
create policy school_users_select on public.school_users for select using (public.is_platform_admin() or school_id in (select school_id from public.school_users su where su.user_id = public.current_profile_id()));
drop policy if exists school_users_insert on public.school_users;
create policy school_users_insert on public.school_users for insert with check (public.is_platform_admin() or exists (select 1 from public.school_users su where su.school_id = school_users.school_id and su.user_id = public.current_profile_id() and su.role in ('school_owner','principal','administrator','ict_manager')));
drop policy if exists school_users_update on public.school_users;
create policy school_users_update on public.school_users for update using (public.is_platform_admin() or exists (select 1 from public.school_users su where su.school_id = school_users.school_id and su.user_id = public.current_profile_id() and su.role in ('school_owner','principal','administrator','ict_manager')));
drop policy if exists school_users_delete on public.school_users;
create policy school_users_delete on public.school_users for delete using (public.is_platform_admin() or exists (select 1 from public.school_users su where su.school_id = school_users.school_id and su.user_id = public.current_profile_id() and su.role in ('school_owner','principal','administrator','ict_manager')));
drop policy if exists invitations_select on public.school_invitations;
create policy invitations_select on public.school_invitations for select using (public.is_platform_admin() or email = (select email from public.user_profiles where id = public.current_profile_id()) or school_id in (select school_id from public.school_users su where su.user_id = public.current_profile_id()));
drop policy if exists invitations_insert on public.school_invitations;
create policy invitations_insert on public.school_invitations for insert with check (public.is_platform_admin() or exists (select 1 from public.school_users su where su.school_id = school_invitations.school_id and su.user_id = public.current_profile_id() and su.role in ('school_owner','principal','administrator','ict_manager')));
drop policy if exists invitations_update on public.school_invitations;
create policy invitations_update on public.school_invitations for update using (true);
drop policy if exists invitations_delete on public.school_invitations;
create policy invitations_delete on public.school_invitations for delete using (public.is_platform_admin() or exists (select 1 from public.school_users su where su.school_id = school_invitations.school_id and su.user_id = public.current_profile_id() and su.role in ('school_owner','principal','administrator','ict_manager')));
drop policy if exists custom_domains_select on public.custom_domains;
create policy custom_domains_select on public.custom_domains for select using (public.is_platform_admin() or school_id in (select school_id from public.school_users su where su.user_id = public.current_profile_id()));
drop policy if exists custom_domains_insert on public.custom_domains;
create policy custom_domains_insert on public.custom_domains for insert with check (public.is_platform_admin() or exists (select 1 from public.school_users su where su.school_id = custom_domains.school_id and su.user_id = public.current_profile_id() and su.role in ('school_owner','principal','administrator','ict_manager')));
drop policy if exists custom_domains_update on public.custom_domains;
create policy custom_domains_update on public.custom_domains for update using (public.is_platform_admin() or exists (select 1 from public.school_users su where su.school_id = custom_domains.school_id and su.user_id = public.current_profile_id() and su.role in ('school_owner','principal','administrator','ict_manager')));
drop policy if exists custom_domains_delete on public.custom_domains;
create policy custom_domains_delete on public.custom_domains for delete using (public.is_platform_admin() or exists (select 1 from public.school_users su where su.school_id = custom_domains.school_id and su.user_id = public.current_profile_id() and su.role in ('school_owner','principal','administrator','ict_manager')));
drop policy if exists subscriptions_select on public.subscriptions;
create policy subscriptions_select on public.subscriptions for select using (public.is_platform_admin() or school_id in (select school_id from public.school_users su where su.user_id = public.current_profile_id()));
drop policy if exists subscriptions_insert on public.subscriptions;
create policy subscriptions_insert on public.subscriptions for insert with check (public.is_platform_admin() or exists (select 1 from public.school_users su where su.school_id = subscriptions.school_id and su.user_id = public.current_profile_id() and su.role in ('school_owner','principal','administrator')));
drop policy if exists subscriptions_update on public.subscriptions;
create policy subscriptions_update on public.subscriptions for update using (public.is_platform_admin() or exists (select 1 from public.school_users su where su.school_id = subscriptions.school_id and su.user_id = public.current_profile_id() and su.role in ('school_owner','principal','administrator')));
drop policy if exists audit_logs_insert on public.audit_logs;
create policy audit_logs_insert on public.audit_logs for insert with check (true);
drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs for select using (public.is_platform_admin() or (school_id in (select school_id from public.school_users su where su.user_id = public.current_profile_id() and su.role in ('school_owner','principal','administrator','ict_manager'))) or (user_id = public.current_profile_id()));
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select using (user_id = public.current_profile_id());
drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications for insert with check (true);
drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications for update using (user_id = public.current_profile_id());
drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications for delete using (user_id = public.current_profile_id() or public.is_platform_admin());
drop policy if exists notif_prefs_select on public.notification_preferences;
create policy notif_prefs_select on public.notification_preferences for select using (user_id = public.current_profile_id());
drop policy if exists notif_prefs_insert on public.notification_preferences;
create policy notif_prefs_insert on public.notification_preferences for insert with check (user_id = public.current_profile_id());
drop policy if exists notif_prefs_update on public.notification_preferences;
create policy notif_prefs_update on public.notification_preferences for update using (user_id = public.current_profile_id());
drop policy if exists notif_prefs_delete on public.notification_preferences;
create policy notif_prefs_delete on public.notification_preferences for delete using (user_id = public.current_profile_id());
drop policy if exists user_devices_select on public.user_devices;
create policy user_devices_select on public.user_devices for select using (user_id = public.current_profile_id());
drop policy if exists user_devices_insert on public.user_devices;
create policy user_devices_insert on public.user_devices for insert with check (user_id = public.current_profile_id());
drop policy if exists user_devices_update on public.user_devices;
create policy user_devices_update on public.user_devices for update using (user_id = public.current_profile_id());
drop policy if exists user_devices_delete on public.user_devices;
create policy user_devices_delete on public.user_devices for delete using (user_id = public.current_profile_id());
drop policy if exists rate_limit_deny_all on public.rate_limit_log;
create policy rate_limit_deny_all on public.rate_limit_log for all using (false) with check (false);

do $$ declare t text; tables text[] := array['schools','user_profiles','school_users','subscriptions'];
begin foreach t in array tables loop execute format('drop trigger if exists trg_%1$s_touch on public.%1$I', t);
execute format('create trigger trg_%1$s_touch before update on public.%1$I for each row execute function public.touch_updated_at()', t); end loop; end $$;
