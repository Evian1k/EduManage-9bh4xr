// EduManage — Tenant Isolation Integration Tests
//
// Verifies that Row-Level Security (RLS) prevents cross-tenant data
// access. Creates two schools and two users (one per school), then
// asserts that User A cannot read/insert/update/delete rows belonging
// to School B.
//
// These tests REQUIRE a live Supabase instance with the foundation
// migration applied. They are excluded from the default `pnpm test`
// CI run (see .github/workflows/ci.yml) and run separately against
// staging. Skipped automatically when SUPABASE_* env vars are missing.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from './setup';

// Skip the entire suite when Supabase env vars are not configured.
const describeOrSkip = config.isConfigured ? describe : describe.skip;

// Unique suffix so parallel CI runs don't collide.
const RUN_ID = process.env.GITHUB_RUN_ID ?? `local-${Date.now()}`;
const SUFFIX = `${RUN_ID}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Create an auth user + user_profiles row + school_users membership.
 * Returns a Supabase client bound to the new user's session.
 */
async function provisionUser(
  admin: SupabaseClient,
  email: string,
  password: string,
  schoolId: string,
  role: 'administrator' | 'teacher' | 'student' | 'parent' | 'bursar',
): Promise<{ client: SupabaseClient; profileId: string }> {
  // 1. Create auth user (admin API).
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authErr) throw new Error(`createUser failed: ${authErr.message}`);
  const authUserId = authData.user.id;

  // 2. Insert user_profiles row.
  const { data: profile, error: profileErr } = await admin
    .from('user_profiles')
    .insert({
      auth_user_id: authUserId,
      email,
      full_name: `Test ${role} ${SUFFIX}`,
      email_verified: true,
      status: 'active',
    })
    .select()
    .single();
  if (profileErr) throw new Error(`profile insert failed: ${profileErr.message}`);

  // 3. Bind to school.
  const { error: bindErr } = await admin.from('school_users').insert({
    school_id: schoolId,
    user_id: profile.id,
    role,
    is_active: true,
  });
  if (bindErr) throw new Error(`school_users insert failed: ${bindErr.message}`);

  // 4. Sign in to get a session-bearing client.
  const client = createClient(config.url, config.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInErr } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (signInErr) throw new Error(`signIn failed: ${signInErr.message}`);

  return { client, profileId: profile.id };
}

async function createSchool(
  admin: SupabaseClient,
  name: string,
  slug: string,
): Promise<string> {
  const { data, error } = await admin
    .from('schools')
    .insert({
      name,
      slug,
      subdomain: slug,
      plan_status: 'trialing',
      plan_tier: 'professional',
    })
    .select('id')
    .single();
  if (error) throw new Error(`createSchool failed: ${error.message}`);
  return data.id;
}

describeOrSkip('Tenant Isolation (RLS)', () => {
  let admin: SupabaseClient;
  let schoolA: string;
  let schoolB: string;
  let userA: SupabaseClient;
  let userB: SupabaseClient;
  let notificationIdB: string;

  beforeAll(async () => {
    admin = createClient(config.url, config.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    schoolA = await createSchool(
      admin,
      `School A ${SUFFIX}`,
      `school-a-${SUFFIX}`,
    );
    schoolB = await createSchool(
      admin,
      `School B ${SUFFIX}`,
      `school-b-${SUFFIX}`,
    );

    const a = await provisionUser(
      admin,
      `a-${SUFFIX}@edumanage-test.test`,
      'Password123!Strong',
      schoolA,
      'administrator',
    );
    const b = await provisionUser(
      admin,
      `b-${SUFFIX}@edumanage-test.test`,
      'Password123!Strong',
      schoolB,
      'administrator',
    );
    userA = a.client;
    userB = b.client;

    // Seed a notification owned by User B in School B (notifications are
    // RLS-protected by user_id; school_users is the canonical cross-tenant
    // table to test against, but notifications give us a clean insert path
    // that requires only the user_id check).
    const { data: notif, error: notifErr } = await admin
      .from('notifications')
      .insert({
        school_id: schoolB,
        user_id: b.profileId,
        title: 'Private notification for School B',
        body: 'Should be invisible to School A users.',
      })
      .select('id')
      .single();
    if (notifErr) throw notifErr;
    notificationIdB = notif.id;
  }, 120_000);

  afterAll(async () => {
    // Cascading deletes from schools take care of school_users, notifications,
    // etc. Auth users must be removed explicitly.
    if (admin) {
      await admin.from('schools').delete().in('id', [schoolA, schoolB]);
    }
  }, 60_000);

  // ─── 8 test cases ───────────────────────────────────────────────────────

  it('1. User A cannot read School B rows from school_users', async () => {
    const { data, error } = await userA
      .from('school_users')
      .select('*')
      .eq('school_id', schoolB);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('2. User A cannot read School B rows from schools', async () => {
    const { data, error } = await userA
      .from('schools')
      .select('*')
      .eq('id', schoolB);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('3. User A cannot INSERT a school_users row in School B', async () => {
    // Try to plant a backdoor membership granting User A admin rights in School B.
    const { data: profileA } = await userA
      .from('user_profiles')
      .select('id')
      .single();
    const { data, error } = await userA.from('school_users').insert({
      school_id: schoolB,
      user_id: profileA!.id,
      role: 'administrator',
      is_active: true,
    });
    // RLS should block the insert (either via error or empty data).
    expect(error || data === null).toBeTruthy();

    // Verify with admin client that no such row exists.
    const { data: probe } = await admin
      .from('school_users')
      .select('id')
      .eq('school_id', schoolB)
      .eq('user_id', profileA!.id);
    expect(probe).toEqual([]);
  });

  it('4. User A cannot UPDATE a row in School B', async () => {
    // Attempt to mutate the title of the notification owned by User B.
    const { data, error } = await userA
      .from('notifications')
      .update({ title: 'PWNED by User A' })
      .eq('id', notificationIdB);
    // update returns no rows when RLS filters them out — no error necessarily,
    // but the row must remain unchanged.
    expect(error).toBeNull();
    expect(data).toEqual([]);

    const { data: probe } = await admin
      .from('notifications')
      .select('title')
      .eq('id', notificationIdB)
      .single();
    expect(probe?.title).toBe('Private notification for School B');
  });

  it('5. User A cannot DELETE a row in School B', async () => {
    const { data, error } = await userA
      .from('notifications')
      .delete()
      .eq('id', notificationIdB);
    expect(error).toBeNull();
    expect(data).toEqual([]);

    const { data: probe } = await admin
      .from('notifications')
      .select('id')
      .eq('id', notificationIdB)
      .maybeSingle();
    expect(probe).not.toBeNull();
  });

  it('6. User A CAN read School A rows (sanity check)', async () => {
    const { data, error } = await userA
      .from('school_users')
      .select('*')
      .eq('school_id', schoolA);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].school_id).toBe(schoolA);
  });

  it('7. User B cannot read School A rows from schools', async () => {
    const { data, error } = await userB
      .from('schools')
      .select('*')
      .eq('id', schoolA);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('8. Anonymous client (no auth) cannot read either school', async () => {
    const anon = createClient(config.url, config.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await anon
      .from('schools')
      .select('*')
      .in('id', [schoolA, schoolB]);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
