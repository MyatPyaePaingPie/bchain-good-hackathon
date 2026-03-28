# Nonprofit Escrow — Hackathon Execution Plan

**USF x Ripple "Blockchain for Social Good" Hackathon**
~20 hours (7pm Fri -> 3:30pm Sat)

Team: Paing (macOS) + Tianqi (Windows) + Andrew + Angelina
All push to `main`. No branches. Coordinate verbally — you're sitting together.

---

## What We're Building

A browser app that makes nonprofit fund management transparent using the XRP Ledger. No backend — the app talks directly to the blockchain.

**The Problem:** Donors give money to nonprofits and have no idea where it goes.

**Our Solution:**
- A nonprofit lists multiple projects (e.g. Clean Water, Solar School, Medical Clinic)
- Each project has sequential milestones — funds trickle down only if the previous milestone succeeds
- Donors browse projects and pick up to 3 to fund
- All funds locked in XRPL escrows (on-chain, publicly verifiable)
- A committee of 3 votes per milestone (2-of-3 required)
- Proof-of-Impact NFTs prove every disbursement

**Flow (project-based, trickle-down):**
```
Nonprofit lists 5 projects, each with 2-3 sequential milestones
     |
Donor browses projects --> selects up to 3 --> clicks "Fund Selected"
     |
For each selected project:
  Fund Account --> EscrowCreate for ALL milestones upfront (each has own condition)
     |
     Project: "Clean Water Initiative"
     ├── Milestone 1: "Purchase Filters"  — 100 XRP locked  [VOTEABLE]
     ├── Milestone 2: "Distribution"      — 75 XRP locked   [LOCKED — waits for M1]
     └── Milestone 3: "Training"          — 50 XRP locked   [LOCKED — waits for M2]
     |
Committee votes on Milestone 1 (2-of-3)
     |
Milestone 1 approved --> EscrowFinish --> funds released --> Proof-of-Impact NFT
     |
Milestone 2 UNLOCKS for voting (trickle-down)
     |
...repeat until all milestones released or timeout
```

**What makes this interesting:**
- **Donor choice:** donors pick which projects matter to them, not just dump money
- **Trickle-down accountability:** milestone 2 only unlocks after milestone 1 proves impact
- **Multiple projects visible on-chain:** each escrow is independently auditable
- **Failure isolation:** if a project's milestone 1 fails review, milestones 2 & 3 stay locked forever (or cancel after timeout, funds return)

**Key design decisions:**
- Escrow gating uses crypto-conditions (NOT on-chain multisig). One condition/fulfillment pair per milestone.
- All escrows created upfront (visible on-chain from day 1). Sequential gating is enforced in app UI, not on-chain.
- 2-of-3 approval logic is React state, tracked per milestone. When a milestone hits quorum AND its predecessor is released, the app submits EscrowFinish.
- Donors see a catalog of projects and choose which to fund. Up to 3 projects per donation.

**No backend.** Everything runs in the browser. Wallet seeds are testnet-only (no real money). State resets on refresh — that's fine for a 3-minute demo.

---

## Proof-of-Impact NFTs

Not just receipt tokens — these NFTs encode verifiable data about what happened on-chain.

### Two types of NFTs:

**1. Proof-of-Donation** (minted to donor when they fund milestones)
```json
{
  "type": "proof-of-donation",
  "donor": "rwVpq...",
  "totalXRP": 225,
  "milestones": 3,
  "timestamp": "2026-03-28T02:30:00Z",
  "fund": "rP2GR..."
}
```

**2. Proof-of-Impact** (minted to donor when each milestone is released)
```json
{
  "type": "proof-of-impact",
  "milestone": "Purchase Water Filters",
  "milestoneId": 1,
  "xrpAmount": 100,
  "beneficiary": "raCGS...",
  "escrowTxHash": "ABC123...",
  "releaseTxHash": "DEF456...",
  "approvedBy": ["NGO Rep", "Donor Rep"],
  "timestamp": "2026-03-28T10:15:00Z"
}
```

**How it works:**
- The JSON is stringified, hex-encoded, and stored as the NFT URI (XRPL requires hex URIs)
- Anyone can read the NFT on-chain, decode the URI, and verify every claim against the ledger
- The `escrowTxHash` and `releaseTxHash` are links back to the actual transactions — full chain of custody
- Donor ends up with 1 donation NFT + up to 3 impact NFTs = a complete on-chain portfolio of where their money went

**Implementation:** This is Angelina's `nft.js`. The `mintNFT()` helper takes a metadata object, JSON-stringifies it, hex-encodes it, and passes it as the URI to NFTokenMint.

---

## Tech Stack

- **Vite + React** — already scaffolded, deps installed
- **Tailwind CSS v4** — via `@tailwindcss/vite` plugin
- **xrpl.js v4.6** — all ledger interactions, signs in-browser
- **XRPL Testnet** — `wss://s.altnet.rippletest.net:51233`
- **Web Crypto API** — SHA-256 crypto-conditions (built into browser, no extra deps)

---

## Project Structure

```
src/
  xrpl/
    client.js               # Paing — WebSocket connection + account queries (DONE)
    escrow.js               # Paing — EscrowCreate / EscrowFinish (DONE)
    condition.js            # Angelina — crypto-condition generation (Web Crypto API)
    nft.js                  # Angelina — NFTokenMint / getAccountNFTs + proof-of-impact metadata
  components/
    DonorPanel.jsx          # Tianqi — donate form, multi-escrow funding, NFT portfolio
    SignerPanel.jsx         # Andrew — per-milestone committee approval, quorum tracker
    MilestoneBoard.jsx      # Andrew — milestone cards, status badges, pipeline view
    FundDashboard.jsx       # Paing — live balances, escrow list, tx history
  data/
    milestones.js           # Tianqi — hardcoded demo milestones
    wallets.js              # Paing — testnet wallet configs (DONE)
  App.jsx                   # Paing — root component, milestone state management, layout
  app.css                   # shared — Tailwind entry point
  main.jsx
```

**Rule: only edit files you own.** If you need something from someone else's file, talk to them.

---

## Work Split (by person, by file — no overlaps)

### Paing — State Management + Dashboard + XRPL Layer

You own `client.js` (DONE), `escrow.js` (DONE), `wallets.js` (DONE), `App.jsx`, and `FundDashboard.jsx`.

XRPL core is finished. Now you own the app's brain (App.jsx state management) and the transparency dashboard.

| Time | Task |
|---|---|
| Fri 7-8pm | ~~Generate wallets, write client.js, escrow.js~~ DONE |
| Fri 8-10pm | `App.jsx` — root component, tab navigation, header |
| | Set up the milestone state array (see Runtime milestone state below) |
| | Wire state updaters: `updateMilestoneStatus()`, `updateMilestoneApproval()`, `updateMilestoneEscrow()` |
| | Pass milestone state + updaters as props to all panels |
| Fri 10pm-12am | `FundDashboard.jsx` — fund account balance, escrow list (one row per milestone), tx history |
| | Show testnet explorer links, overall progress ("2 of 3 milestones released, 175/225 XRP disbursed") |
| | Test end-to-end with Angelina: condition -> escrow -> finish -> NFT |
| Sat 10am-12pm | Wire real XRPL calls into everyone's components, integration fixes |
| Sat 12-2pm | Debug, polish live updates, final integration |
| Sat 2-3:30pm | Demo prep, bug fixes |

### Angelina — Crypto-Conditions + Proof-of-Impact NFTs

You own `condition.js` and `nft.js`. The cryptography layer and the NFT minting with verifiable metadata.

| Time | Task |
|---|---|
| Fri 7-8pm | Read the Technical Gotchas section — especially the crypto-condition DER encoding and NFT URI hex encoding |
| Fri 8-10pm | `condition.js` — generateCondition() using Web Crypto API |
| | Fulfillment DER: `A0 22 80 20 <preimage>`, Fingerprint: SHA-256(raw preimage), Condition DER: `A0 25 80 20 <fingerprint> 81 01 20` |
| Fri 10pm-12am | `nft.js` — two minting functions: |
| | `mintDonationNFT({ wallet, donor, totalXRP, milestoneCount })` — Proof-of-Donation |
| | `mintImpactNFT({ wallet, milestone, xrpAmount, beneficiary, escrowTxHash, releaseTxHash, approvedBy })` — Proof-of-Impact |
| | `getAccountNFTs(address)` — fetch + decode NFT URIs back to JSON |
| | Test with Paing end-to-end: generate condition -> create escrow -> finish -> mint both NFT types |
| Sat 10am-12pm | Help wire NFT minting into DonorPanel and SignerPanel flows |
| Sat 12-2pm | Polish, help with integration and presentation |
| Sat 2-3:30pm | Demo prep, bug fixes |

### Tianqi — Donor Experience

You own `DonorPanel.jsx` and `milestones.js`. The donor's view: funding milestones and the NFT impact portfolio.

| Time | Task |
|---|---|
| Fri 7-8pm | `src/data/milestones.js` — hardcoded demo milestones (3 milestones, see data shapes below) |
| Fri 8-10pm | `DonorPanel.jsx` — "Fund All Milestones" button, donation flow UI |
| | Show donor wallet balance, donation progress ("Funding milestones... 1/3... 2/3... 3/3 done!") |
| | Stub XRPL calls with console.log (helpers aren't ready yet) |
| Fri 10pm-12am | NFT portfolio section in DonorPanel — display Proof-of-Donation + Proof-of-Impact NFTs |
| | Each NFT card shows decoded metadata (milestone name, amount, tx links) |
| | Style everything with Tailwind |
| Sat 10am-12pm | Replace stubs with real XRPL calls (Paing/Angelina help) |
| Sat 12-2pm | Polish UI, loading states, error handling |
| Sat 2-3:30pm | Demo prep, bug fixes |

### Andrew — Governance + Milestone Pipeline View

You own `SignerPanel.jsx` and `MilestoneBoard.jsx`. The committee approval flow and the visual milestone pipeline.

| Time | Task |
|---|---|
| Fri 7-8pm | Read PLAN.md, understand the multi-milestone escrow flow and per-milestone voting |
| Fri 8-10pm | `SignerPanel.jsx` — milestone selector (dropdown/tabs), 3 committee member cards per milestone |
| | Each card has "Approve" button, quorum tracker per milestone (X/3), highlight on 2-of-3 reached |
| | When quorum reached, call `finishEscrow()` + `mintImpactNFT()` (stub for now) |
| | Show summary view: which milestones are voted, which are pending |
| Fri 10pm-12am | `MilestoneBoard.jsx` — milestone pipeline visualization |
| | Cards with: title, description, XRP amount, status badge, approval count, escrow hash (truncated) |
| | Statuses: Pending (gray) → Funded (blue) → Approved (yellow) → Released (green) |
| | Visual flow: show the pipeline progress at a glance |
| Sat 10am-12pm | Replace stubs with real XRPL calls (Paing helps) |
| Sat 12-2pm | Polish: animations, transitions, help with presentation |
| Sat 2-3:30pm | Demo prep, bug fixes |

---

## Setup Instructions

### Prerequisites
- Node.js 18+
- Git

### Clone & Run

```bash
git clone <repo-url>
cd bchain-good-hackathon
npm install
npm run dev
```

Vite dev server starts at `http://localhost:5173`.

### Windows Notes (Tianqi / Andrew / Angelina if applicable)

- Use **PowerShell** or **Git Bash**
- If CRLF warnings: `git config core.autocrlf true`
- Everything else works the same on Windows

### Git Workflow (everyone)

```bash
git pull --rebase       # ALWAYS pull before pushing
git add <your-files>    # only add YOUR files
git commit -m "short message"
git push
```

- Only commit files you own
- Pull before every push
- If merge conflict: yell across the table, fix together
- Keep commits small and frequent

---

## Component Specs

### DonorPanel.jsx (Tianqi)
- Shows donor wallet balance (live)
- **Project catalog:** shows all available projects as cards
- Each card: project title, description, total XRP needed, milestone count
- Donor checks up to 3 projects (checkbox/toggle on each card)
- "Fund Selected Projects" button -> sends total XRP to fund account, creates escrows for ALL milestones in selected projects
- Progress indicator: "Creating escrows... 3/8 done"
- **NFT portfolio section:** Proof-of-Donation + Proof-of-Impact NFTs

### SignerPanel.jsx (Andrew)
- **Project selector** (dropdown/tabs) to pick which funded project to review
- Within that project: shows milestones in sequential order
- **Trickle-down gating:** only the first unfunded/unreleased milestone is voteable. Milestone 2 shows "Locked — waiting for Milestone 1" until Milestone 1 is released.
- For the active milestone: 3 committee member cards with "Approve" buttons
- Quorum tracker, auto-triggers EscrowFinish on 2-of-3
- Shows project-level summary: "2 of 3 milestones released"

### MilestoneBoard.jsx (Andrew)
- Shows ALL funded projects, each with its milestone pipeline
- Per project: sequential milestone cards showing the trickle-down flow
- Statuses: **Pending** (gray), **Funded** (blue), **Voteable** (indigo), **Approved** (yellow), **Released** (green), **Locked** (gray dashed)
- Visual connection between milestones (arrows or progress line showing sequential dependency)
- The "at a glance" view of where all projects stand

### FundDashboard.jsx (Paing)
- Live balance cards (donor, fund, beneficiary)
- **Grouped by project:** each funded project shows its escrows and progress
- Per-project progress bar: "2 of 3 milestones released, 175/225 XRP disbursed"
- Overall aggregate: total locked, total released, total projects funded
- Recent transactions with testnet explorer links

### App.jsx (Paing)
- Imports all panels
- Tab bar: Donor | Committee | Milestones | Dashboard
- **Owns project + milestone state** — nested structure: projects[] → milestones[]
- Gating logic: `updateMilestoneReleased` auto-unlocks next milestone in sequence
- State updaters: `selectProject()`, `updateMilestoneEscrow()`, `updateMilestoneApproval()`, `updateMilestoneReleased()`
- Header with app name + tagline

---

## Data Shapes

### projects.js (Tianqi — renamed from milestones.js)

The nonprofit's project catalog. Static definitions. Runtime state managed in App.jsx.

```js
export const PROJECTS = [
  {
    id: "clean-water",
    title: "Clean Water Initiative",
    description: "Provide safe drinking water to 10 rural communities",
    milestones: [
      { id: "cw-1", title: "Purchase Water Filters", description: "Buy 500 portable water filters", xrpAmount: 100, order: 1 },
      { id: "cw-2", title: "Distribution & Logistics", description: "Transport filters to 10 villages", xrpAmount: 75, order: 2 },
      { id: "cw-3", title: "Community Training", description: "Train local volunteers on filter maintenance", xrpAmount: 50, order: 3 },
    ],
  },
  {
    id: "solar-school",
    title: "Solar-Powered School",
    description: "Install solar panels and equipment at a rural school",
    milestones: [
      { id: "ss-1", title: "Panel Procurement", description: "Purchase 20 solar panels + inverters", xrpAmount: 150, order: 1 },
      { id: "ss-2", title: "Installation", description: "Install panels and wire classrooms", xrpAmount: 100, order: 2 },
    ],
  },
  {
    id: "medical-clinic",
    title: "Mobile Medical Clinic",
    description: "Fund a mobile clinic to serve underserved areas",
    milestones: [
      { id: "mc-1", title: "Vehicle & Equipment", description: "Purchase and outfit a medical van", xrpAmount: 200, order: 1 },
      { id: "mc-2", title: "Staff Training", description: "Train 5 community health workers", xrpAmount: 80, order: 2 },
      { id: "mc-3", title: "First Quarter Operations", description: "Cover fuel, supplies, and salaries for 3 months", xrpAmount: 120, order: 3 },
    ],
  },
  {
    id: "school-meals",
    title: "School Meals Program",
    description: "Provide daily meals to 200 students for one semester",
    milestones: [
      { id: "sm-1", title: "Kitchen Setup", description: "Build a school kitchen and purchase equipment", xrpAmount: 90, order: 1 },
      { id: "sm-2", title: "Food Supply Contract", description: "Secure 6-month food supply agreement", xrpAmount: 110, order: 2 },
    ],
  },
  {
    id: "reforestation",
    title: "Community Reforestation",
    description: "Plant 10,000 native trees across deforested land",
    milestones: [
      { id: "rf-1", title: "Seedling Nursery", description: "Establish nursery and grow 10,000 seedlings", xrpAmount: 60, order: 1 },
      { id: "rf-2", title: "Planting Campaign", description: "Organize community planting over 2 weekends", xrpAmount: 40, order: 2 },
      { id: "rf-3", title: "Monitoring & Care", description: "6-month monitoring, replanting failures", xrpAmount: 50, order: 3 },
    ],
  },
];
```

### Runtime state shape (managed in App.jsx by Paing)

Projects the donor has selected and funded. Each milestone gets enriched with escrow + voting data:

```js
// Shape of a funded project in React state
{
  ...PROJECTS[i],               // id, title, description
  selected: true,               // donor picked this project
  milestones: [
    {
      ...milestone,             // id, title, description, xrpAmount, order
      status: "pending",        // pending | funded | voteable | approved | released | locked
      escrowSequence: null,     // set after EscrowCreate
      condition: null,          // hex string
      fulfillment: null,        // hex string (secret — revealed on quorum)
      escrowTxHash: null,
      releaseTxHash: null,
      approvals: {
        ngoRep: false,
        donorRep: false,
        communityAuditor: false,
      },
    },
    // ...
  ],
}
```

**Status transitions:**
- `pending` → `funded`: after EscrowCreate succeeds for this milestone
- `funded` → `voteable`: automatic if this is milestone #1, OR if the previous milestone is `released`
- `voteable` → `approved`: after 2-of-3 approvals received
- `approved` → `released`: after EscrowFinish succeeds (on-chain), then next milestone becomes `voteable`
- `funded` stays as `locked` display state in UI if previous milestone isn't released yet

**Trickle-down rule:** A milestone is voteable only if `order === 1` OR the milestone with `order - 1` in the same project has status `released`.

### wallets.js (Paing)
```js
// Testnet wallets — generated from faucet, seeds in .env
export const WALLETS = {
  donor:       { address: "r...", seed: import.meta.env.VITE_DONOR_SEED },
  fund:        { address: "r...", seed: import.meta.env.VITE_FUND_SEED },
  beneficiary: { address: "r...", seed: import.meta.env.VITE_BENEFICIARY_SEED },
  reserve:     { address: "r...", seed: import.meta.env.VITE_RESERVE_SEED },
};
```

---

## XRPL Helper API (Paing provides, everyone else calls)

These are the functions Paing will implement. Stub them in your components until they're ready.

```js
// client.js
getClient()                    // -> connected xrpl.Client
getBalance(address)            // -> string (XRP amount)
getAccountTx(address, limit)   // -> transaction[]
getAccountEscrows(address)     // -> escrow objects[]

// escrow.js
createEscrow({ fromWallet, destination, amount, condition, cancelAfterDays })
  // -> { result, sequence, condition, fulfillment }
finishEscrow({ ownerAddress, escrowSequence, condition, fulfillment, wallet })
  // -> tx result

// nft.js
mintNFT({ wallet, uri, memo })   // -> NFT token ID
getAccountNFTs(address)          // -> NFT[]

// condition.js
generateCondition()              // -> { preimage, fulfillment, condition }
```

### Donation flow (how the pieces connect):
```jsx
// In DonorPanel: when donor clicks "Fund Selected Projects"
const handleFundSelected = async (selectedProjects) => {
  // 1. Calculate total XRP across all selected projects' milestones
  const totalXRP = selectedProjects.flatMap(p => p.milestones).reduce((sum, m) => sum + m.xrpAmount, 0);

  // 2. Send total to fund account
  await sendPayment({ wallet: donorWallet, destination: fundWallet.address, amount: totalXRP });

  // 3. Create escrows for ALL milestones in selected projects
  for (const project of selectedProjects) {
    for (const milestone of project.milestones) {
      const { condition, fulfillment } = await generateCondition();
      const { result, sequence } = await createEscrow({
        fromWallet: fundWallet,
        destination: beneficiary,
        amount: milestone.xrpAmount,
        condition,
      });
      // Update state — milestone 1 becomes "voteable", others become "funded" (locked until predecessor releases)
      updateMilestoneEscrow(project.id, milestone.id, {
        escrowSequence: sequence, condition, fulfillment,
        escrowTxHash: result?.result?.tx_json?.hash,
      });
    }
  }
};
```

---

## Technical Gotchas (everyone should know)

1. **No backend.** All transactions happen in-browser via xrpl.js -> XRPL testnet WebSocket. Wallet seeds are in the frontend. This is fine for testnet demos.
2. **Crypto-conditions (CRITICAL — Angelina read this):**
   - Use Web Crypto API (browser-native). NOT `five-bells-condition` (Node-only).
   - **Fulfillment DER** (36 bytes for 32-byte preimage): `A0 22 80 20 <preimage>`
   - **Fingerprint** = SHA-256 of the **raw preimage** (NOT the DER fulfillment)
   - **Condition DER** (39 bytes): `A0 25 80 20 <fingerprint> 81 01 20`
   - The inner `80 20` tag in the fulfillment is required — without it, EscrowFinish fails with `tecCRYPTOCONDITION_ERROR`.
3. **Ripple Epoch:** XRPL timestamps = UNIX timestamp minus `946684800`. Must use this for `CancelAfter`.
4. **NFT URI:** Must be hex-encoded string. `NFTokenTaxon` is required (use `0`).
5. **EscrowFinish fee:** Conditional escrows cost more: `330 drops + 10 drops per 16 bytes of fulfillment`.
6. **Testnet faucet:** https://faucet.altnet.rippletest.net/accounts — Paing generates wallets upfront.
7. **State resets on refresh.** Approval votes, escrow records in React state — all gone on page reload. That's fine for the demo. Don't try to persist it.
8. **xrpl.js v4.6** works directly in the browser via Vite. No polyfills needed.

---

## Demo Script (3 minutes for judges)

Everyone helps prep this Saturday. Nobody owns it alone.

1. **"Here's the problem"** — NGO scandal headline. Donors have no visibility into where money goes.
2. **Show the project catalog** — 5 projects, each with sequential milestones. "This nonprofit is transparent about what they need."
3. **Donor picks 2 projects** — "Clean Water" and "Solar School". Checks the boxes, clicks "Fund Selected".
4. **Escrows created on-chain** — watch progress: "Creating escrows... 3/5... 5/5 done!" All milestones locked.
5. **Show testnet explorer** — 5 separate EscrowCreate txs. Real money locked, publicly visible.
6. **The trickle-down** — "Milestone 2 is locked. The committee can only vote on Milestone 1 first. Funds don't flow until impact is proven."
7. **Committee votes on Clean Water M1** — NGO Rep + Donor Rep approve. EscrowFinish fires. 100 XRP released.
8. **Milestone 2 unlocks** — "Now the committee can review Distribution. The nonprofit earned the right to the next tranche."
9. **Proof-of-Impact NFT** — appears in donor's portfolio with the milestone name, amount, and tx hashes. Verifiable on-chain.
10. **Closing** — "Donors choose their impact. Funds only flow when milestones deliver. Every receipt on-chain."

---

## Coordination Rules

1. **Only edit files you own** (see project structure above)
2. **Pull before push** — always `git pull --rebase` first
3. **Commit often** — small commits, clear messages
4. **Talk before touching shared state** — if you need to change how data flows between components, discuss first
5. **Saturday morning = integration time** — that's when we wire everything together
6. **If something breaks, say it out loud** — we're sitting together, use that
