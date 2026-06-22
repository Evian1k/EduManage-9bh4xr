// EduManage — In-memory sliding-window rate limiter
//
// Designed to be used from React Native client code as the first line of
// defence against brute-force / spam. The authoritative rate-limit records
// live in the `rate_limit_log` Postgres table (see audit.service.ts for the
// DB-backed version). This in-memory implementation is suitable for:
//   • UI debouncing (e.g. prevent double-submit)
//   • Pre-flight checks before invoking an edge function
//   • Background polling throttling
//
// For security-critical paths (login, password reset, invitation send) use
// the DB-backed `isRateLimited` in audit.service.ts — the client can be
// bypassed by an attacker, but the DB cannot.

import { ServiceResult } from './types';

export interface RateLimitConfig {
  /** Stable identifier for the caller (user id, IP, device id, or "*"). */
  identifier: string;
  /** Action label — same value used by `recordRateLimit`. */
  action: string;
  /** Max number of actions allowed within `windowSeconds`. */
  maxCount: number;
  /** Sliding window duration in seconds. */
  windowSeconds: number;
}

interface RateBucket {
  timestamps: number[];
}

// Map of `${identifier}:${action}` → bucket
const buckets = new Map<string, RateBucket>();

function key(cfg: RateLimitConfig): string {
  return `${cfg.identifier || '*'}:${cfg.action}`;
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Check whether the caller is currently within the rate limit for the given
 * action. Does NOT record a hit — call {@link recordRateLimit} to do that
 * after the action succeeds (or before, depending on your semantics).
 */
export function checkRateLimit(cfg: RateLimitConfig): {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
} {
  const k = key(cfg);
  const cutoff = nowSeconds() - cfg.windowSeconds;
  const bucket = buckets.get(k);
  if (!bucket) {
    return { allowed: true, remaining: cfg.maxCount, retryAfterSeconds: 0 };
  }
  const recent = bucket.timestamps.filter((t) => t > cutoff);
  if (recent.length === 0) {
    return { allowed: true, remaining: cfg.maxCount, retryAfterSeconds: 0 };
  }
  const remaining = Math.max(0, cfg.maxCount - recent.length);
  const allowed = recent.length < cfg.maxCount;
  // Earliest timestamp that will fall out of the window in `retryAfter` seconds
  const oldest = Math.min(...recent);
  const retryAfterSeconds = allowed ? 0 : Math.max(0, oldest + cfg.windowSeconds - nowSeconds());
  return { allowed, remaining, retryAfterSeconds };
}

/**
 * Record a rate-limit hit for the given action. Should be called *after*
 * `checkRateLimit` returns `allowed: true` to track the action against the
 * sliding window.
 */
export function recordRateLimit(cfg: RateLimitConfig): void {
  const k = key(cfg);
  const cutoff = nowSeconds() - cfg.windowSeconds;
  const existing = buckets.get(k);
  const recent = existing
    ? existing.timestamps.filter((t) => t > cutoff)
    : [];
  recent.push(nowSeconds());
  // Cap memory growth — keep at most 2x the window's max count
  if (recent.length > cfg.maxCount * 2) {
    recent.splice(0, recent.length - cfg.maxCount * 2);
  }
  buckets.set(k, { timestamps: recent });
}

/**
 * Wrap an async function with a rate-limit pre-check. Returns the standard
 * `ServiceResult<T>` envelope so it composes cleanly with services that
 * already return `{ data, error }`.
 *
 * @example
 *   const { data, error } = await withRateLimit(RATE_LIMITS.LOGIN, () =>
 *     signInWithPassword(email, password),
 *   );
 */
export async function withRateLimit<T>(
  cfg: RateLimitConfig,
  fn: () => Promise<T>,
): Promise<ServiceResult<T>> {
  const check = checkRateLimit(cfg);
  if (!check.allowed) {
    return {
      data: null,
      error: `Rate limit exceeded. Retry in ${check.retryAfterSeconds}s.`,
    };
  }
  try {
    const data = await fn();
    recordRateLimit(cfg);
    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Curried helper: pass an identifier (e.g. user id or IP) to produce a
 * `RateLimitConfig` partial that can be spread into `withRateLimit`.
 */
export function forActor(identifier: string) {
  return (action: keyof typeof RATE_LIMITS): RateLimitConfig => ({
    identifier,
    action,
    ...RATE_LIMITS[action],
  });
}

/**
 * Centralised rate-limit policy. Times are in seconds.
 * These mirror the values used by the DB-backed `isRateLimited` in
 * audit.service.ts.
 */
export const RATE_LIMITS = {
  LOGIN: { action: 'login', maxCount: 10, windowSeconds: 60 },
  PASSWORD_RESET: { action: 'password_reset', maxCount: 3, windowSeconds: 3600 },
  INVITATION_SEND: { action: 'invitation_send', maxCount: 20, windowSeconds: 3600 },
  AI_REQUEST: { action: 'ai_request', maxCount: 30, windowSeconds: 60 },
  PUSH_SEND: { action: 'push_send', maxCount: 60, windowSeconds: 60 },
  MESSAGE_SEND: { action: 'message_send', maxCount: 60, windowSeconds: 60 },
  STUDENT_CREATE: { action: 'student_create', maxCount: 50, windowSeconds: 300 },
  INVOICE_CREATE: { action: 'invoice_create', maxCount: 100, windowSeconds: 300 },
  PAYMENT_RECORD: { action: 'payment_record', maxCount: 100, windowSeconds: 300 },
  FILE_UPLOAD: { action: 'file_upload', maxCount: 30, windowSeconds: 60 },
} as const;

export type RateLimitAction = keyof typeof RATE_LIMITS;
