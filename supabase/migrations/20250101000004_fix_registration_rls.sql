-- Fix: Allow self-registration of school owner
-- The school_users insert policy required is_school_admin, but a new
-- school owner isn't an admin yet (they're creating the school). This
-- allows insert when the user is inserting their own profile id.

drop policy if exists school_users_insert on public.school_users;
create policy school_users_insert on public.school_users
  for insert with check (
    public.is_platform_admin()
    or user_id = public.current_profile_id()
    or exists (
      select 1 from public.school_users su
      where su.school_id = school_users.school_id
      and su.user_id = public.current_profile_id()
      and su.role in ('school_owner','principal','administrator','ict_manager')
    )
  );

-- Also allow schools update for the owner (they need to update their own school
-- during registration, but they're not yet in school_users)
drop policy if exists schools_update on public.schools;
create policy schools_update on public.schools
  for update using (
    public.is_platform_admin()
    or id in (
      select school_id from public.school_users su
      where su.user_id = public.current_profile_id()
      and su.role in ('school_owner','principal','administrator','ict_manager')
    )
  );

-- Allow subscriptions insert for self-registration
drop policy if exists subscriptions_insert on public.subscriptions;
create policy subscriptions_insert on public.subscriptions
  for insert with check (
    public.is_platform_admin()
    or exists (
      select 1 from public.school_users su
      where su.school_id = subscriptions.school_id
      and su.user_id = public.current_profile_id()
      and su.role in ('school_owner','principal','administrator')
    )
    or not exists (
      select 1 from public.school_users su
      where su.school_id = subscriptions.school_id
    )
  );

-- Allow notification_preferences insert for self
drop policy if exists notif_prefs_insert on public.notification_preferences;
create policy notif_prefs_insert on public.notification_preferences
  for insert with check (
    user_id = public.current_profile_id()
    or user_id in (
      select p.id from public.user_profiles p
      where p.auth_user_id = auth.uid()
    )
  );
