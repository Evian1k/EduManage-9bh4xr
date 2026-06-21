// EduManage — School branding service
//
// Thin wrapper around the `schools` table's branding columns. The new
// schema uses `primary_color`, `accent_color`, and `settings.theme` rather
// than the legacy `secondary_color`/`theme_preference`/`website_*` columns.
// This service bridges both shapes so older screens keep working.

import { getSupabaseClient } from '@/template';
import { ServiceResult } from '@/lib/types';
import { logAuditEvent } from './audit.service';

export interface SchoolBranding {
  primary_color?: string | null;
  accent_color?: string | null;
  logo_url?: string | null;
  motto?: string | null;
  website?: string | null;
  /** Stored in `settings.theme` (or `settings.theme_preference` for back-compat). */
  theme_preference?: 'dark' | 'light';
  /** Stored in `settings.website_enabled`. */
  website_enabled?: boolean;
  /** Stored in `settings.website_plan`. */
  website_plan?: string;
}

export interface BrandingWithSchool extends SchoolBranding {
  name: string;
  subdomain: string;
}

export async function getBranding(
  schoolId: string,
): Promise<ServiceResult<BrandingWithSchool>> {
  return getSchoolBranding(schoolId);
}

export async function getSchoolBranding(
  schoolId: string,
): Promise<ServiceResult<BrandingWithSchool>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('schools')
    .select('name, subdomain, primary_color, accent_color, logo_url, motto, website, settings')
    .eq('id', schoolId)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: 'School not found' };
  const row = data as {
    name: string;
    subdomain: string;
    primary_color?: string | null;
    accent_color?: string | null;
    logo_url?: string | null;
    motto?: string | null;
    website?: string | null;
    settings?: Record<string, unknown> | null;
  };
  const settings = (row.settings ?? {}) as Record<string, unknown>;
  return {
    data: {
      name: row.name,
      subdomain: row.subdomain,
      primary_color: row.primary_color,
      accent_color: row.accent_color,
      logo_url: row.logo_url,
      motto: row.motto,
      website: row.website,
      theme_preference: (settings.theme as 'dark' | 'light') ?? (settings.theme_preference as 'dark' | 'light'),
      website_enabled: settings.website_enabled as boolean | undefined,
      website_plan: settings.website_plan as string | undefined,
    },
    error: null,
  };
}

export async function updateBranding(
  schoolId: string,
  branding: Partial<SchoolBranding>,
): Promise<ServiceResult<BrandingWithSchool>> {
  return updateSchoolBranding(schoolId, branding);
}

export async function updateSchoolBranding(
  schoolId: string,
  branding: Partial<SchoolBranding>,
): Promise<ServiceResult<BrandingWithSchool>> {
  const supabase = getSupabaseClient();
  // Split columns vs settings
  const columnUpdates: Record<string, unknown> = {};
  const settingsUpdates: Record<string, unknown> = {};
  if (branding.primary_color !== undefined) columnUpdates.primary_color = branding.primary_color;
  if (branding.accent_color !== undefined) columnUpdates.accent_color = branding.accent_color;
  if (branding.logo_url !== undefined) columnUpdates.logo_url = branding.logo_url;
  if (branding.motto !== undefined) columnUpdates.motto = branding.motto;
  if (branding.website !== undefined) columnUpdates.website = branding.website;
  if (branding.theme_preference !== undefined) settingsUpdates.theme = branding.theme_preference;
  if (branding.website_enabled !== undefined) settingsUpdates.website_enabled = branding.website_enabled;
  if (branding.website_plan !== undefined) settingsUpdates.website_plan = branding.website_plan;

  // Merge settings into the existing JSONB
  if (Object.keys(settingsUpdates).length > 0) {
    const { data: existing } = await supabase
      .from('schools')
      .select('settings')
      .eq('id', schoolId)
      .maybeSingle();
    const current = ((existing as { settings?: Record<string, unknown> | null })?.settings) ?? {};
    columnUpdates.settings = { ...current, ...settingsUpdates };
  }

  const { data, error } = await supabase
    .from('schools')
    .update(columnUpdates)
    .eq('id', schoolId)
    .select('name, subdomain, primary_color, accent_color, logo_url, motto, website, settings')
    .single();
  if (error) return { data: null, error: error.message };

  await logAuditEvent({
    schoolId,
    action: 'settings.updated',
    resourceType: 'school',
    resourceId: schoolId,
    details: { updated: Object.keys(branding) },
    severity: 'info',
  });

  const row = data as {
    name: string;
    subdomain: string;
    primary_color?: string | null;
    accent_color?: string | null;
    logo_url?: string | null;
    motto?: string | null;
    website?: string | null;
    settings?: Record<string, unknown> | null;
  };
  const settings = (row.settings ?? {}) as Record<string, unknown>;
  return {
    data: {
      name: row.name,
      subdomain: row.subdomain,
      primary_color: row.primary_color,
      accent_color: row.accent_color,
      logo_url: row.logo_url,
      motto: row.motto,
      website: row.website,
      theme_preference: (settings.theme as 'dark' | 'light') ?? undefined,
      website_enabled: settings.website_enabled as boolean | undefined,
      website_plan: settings.website_plan as string | undefined,
    },
    error: null,
  };
}

/**
 * Upload a school logo to Supabase Storage and return the public URL.
 * File must be passed as a base64 string (from expo-image-picker).
 */
export async function uploadSchoolLogo(
  schoolId: string,
  base64Data: string,
  mimeType: string = 'image/png',
): Promise<ServiceResult<{ url: string }>> {
  const supabase = getSupabaseClient();
  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const ext = mimeType === 'image/jpeg' ? 'jpg' : 'png';
  const filePath = `${schoolId}/logo.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from('school-logos')
    .upload(filePath, bytes.buffer as ArrayBuffer, {
      contentType: mimeType,
      upsert: true,
    });
  if (uploadErr) return { data: null, error: uploadErr.message };

  const { data: urlData } = supabase.storage.from('school-logos').getPublicUrl(filePath);
  await supabase
    .from('schools')
    .update({ logo_url: urlData.publicUrl })
    .eq('id', schoolId);
  return { data: { url: urlData.publicUrl }, error: null };
}

// Preset branding color palettes
export const BRAND_PALETTES = [
  { name: 'Ocean Blue', primary: '#1565C0', secondary: '#00897B' },
  { name: 'Royal Purple', primary: '#6A1B9A', secondary: '#283593' },
  { name: 'Forest Green', primary: '#2E7D32', secondary: '#00695C' },
  { name: 'Crimson', primary: '#B71C1C', secondary: '#1565C0' },
  { name: 'Amber Gold', primary: '#F57F17', secondary: '#1565C0' },
  { name: 'Slate', primary: '#37474F', secondary: '#00897B' },
  { name: 'Teal', primary: '#00695C', secondary: '#1565C0' },
  { name: 'Indigo', primary: '#283593', secondary: '#6A1B9A' },
];
