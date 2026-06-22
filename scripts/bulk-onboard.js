#!/usr/bin/env node
/**
 * EduManage — Bulk Onboarding Script
 * ===========================================================================
 * Provisions N schools × M staff for scale / load testing.
 *
 * For each school it creates:
 *   1. A `schools` row (random slug + subdomain).
 *   2. An auth user + `user_profiles` row for the school owner.
 *   3. A `school_users` row binding the owner (role = school_owner).
 *   4. M additional staff members (auth user + profile + school_users),
 *      assigned a round-robin role from the staff-roles list.
 *   5. A `subscriptions` row giving the school a `professional` plan.
 *
 * Requires the SUPABASE_SERVICE_ROLE_KEY — uses the admin API to bypass
 * RLS. NEVER run this against production.
 *
 * Usage:
 *   node scripts/bulk-onboard.js --schools 50 --staff 25
 *   node scripts/bulk-onboard.js --schools 10 --staff 10 --prefix scale-test
 *   node scripts/bulk-onboard.js --schools 5 --staff 5 --dry-run
 *
 * Required env vars:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional env vars:
 *   DEFAULT_PASSWORD   — password for all created auth users (default:
 *                        'LoadTest123!Strong')
 *   EMAIL_DOMAIN       — domain for generated emails (default: 'edumanage-loadtest.test')
 * ===========================================================================
 */

const { createClient } = require('@supabase/supabase-js');

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { schools: 10, staff: 10, prefix: 'bulk', dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === '--schools') { args.schools = parseInt(next, 10); i++; }
    else if (a === '--staff') { args.staff = parseInt(next, 10); i++; }
    else if (a === '--prefix') { args.prefix = next; i++; }
    else if (a === '--dry-run') { args.dryRun = true; }
    else if (a === '--help' || a === '-h') {
      console.log(`Usage: node scripts/bulk-onboard.js [options]

Options:
  --schools <n>   Number of schools to create (default: 10)
  --staff <m>     Staff members per school (default: 10)
  --prefix <str>  Prefix for slugs/emails (default: 'bulk')
  --dry-run       Print what would be created without writing to Supabase
  --help, -h      Show this help message

Required env vars:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
`);
      process.exit(0);
    }
  }
  return args;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEFAULT_PASSWORD = process.env.DEFAULT_PASSWORD || 'LoadTest123!Strong';
const EMAIL_DOMAIN = process.env.EMAIL_DOMAIN || 'edumanage-loadtest.test';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    '\n❌ Missing required env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY\n' +
    '   This script needs the service-role key to provision auth users + rows.\n' +
    '   NEVER run this against production — it bypasses RLS.\n',
  );
  process.exit(1);
}

const STAFF_ROLES = [
  'school_owner',
  'principal',
  'deputy_principal',
  'administrator',
  'teacher',
  'secretary',
  'bursar',
  'librarian',
  'nurse',
  'ict_manager',
  'driver',
  'groundskeeper',
  'counselor',
  'boarding_master',
  'boarding_mistress',
];

const FIRST_NAMES = [
  'Alice', 'Brian', 'Carol', 'David', 'Esther', 'Frank', 'Grace', 'Henry',
  'Iris', 'Jacob', 'Karl', 'Linda', 'Moses', 'Nadia', 'Oscar', 'Priya',
  'Quentin', 'Rosa', 'Samuel', 'Tina', 'Umar', 'Vera', 'Walter', 'Xenia',
];
const LAST_NAMES = [
  'Adams', 'Baker', 'Chen', 'Diaz', 'Evans', 'Foster', 'Gupta', 'Harris',
  'Ibrahim', 'Johnson', 'Khan', 'Lopez', 'Martin', 'Nguyen', 'Owens',
  'Patel', 'Quinn', 'Rivera', 'Smith', 'Torres', 'Underwood', 'Vargas',
];

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shortId() {
  return Math.random().toString(36).slice(2, 8);
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

// ---------------------------------------------------------------------------
// Provisioning primitives
// ---------------------------------------------------------------------------

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function createAuthUser(email, password) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser(${email}) failed: ${error.message}`);
  return data.user.id;
}

async function createProfile(authUserId, email, fullName) {
  const { data, error } = await supabase
    .from('user_profiles')
    .insert({
      auth_user_id: authUserId,
      email,
      full_name: fullName,
      email_verified: true,
      status: 'active',
    })
    .select('id')
    .single();
  if (error) throw new Error(`profile insert failed for ${email}: ${error.message}`);
  return data.id;
}

async function createSchool(name, slug, subdomain) {
  const { data, error } = await supabase
    .from('schools')
    .insert({
      name,
      slug,
      subdomain,
      plan_status: 'trialing',
      plan_tier: 'professional',
    })
    .select('id')
    .single();
  if (error) throw new Error(`createSchool(${name}) failed: ${error.message}`);
  return data.id;
}

async function bindSchoolUser(schoolId, profileId, role) {
  const { error } = await supabase.from('school_users').insert({
    school_id: schoolId,
    user_id: profileId,
    role,
    is_active: true,
  });
  if (error) throw new Error(`bindSchoolUser failed: ${error.message}`);
}

async function createSubscription(schoolId) {
  const { error } = await supabase.from('subscriptions').insert({
    school_id: schoolId,
    plan_tier: 'professional',
    status: 'trialing',
    current_period_start: new Date().toISOString(),
    current_period_end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    payment_provider: 'stripe',
    amount_usd: 99.0,
    currency: 'USD',
  });
  if (error) throw new Error(`createSubscription failed: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function provisionSchool(schoolIndex, opts) {
  const schoolName = `${opts.prefix} School #${schoolIndex} ${shortId()}`;
  const slugBase = slugify(schoolName);
  const emailLocal = `${slugBase}-owner`;

  if (opts.dryRun) {
    console.log(
      `[dry-run] Would create school "${schoolName}" with ${opts.staff} staff`,
    );
    return { school: schoolName, owner: `${emailLocal}@${EMAIL_DOMAIN}`, staff: opts.staff };
  }

  const schoolId = await createSchool(schoolName, slugBase, slugBase);
  const ownerEmail = `${emailLocal}@${EMAIL_DOMAIN}`;
  const ownerAuthId = await createAuthUser(ownerEmail, DEFAULT_PASSWORD);
  const ownerProfileId = await createProfile(
    ownerAuthId,
    ownerEmail,
    `${randomFrom(FIRST_NAMES)} ${randomFrom(LAST_NAMES)}`,
  );
  await bindSchoolUser(schoolId, ownerProfileId, 'school_owner');
  await createSubscription(schoolId);

  // Create the remaining staff (M - 1, since the owner already counts as 1).
  const additionalStaff = Math.max(0, opts.staff - 1);
  for (let i = 0; i < additionalStaff; i++) {
    const role = STAFF_ROLES[(i + 1) % STAFF_ROLES.length]; // skip school_owner for staff
    const email = `${slugBase}-staff${i + 1}@${EMAIL_DOMAIN}`;
    const authId = await createAuthUser(email, DEFAULT_PASSWORD);
    const profileId = await createProfile(
      authId,
      email,
      `${randomFrom(FIRST_NAMES)} ${randomFrom(LAST_NAMES)}`,
    );
    await bindSchoolUser(schoolId, profileId, role);
  }

  return { school: schoolName, schoolId, owner: ownerEmail, staff: opts.staff };
}

async function main() {
  const opts = parseArgs(process.argv);

  console.log('========================================');
  console.log(' EduManage — Bulk Onboarding');
  console.log('========================================');
  console.log(` Schools:           ${opts.schools}`);
  console.log(` Staff per school:  ${opts.staff}`);
  console.log(` Total users:       ${opts.schools * opts.staff}`);
  console.log(` Slug prefix:       ${opts.prefix}`);
  console.log(` Dry run:           ${opts.dryRun}`);
  console.log(` Supabase URL:      ${SUPABASE_URL}`);
  console.log(` Email domain:      ${EMAIL_DOMAIN}`);
  console.log('========================================\n');

  const startedAt = Date.now();
  const results = [];
  let errors = 0;

  for (let s = 1; s <= opts.schools; s++) {
    try {
      const result = await provisionSchool(s, opts);
      results.push(result);
      console.log(
        `✅ [${s}/${opts.schools}] ${result.school} — owner: ${result.owner}, staff: ${result.staff}`,
      );
    } catch (err) {
      errors++;
      console.error(`❌ [${s}/${opts.schools}] FAILED: ${err.message}`);
    }
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log('\n========================================');
  console.log(` Done in ${elapsed}s`);
  console.log(` Schools created: ${results.length}/${opts.schools}`);
  console.log(` Errors: ${errors}`);
  console.log('========================================');

  if (errors > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
