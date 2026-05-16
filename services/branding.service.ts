import { getSupabaseClient } from '@/template';

export interface SchoolBranding {
  primary_color: string;
  secondary_color: string;
  theme_preference: 'dark' | 'light';
  logo_url?: string;
  motto?: string;
  website_enabled: boolean;
  website_plan: string;
}

/**
 * Get branding settings for a school.
 */
export async function getSchoolBranding(schoolId: string) {
  const supabase = getSupabaseClient();
  return supabase
    .from('schools')
    .select('primary_color, secondary_color, theme_preference, logo_url, motto, website_enabled, website_plan, name, subdomain')
    .eq('id', schoolId)
    .single();
}

/**
 * Update school branding settings.
 */
export async function updateSchoolBranding(schoolId: string, branding: Partial<SchoolBranding>) {
  const supabase = getSupabaseClient();
  return supabase
    .from('schools')
    .update({ ...branding, updated_at: new Date().toISOString() })
    .eq('id', schoolId)
    .select()
    .single();
}

/**
 * Upload a school logo to Supabase Storage and return the public URL.
 * File must be passed as a base64 string (from expo-image-picker).
 */
export async function uploadSchoolLogo(
  schoolId: string,
  base64Data: string,
  mimeType: string = 'image/png'
): Promise<{ url: string | null; error: any }> {
  const supabase = getSupabaseClient();

  // Convert base64 to ArrayBuffer
  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const ext = mimeType === 'image/jpeg' ? 'jpg' : 'png';
  const filePath = `school-logos/${schoolId}/logo.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('school-assets')
    .upload(filePath, bytes.buffer, {
      contentType: mimeType,
      upsert: true,
    });

  if (uploadError) return { url: null, error: uploadError };

  const { data: urlData } = supabase.storage
    .from('school-assets')
    .getPublicUrl(filePath);

  // Update school record with new logo URL
  await supabase
    .from('schools')
    .update({ logo_url: urlData.publicUrl, updated_at: new Date().toISOString() })
    .eq('id', schoolId);

  return { url: urlData.publicUrl, error: null };
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
