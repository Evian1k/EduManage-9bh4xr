// EduManage — Jest setup
//
// Loads BEFORE every test file. Exports a shared `config` object that
// other test files import for Supabase connection details. Emits a
// console warning (not a hard failure) when the env vars are missing so
// unit tests (tenant-guard.test.ts) can still run without a backend.
//
// Required env vars (set in .env or CI secrets):
//   SUPABASE_URL               — project URL, e.g. https://abcdefg.supabase.co
//   SUPABASE_ANON_KEY          — anon/public key (RLS-enforced client)
//   SUPABASE_SERVICE_ROLE_KEY  — service-role key (bypasses RLS, used for
//                                seeding/dismantling test data)

export interface TestConfig {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
  /** True when all three Supabase env vars are populated. */
  isConfigured: boolean;
}

const url = process.env.SUPABASE_URL ?? '';
const anonKey = process.env.SUPABASE_ANON_KEY ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

export const config: TestConfig = {
  url,
  anonKey,
  serviceRoleKey,
  isConfigured: Boolean(url && anonKey && serviceRoleKey),
};

if (!config.isConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    '\n⚠️  [tests/setup.ts] Supabase env vars are not fully configured.\n' +
      '   Integration tests (tenant-isolation, permissions, ai-integration) will be skipped.\n' +
      '   Set SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY to run them.\n',
  );
}

// Jest setupFiles run in the Node test environment — re-export the config
// as the module's default export so test files can do `import { config }`.
export default config;
