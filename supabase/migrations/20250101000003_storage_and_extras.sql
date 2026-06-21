-- EduManage — Storage buckets + Rulebook + Cron schedules

-- Rulebook
create table if not exists public.school_rule_acceptance (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references public.schools(id) on delete cascade,
  accepted_by_user_id uuid not null references public.user_profiles(id) on delete cascade,
  rulebook_version text not null default '1.0', accepted boolean not null default true,
  ip_address text, user_agent text, accepted_at timestamptz default now(),
  unique(school_id, accepted_by_user_id, rulebook_version)
);
alter table public.school_rule_acceptance enable row level security;
drop policy if exists rule_acceptance_select on public.school_rule_acceptance;
create policy rule_acceptance_select on public.school_rule_acceptance for select using (public.is_platform_admin() or school_id in (select school_id from public.school_users su where su.user_id = public.current_profile_id()) or accepted_by_user_id = public.current_profile_id());
drop policy if exists rule_acceptance_insert on public.school_rule_acceptance;
create policy rule_acceptance_insert on public.school_rule_acceptance for insert with check (accepted_by_user_id = public.current_profile_id() and school_id in (select school_id from public.school_users su where su.user_id = public.current_profile_id()));

-- Storage buckets
insert into storage.buckets (id, name, public) values ('school-logos', 'school-logos', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('user-avatars', 'user-avatars', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('student-photos', 'student-photos', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('assignment-attachments', 'assignment-attachments', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('medical-documents', 'medical-documents', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('financial-documents', 'financial-documents', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('staff-documents', 'staff-documents', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('library-book-covers', 'library-book-covers', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('announcement-attachments', 'announcement-attachments', true) on conflict (id) do nothing;

-- Materialized views for analytics
create materialized view if not exists public.mv_school_stats as
  select s.id as school_id, s.name as school_name, s.plan_tier, s.plan_status, s.ai_usage_count, s.ai_usage_limit,
    count(distinct st.id) filter (where st.status = 'active') as active_students,
    count(distinct t.id) filter (where t.status = 'active') as active_teachers,
    count(distinct c.id) as total_classes,
    count(distinct su.id) filter (where su.is_active = true) as total_staff
  from public.schools s
  left join public.students st on st.school_id = s.id
  left join public.teachers t on t.school_id = s.id
  left join public.classes c on c.school_id = s.id
  left join public.school_users su on su.school_id = s.id
  group by s.id, s.name, s.plan_tier, s.plan_status, s.ai_usage_count, s.ai_usage_limit with data;
create unique index if not exists idx_mv_school_stats_school on public.mv_school_stats(school_id);

create or replace function public.refresh_analytics_views() returns void language plpgsql security definer as $$
begin refresh materialized view concurrently public.mv_school_stats; end $$;

-- Cron schedules (requires pg_cron extension — enable in Supabase dashboard)
-- select cron.schedule('send-notifications', '* * * * *', $$ select net.http_post(url := 'https://YOUR-PROJECT.supabase.co/functions/v1/send-notifications', headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-key', 'CRON_API_KEY'), body := '{}'::jsonb); $$);
-- select cron.schedule('verify-domain', '*/5 * * * *', $$ select net.http_post(url := 'https://YOUR-PROJECT.supabase.co/functions/v1/verify-domain', headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-key', 'CRON_API_KEY'), body := '{}'::jsonb); $$);
-- select cron.schedule('refresh-analytics', '0 * * * *', $$ select public.refresh_analytics_views(); $$);
-- select cron.schedule('expire-invitations', '0 3 * * *', $$ update public.school_invitations set status = 'expired' where status = 'pending' and expires_at < now(); $$);
-- select cron.schedule('mark-overdue-invoices', '0 4 * * *', $$ update public.invoices set status = 'overdue' where status in ('unpaid', 'partial') and due_date < current_date; $$);
-- select cron.schedule('audit-log-cleanup', '0 5 * * *', $$ do $$ declare cutoff date := date_trunc('month', current_date - interval '12 months'); old_part record; begin for old_part in select tablename from pg_tables where tablename like 'audit_logs_%' and tablename ~ '^audit_logs_\d{4}_\d{2}$' loop execute format('drop table if exists public.%I', old_part.tablename); end loop; end $$; $$);
