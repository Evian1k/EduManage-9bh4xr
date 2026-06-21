// EduManage — Multi-tenant isolation helpers
// All service functions accept `schoolId` as their first argument. These helpers
// provide defence-in-depth checks that the caller's session actually belongs to
// the school whose data is being read/written.

import { useCallback, useMemo } from 'react';
import { useAppContext } from '@/hooks/useAppContext';
import { ServiceResult } from './types';

/**
 * Verify that the requesting user is permitted to act on the requested school.
 *
 * Returns `null` when the action is permitted, otherwise returns a string error
 * describing why the action was rejected (e.g. cross-tenant access attempt).
 *
 * @param userSchoolId  The school_id from the caller's session (AppContext).
 * @param requestedSchoolId  The school_id the caller is trying to act on.
 * @param action  A short label used in the returned error message.
 */
export function tenantGuard(
  userSchoolId: string | null | undefined,
  requestedSchoolId: string,
  action: string,
): string | null {
  if (!requestedSchoolId) return `${action} failed: missing school identifier`;
  if (!userSchoolId) return `${action} failed: no active school context`;

  // Platform admins (no school) bypass — handled at the AppContext level by
  // not setting a school for them; services that need platform-level access
  // should not call tenantGuard.
  if (userSchoolId === requestedSchoolId) return null;
  return `${action} denied: cross-tenant access blocked`;
}

/**
 * Wrap a payload with the calling school's id so downstream services can stamp
 * it onto the row being inserted. Reduces boilerplate at call sites.
 *
 * @example
 *   const payload = withTenant(schoolId, { name: 'Term 1' });
 *   // { school_id: '<id>', name: 'Term 1' }
 */
export function withTenant<T extends Record<string, unknown>>(
  schoolId: string,
  payload: T,
): T & { school_id: string } {
  return { ...payload, school_id: schoolId };
}

/**
 * React hook that returns memoised tenant helpers bound to the current session.
 *
 * The returned `guard` function is a thin wrapper around {@link tenantGuard}
 * that automatically supplies the user's school id from {@link useAppContext}.
 *
 * @throws Error if used outside an `AppProvider`.
 */
export function useTenantValidation() {
  const { school, schoolUser, isPlatformAdmin } = useAppContext();

  const userSchoolId = school?.id ?? schoolUser?.school_id ?? null;

  const guard = useCallback(
    (requestedSchoolId: string, action: string): string | null => {
      if (isPlatformAdmin) return null; // platform admins bypass tenant check
      return tenantGuard(userSchoolId, requestedSchoolId, action);
    },
    [userSchoolId, isPlatformAdmin],
  );

  /** Returns the school id for the current session or null when unauthenticated. */
  const currentSchoolId = userSchoolId;

  /**
   * Convenience: returns a service-result error envelope if the guard fails,
   * otherwise returns null (callers should proceed with the operation).
   */
  const guardOrError = useCallback(
    <T>(requestedSchoolId: string, action: string): ServiceResult<T> | null => {
      const err = guard(requestedSchoolId, action);
      if (err) return { data: null, error: err };
      return null;
    },
    [guard],
  );

  return useMemo(
    () => ({
      currentSchoolId,
      isPlatformAdmin,
      guard,
      guardOrError,
    }),
    [currentSchoolId, isPlatformAdmin, guard, guardOrError],
  );
}
