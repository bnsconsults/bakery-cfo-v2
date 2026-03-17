import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

/*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  BAKERY CFO V2 — FULL DATABASE SCHEMA
  Paste this into Supabase → SQL Editor → Run
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- BAKERY PROFILE
create table if not exists public.bakery_profile (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null unique,
  bakery_name text default 'My Bakery',
  owner_name text,
  location text,
  currency text default 'UGX',
  whatsapp_number text,
  target_margin numeric default 40,
  labor_threshold numeric default 35,
  waste_threshold numeric default 8,
  created_at timestamptz default now()
);
alter table public.bakery_profile enable row level security;
create policy "Users see own profile" on public.bakery_profile
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- INGREDIENTS / INVENTORY
create table if not exists public.ingredients (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  name text not null,
  stock numeric default 0,
  unit text default 'kg',
  reorder_level numeric default 5,
  cost_per_unit numeric default 0,
  expiry_date date,
  supplier_id uuid,
  created_at timestamptz default now()
);
alter table public.ingredients enable row level security;
create policy "Users see own ingredients" on public.ingredients
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- RECIPES
create table if not exists public.recipes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  name text not null,
  category text default 'bread',
  batch_size integer default 10,
  batch_unit text default 'units',
  sell_price numeric default 0,
  prep_minutes integer default 30,
  bake_minutes integer default 20,
  active boolean default true,
  notes text,
  created_at timestamptz default now()
);
alter table public.recipes enable row level security;
create policy "Users see own recipes" on public.recipes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- RECIPE INGREDIENTS (links recipes to ingredients)
create table if not exists public.recipe_ingredients (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  recipe_id uuid references public.recipes not null,
  ingredient_id uuid references public.ingredients not null,
  quantity numeric not null,
  unit text,
  created_at timestamptz default now()
);
alter table public.recipe_ingredients enable row level security;
create policy "Users see own recipe_ingredients" on public.recipe_ingredients
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- PRODUCTION PLANS
create table if not exists public.production_plans (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  plan_date date not null default current_date,
  recipe_id uuid references public.recipes not null,
  planned_batches numeric default 1,
  planned_units integer,
  actual_units integer,
  status text default 'planned',
  created_at timestamptz default now()
);
alter table public.production_plans enable row level security;
create policy "Users see own plans" on public.production_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- SALES LOG (POS)
create table if not exists public.sales_log (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  recipe_id uuid references public.recipes,
  product_name text not null,
  sale_date date default current_date,
  units_sold integer default 0,
  units_wasted integer default 0,
  unit_price numeric default 0,
  total_revenue numeric default 0,
  channel text default 'walk-in',
  created_at timestamptz default now()
);
alter table public.sales_log enable row level security;
create policy "Users see own sales" on public.sales_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- STAFF
create table if not exists public.staff (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  name text not null,
  role text,
  hourly_rate numeric default 5000,
  phone text,
  active boolean default true,
  created_at timestamptz default now()
);
alter table public.staff enable row level security;
create policy "Users see own staff" on public.staff
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- LABOR LOG
create table if not exists public.labor_log (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  staff_id uuid references public.staff,
  staff_name text,
  log_date date default current_date,
  hours_worked numeric default 8,
  overtime_hours numeric default 0,
  created_at timestamptz default now()
);
alter table public.labor_log enable row level security;
create policy "Users see own labor" on public.labor_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- SUPPLIERS
create table if not exists public.suppliers (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  name text not null,
  contact_name text,
  phone text,
  email text,
  address text,
  payment_terms text,
  notes text,
  created_at timestamptz default now()
);
alter table public.suppliers enable row level security;
create policy "Users see own suppliers" on public.suppliers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- PURCHASE ORDERS
create table if not exists public.purchase_orders (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  supplier_id uuid references public.suppliers,
  supplier_name text,
  order_date date default current_date,
  expected_date date,
  status text default 'draft',
  total_amount numeric default 0,
  notes text,
  created_at timestamptz default now()
);
alter table public.purchase_orders enable row level security;
create policy "Users see own orders" on public.purchase_orders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- PURCHASE ORDER ITEMS
create table if not exists public.purchase_order_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  order_id uuid references public.purchase_orders not null,
  ingredient_id uuid references public.ingredients,
  ingredient_name text,
  quantity numeric,
  unit text,
  unit_price numeric,
  total numeric,
  created_at timestamptz default now()
);
alter table public.purchase_order_items enable row level security;
create policy "Users see own order items" on public.purchase_order_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- DAILY SUMMARY (auto-calculated at end of day)
create table if not exists public.daily_summary (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  summary_date date not null default current_date,
  total_revenue numeric default 0,
  total_ingredient_cost numeric default 0,
  total_labor_cost numeric default 0,
  total_waste_value numeric default 0,
  net_profit numeric default 0,
  gross_margin numeric default 0,
  units_sold integer default 0,
  units_wasted integer default 0,
  notes text,
  whatsapp_sent boolean default false,
  created_at timestamptz default now(),
  unique(user_id, summary_date)
);
alter table public.daily_summary enable row level security;
create policy "Users see own summary" on public.daily_summary
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- SUBSCRIPTIONS
create table if not exists public.subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null unique,
  email text,
  status text default 'trial',
  plan text default 'monthly',
  expires_at timestamptz,
  activated_at timestamptz,
  created_at timestamptz default now()
);
alter table public.subscriptions enable row level security;
create policy "Users see own subscription" on public.subscriptions
  for select using (auth.uid() = user_id);
create policy "Admin full access" on public.subscriptions for all using (true);

*/
