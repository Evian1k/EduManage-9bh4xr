// EduManage — AI Website Builder service
// Full CMS for school websites. Multi-tenant (school_id isolated).
// Supports: themes, pages, blocks, news, events, gallery, staff, admissions,
// SEO, careers, testimonials, stats.

import { getSupabaseClient } from '@/template';
import { ServiceResult } from '@/lib/types';

// ===== Themes =====
export async function getTheme(schoolId: string): Promise<ServiceResult<any>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('website_themes').select('*').eq('school_id', schoolId).maybeSingle();
  return { data, error: error?.message ?? null };
}

export async function upsertTheme(schoolId: string, theme: Partial<any>): Promise<ServiceResult<any>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('website_themes').upsert({ school_id: schoolId, ...theme }, { onConflict: 'school_id' }).select().single();
  return { data, error: error?.message ?? null };
}

// ===== Pages =====
export async function getPages(schoolId: string): Promise<ServiceResult<any[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('website_pages').select('*').eq('school_id', schoolId).order('sort_order');
  return { data, error: error?.message ?? null };
}

export async function getPage(schoolId: string, slug: string): Promise<ServiceResult<any>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('website_pages').select('*').eq('school_id', schoolId).eq('slug', slug).maybeSingle();
  return { data, error: error?.message ?? null };
}

export async function upsertPage(schoolId: string, page: Partial<any>): Promise<ServiceResult<any>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('website_pages').upsert({ school_id: schoolId, ...page }, { onConflict: 'school_id,slug' }).select().single();
  return { data, error: error?.message ?? null };
}

// ===== Blocks =====
export async function getBlocks(schoolId: string, pageId: string): Promise<ServiceResult<any[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('website_blocks').select('*').eq('school_id', schoolId).eq('page_id', pageId).order('sort_order');
  return { data, error: error?.message ?? null };
}

export async function createBlock(schoolId: string, block: Partial<any>): Promise<ServiceResult<any>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('website_blocks').insert({ school_id: schoolId, ...block }).select().single();
  return { data, error: error?.message ?? null };
}

export async function updateBlock(blockId: string, updates: Partial<any>): Promise<ServiceResult<any>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('website_blocks').update(updates).eq('id', blockId).select().single();
  return { data, error: error?.message ?? null };
}

export async function deleteBlock(blockId: string): Promise<ServiceResult<boolean>> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('website_blocks').delete().eq('id', blockId);
  return { data: !error, error: error?.message ?? null };
}

// ===== News =====
export async function getNews(schoolId: string, opts?: { limit?: number; category?: string }): Promise<ServiceResult<any[]>> {
  const supabase = getSupabaseClient();
  let q = supabase.from('website_news').select('*').eq('school_id', schoolId).eq('is_published', true).order('published_at', { ascending: false });
  if (opts?.category) q = q.eq('category', opts.category);
  if (opts?.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  return { data, error: error?.message ?? null };
}

export async function createNews(schoolId: string, news: Partial<any>): Promise<ServiceResult<any>> {
  const supabase = getSupabaseClient();
  const slug = news.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `news-${Date.now()}`;
  const { data, error } = await supabase.from('website_news').insert({ school_id: schoolId, slug, ...news }).select().single();
  return { data, error: error?.message ?? null };
}

export async function deleteNews(schoolId: string, newsId: string): Promise<ServiceResult<boolean>> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('website_news').delete().eq('id', newsId).eq('school_id', schoolId);
  return { data: !error, error: error?.message ?? null };
}

// ===== Events =====
export async function getEvents(schoolId: string, opts?: { limit?: number; upcoming?: boolean }): Promise<ServiceResult<any[]>> {
  const supabase = getSupabaseClient();
  let q = supabase.from('website_events').select('*').eq('school_id', schoolId).eq('is_published', true).order('start_at', { ascending: true });
  if (opts?.upcoming) q = q.gte('start_at', new Date().toISOString());
  if (opts?.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  return { data, error: error?.message ?? null };
}

export async function createEvent(schoolId: string, event: Partial<any>): Promise<ServiceResult<any>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('website_events').insert({ school_id: schoolId, ...event }).select().single();
  return { data, error: error?.message ?? null };
}

// ===== Gallery =====
export async function getGallery(schoolId: string, opts?: { category?: string }): Promise<ServiceResult<any[]>> {
  const supabase = getSupabaseClient();
  let q = supabase.from('website_gallery').select('*').eq('school_id', schoolId).eq('is_published', true).order('sort_order');
  if (opts?.category) q = q.eq('category', opts.category);
  const { data, error } = await q;
  return { data, error: error?.message ?? null };
}

export async function addGalleryImage(schoolId: string, image: Partial<any>): Promise<ServiceResult<any>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('website_gallery').insert({ school_id: schoolId, ...image }).select().single();
  return { data, error: error?.message ?? null };
}

export async function deleteGalleryImage(schoolId: string, imageId: string): Promise<ServiceResult<boolean>> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('website_gallery').delete().eq('id', imageId).eq('school_id', schoolId);
  return { data: !error, error: error?.message ?? null };
}

// ===== Staff Directory =====
export async function getWebsiteStaff(schoolId: string): Promise<ServiceResult<any[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('website_staff').select('*').eq('school_id', schoolId).eq('is_published', true).order('sort_order');
  return { data, error: error?.message ?? null };
}

export async function addWebsiteStaff(schoolId: string, staff: Partial<any>): Promise<ServiceResult<any>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('website_staff').insert({ school_id: schoolId, ...staff }).select().single();
  return { data, error: error?.message ?? null };
}

export async function deleteWebsiteStaff(schoolId: string, staffId: string): Promise<ServiceResult<boolean>> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('website_staff').delete().eq('id', staffId).eq('school_id', schoolId);
  return { data: !error, error: error?.message ?? null };
}

// ===== Admissions =====
export async function getAdmissions(schoolId: string): Promise<ServiceResult<any>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('website_admissions').select('*').eq('school_id', schoolId).maybeSingle();
  return { data, error: error?.message ?? null };
}

export async function upsertAdmissions(schoolId: string, admissions: Partial<any>): Promise<ServiceResult<any>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('website_admissions').upsert({ school_id: schoolId, ...admissions }, { onConflict: 'school_id' }).select().single();
  return { data, error: error?.message ?? null };
}

// ===== SEO =====
export async function getSEO(schoolId: string): Promise<ServiceResult<any>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('website_seo').select('*').eq('school_id', schoolId).maybeSingle();
  return { data, error: error?.message ?? null };
}

export async function upsertSEO(schoolId: string, seo: Partial<any>): Promise<ServiceResult<any>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('website_seo').upsert({ school_id: schoolId, ...seo }, { onConflict: 'school_id' }).select().single();
  return { data, error: error?.message ?? null };
}

// ===== Careers =====
export async function getCareers(schoolId: string): Promise<ServiceResult<any[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('website_careers').select('*').eq('school_id', schoolId).eq('is_active', true).order('created_at', { ascending: false });
  return { data, error: error?.message ?? null };
}

export async function createCareer(schoolId: string, career: Partial<any>): Promise<ServiceResult<any>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('website_careers').insert({ school_id: schoolId, ...career }).select().single();
  return { data, error: error?.message ?? null };
}

// ===== Testimonials =====
export async function getTestimonials(schoolId: string): Promise<ServiceResult<any[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('website_testimonials').select('*').eq('school_id', schoolId).eq('is_published', true).order('sort_order');
  return { data, error: error?.message ?? null };
}

export async function addTestimonial(schoolId: string, testimonial: Partial<any>): Promise<ServiceResult<any>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('website_testimonials').insert({ school_id: schoolId, ...testimonial }).select().single();
  return { data, error: error?.message ?? null };
}

// ===== Stats =====
export async function getStats(schoolId: string): Promise<ServiceResult<any[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('website_stats').select('*').eq('school_id', schoolId).eq('is_published', true).order('sort_order');
  return { data, error: error?.message ?? null };
}

export async function addStat(schoolId: string, stat: Partial<any>): Promise<ServiceResult<any>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('website_stats').insert({ school_id: schoolId, ...stat }).select().single();
  return { data, error: error?.message ?? null };
}

// ===== Initialize default website for a new school =====
export async function initializeWebsite(schoolId: string, schoolName: string): Promise<ServiceResult<boolean>> {
  const supabase = getSupabaseClient();
  // Create default theme
  await upsertTheme(schoolId, {
    primary_color: '#2196F3',
    secondary_color: '#0B1426',
    accent_color: '#FFD700',
    footer_text: `${schoolName} — Excellence in Education`,
    is_published: false,
  });
  // Create default pages
  const defaultPages = [
    { slug: 'home', title: 'Home', meta_title: `${schoolName} — Excellence in Education`, sort_order: 0 },
    { slug: 'about', title: 'About Us', meta_title: `About ${schoolName}`, sort_order: 1 },
    { slug: 'admissions', title: 'Admissions', meta_title: `Admissions — ${schoolName}`, sort_order: 2 },
    { slug: 'academics', title: 'Academics', meta_title: `Academics — ${schoolName}`, sort_order: 3 },
    { slug: 'staff', title: 'Staff Directory', meta_title: `Our Staff — ${schoolName}`, sort_order: 4 },
    { slug: 'news', title: 'News & Events', meta_title: `News & Events — ${schoolName}`, sort_order: 5 },
    { slug: 'gallery', title: 'Gallery', meta_title: `Gallery — ${schoolName}`, sort_order: 6 },
    { slug: 'contact', title: 'Contact Us', meta_title: `Contact — ${schoolName}`, sort_order: 7 },
    { slug: 'careers', title: 'Careers', meta_title: `Careers — ${schoolName}`, sort_order: 8 },
  ];
  for (const page of defaultPages) {
    await supabase.from('website_pages').upsert({ school_id: schoolId, ...page }, { onConflict: 'school_id,slug' });
  }
  // Create default SEO
  await supabase.from('website_seo').upsert({
    school_id: schoolId,
    site_title: `${schoolName} — Excellence in Education`,
    site_description: `Welcome to ${schoolName}, where we nurture future leaders through quality education.`,
    keywords: [schoolName, 'school', 'education', 'admissions'],
    sitemap_enabled: true,
  }, { onConflict: 'school_id' });
  // Create default stats
  const defaultStats = [
    { label: 'Students', value: '500+', icon: 'people' },
    { label: 'Teachers', value: '50+', icon: 'cast-for-education' },
    { label: 'Pass Rate', value: '95%', icon: 'trending-up' },
    { label: 'Years', value: '20+', icon: 'history' },
  ];
  for (const stat of defaultStats) {
    await supabase.from('website_stats').insert({ school_id: schoolId, ...stat });
  }
  return { data: true, error: null };
}

// ===== Publish/Unpublish website =====
export async function publishWebsite(schoolId: string): Promise<ServiceResult<boolean>> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('website_themes').update({ is_published: true, published_at: new Date().toISOString() }).eq('school_id', schoolId);
  return { data: !error, error: error?.message ?? null };
}

export async function unpublishWebsite(schoolId: string): Promise<ServiceResult<boolean>> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('website_themes').update({ is_published: false }).eq('school_id', schoolId);
  return { data: !error, error: error?.message ?? null };
}
