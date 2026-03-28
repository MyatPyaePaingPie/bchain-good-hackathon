-- Nonprofit Escrow v2 core schema
-- Run this in the Supabase SQL editor for the initial backend setup.

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Organizations
-- -----------------------------------------------------------------------------

create table if not exists public.organizations (
  id text primary key,
  name text not null,
  description text,
  wallet_address text not null,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Profiles / donor data
-- -----------------------------------------------------------------------------

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text not null,
  role text not null check (role in ('donor', 'ngo_admin', 'committee_member', 'super_admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.donor_profiles (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  wallet_address text unique not null,
  display_name text not null,
  is_committee_eligible boolean not null default false,
  total_donated_xrp numeric(18, 6) not null default 0,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Projects / milestones
-- -----------------------------------------------------------------------------

create table if not exists public.projects (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete restrict,
  title text not null,
  description text not null,
  funding_goal_xrp numeric(18, 6) not null check (funding_goal_xrp > 0),
  current_funded_xrp numeric(18, 6) not null default 0 check (current_funded_xrp >= 0),
  status text not null default 'open' check (status in ('open', 'fully_funded', 'closed')),
  created_at timestamptz not null default now()
);

create index if not exists projects_organization_id_idx on public.projects (organization_id);

create table if not exists public.milestones (
  id text primary key,
  project_id text not null references public.projects(id) on delete cascade,
  title text not null,
  description text not null,
  xrp_amount numeric(18, 6) not null check (xrp_amount > 0),
  milestone_order integer not null check (milestone_order > 0),
  status text not null default 'pending'
    check (status in ('pending', 'funded', 'voteable', 'approved', 'released', 'cancelled')),
  created_at timestamptz not null default now(),
  unique (project_id, milestone_order)
);

create index if not exists milestones_project_id_idx on public.milestones (project_id);

-- -----------------------------------------------------------------------------
-- Donor preference rankings
-- -----------------------------------------------------------------------------

create table if not exists public.donor_project_rankings (
  id uuid primary key default gen_random_uuid(),
  donor_user_id uuid not null references public.donor_profiles(user_id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  rank integer not null check (rank between 1 and 3),
  created_at timestamptz not null default now(),
  unique (donor_user_id, project_id),
  unique (donor_user_id, rank)
);

create index if not exists donor_project_rankings_donor_idx
  on public.donor_project_rankings (donor_user_id);

-- -----------------------------------------------------------------------------
-- Donations and project allocations
-- -----------------------------------------------------------------------------

create table if not exists public.donations (
  id uuid primary key default gen_random_uuid(),
  donor_user_id uuid not null references public.donor_profiles(user_id) on delete restrict,
  wallet_address text not null,
  total_amount_xrp numeric(18, 6) not null check (total_amount_xrp > 0),
  payment_tx_hash text,
  status text not null default 'pending'
    check (status in ('pending', 'submitted', 'confirmed', 'failed')),
  created_at timestamptz not null default now()
);

create index if not exists donations_donor_user_id_idx on public.donations (donor_user_id);

create table if not exists public.donation_allocations (
  id uuid primary key default gen_random_uuid(),
  donation_id uuid not null references public.donations(id) on delete cascade,
  project_id text not null references public.projects(id) on delete restrict,
  amount_xrp numeric(18, 6) not null check (amount_xrp > 0),
  created_at timestamptz not null default now()
);

create index if not exists donation_allocations_donation_idx
  on public.donation_allocations (donation_id);

-- -----------------------------------------------------------------------------
-- Escrow records
-- -----------------------------------------------------------------------------

create table if not exists public.escrow_records (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(id) on delete cascade,
  milestone_id text not null references public.milestones(id) on delete cascade,
  donation_id uuid references public.donations(id) on delete set null,
  owner_wallet_address text not null,
  destination_wallet_address text not null,
  escrow_sequence integer not null,
  condition_hex text not null,
  fulfillment_hex text not null,
  escrow_tx_hash text,
  release_tx_hash text,
  status text not null default 'created'
    check (status in ('created', 'approved', 'released', 'cancelled', 'failed')),
  created_at timestamptz not null default now(),
  unique (project_id, milestone_id),
  unique (owner_wallet_address, escrow_sequence)
);

create index if not exists escrow_records_project_id_idx on public.escrow_records (project_id);
create index if not exists escrow_records_milestone_id_idx on public.escrow_records (milestone_id);
create index if not exists escrow_records_donation_id_idx on public.escrow_records (donation_id);

-- -----------------------------------------------------------------------------
-- Committee tables
-- -----------------------------------------------------------------------------

create table if not exists public.committee_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  role text not null check (role in ('ngo_rep', 'donor_rep', 'community_auditor')),
  active boolean not null default true,
  selected_from_donor_pool boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create table if not exists public.committee_votes (
  id uuid primary key default gen_random_uuid(),
  committee_membership_id uuid not null references public.committee_memberships(id) on delete cascade,
  milestone_id text not null references public.milestones(id) on delete cascade,
  approved boolean not null,
  created_at timestamptz not null default now(),
  unique (committee_membership_id, milestone_id)
);

create index if not exists committee_votes_milestone_id_idx on public.committee_votes (milestone_id);

-- -----------------------------------------------------------------------------
-- Donor-facing documents
-- -----------------------------------------------------------------------------

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  donor_user_id uuid references public.donor_profiles(user_id) on delete cascade,
  project_id text references public.projects(id) on delete cascade,
  document_type text not null
    check (document_type in ('donor_contract', 'grant_contract', 'escrow_summary', 'compliance_form')),
  storage_path text not null,
  version integer not null default 1 check (version > 0),
  visible_to_donor boolean not null default true,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Trigger to keep donor_profiles.total_donated_xrp in sync
-- -----------------------------------------------------------------------------

create or replace function public.sync_donor_total_donated()
returns trigger
language plpgsql
as $$
begin
  update public.donor_profiles dp
  set total_donated_xrp = coalesce((
    select sum(d.total_amount_xrp)
    from public.donations d
    where d.donor_user_id = dp.user_id
      and d.status = 'confirmed'
  ), 0)
  where dp.user_id = coalesce(new.donor_user_id, old.donor_user_id);

  return coalesce(new, old);
end;
$$;

drop trigger if exists donations_sync_total_after_insert on public.donations;
create trigger donations_sync_total_after_insert
after insert or update or delete on public.donations
for each row execute function public.sync_donor_total_donated();

-- -----------------------------------------------------------------------------
-- Seed current demo NGO / projects / milestones
-- -----------------------------------------------------------------------------

insert into public.organizations (id, name, description, wallet_address)
values (
  'ngo-demo',
  'Nonprofit Escrow Demo NGO',
  'Seed organization for the XRPL donor transparency demo',
  'REPLACE_WITH_NGO_WALLET_ADDRESS'
)
on conflict (id) do update
set
  name = excluded.name,
  description = excluded.description,
  wallet_address = excluded.wallet_address;

insert into public.projects (id, organization_id, title, description, funding_goal_xrp, current_funded_xrp, status)
values
  (
    'clean-water',
    'ngo-demo',
    'Clean Water Initiative',
    'Provide safe drinking water to 10 rural communities',
    225,
    0,
    'open'
  ),
  (
    'solar-school',
    'ngo-demo',
    'Solar-Powered School',
    'Install solar panels and equipment at a rural school',
    250,
    250,
    'fully_funded'
  ),
  (
    'medical-clinic',
    'ngo-demo',
    'Mobile Medical Clinic',
    'Fund a mobile clinic to serve underserved areas',
    400,
    0,
    'open'
  ),
  (
    'school-meals',
    'ngo-demo',
    'School Meals Program',
    'Provide daily meals to 200 students for one semester',
    200,
    200,
    'fully_funded'
  ),
  (
    'reforestation',
    'ngo-demo',
    'Community Reforestation',
    'Plant 10,000 native trees across deforested land',
    150,
    0,
    'open'
  )
on conflict (id) do update
set
  organization_id = excluded.organization_id,
  title = excluded.title,
  description = excluded.description,
  funding_goal_xrp = excluded.funding_goal_xrp,
  current_funded_xrp = excluded.current_funded_xrp,
  status = excluded.status;

insert into public.milestones (id, project_id, title, description, xrp_amount, milestone_order, status)
values
  ('cw-1', 'clean-water', 'Purchase Water Filters', 'Buy 500 portable water filters', 100, 1, 'pending'),
  ('cw-2', 'clean-water', 'Distribution & Logistics', 'Transport filters to 10 villages', 75, 2, 'pending'),
  ('cw-3', 'clean-water', 'Community Training', 'Train local volunteers on filter maintenance', 50, 3, 'pending'),

  ('ss-1', 'solar-school', 'Panel Procurement', 'Purchase 20 solar panels + inverters', 150, 1, 'pending'),
  ('ss-2', 'solar-school', 'Installation', 'Install panels and wire classrooms', 100, 2, 'pending'),

  ('mc-1', 'medical-clinic', 'Vehicle & Equipment', 'Purchase and outfit a medical van', 200, 1, 'pending'),
  ('mc-2', 'medical-clinic', 'Staff Training', 'Train 5 community health workers', 80, 2, 'pending'),
  ('mc-3', 'medical-clinic', 'First Quarter Operations', 'Cover fuel, supplies, and salaries for 3 months', 120, 3, 'pending'),

  ('sm-1', 'school-meals', 'Kitchen Setup', 'Build a school kitchen and purchase equipment', 90, 1, 'pending'),
  ('sm-2', 'school-meals', 'Food Supply Contract', 'Secure 6-month food supply agreement', 110, 2, 'pending'),

  ('rf-1', 'reforestation', 'Seedling Nursery', 'Establish nursery and grow 10,000 seedlings', 60, 1, 'pending'),
  ('rf-2', 'reforestation', 'Planting Campaign', 'Organize community planting over 2 weekends', 40, 2, 'pending'),
  ('rf-3', 'reforestation', 'Monitoring & Care', '6-month monitoring, replanting failures', 50, 3, 'pending')
on conflict (id) do update
set
  project_id = excluded.project_id,
  title = excluded.title,
  description = excluded.description,
  xrp_amount = excluded.xrp_amount,
  milestone_order = excluded.milestone_order,
  status = excluded.status;

-- -----------------------------------------------------------------------------
-- Row-level security
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.donor_profiles enable row level security;
alter table public.donor_project_rankings enable row level security;
alter table public.donations enable row level security;
alter table public.donation_allocations enable row level security;
alter table public.documents enable row level security;
alter table public.committee_votes enable row level security;
alter table public.committee_memberships enable row level security;

-- Public read access for project browsing
alter table public.organizations enable row level security;
alter table public.projects enable row level security;
alter table public.milestones enable row level security;
alter table public.escrow_records enable row level security;

drop policy if exists "public can read organizations" on public.organizations;
create policy "public can read organizations"
on public.organizations
for select
using (true);

drop policy if exists "public can read projects" on public.projects;
create policy "public can read projects"
on public.projects
for select
using (true);

drop policy if exists "public can read milestones" on public.milestones;
create policy "public can read milestones"
on public.milestones
for select
using (true);

drop policy if exists "public can read escrow records" on public.escrow_records;
create policy "public can read escrow records"
on public.escrow_records
for select
using (true);

drop policy if exists "users can read own profile" on public.profiles;
create policy "users can read own profile"
on public.profiles
for select
using (auth.uid() = user_id);

drop policy if exists "users can insert own profile" on public.profiles;
create policy "users can insert own profile"
on public.profiles
for insert
with check (auth.uid() = user_id);

drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile"
on public.profiles
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "donors can read own donor profile" on public.donor_profiles;
create policy "donors can read own donor profile"
on public.donor_profiles
for select
using (auth.uid() = user_id);

drop policy if exists "donors can insert own donor profile" on public.donor_profiles;
create policy "donors can insert own donor profile"
on public.donor_profiles
for insert
with check (auth.uid() = user_id);

drop policy if exists "donors can update own donor profile" on public.donor_profiles;
create policy "donors can update own donor profile"
on public.donor_profiles
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "donors can manage own rankings" on public.donor_project_rankings;
create policy "donors can manage own rankings"
on public.donor_project_rankings
for all
using (auth.uid() = donor_user_id)
with check (auth.uid() = donor_user_id);

drop policy if exists "donors can manage own donations" on public.donations;
create policy "donors can manage own donations"
on public.donations
for all
using (auth.uid() = donor_user_id)
with check (auth.uid() = donor_user_id);

drop policy if exists "donors can read own allocations" on public.donation_allocations;
create policy "donors can read own allocations"
on public.donation_allocations
for select
using (
  exists (
    select 1
    from public.donations d
    where d.id = donation_id
      and d.donor_user_id = auth.uid()
  )
);

drop policy if exists "donors can read own documents" on public.documents;
create policy "donors can read own documents"
on public.documents
for select
using (auth.uid() = donor_user_id);

drop policy if exists "committee members can read memberships" on public.committee_memberships;
create policy "committee members can read memberships"
on public.committee_memberships
for select
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role in ('ngo_admin', 'super_admin')
  )
);

drop policy if exists "committee members can read votes" on public.committee_votes;
create policy "committee members can read votes"
on public.committee_votes
for select
using (true);

drop policy if exists "committee members can write own votes" on public.committee_votes;
create policy "committee members can write own votes"
on public.committee_votes
for all
using (
  exists (
    select 1
    from public.committee_memberships cm
    where cm.id = committee_membership_id
      and cm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.committee_memberships cm
    where cm.id = committee_membership_id
      and cm.user_id = auth.uid()
  )
);
