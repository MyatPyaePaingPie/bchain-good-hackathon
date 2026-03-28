# Nonprofit Escrow — Refactor Plan V2

## Goal

Refactor the current frontend-only, single-donor demo into a multi-donor architecture with clear separation between:

- donors
- NGO/admin users
- committee members
- blockchain transaction records
- donor-facing documents/contracts

The primary outcome is to remove donor-specific state from shared project objects and move identity, rankings, donations, committee membership, and documents into a database-backed backend.

## Why This Refactor Is Needed

The current app couples global project state with a single donor session:

- [`src/App.jsx`](/Users/andrew/Documents/projects/bchain-good-hackathon/src/App.jsx) stores `rank` and `funded` directly on project objects.
- [`src/data/wallets.js`](/Users/andrew/Documents/projects/bchain-good-hackathon/src/data/wallets.js) exposes a single `donor` wallet.
- [`src/components/DonorPanel.jsx`](/Users/andrew/Documents/projects/bchain-good-hackathon/src/components/DonorPanel.jsx) assumes one donor is funding all selected projects.
- committee logic is attached to app state rather than explicit committee membership records.

This prevents:

- multiple donors having different ranked project preferences
- donor-specific funded history
- selecting committee members from real donor records
- storing donor identity and contract metadata
- reconstructing state after refresh

## Architecture Decision

Use **Supabase** as the first backend platform.

Reasons:

- fastest path from the current Vite app to a real database
- Postgres for relational donor/project/committee data
- Auth for donor/admin login
- Storage for donor-facing PDFs/contracts
- straightforward JS client integration from React

This refactor will produce a **hybrid architecture**:

- XRPL remains the source of truth for payments, escrows, releases, and NFT proofs
- Supabase/Postgres becomes the source of truth for users, donor preferences, committee assignment, documents, and indexed blockchain metadata

## Separation of Responsibilities

### On-chain

Store only public financial proof and transaction state:

- donor wallet address
- payment transaction hash
- escrow transaction hash
- escrow sequence
- release transaction hash
- NFT token ids

Never store private keys or seeds in the database.

### Database

Store application and identity data:

- donor profile and contact info
- NGO/admin users
- committee membership
- donor ranking preferences
- donor contributions
- project funding totals
- escrow record index
- milestone voting records
- documents/contracts and version metadata

## Data Model

### `users`

Auth-backed identity table.

- `id uuid pk`
- `email text unique not null`
- `full_name text not null`
- `role text not null check in ('donor', 'ngo_admin', 'committee_member', 'super_admin')`
- `created_at timestamptz not null default now()`

### `donor_profiles`

- `user_id uuid pk references users(id)`
- `wallet_address text unique not null`
- `display_name text not null`
- `is_committee_eligible boolean not null default false`
- `total_donated_xrp numeric not null default 0`
- `created_at timestamptz not null default now()`

### `organizations`

- `id uuid pk`
- `name text not null`
- `description text`
- `wallet_address text not null`
- `created_at timestamptz not null default now()`

### `projects`

Global NGO-owned project records.

- `id uuid pk`
- `organization_id uuid references organizations(id)`
- `slug text unique not null`
- `title text not null`
- `description text not null`
- `funding_goal_xrp numeric not null`
- `current_funded_xrp numeric not null default 0`
- `status text not null check in ('open', 'fully_funded', 'closed')`
- `created_at timestamptz not null default now()`

### `milestones`

- `id uuid pk`
- `project_id uuid references projects(id)`
- `title text not null`
- `description text not null`
- `xrp_amount numeric not null`
- `milestone_order int not null`
- `status text not null check in ('pending', 'funded', 'voteable', 'approved', 'released', 'cancelled')`
- `created_at timestamptz not null default now()`
- unique `(project_id, milestone_order)`

### `donor_project_rankings`

Per-donor preference state.

- `id uuid pk`
- `donor_user_id uuid references donor_profiles(user_id)`
- `project_id uuid references projects(id)`
- `rank int not null check (rank between 1 and 3)`
- `created_at timestamptz not null default now()`
- unique `(donor_user_id, rank)`
- unique `(donor_user_id, project_id)`

### `donations`

One donor funding action. A donor can fund multiple projects in one action.

- `id uuid pk`
- `donor_user_id uuid references donor_profiles(user_id)`
- `wallet_address text not null`
- `total_amount_xrp numeric not null`
- `payment_tx_hash text`
- `status text not null check in ('pending', 'submitted', 'confirmed', 'failed')`
- `created_at timestamptz not null default now()`

### `donation_allocations`

Breakdown of a donation across projects.

- `id uuid pk`
- `donation_id uuid references donations(id)`
- `project_id uuid references projects(id)`
- `amount_xrp numeric not null`

### `escrow_records`

One row per milestone escrow.

- `id uuid pk`
- `project_id uuid references projects(id)`
- `milestone_id uuid references milestones(id)`
- `donation_id uuid references donations(id)`
- `owner_wallet_address text not null`
- `destination_wallet_address text not null`
- `escrow_sequence int not null`
- `condition_hex text not null`
- `fulfillment_hex text not null`
- `escrow_tx_hash text`
- `release_tx_hash text`
- `status text not null check in ('created', 'approved', 'released', 'cancelled', 'failed')`
- `created_at timestamptz not null default now()`

### `committee_memberships`

Committee is modeled explicitly, not inferred in queries.

- `id uuid pk`
- `user_id uuid references users(id)`
- `role text not null check in ('ngo_rep', 'donor_rep', 'community_auditor')`
- `active boolean not null default true`
- `selected_from_donor_pool boolean not null default false`
- `created_at timestamptz not null default now()`

### `committee_votes`

- `id uuid pk`
- `committee_membership_id uuid references committee_memberships(id)`
- `milestone_id uuid references milestones(id)`
- `approved boolean not null`
- `created_at timestamptz not null default now()`
- unique `(committee_membership_id, milestone_id)`

### `documents`

For donor-facing contracts and future legal PDFs.

- `id uuid pk`
- `donor_user_id uuid references donor_profiles(user_id)`
- `project_id uuid references projects(id)`
- `document_type text not null check in ('donor_contract', 'grant_contract', 'escrow_summary', 'compliance_form')`
- `storage_path text not null`
- `version int not null default 1`
- `visible_to_donor boolean not null default true`
- `created_at timestamptz not null default now()`

## Backend Surface

Create a new `backend/` service or Supabase functions layer. Do not add this logic into the Vite client.

### Required API capabilities

#### Auth / Session

- `POST /auth/signup`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /me`

#### Donor

- `GET /donor/profile`
- `PATCH /donor/profile`
- `GET /donor/rankings`
- `PUT /donor/rankings`
- `GET /donor/donations`
- `GET /donor/documents`

#### Projects

- `GET /projects`
- `GET /projects/:projectId`
- `GET /projects/:projectId/milestones`

#### Funding

- `POST /donations`
  - creates a donation record in `pending`
  - returns backend donation id plus ranked/fundable projects snapshot
- `POST /donations/:donationId/confirm-payment`
  - writes `payment_tx_hash`
  - creates `donation_allocations`
- `POST /escrows`
  - records each created escrow after XRPL success
- `POST /escrows/:escrowId/release`
  - records release tx hash after XRPL success

#### Committee

- `GET /committee/projects`
- `GET /committee/milestones/:milestoneId`
- `POST /committee/votes`
- `GET /committee/members`

#### Documents

- `GET /documents`
- `POST /documents`
- `GET /documents/:documentId/download`

## Frontend Refactor

### 1. Replace `WALLETS.donor` as the app identity source

Current state assumes one donor wallet in config. Replace that with:

- authenticated user session
- donor profile from DB
- wallet address linked to donor profile

Temporary hackathon-compatible fallback:

- keep XRPL donor wallet selection local for testnet signing
- but treat wallet address as part of the donor profile loaded from backend

### 2. Remove donor-specific fields from `projects` client state

Delete these frontend-only project fields:

- `rank`
- `funded`

Replace them with:

- `project.currentFunded` from backend
- `rankedProjects` from donor rankings API
- donor-funded history from `donations` + `donation_allocations`

### 3. Introduce app-level state domains

Refactor `App.jsx` into separate domains:

- `session`
- `donorProfile`
- `projects`
- `rankings`
- `committee`
- `documents`
- `balances`

Do not continue storing all concerns inside one nested `projects` array.

### 4. Donor flow changes

`DonorPanel.jsx` should:

- load rankings for the logged-in donor
- load project list with real `currentFunded`
- disable projects where `currentFunded >= fundingGoal`
- save ranking changes to backend
- create a `donation` record before XRPL payment
- after XRPL success, confirm payment and persist allocations/escrows
- show donor’s own donation history, not global project flags

### 5. Committee flow changes

`SignerPanel.jsx` should:

- load funded/voteable milestones from backend, not from donor-only frontend state
- show committee membership from `committee_memberships`
- write votes to backend
- still call XRPL `EscrowFinish` client-side for hackathon v1, then persist release result

Committee selection from top donors is **not implemented in this refactor**. Instead:

- store explicit committee assignments now
- add donor-based selection later as an admin workflow

### 6. NGO/Admin flow

Add a new admin surface in a later UI pass, but model it now:

- project creation/editing
- milestone creation/editing
- document upload
- committee assignment

No NGO-only editing should happen through hardcoded `src/data/projects.js` after the refactor is complete.

## Migration Strategy

### Phase 1 — Backend foundation

- add Supabase project
- create schema above
- seed one NGO, one admin, current demo projects, and 3 test donors
- add auth and donor profile bootstrap

### Phase 2 — Read path migration

- replace `src/data/projects.js` reads with API-backed project queries
- keep current XRPL funding logic, but stop storing `rank` and `funded` on project objects
- show donor rankings and donor-funded projects from backend data

### Phase 3 — Write path migration

- persist donor rankings
- create donation records before funding
- persist payment tx hash, escrow rows, and milestone status updates
- persist committee votes and release records

### Phase 4 — Documents

- add `documents` table and storage bucket
- upload donor-facing contract PDFs
- add donor document list UI

### Phase 5 — Committee candidate logic

- compute top donors by `total_donated_xrp`
- build admin action to nominate top donors into `committee_memberships`
- do not auto-promote donors silently

## File-Level Refactor Targets

### Keep

- `src/xrpl/client.js`
- `src/xrpl/escrow.js`
- `src/xrpl/condition.js`
- `src/xrpl/nft.js`

These remain the on-chain integration layer.

### Replace / heavily refactor

- [`src/App.jsx`](/Users/andrew/Documents/projects/bchain-good-hackathon/src/App.jsx)
  - remove project-owned donor state
  - add session/data-fetch orchestration
- [`src/components/DonorPanel.jsx`](/Users/andrew/Documents/projects/bchain-good-hackathon/src/components/DonorPanel.jsx)
  - use donor profile + rankings + donation records
- [`src/components/SignerPanel.jsx`](/Users/andrew/Documents/projects/bchain-good-hackathon/src/components/SignerPanel.jsx)
  - use committee membership + persisted votes
- [`src/components/MilestoneBoard.jsx`](/Users/andrew/Documents/projects/bchain-good-hackathon/src/components/MilestoneBoard.jsx)
  - read from project/milestone API, not donor session assumptions
- [`src/components/FundDashboard.jsx`](/Users/andrew/Documents/projects/bchain-good-hackathon/src/components/FundDashboard.jsx)
  - aggregate backend funding state plus on-chain tx references

### Deprecate

- [`src/data/projects.js`](/Users/andrew/Documents/projects/bchain-good-hackathon/src/data/projects.js)
  - keep only as seed source during migration
- [`src/data/wallets.js`](/Users/andrew/Documents/projects/bchain-good-hackathon/src/data/wallets.js)
  - keep fund/beneficiary/reserve config
  - remove single hardcoded donor as the app identity model

## Security Rules

- never store donor private keys or seeds in Postgres
- use row-level security so donors can only see their own profile, rankings, donations, and documents
- NGO/admin users can manage projects and documents
- committee members can read voteable milestones and write only their own votes

## Acceptance Criteria

The refactor is complete when:

- at least 3 donors can sign in independently
- each donor has separate ranked project preferences
- each donor sees their own donation history and documents
- projects display global funding totals across all donors
- fully funded projects are disabled for every donor automatically
- committee membership exists independently of donor rankings in the schema
- committee votes are persisted and survive refresh
- project and milestone state survives refresh and new sessions
- XRPL tx hashes are linked to DB donation/escrow records

## Explicit Decisions

- Use Supabase/Postgres as the backend platform
- Keep XRPL transaction signing in the client for hackathon v1
- Do not implement top-donor committee auto-selection in this refactor
- Model NGO/admin users separately from donors
- Store contracts/documents off-chain in storage, with DB metadata and donor visibility rules
- Treat `Form 1023` as out of scope for this refactor

## Immediate First Task List

1. Add Supabase and create the schema above.
2. Seed current demo projects into the database.
3. Replace frontend `projects` seed loading with backend project loading.
4. Introduce donor auth and donor profile loading.
5. Move donor rankings out of `App.jsx` local project state into `donor_project_rankings`.
6. Persist donation + escrow records after current XRPL success paths.
7. Add donor document storage and document list UI.
