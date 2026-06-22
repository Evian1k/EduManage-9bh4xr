-- ============================================================================
-- EduManage — AI Website Builder
-- ============================================================================
-- Each school gets a professional public website with CMS.
-- Multi-tenant: all content isolated by school_id.
-- ============================================================================

-- Website themes (per school branding)
create table if not exists public.website_themes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade unique,
  primary_color text default '#2196F3',
  secondary_color text default '#0B1426',
  accent_color text default '#FFD700',
  background_color text default '#FFFFFF',
  text_color text default '#1A1A1A',
  heading_font text default 'Inter',
  body_font text default 'Inter',
  hero_image_url text,
  logo_url text,
  favicon_url text,
  footer_text text,
  social_links jsonb default '{}'::jsonb,
  is_published boolean default false,
  published_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Website pages (Home, About, Admissions, Academics, etc.)
create table if not exists public.website_pages (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  slug text not null, -- 'home', 'about', 'admissions', 'academics', etc.
  title text not null,
  meta_title text,
  meta_description text,
  og_image_url text,
  is_published boolean default true,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(school_id, slug)
);
create index if not exists idx_website_pages_school on public.website_pages(school_id);

-- Content blocks (flexible CMS — each page has multiple blocks)
create table if not exists public.website_blocks (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  page_id uuid not null references public.website_pages(id) on delete cascade,
  block_type text not null, -- hero, text, image, stats, testimonials, gallery, cta, staff_grid, news_list, events_list, contact_form, map, video, accordion, timeline
  title text,
  subtitle text,
  body text,
  image_url text,
  images text[], -- for galleries
  data jsonb default '{}'::jsonb, -- flexible data (stats, testimonials, staff, etc.)
  sort_order integer default 0,
  is_visible boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_website_blocks_page on public.website_blocks(page_id, sort_order);

-- Website news (public-facing, separate from internal announcements)
create table if not exists public.website_news (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  title text not null,
  slug text not null,
  excerpt text,
  body text not null,
  image_url text,
  category text, -- academic, sports, arts, community, achievement
  author text,
  is_published boolean default true,
  published_at timestamptz default now(),
  views integer default 0,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(school_id, slug)
);
create index if not exists idx_website_news_school on public.website_news(school_id, published_at desc);

-- Website events (public-facing)
create table if not exists public.website_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  title text not null,
  description text,
  start_at timestamptz not null,
  end_at timestamptz,
  location text,
  image_url text,
  category text, -- academic, sports, cultural, holiday, meeting
  is_published boolean default true,
  is_featured boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_website_events_school on public.website_events(school_id, start_at);

-- Website gallery
create table if not exists public.website_gallery (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  title text,
  description text,
  image_url text not null,
  category text, -- campus, sports, arts, events, classrooms
  sort_order integer default 0,
  is_published boolean default true,
  created_at timestamptz default now()
);
create index if not exists idx_website_gallery_school on public.website_gallery(school_id, sort_order);

-- Website staff (public directory)
create table if not exists public.website_staff (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  full_name text not null,
  position text not null,
  department text,
  bio text,
  photo_url text,
  email text,
  phone text,
  qualifications text,
  sort_order integer default 0,
  is_published boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_website_staff_school on public.website_staff(school_id, sort_order);

-- Website admission info
create table if not exists public.website_admissions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade unique,
  intro_text text,
  process_steps jsonb default '[]'::jsonb, -- [{step, title, description}]
  requirements jsonb default '[]'::jsonb, -- [{item, description}]
  fee_structure jsonb default '[]'::jsonb, -- [{level, amount, currency, includes}]
  scholarships jsonb default '[]'::jsonb, -- [{name, description, amount, eligibility}]
  forms jsonb default '[]'::jsonb, -- [{name, url, description}]
  application_url text,
  contact_email text,
  contact_phone text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Website SEO settings
create table if not exists public.website_seo (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade unique,
  site_title text,
  site_description text,
  keywords text[],
  google_analytics_id text,
  google_search_console_code text,
  facebook_pixel_id text,
  og_default_image text,
  twitter_handle text,
  structured_data jsonb default '{}'::jsonb,
  robots_txt text default 'User-agent: *\nAllow: /',
  sitemap_enabled boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Website careers
create table if not exists public.website_careers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  title text not null,
  department text,
  description text not null,
  requirements text,
  benefits text,
  salary_range text,
  job_type text, -- full_time, part_time, contract
  application_url text,
  application_email text,
  is_active boolean default true,
  closing_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_website_careers_school on public.website_careers(school_id, is_active);

-- Website testimonials
create table if not exists public.website_testimonials (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  author_name text not null,
  author_title text, -- "Parent of Grade 5 student", "Alumni 2020"
  author_photo text,
  quote text not null,
  rating integer default 5,
  is_published boolean default true,
  sort_order integer default 0,
  created_at timestamptz default now()
);
create index if not exists idx_website_testimonials_school on public.website_testimonials(school_id, sort_order);

-- Website stats (e.g., "500 Students", "50 Teachers", "95% Pass Rate")
create table if not exists public.website_stats (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  label text not null,
  value text not null,
  icon text,
  sort_order integer default 0,
  is_published boolean default true,
  created_at timestamptz default now()
);
create index if not exists idx_website_stats_school on public.website_stats(school_id, sort_order);

-- RLS — website content is PUBLIC (readable by anyone) but only school admins can write
-- For public reads, we use a special policy that allows anon to read published content

alter table public.website_themes enable row level security;
alter table public.website_pages enable row level security;
alter table public.website_blocks enable row level security;
alter table public.website_news enable row level security;
alter table public.website_events enable row level security;
alter table public.website_gallery enable row level security;
alter table public.website_staff enable row level security;
alter table public.website_admissions enable row level security;
alter table public.website_seo enable row level security;
alter table public.website_careers enable row level security;
alter table public.website_testimonials enable row level security;
alter table public.website_stats enable row level security;

-- Helper: is school admin for website management
create or replace function public.is_website_admin(p_school_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.school_users
    where school_id = p_school_id
    and user_id = public.current_profile_id()
    and role in ('school_owner','principal','deputy_principal','administrator','ict_manager','secretary')
    and is_active = true
  );
$$;

-- SELECT: anyone can read published content (public website)
-- INSERT/UPDATE/DELETE: school admins only

-- Themes
drop policy if exists website_themes_select on public.website_themes;
create policy website_themes_select on public.website_themes for select using (true);
drop policy if exists website_themes_write on public.website_themes;
create policy website_themes_write on public.website_themes for all using (public.is_website_admin(school_id)) with check (public.is_website_admin(school_id));

-- Pages
drop policy if exists website_pages_select on public.website_pages;
create policy website_pages_select on public.website_pages for select using (is_published = true or public.is_website_admin(school_id));
drop policy if exists website_pages_write on public.website_pages;
create policy website_pages_write on public.website_pages for all using (public.is_website_admin(school_id)) with check (public.is_website_admin(school_id));

-- Blocks
drop policy if exists website_blocks_select on public.website_blocks;
create policy website_blocks_select on public.website_blocks for select using (is_visible = true or public.is_website_admin(school_id));
drop policy if exists website_blocks_write on public.website_blocks;
create policy website_blocks_write on public.website_blocks for all using (public.is_website_admin(school_id)) with check (public.is_website_admin(school_id));

-- News
drop policy if exists website_news_select on public.website_news;
create policy website_news_select on public.website_news for select using (is_published = true or public.is_website_admin(school_id));
drop policy if exists website_news_write on public.website_news;
create policy website_news_write on public.website_news for all using (public.is_website_admin(school_id)) with check (public.is_website_admin(school_id));

-- Events
drop policy if exists website_events_select on public.website_events;
create policy website_events_select on public.website_events for select using (is_published = true or public.is_website_admin(school_id));
drop policy if exists website_events_write on public.website_events;
create policy website_events_write on public.website_events for all using (public.is_website_admin(school_id)) with check (public.is_website_admin(school_id));

-- Gallery
drop policy if exists website_gallery_select on public.website_gallery;
create policy website_gallery_select on public.website_gallery for select using (is_published = true or public.is_website_admin(school_id));
drop policy if exists website_gallery_write on public.website_gallery;
create policy website_gallery_write on public.website_gallery for all using (public.is_website_admin(school_id)) with check (public.is_website_admin(school_id));

-- Staff
drop policy if exists website_staff_select on public.website_staff;
create policy website_staff_select on public.website_staff for select using (is_published = true or public.is_website_admin(school_id));
drop policy if exists website_staff_write on public.website_staff;
create policy website_staff_write on public.website_staff for all using (public.is_website_admin(school_id)) with check (public.is_website_admin(school_id));

-- Admissions
drop policy if exists website_admissions_select on public.website_admissions;
create policy website_admissions_select on public.website_admissions for select using (true);
drop policy if exists website_admissions_write on public.website_admissions;
create policy website_admissions_write on public.website_admissions for all using (public.is_website_admin(school_id)) with check (public.is_website_admin(school_id));

-- SEO
drop policy if exists website_seo_select on public.website_seo;
create policy website_seo_select on public.website_seo for select using (true);
drop policy if exists website_seo_write on public.website_seo;
create policy website_seo_write on public.website_seo for all using (public.is_website_admin(school_id)) with check (public.is_website_admin(school_id));

-- Careers
drop policy if exists website_careers_select on public.website_careers;
create policy website_careers_select on public.website_careers for select using (is_active = true or public.is_website_admin(school_id));
drop policy if exists website_careers_write on public.website_careers;
create policy website_careers_write on public.website_careers for all using (public.is_website_admin(school_id)) with check (public.is_website_admin(school_id));

-- Testimonials
drop policy if exists website_testimonials_select on public.website_testimonials;
create policy website_testimonials_select on public.website_testimonials for select using (is_published = true or public.is_website_admin(school_id));
drop policy if exists website_testimonials_write on public.website_testimonials;
create policy website_testimonials_write on public.website_testimonials for all using (public.is_website_admin(school_id)) with check (public.is_website_admin(school_id));

-- Stats
drop policy if exists website_stats_select on public.website_stats;
create policy website_stats_select on public.website_stats for select using (is_published = true or public.is_website_admin(school_id));
drop policy if exists website_stats_write on public.website_stats;
create policy website_stats_write on public.website_stats for all using (public.is_website_admin(school_id)) with check (public.is_website_admin(school_id));

-- Triggers
do $$ declare t text; tables text[] := array['website_themes','website_pages','website_blocks','website_news','website_events','website_staff','website_admissions','website_seo','website_careers','website_testimonials','website_stats'];
begin foreach t in array tables loop
  execute format('drop trigger if exists trg_%1$s_touch on public.%1$I', t);
  execute format('create trigger trg_%1$s_touch before update on public.%1$I for each row execute function public.touch_updated_at()', t);
end loop; end $$;

-- Storage bucket for website media
insert into storage.buckets (id, name, public) values ('website-media', 'website-media', true) on conflict (id) do nothing;
drop policy if exists "website-media-public-read" on storage.objects;
create policy "website-media-public-read" on storage.objects for select using (bucket_id = 'website-media');
drop policy if exists "website-media-admin-write" on storage.objects;
create policy "website-media-admin-write" on storage.objects for insert with check (
  bucket_id = 'website-media' and (storage.foldername(name))[1] in (
    select school_id::text from public.school_users where user_id = public.current_profile_id() and role in ('school_owner','principal','deputy_principal','administrator','ict_manager','secretary')
  )
);
