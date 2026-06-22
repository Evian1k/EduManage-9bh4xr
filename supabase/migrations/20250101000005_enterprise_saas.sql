-- ============================================================================
-- EduManage — Enterprise SaaS Expansion
-- ============================================================================
-- Adds:
--   1. 20 roles (school-side + company-side)
--   2. Company platform tables (CEO, Support, Engineering, Security, Sales,
--      Finance, HR, Marketing, Customer Success, Maintenance dashboards)
--   3. SaaS billing (6 subscription plans, revenue tracking, MRR/ARR/CLV/Churn)
--   4. School Marketplace (books, uniforms, transport, LMS content, exams,
--      teacher training — second revenue stream)
--   5. Company AI (support assistant, revenue forecasting, churn prediction)
--   6. Support tickets system
--   7. Lead tracking (sales pipeline)
--   8. Customer health scoring
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Expand user_role enum with all new roles
-- ----------------------------------------------------------------------------
do $$ begin
  alter type public.user_role add value if not exists 'head_teacher';
exception when duplicate_object then null; end $$;
do $$ begin
  alter type public.user_role add value if not exists 'academic_director';
exception when duplicate_object then null; end $$;
do $$ begin
  alter type public.user_role add value if not exists 'accountant';
exception when duplicate_object then null; end $$;
do $$ begin
  alter type public.user_role add value if not exists 'security_officer';
exception when duplicate_object then null; end $$;
do $$ begin
  alter type public.user_role add value if not exists 'hostel_warden';
exception when duplicate_object then null; end $$;
do $$ begin
  alter type public.user_role add value if not exists 'board_member';
exception when duplicate_object then null; end $$;
-- Company-side roles
do $$ begin
  alter type public.user_role add value if not exists 'company_ceo';
exception when duplicate_object then null; end $$;
do $$ begin
  alter type public.user_role add value if not exists 'company_support';
exception when duplicate_object then null; end $$;
do $$ begin
  alter type public.user_role add value if not exists 'company_engineering';
exception when duplicate_object then null; end $$;
do $$ begin
  alter type public.user_role add value if not exists 'company_security';
exception when duplicate_object then null; end $$;
do $$ begin
  alter type public.user_role add value if not exists 'company_sales';
exception when duplicate_object then null; end $$;
do $$ begin
  alter type public.user_role add value if not exists 'company_finance';
exception when duplicate_object then null; end $$;
do $$ begin
  alter type public.user_role add value if not exists 'company_hr';
exception when duplicate_object then null; end $$;
do $$ begin
  alter type public.user_role add value if not exists 'company_marketing';
exception when duplicate_object then null; end $$;
do $$ begin
  alter type public.user_role add value if not exists 'company_customer_success';
exception when duplicate_object then null; end $$;
do $$ begin
  alter type public.user_role add value if not exists 'company_maintenance';
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- 2. Expand subscription_plan enum with new tiers
-- ----------------------------------------------------------------------------
do $$ begin
  alter type public.subscription_plan add value if not exists 'government';
exception when duplicate_object then null; end $$;
do $$ begin
  alter type public.subscription_plan add value if not exists 'university';
exception when duplicate_object then null; end $$;
do $$ begin
  alter type public.subscription_plan add value if not exists 'custom';
exception when duplicate_object then null; end $$;

-- Insert new plans
insert into public.subscription_plans (tier, name, description, price_monthly_usd, price_yearly_usd, max_students, max_staff, max_storage_mb, ai_usage_limit, features) values
  ('government', 'Government', 'For government schools and ministries', 199.00, 1990.00, 100000, 2000, 51200, 50000, '{"modules":["all"],"custom_domain":true,"sso":true,"dedicated_support":true}'),
  ('university', 'University', 'For universities and colleges', 499.00, 4990.00, 200000, 5000, 102400, 200000, '{"modules":["all"],"custom_domain":true,"sso":true,"api_access":true,"dedicated_support":true}'),
  ('custom', 'Custom', 'Custom plan for large networks', 0, 0, 0, 0, 0, 0, '{"modules":["all"],"custom_domain":true,"sso":true,"api_access":true,"dedicated_support":true,"white_label":true}')
on conflict (tier) do nothing;

-- ----------------------------------------------------------------------------
-- 3. Company platform — employees, departments, KPIs
-- ----------------------------------------------------------------------------
create table if not exists public.company_employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  employee_number text not null unique,
  full_name text not null,
  email text not null,
  phone text,
  department text not null, -- executive | support | engineering | security | sales | finance | hr | marketing | customer_success | maintenance
  position text,
  role user_role not null,
  employment_date date default current_date,
  status text default 'active',
  salary numeric(12,2) default 0,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_company_employees_user on public.company_employees(user_id);
create index if not exists idx_company_employees_dept on public.company_employees(department);

create table if not exists public.company_kpis (
  id uuid primary key default gen_random_uuid(),
  metric_name text not null,
  metric_value numeric(14,2) not null,
  target_value numeric(14,2),
  unit text,
  period text not null, -- daily | weekly | monthly | quarterly | yearly
  period_start date not null,
  period_end date not null,
  category text, -- revenue | growth | churn | support | engineering | security
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create index if not exists idx_company_kpis_period on public.company_kpis(period, period_start);

-- ----------------------------------------------------------------------------
-- 4. Support tickets system
-- ----------------------------------------------------------------------------
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  ticket_number text not null unique,
  subject text not null,
  description text not null,
  category text, -- technical | billing | general | feature_request | bug
  priority text default 'normal', -- low | normal | high | urgent | critical
  status text default 'open', -- open | in_progress | resolved | closed | escalated
  created_by uuid not null references public.user_profiles(id) on delete cascade,
  assigned_to uuid references public.user_profiles(id) on delete set null,
  resolved_at timestamptz,
  resolved_by uuid references public.user_profiles(id) on delete set null,
  resolution_notes text,
  satisfaction_rating integer, -- 1-5
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_support_tickets_school on public.support_tickets(school_id);
create index if not exists idx_support_tickets_status on public.support_tickets(status);
create index if not exists idx_support_tickets_priority on public.support_tickets(priority);

create table if not exists public.support_ticket_replies (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  replied_by uuid not null references public.user_profiles(id) on delete cascade,
  body text not null,
  is_internal boolean default false,
  attachment_url text,
  created_at timestamptz default now()
);
create index if not exists idx_ticket_replies_ticket on public.support_ticket_replies(ticket_id);

create table if not exists public.knowledge_base_articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  body text not null,
  category text,
  tags text[],
  author_id uuid references public.user_profiles(id) on delete set null,
  views integer default 0,
  helpful_count integer default 0,
  unhelpful_count integer default 0,
  status text default 'published',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_kb_articles_slug on public.knowledge_base_articles(slug);
create index if not exists idx_kb_articles_category on public.knowledge_base_articles(category);

-- ----------------------------------------------------------------------------
-- 5. Sales — leads, pipeline, conversions
-- ----------------------------------------------------------------------------
create table if not exists public.sales_leads (
  id uuid primary key default gen_random_uuid(),
  lead_number text not null unique,
  school_name text not null,
  contact_name text not null,
  contact_email text not null,
  contact_phone text,
  country text,
  country_code text,
  lead_source text, -- website | referral | conference | cold_call | social_media | partner
  lead_status text default 'new', -- new | contacted | qualified | proposal_sent | negotiation | won | lost
  estimated_value numeric(12,2),
  actual_value numeric(12,2),
  probability integer default 10, -- 0-100
  expected_close_date date,
  assigned_to uuid references public.user_profiles(id) on delete set null,
  school_id uuid references public.schools(id) on delete set null, -- linked if converted
  converted_at timestamptz,
  loss_reason text,
  notes text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_sales_leads_status on public.sales_leads(lead_status);
create index if not exists idx_sales_leads_assigned on public.sales_leads(assigned_to);

create table if not exists public.sales_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  campaign_type text, -- email | social_media | conference | webinar | referral
  start_date date,
  end_date date,
  budget numeric(12,2),
  spent numeric(12,2) default 0,
  leads_generated integer default 0,
  conversions integer default 0,
  revenue_generated numeric(12,2) default 0,
  status text default 'draft',
  created_by uuid references public.user_profiles(id) on delete set null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ----------------------------------------------------------------------------
-- 6. Customer success — onboarding, health scores
-- ----------------------------------------------------------------------------
create table if not exists public.customer_health_scores (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  score integer not null, -- 0-100 (100 = very healthy)
  risk_level text, -- healthy | at_risk | critical
  factors jsonb default '{}'::jsonb, -- {login_frequency, feature_adoption, support_tickets, payment_status}
  recommendations text[],
  assessed_by uuid references public.user_profiles(id) on delete set null,
  assessed_at timestamptz default now(),
  created_at timestamptz default now()
);
create index if not exists idx_customer_health_school on public.customer_health_scores(school_id);
create index if not exists idx_customer_health_risk on public.customer_health_scores(risk_level);

create table if not exists public.onboarding_checklists (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  step_name text not null,
  step_description text,
  step_order integer not null,
  is_completed boolean default false,
  completed_at timestamptz,
  completed_by uuid references public.user_profiles(id) on delete set null,
  notes text,
  created_at timestamptz default now()
);
create index if not exists idx_onboarding_school on public.onboarding_checklists(school_id);

-- ----------------------------------------------------------------------------
-- 7. Revenue analytics — MRR, ARR, CLV, Churn
-- ----------------------------------------------------------------------------
create table if not exists public.revenue_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  amount numeric(14,2) not null,
  currency text default 'USD',
  revenue_type text not null, -- subscription | marketplace | setup_fee | add_on | refund
  period_month integer not null,
  period_year integer not null,
  invoice_id text,
  payment_method text,
  status text default 'recognized', -- pending | recognized | refunded
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create index if not exists idx_revenue_school on public.revenue_records(school_id);
create index if not exists idx_revenue_period on public.revenue_records(period_year, period_month);
create index if not exists idx_revenue_type on public.revenue_records(revenue_type);

create materialized view if not exists public.mv_revenue_summary as
  select
    period_year, period_month,
    count(distinct school_id) as active_schools,
    sum(amount) filter (where revenue_type = 'subscription') as subscription_revenue,
    sum(amount) filter (where revenue_type = 'marketplace') as marketplace_revenue,
    sum(amount) as total_revenue,
    avg(amount) filter (where revenue_type = 'subscription') as arps
  from public.revenue_records
  where status = 'recognized'
  group by period_year, period_month
  with data;
create unique index if not exists idx_mv_revenue_summary on public.mv_revenue_summary(period_year, period_month);

-- ----------------------------------------------------------------------------
-- 8. School Marketplace — second revenue stream
-- ----------------------------------------------------------------------------
do $$ begin create type marketplace_category as enum ('books', 'uniforms', 'transport_software', 'lms_content', 'exam_papers', 'teacher_training', 'supplies', 'other');
exception when duplicate_object then null; end $$;

create table if not exists public.marketplace_products (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid references public.user_profiles(id) on delete set null,
  vendor_name text not null,
  vendor_type text, -- internal | external | school
  title text not null,
  description text not null,
  category marketplace_category not null,
  subcategory text,
  price numeric(12,2) not null,
  currency text default 'KES',
  compare_at_price numeric(12,2), -- original price for discounts
  sku text,
  barcode text,
  stock_quantity integer default 0,
  digital boolean default false, -- true for LMS content, exam papers, software
  download_url text,
  image_url text,
  images text[],
  rating numeric(3,2) default 0,
  review_count integer default 0,
  sales_count integer default 0,
  is_active boolean default true,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_marketplace_products_category on public.marketplace_products(category);
create index if not exists idx_marketplace_products_active on public.marketplace_products(is_active);

create table if not exists public.marketplace_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  school_id uuid not null references public.schools(id) on delete cascade,
  ordered_by uuid not null references public.user_profiles(id) on delete cascade,
  status text default 'pending', -- pending | confirmed | shipped | delivered | cancelled | refunded
  subtotal numeric(12,2) not null,
  discount_amount numeric(12,2) default 0,
  tax_amount numeric(12,2) default 0,
  shipping_amount numeric(12,2) default 0,
  total_amount numeric(12,2) not null,
  currency text default 'KES',
  payment_method text,
  payment_status text default 'unpaid', -- unpaid | paid | partially_paid | refunded
  payment_provider_ref text,
  shipping_address text,
  tracking_number text,
  notes text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_marketplace_orders_school on public.marketplace_orders(school_id);
create index if not exists idx_marketplace_orders_status on public.marketplace_orders(status);

create table if not exists public.marketplace_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.marketplace_orders(id) on delete cascade,
  product_id uuid not null references public.marketplace_products(id) on delete restrict,
  quantity integer not null,
  unit_price numeric(12,2) not null,
  total_price numeric(12,2) not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create index if not exists idx_marketplace_order_items_order on public.marketplace_order_items(order_id);

create table if not exists public.marketplace_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.marketplace_products(id) on delete cascade,
  school_id uuid references public.schools(id) on delete set null,
  reviewed_by uuid not null references public.user_profiles(id) on delete cascade,
  rating integer not null, -- 1-5
  title text,
  body text,
  is_verified_purchase boolean default true,
  created_at timestamptz default now()
);
create index if not exists idx_marketplace_reviews_product on public.marketplace_reviews(product_id);

create table if not exists public.marketplace_cart (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  product_id uuid not null references public.marketplace_products(id) on delete cascade,
  quantity integer not null default 1,
  created_at timestamptz default now(),
  unique(school_id, user_id, product_id)
);

-- ----------------------------------------------------------------------------
-- 9. Company AI logs (separate from school AI)
-- ----------------------------------------------------------------------------
create table if not exists public.company_ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  feature text not null, -- support_assistant | revenue_forecast | churn_prediction | growth_recs | operational_analytics
  provider text,
  model text,
  tokens_used integer default 0,
  cost_usd numeric(10,6) default 0,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create index if not exists idx_company_ai_usage_user on public.company_ai_usage_logs(user_id);

-- ----------------------------------------------------------------------------
-- 10. System health monitoring
-- ----------------------------------------------------------------------------
create table if not exists public.system_incidents (
  id uuid primary key default gen_random_uuid(),
  incident_number text not null unique,
  title text not null,
  description text not null,
  severity text not null, -- minor | major | critical
  status text default 'investigating', -- investigating | identified | monitoring | resolved
  affected_services text[],
  started_at timestamptz default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.user_profiles(id) on delete set null,
  resolution_notes text,
  impact_description text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_system_incidents_status on public.system_incidents(status);

create table if not exists public.system_health_checks (
  id uuid primary key default gen_random_uuid(),
  service_name text not null,
  endpoint text,
  status text not null, -- healthy | degraded | down
  response_time_ms integer,
  checked_at timestamptz default now(),
  metadata jsonb default '{}'::jsonb
);
create index if not exists idx_health_checks_service on public.system_health_checks(service_name, checked_at desc);

-- ----------------------------------------------------------------------------
-- RLS Policies for all new tables
-- ----------------------------------------------------------------------------
alter table public.company_employees enable row level security;
alter table public.company_kpis enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_ticket_replies enable row level security;
alter table public.knowledge_base_articles enable row level security;
alter table public.sales_leads enable row level security;
alter table public.sales_campaigns enable row level security;
alter table public.customer_health_scores enable row level security;
alter table public.onboarding_checklists enable row level security;
alter table public.revenue_records enable row level security;
alter table public.marketplace_products enable row level security;
alter table public.marketplace_orders enable row level security;
alter table public.marketplace_order_items enable row level security;
alter table public.marketplace_reviews enable row level security;
alter table public.marketplace_cart enable row level security;
alter table public.company_ai_usage_logs enable row level security;
alter table public.system_incidents enable row level security;
alter table public.system_health_checks enable row level security;

-- Helper: is the caller a company employee?
create or replace function public.is_company_employee()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.school_users
    where user_id = public.current_profile_id()
    and role in ('company_ceo','company_support','company_engineering','company_security','company_sales','company_finance','company_hr','company_marketing','company_customer_success','company_maintenance','platform_admin')
  );
$$;

-- Company employees: company employees can see each other
drop policy if exists company_employees_select on public.company_employees;
create policy company_employees_select on public.company_employees
  for select using (public.is_company_employee());
drop policy if exists company_employees_insert on public.company_employees;
create policy company_employees_insert on public.company_employees
  for insert with check (public.is_company_employee());
drop policy if exists company_employees_update on public.company_employees;
create policy company_employees_update on public.company_employees
  for update using (public.is_company_employee());

-- KPIs: company employees can read, only CEO/finance can write
drop policy if exists company_kpis_select on public.company_kpis;
create policy company_kpis_select on public.company_kpis
  for select using (public.is_company_employee());
drop policy if exists company_kpis_insert on public.company_kpis;
create policy company_kpis_insert on public.company_kpis
  for insert with check (public.is_platform_admin() or exists (select 1 from public.school_users where user_id = public.current_profile_id() and role in ('company_ceo','company_finance')));

-- Support tickets: school staff can see their own, company support can see all
drop policy if exists support_tickets_select on public.support_tickets;
create policy support_tickets_select on public.support_tickets
  for select using (
    public.is_company_employee()
    or (school_id in (select school_id from public.school_users su where su.user_id = public.current_profile_id()))
    or created_by = public.current_profile_id()
  );
drop policy if exists support_tickets_insert on public.support_tickets;
create policy support_tickets_insert on public.support_tickets
  for insert with check (
    public.is_company_employee()
    or (school_id in (select school_id from public.school_users su where su.user_id = public.current_profile_id()))
  );
drop policy if exists support_tickets_update on public.support_tickets;
create policy support_tickets_update on public.support_tickets
  for update using (public.is_company_employee() or created_by = public.current_profile_id());

-- Ticket replies: same as tickets
drop policy if exists ticket_replies_select on public.support_ticket_replies;
create policy ticket_replies_select on public.support_ticket_replies
  for select using (
    public.is_company_employee()
    or exists (
      select 1 from public.support_tickets t
      where t.id = support_ticket_replies.ticket_id
      and (t.school_id in (select school_id from public.school_users su where su.user_id = public.current_profile_id()) or t.created_by = public.current_profile_id())
    )
  );
drop policy if exists ticket_replies_insert on public.support_ticket_replies;
create policy ticket_replies_insert on public.support_ticket_replies
  for insert with check (public.is_company_employee() or replied_by = public.current_profile_id());

-- Knowledge base: everyone can read, company can write
drop policy if exists kb_select on public.knowledge_base_articles;
create policy kb_select on public.knowledge_base_articles
  for select using (status = 'published' or public.is_company_employee());
drop policy if exists kb_insert on public.knowledge_base_articles;
create policy kb_insert on public.knowledge_base_articles
  for insert with check (public.is_company_employee());
drop policy if exists kb_update on public.knowledge_base_articles;
create policy kb_update on public.knowledge_base_articles
  for update using (public.is_company_employee());

-- Sales leads: company sales/ceo only
drop policy if exists sales_leads_select on public.sales_leads;
create policy sales_leads_select on public.sales_leads
  for select using (
    public.is_platform_admin()
    or exists (select 1 from public.school_users where user_id = public.current_profile_id() and role in ('company_ceo','company_sales','company_finance','company_marketing'))
  );
drop policy if exists sales_leads_insert on public.sales_leads;
create policy sales_leads_insert on public.sales_leads
  for insert with check (
    public.is_platform_admin()
    or exists (select 1 from public.school_users where user_id = public.current_profile_id() and role in ('company_ceo','company_sales','company_marketing'))
  );
drop policy if exists sales_leads_update on public.sales_leads;
create policy sales_leads_update on public.sales_leads
  for update using (
    public.is_platform_admin()
    or exists (select 1 from public.school_users where user_id = public.current_profile_id() and role in ('company_ceo','company_sales','company_marketing'))
  );

-- Sales campaigns: same as leads
drop policy if exists sales_campaigns_select on public.sales_campaigns;
create policy sales_campaigns_select on public.sales_campaigns
  for select using (public.is_platform_admin() or exists (select 1 from public.school_users where user_id = public.current_profile_id() and role in ('company_ceo','company_sales','company_marketing')));
drop policy if exists sales_campaigns_insert on public.sales_campaigns;
create policy sales_campaigns_insert on public.sales_campaigns
  for insert with check (public.is_platform_admin() or exists (select 1 from public.school_users where user_id = public.current_profile_id() and role in ('company_ceo','company_sales','company_marketing')));
drop policy if exists sales_campaigns_update on public.sales_campaigns;
create policy sales_campaigns_update on public.sales_campaigns
  for update using (public.is_platform_admin() or exists (select 1 from public.school_users where user_id = public.current_profile_id() and role in ('company_ceo','company_sales','company_marketing')));

-- Customer health: company customer_success/ceo/finance
drop policy if exists customer_health_select on public.customer_health_scores;
create policy customer_health_select on public.customer_health_scores
  for select using (
    public.is_platform_admin()
    or exists (select 1 from public.school_users where user_id = public.current_profile_id() and role in ('company_ceo','company_customer_success','company_finance'))
  );
drop policy if exists customer_health_insert on public.customer_health_scores;
create policy customer_health_insert on public.customer_health_scores
  for insert with check (
    public.is_platform_admin()
    or exists (select 1 from public.school_users where user_id = public.current_profile_id() and role in ('company_ceo','company_customer_success'))
  );
drop policy if exists customer_health_update on public.customer_health_scores;
create policy customer_health_update on public.customer_health_scores
  for update using (
    public.is_platform_admin()
    or exists (select 1 from public.school_users where user_id = public.current_profile_id() and role in ('company_ceo','company_customer_success'))
  );

-- Onboarding checklists: company customer_success + school admins
drop policy if exists onboarding_select on public.onboarding_checklists;
create policy onboarding_select on public.onboarding_checklists
  for select using (
    public.is_company_employee()
    or (school_id in (select school_id from public.school_users su where su.user_id = public.current_profile_id() and su.role in ('school_owner','principal','administrator','ict_manager')))
  );
drop policy if exists onboarding_insert on public.onboarding_checklists;
create policy onboarding_insert on public.onboarding_checklists
  for insert with check (
    public.is_company_employee()
    or (school_id in (select school_id from public.school_users su where su.user_id = public.current_profile_id() and su.role in ('school_owner','principal','administrator','ict_manager')))
  );
drop policy if exists onboarding_update on public.onboarding_checklists;
create policy onboarding_update on public.onboarding_checklists
  for update using (
    public.is_company_employee()
    or (school_id in (select school_id from public.school_users su where su.user_id = public.current_profile_id() and su.role in ('school_owner','principal','administrator','ict_manager')))
  );

-- Revenue records: company finance/ceo only
drop policy if exists revenue_select on public.revenue_records;
create policy revenue_select on public.revenue_records
  for select using (
    public.is_platform_admin()
    or exists (select 1 from public.school_users where user_id = public.current_profile_id() and role in ('company_ceo','company_finance'))
  );
drop policy if exists revenue_insert on public.revenue_records;
create policy revenue_insert on public.revenue_records
  for insert with check (
    public.is_platform_admin()
    or exists (select 1 from public.school_users where user_id = public.current_profile_id() and role in ('company_ceo','company_finance'))
  );

-- Marketplace products: everyone can read (public catalog), company/vendors can write
drop policy if exists marketplace_products_select on public.marketplace_products;
create policy marketplace_products_select on public.marketplace_products
  for select using (is_active = true or public.is_company_employee());
drop policy if exists marketplace_products_insert on public.marketplace_products;
create policy marketplace_products_insert on public.marketplace_products
  for insert with check (public.is_company_employee());
drop policy if exists marketplace_products_update on public.marketplace_products;
create policy marketplace_products_update on public.marketplace_products
  for update using (public.is_company_employee());

-- Marketplace orders: school can see own, company can see all
drop policy if exists marketplace_orders_select on public.marketplace_orders;
create policy marketplace_orders_select on public.marketplace_orders
  for select using (
    public.is_company_employee()
    or (school_id in (select school_id from public.school_users su where su.user_id = public.current_profile_id()))
    or ordered_by = public.current_profile_id()
  );
drop policy if exists marketplace_orders_insert on public.marketplace_orders;
create policy marketplace_orders_insert on public.marketplace_orders
  for insert with check (
    school_id in (select school_id from public.school_users su where su.user_id = public.current_profile_id())
  );
drop policy if exists marketplace_orders_update on public.marketplace_orders;
create policy marketplace_orders_update on public.marketplace_orders
  for update using (public.is_company_employee());

-- Order items: same access as orders
drop policy if exists marketplace_order_items_select on public.marketplace_order_items;
create policy marketplace_order_items_select on public.marketplace_order_items
  for select using (
    public.is_company_employee()
    or exists (
      select 1 from public.marketplace_orders o
      where o.id = marketplace_order_items.order_id
      and (o.school_id in (select school_id from public.school_users su where su.user_id = public.current_profile_id()) or o.ordered_by = public.current_profile_id())
    )
  );

-- Reviews: everyone can read, school members can write
drop policy if exists marketplace_reviews_select on public.marketplace_reviews;
create policy marketplace_reviews_select on public.marketplace_reviews
  for select using (true);
drop policy if exists marketplace_reviews_insert on public.marketplace_reviews;
create policy marketplace_reviews_insert on public.marketplace_reviews
  for insert with check (
    reviewed_by = public.current_profile_id()
    or (school_id in (select school_id from public.school_users su where su.user_id = public.current_profile_id()))
  );

-- Cart: user can only see own cart
drop policy if exists marketplace_cart_select on public.marketplace_cart;
create policy marketplace_cart_select on public.marketplace_cart
  for select using (user_id = public.current_profile_id());
drop policy if exists marketplace_cart_insert on public.marketplace_cart;
create policy marketplace_cart_insert on public.marketplace_cart
  for insert with check (user_id = public.current_profile_id());
drop policy if exists marketplace_cart_update on public.marketplace_cart;
create policy marketplace_cart_update on public.marketplace_cart
  for update using (user_id = public.current_profile_id());
drop policy if exists marketplace_cart_delete on public.marketplace_cart;
create policy marketplace_cart_delete on public.marketplace_cart
  for delete using (user_id = public.current_profile_id());

-- Company AI logs: company employees only
drop policy if exists company_ai_select on public.company_ai_usage_logs;
create policy company_ai_select on public.company_ai_usage_logs
  for select using (public.is_company_employee());
drop policy if exists company_ai_insert on public.company_ai_usage_logs;
create policy company_ai_insert on public.company_ai_usage_logs
  for insert with check (public.is_company_employee());

-- System incidents: company employees can see, engineering/maintenance can write
drop policy if exists incidents_select on public.system_incidents;
create policy incidents_select on public.system_incidents
  for select using (public.is_company_employee());
drop policy if exists incidents_insert on public.system_incidents;
create policy incidents_insert on public.system_incidents
  for insert with check (public.is_platform_admin() or exists (select 1 from public.school_users where user_id = public.current_profile_id() and role in ('company_engineering','company_maintenance','company_security')));
drop policy if exists incidents_update on public.system_incidents;
create policy incidents_update on public.system_incidents
  for update using (public.is_platform_admin() or exists (select 1 from public.school_users where user_id = public.current_profile_id() and role in ('company_engineering','company_maintenance','company_security')));

-- Health checks: company employees only
drop policy if exists health_checks_select on public.system_health_checks;
create policy health_checks_select on public.system_health_checks
  for select using (public.is_company_employee());
drop policy if exists health_checks_insert on public.system_health_checks;
create policy health_checks_insert on public.system_health_checks
  for insert with check (public.is_platform_admin() or exists (select 1 from public.school_users where user_id = public.current_profile_id() and role in ('company_engineering','company_maintenance')));

-- Triggers
do $$ declare t text; tables text[] := array['company_employees','support_tickets','sales_leads','sales_campaigns','marketplace_products','marketplace_orders','system_incidents'];
begin foreach t in array tables loop
  execute format('drop trigger if exists trg_%1$s_touch on public.%1$I', t);
  execute format('create trigger trg_%1$s_touch before update on public.%1$I for each row execute function public.touch_updated_at()', t);
end loop; end $$;
