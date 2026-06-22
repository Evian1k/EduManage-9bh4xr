-- EduManage — Demo Accounts Seed
-- Creates 12 demo accounts for local development testing.
-- All accounts use password: Demo123!
-- Run this migration AFTER all other migrations.
-- To re-seed: supabase db reset (drops everything) then supabase db push

-- Create demo school
insert into public.schools (id, name, slug, subdomain, email, status, plan_status, plan_tier, ai_usage_limit, max_students, max_staff)
values ('a0000000-0000-0000-0000-000000000001', 'Greenfield Academy', 'greenfield', 'greenfield', 'admin@greenfield.demo', 'active', 'active', 'professional', 10000, 5000, 200)
on conflict (subdomain) do nothing;

-- Create auth users (password: Demo123!)
-- Using Supabase auth schema directly
insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, role, aud, instance_id)
values
  ('b0000000-0000-0000-0000-000000000001', 'owner@edumanage.demo', crypt('Demo123!', gen_salt('bf')), now(), now(), now(), 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('b0000000-0000-0000-0000-000000000002', 'admin@greenfield.demo', crypt('Demo123!', gen_salt('bf')), now(), now(), now(), 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('b0000000-0000-0000-0000-000000000003', 'teacher@greenfield.demo', crypt('Demo123!', gen_salt('bf')), now(), now(), now(), 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('b0000000-0000-0000-0000-000000000004', 'student@greenfield.demo', crypt('Demo123!', gen_salt('bf')), now(), now(), now(), 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('b0000000-0000-0000-0000-000000000005', 'secretary@greenfield.demo', crypt('Demo123!', gen_salt('bf')), now(), now(), now(), 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('b0000000-0000-0000-0000-000000000006', 'bursar@greenfield.demo', crypt('Demo123!', gen_salt('bf')), now(), now(), now(), 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('b0000000-0000-0000-0000-000000000007', 'ict@greenfield.demo', crypt('Demo123!', gen_salt('bf')), now(), now(), now(), 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('b0000000-0000-0000-0000-000000000008', 'librarian@greenfield.demo', crypt('Demo123!', gen_salt('bf')), now(), now(), now(), 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('b0000000-0000-0000-0000-000000000009', 'nurse@greenfield.demo', crypt('Demo123!', gen_salt('bf')), now(), now(), now(), 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('b0000000-0000-0000-0000-000000000010', 'parent@greenfield.demo', crypt('Demo123!', gen_salt('bf')), now(), now(), now(), 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('b0000000-0000-0000-0000-000000000011', 'principal@greenfield.demo', crypt('Demo123!', gen_salt('bf')), now(), now(), now(), 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('b0000000-0000-0000-0000-000000000012', 'company@edumanage.demo', crypt('Demo123!', gen_salt('bf')), now(), now(), now(), 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000')
on conflict (email) do nothing;

-- Create identities for auth users (required for Supabase Auth to work)
insert into auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, jsonb_build_object('sub', id::text, 'email', email), 'email', now(), now(), now()
from auth.users
where email like '%@greenfield.demo' or email like '%@edumanage.demo'
on conflict do nothing;

-- Create user profiles
insert into public.user_profiles (id, auth_user_id, email, full_name, email_verified, status)
values
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'owner@edumanage.demo', 'Platform Owner', true, 'active'),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'admin@greenfield.demo', 'School Admin', true, 'active'),
  ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000003', 'teacher@greenfield.demo', 'John Teacher', true, 'active'),
  ('c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000004', 'student@greenfield.demo', 'Jane Student', true, 'active'),
  ('c0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000005', 'secretary@greenfield.demo', 'Mary Secretary', true, 'active'),
  ('c0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000006', 'bursar@greenfield.demo', 'Peter Bursar', true, 'active'),
  ('c0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000007', 'ict@greenfield.demo', 'James ICT', true, 'active'),
  ('c0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000008', 'librarian@greenfield.demo', 'Sarah Librarian', true, 'active'),
  ('c0000000-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-000000000009', 'nurse@greenfield.demo', 'Grace Nurse', true, 'active'),
  ('c0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000010', 'parent@greenfield.demo', 'David Parent', true, 'active'),
  ('c0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000011', 'principal@greenfield.demo', 'Robert Principal', true, 'active'),
  ('c0000000-0000-0000-0000-000000000012', 'b0000000-0000-0000-0000-000000000012', 'company@edumanage.demo', 'Company CEO', true, 'active')
on conflict (email) do nothing;

-- Link users to school with roles (skip platform_admin and company - they don't belong to a school)
insert into public.school_users (school_id, user_id, role, is_active, joined_at)
values
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'school_owner', true, now()),
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'teacher', true, now()),
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', 'student', true, now()),
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000005', 'secretary', true, now()),
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000006', 'bursar', true, now()),
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000007', 'ict_manager', true, now()),
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000008', 'librarian', true, now()),
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000009', 'nurse', true, now()),
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000010', 'parent', true, now()),
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000011', 'principal', true, now())
on conflict (school_id, user_id) do nothing;

-- Create a fake school_users entry for platform_admin (linked to the demo school so they can access it)
insert into public.school_users (school_id, user_id, role, is_active, joined_at)
values ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'platform_admin', true, now())
on conflict (school_id, user_id) do nothing;

-- Create a student record for the student demo account
insert into public.students (school_id, user_id, admission_number, full_name, gender, status, enrollment_date)
values ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', 'STU-001', 'Jane Student', 'female', 'active', current_date)
on conflict do nothing;

-- Create a teacher record for the teacher demo account
insert into public.teachers (school_id, user_id, employee_number, full_name, gender, department, status, employment_date)
values ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'EMP-001', 'John Teacher', 'male', 'Sciences', 'active', current_date)
on conflict do nothing;

-- Create a subscription for the demo school
insert into public.subscriptions (school_id, plan_tier, status, current_period_start, current_period_end)
values ('a0000000-0000-0000-0000-000000000001', 'professional', 'active', now(), now() + interval '1 year')
on conflict (school_id) do nothing;

-- Create default notification preferences for all demo users
insert into public.notification_preferences (user_id, channel, category, enabled)
select up.id, channel, category, true
from public.user_profiles up
cross join (values ('email'), ('sms'), ('push'), ('in_app')) as channels(channel)
cross join (values ('announcements'), ('messages'), ('finance'), ('attendance'), ('alerts')) as cats(category)
where up.email like '%@greenfield.demo' or up.email like '%@edumanage.demo'
on conflict (user_id, channel, category) do nothing;
