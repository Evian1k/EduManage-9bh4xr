// EduManage — Role-Based Access Control Integration Tests
//
// Provisions one school and five users with different roles (administrator,
// teacher, student, parent, bursar) and asserts that each role can perform
// the actions its RLS policy permits, and is blocked from the actions it
// does not.
//
// REQUIRES a live Supabase instance. Skipped automatically when SUPABASE_*
// env vars are missing.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from './setup';

const describeOrSkip = config.isConfigured ? describe : describe.skip;

const RUN_ID = process.env.GITHUB_RUN_ID ?? `local-${Date.now()}`;
const SUFFIX = `${RUN_ID}-${Math.random().toString(36).slice(2, 8)}`;
const PASSWORD = 'Password123!Strong';

type TestRole = 'administrator' | 'teacher' | 'student' | 'parent' | 'bursar';

interface UserCtx {
  client: SupabaseClient;
  profileId: string;
  email: string;
}

async function provisionUser(
  admin: SupabaseClient,
  email: string,
  schoolId: string,
  role: TestRole,
): Promise<UserCtx> {
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (authErr) throw new Error(`createUser failed: ${authErr.message}`);

  const { data: profile, error: profileErr } = await admin
    .from('user_profiles')
    .insert({
      auth_user_id: authData.user.id,
      email,
      full_name: `Test ${role} ${SUFFIX}`,
      email_verified: true,
      status: 'active',
    })
    .select()
    .single();
  if (profileErr) throw new Error(`profile insert failed: ${profileErr.message}`);

  const { error: bindErr } = await admin.from('school_users').insert({
    school_id: schoolId,
    user_id: profile.id,
    role,
    is_active: true,
  });
  if (bindErr) throw new Error(`school_users insert failed: ${bindErr.message}`);

  const client = createClient(config.url, config.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInErr } = await client.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (signInErr) throw new Error(`signIn failed: ${signInErr.message}`);

  return { client, profileId: profile.id, email };
}

describeOrSkip('Role-Based Permissions', () => {
  let admin: SupabaseClient;
  let schoolId: string;
  let users: Record<TestRole, UserCtx>;

  beforeAll(async () => {
    admin = createClient(config.url, config.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: school, error: schoolErr } = await admin
      .from('schools')
      .insert({
        name: `Permissions School ${SUFFIX}`,
        slug: `perm-${SUFFIX}`,
        subdomain: `perm-${SUFFIX}`,
        plan_status: 'trialing',
        plan_tier: 'professional',
      })
      .select('id')
      .single();
    if (schoolErr) throw schoolErr;
    schoolId = school.id;

    users = {
      administrator: await provisionUser(
        admin,
        `admin-${SUFFIX}@edumanage-test.test`,
        schoolId,
        'administrator',
      ),
      teacher: await provisionUser(
        admin,
        `teacher-${SUFFIX}@edumanage-test.test`,
        schoolId,
        'teacher',
      ),
      student: await provisionUser(
        admin,
        `student-${SUFFIX}@edumanage-test.test`,
        schoolId,
        'student',
      ),
      parent: await provisionUser(
        admin,
        `parent-${SUFFIX}@edumanage-test.test`,
        schoolId,
        'parent',
      ),
      bursar: await provisionUser(
        admin,
        `bursar-${SUFFIX}@edumanage-test.test`,
        schoolId,
        'bursar',
      ),
    };
  }, 180_000);

  afterAll(async () => {
    if (admin && schoolId) {
      await admin.from('schools').delete().eq('id', schoolId);
    }
  }, 60_000);

  // ─── 7 test cases ───────────────────────────────────────────────────────

  it('1. Administrator can read own school_users membership', async () => {
    const { data, error } = await users.administrator.client
      .from('school_users')
      .select('*')
      .eq('school_id', schoolId);
    expect(error).toBeNull();
    // At minimum, the admin's own membership row should be visible.
    expect(data!.length).toBeGreaterThanOrEqual(1);
    expect(data!.some((r) => r.user_id === users.administrator.profileId)).toBe(
      true,
    );
  });

  it('2. Administrator can invite a new staff member (insert into school_invitations)', async () => {
    const { data, error } = await users.administrator.client
      .from('school_invitations')
      .insert({
        school_id: schoolId,
        email: `invitee-${SUFFIX}@edumanage-test.test`,
        role: 'teacher',
        token: `tok-${SUFFIX}-${Math.random().toString(36).slice(2)}`,
        invited_by: users.administrator.profileId,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select('id')
      .single();
    expect(error).toBeNull();
    expect(data).not.toBeNull();
  });

  it('3. Teacher CANNOT invite new staff (no school_invitations insert)', async () => {
    const { data, error } = await users.teacher.client
      .from('school_invitations')
      .insert({
        school_id: schoolId,
        email: `rogue-${SUFFIX}@edumanage-test.test`,
        role: 'teacher',
        token: `rogue-tok-${SUFFIX}-${Math.random().toString(36).slice(2)}`,
        invited_by: users.teacher.profileId,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
    expect(error || data === null).toBeTruthy();

    const { data: probe } = await admin
      .from('school_invitations')
      .select('id')
      .eq('email', `rogue-${SUFFIX}@edumanage-test.test`);
    expect(probe).toEqual([]);
  });

  it('4. Student CAN read their own user_profiles row', async () => {
    const { data, error } = await users.student.client
      .from('user_profiles')
      .select('id, email')
      .eq('id', users.student.profileId)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.email).toBe(users.student.email);
  });

  it('5. Student CANNOT read another user's profile row', async () => {
    const { data, error } = await users.student.client
      .from('user_profiles')
      .select('*')
      .eq('id', users.administrator.profileId)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it('6. Parent can read notifications addressed to them', async () => {
    // Seed a notification for the parent (admin client).
    const { data: notif, error: notifErr } = await admin
      .from('notifications')
      .insert({
        school_id: schoolId,
        user_id: users.parent.profileId,
        title: 'Your child was marked absent',
        body: 'Please contact the office.',
      })
      .select('id')
      .single();
    expect(notifErr).toBeNull();

    const { data, error } = await users.parent.client
      .from('notifications')
      .select('*')
      .eq('id', notif!.id)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.title).toBe('Your child was marked absent');
  });

  it('7. Bursar CANNOT delete another user's notification (only own or admin)', async () => {
    // Use the parent's notification from case 6.
    const { data: notif } = await admin
      .from('notifications')
      .select('id')
      .eq('user_id', users.parent.profileId)
      .limit(1)
      .single();

    const { data, error } = await users.bursar.client
      .from('notifications')
      .delete()
      .eq('id', notif!.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);

    // Verify the row is still present.
    const { data: probe } = await admin
      .from('notifications')
      .select('id')
      .eq('id', notif!.id)
      .maybeSingle();
    expect(probe).not.toBeNull();
  });
});
