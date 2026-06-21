// EduManage — Shared domain types & enums
// Mirrors Postgres enums declared in 20250101000001_foundation.sql

export type UserRole =
  | 'school_owner'
  | 'principal'
  | 'deputy_principal'
  | 'administrator'
  | 'teacher'
  | 'student'
  | 'parent'
  | 'secretary'
  | 'bursar'
  | 'librarian'
  | 'nurse'
  | 'ict_manager'
  | 'driver'
  | 'groundskeeper'
  | 'counselor'
  | 'boarding_master'
  | 'boarding_mistress'
  | 'platform_admin';

export const ALL_ROLES: UserRole[] = [
  'school_owner',
  'principal',
  'deputy_principal',
  'administrator',
  'teacher',
  'student',
  'parent',
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
  'platform_admin',
];

/** Staff roles — every role except `student`, `parent`, `platform_admin`. */
export const STAFF_ROLES: UserRole[] = [
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

/**
 * Alias for {@link STAFF_ROLES}. Exported under a more descriptive name so
 * call sites can disambiguate from {@link ADMIN_ROLES} / {@link ALL_ROLES}.
 */
export const ALL_STAFF_ROLES: UserRole[] = STAFF_ROLES;

/** Roles that can administer a school (manage users, settings, billing). */
export const ADMIN_ROLES: UserRole[] = [
  'school_owner',
  'principal',
  'deputy_principal',
  'administrator',
  'ict_manager',
];

export type SubscriptionPlan = 'starter' | 'professional' | 'enterprise';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired';
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';
export type DomainStatus = 'pending' | 'verified' | 'failed' | 'ssl_pending' | 'active' | 'removed';
export type AuditSeverity = 'info' | 'warning' | 'critical';

export interface School {
  id: string;
  name: string;
  slug: string;
  subdomain: string;
  country?: string | null;
  county?: string | null;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  motto?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  accent_color?: string | null;
  status?: string | null;
  plan_status: SubscriptionStatus;
  plan_tier: SubscriptionPlan;
  trial_ends_at?: string | null;
  plan_renews_at?: string | null;
  ai_usage_count: number;
  ai_usage_limit: number;
  max_students: number;
  max_staff: number;
  max_storage_mb: number;
  settings?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  auth_user_id?: string | null;
  email: string;
  full_name?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  default_school_id?: string | null;
  mfa_enabled: boolean;
  mfa_secret?: string | null;
  email_verified: boolean;
  phone_verified: boolean;
  failed_login_count: number;
  locked_until?: string | null;
  last_login_at?: string | null;
  last_login_ip?: string | null;
  last_device_fingerprint?: string | null;
  status?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface SchoolUser {
  id: string;
  school_id: string;
  user_id: string;
  role: UserRole;
  is_active: boolean;
  invited_by?: string | null;
  joined_at: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface SchoolInvitation {
  id: string;
  school_id: string;
  email: string;
  role: UserRole;
  token: string;
  invited_by: string;
  status: InvitationStatus;
  expires_at: string;
  accepted_at?: string | null;
  accepted_by?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

export interface CustomDomain {
  id: string;
  school_id: string;
  domain: string;
  domain_type: string;
  verification_token?: string | null;
  verification_method?: string;
  status: DomainStatus;
  verified_at?: string | null;
  ssl_status?: string;
  ssl_expires_at?: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  school_id?: string | null;
  user_id?: string | null;
  action: string;
  resource_type?: string | null;
  resource_id?: string | null;
  details?: Record<string, unknown> | null;
  ip_address?: string | null;
  user_agent?: string | null;
  severity: AuditSeverity;
  created_at: string;
}

export interface Notification {
  id: string;
  school_id?: string | null;
  user_id: string;
  title: string;
  body?: string | null;
  type?: string | null;
  category?: string | null;
  data?: Record<string, unknown> | null;
  read_at?: string | null;
  created_at: string;
}

/** Standard service result envelope: every service function returns this shape. */
export interface ServiceResult<T> {
  data: T | null;
  error: string | null;
}

// ─── AI ─────────────────────────────────────────────────────────────────────

export type AIProvider = 'openai' | 'anthropic' | 'google' | 'azure' | 'cohere' | 'mistral' | 'local';

export type AIFeature =
  | 'assignment_generation'
  | 'submission_grading'
  | 'lesson_plan'
  | 'quiz_generation'
  | 'student_tutor'
  | 'admin_analytics'
  | 'principal_insights';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  name?: string;
}

export interface AIResponse {
  content: string;
  provider: AIProvider;
  model: string;
  tokensUsed: number;
  costUsd: number;
  metadata?: Record<string, unknown>;
}
