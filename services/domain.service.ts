// EduManage — Custom domain service
//
// Manages the `custom_domains` table (per-school custom hostnames for
// white-label deployments). Verification is done by the `verify-domain`
// edge function — this service only sets/resets the row state.

import { getSupabaseClient } from '@/template';
import { CustomDomain, ServiceResult } from '@/lib/types';
import { logAuditEvent } from './audit.service';

function randomToken(): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return `edumanage-verify-${Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`;
  }
  return `edumanage-verify-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export async function listDomains(
  schoolId: string,
): Promise<ServiceResult<CustomDomain[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('custom_domains')
    .select('*')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false });
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as CustomDomain[], error: null };
}

export async function addCustomDomain(
  schoolId: string,
  domain: string,
  addedBy: string,
): Promise<ServiceResult<CustomDomain>> {
  const supabase = getSupabaseClient();
  const cleaned = domain.toLowerCase().trim().replace(/\/$/, '');
  if (!cleaned) return { data: null, error: 'Domain is required' };

  const verificationToken = randomToken();
  const { data, error } = await supabase
    .from('custom_domains')
    .insert({
      school_id: schoolId,
      domain: cleaned,
      domain_type: 'custom',
      verification_token: verificationToken,
      verification_method: 'txt',
      status: 'pending',
      ssl_status: 'none',
      is_primary: false,
    })
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };

  await logAuditEvent({
    schoolId,
    userId: addedBy,
    action: 'domain.added',
    resourceType: 'custom_domain',
    resourceId: (data as { id: string }).id,
    details: { domain: cleaned },
    severity: 'info',
  });

  return { data: data as unknown as CustomDomain, error: null };
}

/**
 * Mark a domain as verified. The actual DNS check is performed by the
 * `verify-domain` edge function — this method is the persistence layer
 * it calls once DNS resolves successfully.
 */
export async function verifyDomain(
  schoolId: string,
  domainId: string,
  verifiedBy: string,
): Promise<ServiceResult<CustomDomain>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('custom_domains')
    .update({
      status: 'verified',
      verified_at: new Date().toISOString(),
      ssl_status: 'ssl_pending',
    })
    .eq('id', domainId)
    .eq('school_id', schoolId)
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };

  await logAuditEvent({
    schoolId,
    userId: verifiedBy,
    action: 'domain.verified',
    resourceType: 'custom_domain',
    resourceId: domainId,
    severity: 'info',
  });

  return { data: data as unknown as CustomDomain, error: null };
}

export async function removeDomain(
  schoolId: string,
  domainId: string,
  removedBy: string,
): Promise<ServiceResult<{ removed: boolean }>> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('custom_domains')
    .update({ status: 'removed', is_primary: false })
    .eq('id', domainId)
    .eq('school_id', schoolId);
  if (error) return { data: null, error: error.message };

  await logAuditEvent({
    schoolId,
    userId: removedBy,
    action: 'domain.removed',
    resourceType: 'custom_domain',
    resourceId: domainId,
    severity: 'warning',
  });

  return { data: { removed: true }, error: null };
}

/**
 * Set a domain as the school's primary. Clears the `is_primary` flag on all
 * other domains for the school first, then sets the requested one.
 */
export async function setPrimaryDomain(
  schoolId: string,
  domainId: string,
): Promise<ServiceResult<CustomDomain>> {
  const supabase = getSupabaseClient();
  // Clear existing primary
  const { error: clearErr } = await supabase
    .from('custom_domains')
    .update({ is_primary: false })
    .eq('school_id', schoolId)
    .eq('is_primary', true);
  if (clearErr) return { data: null, error: clearErr.message };

  const { data, error } = await supabase
    .from('custom_domains')
    .update({ is_primary: true, status: 'active' })
    .eq('id', domainId)
    .eq('school_id', schoolId)
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };

  await logAuditEvent({
    schoolId,
    action: 'domain.primary_changed',
    resourceType: 'custom_domain',
    resourceId: domainId,
    severity: 'info',
  });

  return { data: data as unknown as CustomDomain, error: null };
}
