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

**Flow (ranked preferences + cascade + trickle-down):**
```
Nonprofit lists 5 projects, each with a funding cap and 2-3 sequential milestones
     |
Donor browses projects --> RANKS up to 3 in preference order (1st, 2nd, 3rd)
     |
Clicks "Fund My Top Choices"
     |
CASCADE LOGIC:
  #1 pick full?  → skip, log "Solar School — skipped (250/250 XRP)"
  #2 pick has room? → fund it
  #3 pick has room? → fund it
     |
For each fundable project:
  Fund Account --> EscrowCreate for ALL milestones upfront (each has own condition)
     |
     Project: "Clean Water Initiative" (fundingGoal: 225, currentFunded: 0)
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
- **Ranked preferences:** donors rank projects by what matters most to them
- **Cascade funding:** if top choice is full, money flows to next choice automatically — no wasted intent
- **Trickle-down accountability:** milestone 2 only unlocks after milestone 1 proves impact
- **Funding caps:** each project has a goal; once met, new donors cascade to other projects
- **Failure isolation:** if a milestone fails review, remaining milestones stay locked (cancel after timeout, funds return)

**Key design decisions:**
- Escrow gating uses crypto-conditions (NOT on-chain multisig). One condition/fulfillment pair per milestone.
- All escrows created upfront (visible on-chain from day 1). Sequential gating is enforced in app UI, not on-chain.
- 2-of-3 approval logic is React state, tracked per milestone. When a milestone hits quorum AND its predecessor is released, the app submits EscrowFinish.
- Donors rank up to 3 projects. Cascade skips full projects, funds the rest in preference order.
- Each project has `fundingGoal` (cap) and `currentFunded` (how much already contributed by other donors).

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
    client.js               # Paing (DONE) — WebSocket connection, balance, tx queries
    escrow.js               # Paing (DONE) — EscrowCreate / EscrowFinish
    condition.js            # Angelina (DONE) — crypto-condition generation (Web Crypto API)
    nft.js                  # Angelina (TODO) — NFTokenMint + proof-of-impact metadata
  components/
    DonorPanel.jsx          # Paing (DONE) — ranked project selection, cascade funding, escrow creation
    SignerPanel.jsx         # Paing (DONE) — per-project/milestone voting, trickle-down gating, EscrowFinish
    MilestoneBoard.jsx      # Andrew (BASIC) — pipeline view, needs polish
    FundDashboard.jsx       # Paing (DONE) — live balances, per-project escrow list, tx history
  data/
    projects.js             # Paing (DONE) — 5 projects with funding caps and sequential milestones
    wallets.js              # Paing (DONE) — 4 testnet wallet configs
  App.jsx                   # Paing (DONE) — project/milestone state, gating logic, ranked selection, cascade
  app.css                   # shared — Tailwind entry point
  main.jsx
```

**Rule: only edit files you own.** If you need something from someone else's file, talk to them.

---

## Current Status + Remaining Work

### What's DONE

| File | Owner | Status |
|---|---|---|
| `xrpl/client.js` | Paing | Done — tested, race condition fixed |
| `xrpl/escrow.js` | Paing | Done — tested end-to-end on testnet |
| `xrpl/condition.js` | Angelina | Done — correct DER encoding verified |
| `data/projects.js` | Paing | Done — 5 projects, funding caps, 2 pre-filled for cascade demo |
| `data/wallets.js` | Paing | Done — 4 testnet wallets |
| `App.jsx` | Paing | Done — nested project/milestone state, trickle-down gating, ranked selection, cascade |
| `DonorPanel.jsx` | Paing | Done — ranked preferences (1st/2nd/3rd), cascade logic, wired to real XRPL |
| `SignerPanel.jsx` | Paing | Done — per-project nav, per-milestone voting with lock states, real EscrowFinish |
| `FundDashboard.jsx` | Paing | Done — grouped by project, progress bars, tx history with explorer links |

### What's REMAINING

| Task | Owner | Priority |
|---|---|---|
| `xrpl/nft.js` — Proof-of-Impact NFT minting | Angelina | High |
| `MilestoneBoard.jsx` — polish pipeline visualization | Andrew | Medium |
| Wire NFT minting into DonorPanel + SignerPanel flows | Angelina + Paing | High (after nft.js) |
| Legal contract integration (review + hash in escrow memos) | Paing + lawyer teammate | Medium |
| End-to-end browser test of full flow | Everyone | High |
| Delete stale `data/milestones.js` | Anyone | Low |
| Demo script + presentation | Everyone | Saturday |

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

### DonorPanel.jsx (DONE)
- Donor wallet balance (live, auto-refresh)
- **Ranked project selection:** click projects to rank 1st/2nd/3rd (gold/silver/bronze badges)
- Each card shows: title, description, milestone count, funding progress bar (currentFunded/fundingGoal), "Fully funded" badge if at cap
- **"Fund My Top Choices"** button with cascade logic:
  - Iterates ranked projects in order, skips full ones, funds the rest
  - Cascade log shows what happened: "Solar School — skipped (full)" / "Clean Water — funding"
- Creates escrows for all milestones in fundable projects
- Shows funded projects summary with release progress

### SignerPanel.jsx (DONE)
- **Project selector tabs** to pick which funded project to review
- Per-project summary cards: total milestones, voteable count, released count
- **Per-milestone voting cards** with trickle-down gating:
  - Only voteable milestones accept votes
  - Locked milestones show "Locked — waiting for Milestone N-1"
  - Quorum progress bar per milestone
- 3 committee members (NGO Rep, Donor Rep, Community Auditor) as toggle buttons
- Auto-triggers real EscrowFinish when 2-of-3 approve, auto-unlocks next milestone

### MilestoneBoard.jsx (BASIC — Andrew can polish)
- Shows all funded projects with milestone pipeline
- Per project: sequential cards with M1 → M2 → M3 arrows
- Status badges: pending, locked, voteable, approved, released
- Needs: better styling, approval counts, escrow hash display

### FundDashboard.jsx (DONE)
- Balance cards: donor, fund, beneficiary (live)
- Overall disbursement progress bar with aggregate stats
- **Per-project sections:** each funded project with milestone rows, status badges, explorer links for escrow + release tx hashes
- Recent transaction history with testnet explorer links

### App.jsx (DONE)
- Tab bar: Donor | Committee | Milestones | Dashboard
- **Owns all state:** projects array with nested milestones, ranked selection, funded status
- `getEffectiveStatus()` — exported helper for trickle-down display logic
- State updaters: `toggleProjectRank()`, `markProjectFunded()`, `updateMilestoneEscrow()`, `updateMilestoneApproval()`, `updateMilestoneReleased()`
- `updateMilestoneReleased` auto-unlocks next milestone in sequence
- Balance polling every 10s

---

## Data Shapes

### projects.js (DONE)

5 projects with funding caps. 2 are pre-filled (full) for cascade demo.

```js
{
  id: "clean-water",
  title: "Clean Water Initiative",
  description: "Provide safe drinking water to 10 rural communities",
  fundingGoal: 225,       // cap — once reached, new donors cascade past
  currentFunded: 0,       // simulates other donors' contributions
  milestones: [
    { id: "cw-1", title: "Purchase Water Filters", xrpAmount: 100, order: 1 },
    { id: "cw-2", title: "Distribution & Logistics", xrpAmount: 75, order: 2 },
    { id: "cw-3", title: "Community Training", xrpAmount: 50, order: 3 },
  ],
}
// Solar School: fundingGoal 250, currentFunded 250 (FULL)
// Medical Clinic: fundingGoal 400, currentFunded 0
// School Meals: fundingGoal 200, currentFunded 200 (FULL)
// Reforestation: fundingGoal 150, currentFunded 0
```

### Runtime state shape (managed in App.jsx)

```js
{
  ...project,                   // id, title, description, fundingGoal, currentFunded
  rank: null,                   // 1, 2, or 3 (donor preference) — null = not ranked
  funded: false,                // true after escrows created by this donor
  milestones: [{
    ...milestone,               // id, title, description, xrpAmount, order
    status: "pending",          // pending | funded | voteable | approved | released
    escrowSequence: null,
    condition: null,            // hex
    fulfillment: null,          // hex (secret — revealed on quorum)
    escrowTxHash: null,
    releaseTxHash: null,
    approvals: { ngoRep: false, donorRep: false, communityAuditor: false },
  }],
}
```

**Status transitions:**
- `pending` → `funded`: after EscrowCreate (milestone 1 becomes `voteable` instead)
- `funded` → `voteable`: auto when predecessor is `released`
- `voteable` → `approved`: 2-of-3 committee approvals
- `approved` → `released`: EscrowFinish succeeds, next milestone auto-unlocks

**Trickle-down rule:** voteable if `order === 1` OR predecessor in same project is `released`.

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

### Donation flow with cascade (implemented in DonorPanel):
```
1. Donor ranks projects: 1st Solar School, 2nd Clean Water, 3rd Reforestation
2. Clicks "Fund My Top Choices"
3. CASCADE:
   - Solar School: currentFunded 250/250 → SKIP (logged: "skipped — full")
   - Clean Water: currentFunded 0/225 → FUND (logged: "funding — has capacity")
   - Reforestation: currentFunded 0/150 → FUND
4. Total XRP = 225 + 150 = 375
5. sendPayment(375 XRP → fund account)
6. For each fundable project, for each milestone:
   - generateCondition() → createEscrow() → updateMilestoneEscrow()
7. Milestone 1 of each project becomes "voteable", rest become "funded" (locked)
```
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

1. **"Here's the problem"** — NGO scandal headline. Donors have no visibility.
2. **Show the catalog** — 5 projects with funding progress bars. 2 already full. "This nonprofit is transparent."
3. **Donor ranks 3 projects** — 1st Solar School (full!), 2nd Clean Water, 3rd Reforestation
4. **Click "Fund My Top Choices"** — cascade log appears:
   - "Solar School — skipped (full 250/250)"
   - "Clean Water — funding (0/225)"
   - "Reforestation — funding (0/150)"
5. **Escrows created** — "Creating escrows... 3/6... 6/6 done!" All milestones locked on-chain.
6. **Show testnet explorer** — 6 EscrowCreate txs. Real money locked, publicly visible.
7. **The trickle-down** — "Milestone 2 is locked. Committee can only vote on M1 first."
8. **Committee votes on Clean Water M1** — 2-of-3 approve. EscrowFinish fires. 100 XRP released. M2 unlocks.
9. **"The nonprofit earned the right to the next tranche"** — show M2 now voteable.
10. **Closing** — "Donors rank their priorities. Full projects cascade. Funds trickle down only when milestones deliver."

---

## Coordination Rules

1. **Only edit files you own** (see project structure above)
2. **Pull before push** — always `git pull --rebase` first
3. **Commit often** — small commits, clear messages
4. **Talk before touching shared state** — if you need to change how data flows between components, discuss first
5. **Saturday morning = integration time** — that's when we wire everything together
6. **If something breaks, say it out loud** — we're sitting together, use that
