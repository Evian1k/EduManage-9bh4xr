/**
 * EduManage — Jest configuration
 *
 * Uses `jest-expo` as the preset so React Native + Expo modules are
 * transpiled correctly. The `node` test environment is sufficient for
 * our test suite because none of the tests render React components —
 * they exercise pure helpers (lib/tenant.ts), types (lib/types.ts), and
 * HTTP/Supabase clients (integration tests).
 *
 * Test files live under tests/ and are picked up by the standard
 * `*.test.ts` glob. Integration tests that require a live Supabase
 * instance self-skip via `describe.skip` when env vars are missing
 * (see tests/setup.ts).
 *
 * Module alias `@/*` mirrors tsconfig.json so tests can import shared
 * modules the same way app code does.
 */

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',

  testEnvironment: 'node',

  // Loaded before every test file. Exports the shared `config` object
  // used by integration tests + emits a warning when Supabase env vars
  // are missing.
  setupFiles: ['<rootDir>/tests/setup.ts'],

  // Allow importing TypeScript + TSX + JS source files.
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Jest uses Babel for transpilation. The project's babel.config.js
  // already extends `babel-preset-expo` which understands TS + the
  // React Native module registry.
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': 'babel-jest',
  },

  // Supabase ships ESM that Jest can't interpret by default; allow the
  // Babel transformer to process it.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|@supabase/.*|react-native-url-polyfill)',
  ],

  // Path alias — matches tsconfig.json's `@/* -> ./*`.
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },

  // Where Jest looks for test files.
  testMatch: [
    '<rootDir>/tests/**/*.test.ts',
    '<rootDir>/tests/**/*.test.tsx',
  ],

  // Integration tests are slow (network + auth flows); give them room.
  testTimeout: 60000,

  // Collect coverage from lib/ and services/ when --coverage is passed.
  collectCoverageFrom: [
    'lib/**/*.ts',
    'services/**/*.ts',
    '!**/*.d.ts',
  ],

  coverageDirectory: 'coverage',

  // Make sure Jest clears mock state between tests.
  clearMocks: true,

  // Don't bail by default — surface every failure in one run.
  bail: 0,

  // Verbose output for CI readability.
  verbose: true,
};
