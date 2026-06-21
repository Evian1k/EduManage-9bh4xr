// EduManage — Pure Unit Tests for lib/tenant.ts
//
// These tests do NOT touch Supabase — they exercise the synchronous
// `tenantGuard`, `withTenant`, and `ALL_STAFF_ROLES` helpers directly.
// They run in every CI environment regardless of backend availability.

import { tenantGuard, withTenant } from '@/lib/tenant';
import { ALL_STAFF_ROLES, STAFF_ROLES } from '@/lib/types';

describe('tenantGuard', () => {
  it('returns null (permits) when userSchoolId matches requestedSchoolId', () => {
    const schoolId = '00000000-0000-0000-0000-000000000001';
    const result = tenantGuard(schoolId, schoolId, 'read students');
    expect(result).toBeNull();
  });

  it('throws / returns an error string on mismatch (cross-tenant attempt)', () => {
    const userSchool = '00000000-0000-0000-0000-000000000001';
    const requestedSchool = '00000000-0000-0000-0000-000000000002';
    const result = tenantGuard(userSchool, requestedSchool, 'read students');
    expect(result).not.toBeNull();
    expect(result).toMatch(/denied|cross-tenant|blocked/i);
  });

  it('returns an error string when userSchoolId is null (no session)', () => {
    const requestedSchool = '00000000-0000-0000-0000-000000000001';
    const result = tenantGuard(null, requestedSchool, 'read students');
    expect(result).not.toBeNull();
    expect(result).toMatch(/no active school|session|context/i);
  });

  it('returns an error string when requestedSchoolId is empty', () => {
    const userSchool = '00000000-0000-0000-0000-000000000001';
    const result = tenantGuard(userSchool, '', 'read students');
    expect(result).not.toBeNull();
    expect(result).toMatch(/missing|identifier|school/i);
  });
});

describe('withTenant', () => {
  it('adds school_id to the payload', () => {
    const schoolId = '00000000-0000-0000-0000-000000000001';
    const payload = { name: 'Term 1', start_date: '2025-01-01' };
    const result = withTenant(schoolId, payload);
    expect(result).toHaveProperty('school_id', schoolId);
    expect(result).toHaveProperty('name', 'Term 1');
    expect(result).toHaveProperty('start_date', '2025-01-01');
  });

  it('does NOT mutate the original payload object', () => {
    const schoolId = '00000000-0000-0000-0000-000000000001';
    const payload = { name: 'Term 1', settings: { color: 'red' } };
    const snapshot = JSON.parse(JSON.stringify(payload));
    const result = withTenant(schoolId, payload);

    // The original object should be untouched.
    expect(payload).toEqual(snapshot);
    expect(payload).not.toHaveProperty('school_id');

    // The returned object is a new instance with the school_id stamped on.
    expect(result).toHaveProperty('school_id', schoolId);
    expect(result).not.toBe(payload);
  });

  it('preserves nested objects without sharing references', () => {
    const schoolId = '00000000-0000-0000-0000-000000000001';
    const nested = { color: 'red' };
    const payload = { name: 'Term 1', settings: nested };
    const result = withTenant(schoolId, payload);
    // Mutating the returned object's settings should not affect the source.
    (result.settings as { color: string }).color = 'blue';
    expect(nested.color).toBe('red');
  });
});

describe('ALL_STAFF_ROLES', () => {
  it('exports a constant with exactly 16 staff roles', () => {
    expect(Array.isArray(ALL_STAFF_ROLES)).toBe(true);
    expect(ALL_STAFF_ROLES).toHaveLength(16);
  });

  it('excludes student, parent, and platform_admin', () => {
    expect(ALL_STAFF_ROLES).not.toContain('student');
    expect(ALL_STAFF_ROLES).not.toContain('parent');
    expect(ALL_STAFF_ROLES).not.toContain('platform_admin');
  });

  it('contains all expected core staff roles', () => {
    const expected = [
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
    for (const role of expected) {
      expect(ALL_STAFF_ROLES).toContain(role);
    }
  });

  it('is the same set as STAFF_ROLES (alias)', () => {
    // The codebase exposes STAFF_ROLES as the canonical list; ALL_STAFF_ROLES
    // is an alias re-exported for ergonomics at call sites.
    expect(ALL_STAFF_ROLES).toEqual(STAFF_ROLES);
  });

  it('has no duplicate entries', () => {
    expect(new Set(ALL_STAFF_ROLES).size).toBe(ALL_STAFF_ROLES.length);
  });
});
