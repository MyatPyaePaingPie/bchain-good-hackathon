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
- Donations go into XRPL escrows (locked on-chain, publicly verifiable)
- A committee of 3 must approve (2-of-3) before funds release
- NFT receipts prove donation and disbursement happened
- Anyone can audit everything on the XRPL explorer

**Flow (multi-milestone pipeline):**
```
Donor donates XRP --> Fund Account
     |
Fund Account --> EscrowCreate PER MILESTONE (each has its own crypto-condition)
     |
     ├── Milestone 1: "Purchase Water Filters"  — 100 XRP locked (own condition)
     ├── Milestone 2: "Distribution & Logistics" — 75 XRP locked (own condition)
     └── Milestone 3: "Training Program"         — 50 XRP locked (own condition)
     |
Proof-of-Donation NFT minted to donor (encodes: total XRP, milestone count, timestamp)
     |
Committee votes PER MILESTONE (2-of-3 in app state)
     |
     ├── Milestone 1 approved --> EscrowFinish #1 --> 100 XRP released
     │   └── Proof-of-Impact NFT minted (encodes: milestone title, XRP amount, escrow tx hash)
     ├── Milestone 2 approved --> EscrowFinish #2 --> 75 XRP released
     │   └── Proof-of-Impact NFT minted
     └── Milestone 3 approved --> EscrowFinish #3 --> 50 XRP released
         └── Proof-of-Impact NFT minted
```

**What makes this interesting vs. a single escrow:**
- Each milestone has its **own escrow, own condition, own vote tally**
- Committee can approve milestones in any order (or reject/skip)
- Partial fund release is visible on-chain — you can see "2 of 3 milestones disbursed"
- If a milestone is never approved, that escrow stays locked and can be cancelled after timeout (funds return to fund account)

**Key design decisions:**
- Escrow gating uses crypto-conditions (NOT on-chain multisig). One condition/fulfillment pair per milestone.
- 2-of-3 approval logic is React state, tracked per milestone. When a milestone hits quorum, the app submits EscrowFinish with that milestone's fulfillment.
- All escrows are created upfront when the donor donates. This locks the funds immediately and makes the pipeline visible on-chain from the start.

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
    client.js               # Paing — WebSocket connection + account queries
    escrow.js               # Paing — EscrowCreate / EscrowFinish
    condition.js            # Angelina — crypto-condition generation (Web Crypto API)
    nft.js                  # Angelina — NFTokenMint / getAccountNFTs helpers
  components/
    DonorPanel.jsx          # Tianqi — donate form, NFT receipts, balance
    SignerPanel.jsx         # Andrew — committee approval, quorum tracker
    MilestoneBoard.jsx      # Tianqi — milestone cards with status badges
    FundDashboard.jsx       # Angelina — live balances, escrows, tx history
  data/
    milestones.js           # Andrew — hardcoded demo milestones
    wallets.js              # Paing — testnet wallet configs
  App.jsx                   # Tianqi — root component, layout, tab navigation
  app.css                   # shared — Tailwind entry point
  main.jsx
```

**Rule: only edit files you own.** If you need something from someone else's file, talk to them.

---

## Work Split (by person, by file — no overlaps)

### Paing — Escrow + Connection Layer

You own `client.js`, `escrow.js`, and `wallets.js`. The core ledger connection and escrow logic.

| Time | Task |
|---|---|
| Fri 7-8pm | Generate 4 testnet wallets (faucet), write `wallets.js` and `.env` |
| Fri 8-10pm | `client.js` — connect to testnet, getBalance, getAccountTx, getAccountEscrows |
| | `escrow.js` — createEscrow() with crypto-condition, finishEscrow() with fulfillment |
| Fri 10pm-12am | End-to-end test in console with Angelina: donate -> escrow create -> finish -> NFT mint |
| | Fix bugs, edge cases (fee calculation, Ripple epoch) |
| Sat 10am-12pm | Help wire XRPL helpers into everyone's components |
| Sat 12-2pm | Debug integration issues, polish live data updates |
| Sat 2-3:30pm | Demo prep, bug fixes |

### Angelina — Crypto-Conditions + NFTs + Dashboard

You own `condition.js`, `nft.js`, and `FundDashboard.jsx`. The cryptography layer, NFT minting, and the transparency dashboard.

| Time | Task |
|---|---|
| Fri 7-8pm | Read the Technical Gotchas section — especially crypto-conditions and NFT encoding |
| Fri 8-10pm | `condition.js` — generateCondition() using Web Crypto API (SHA-256 preimage -> fulfillment -> condition) |
| | `nft.js` — mintNFT() with hex-encoded URI, getAccountNFTs() |
| Fri 10pm-12am | Test with Paing end-to-end: generate condition -> create escrow -> finish -> mint NFT |
| | Start `FundDashboard.jsx` — fund account balance, active escrows list, tx history |
| Sat 10am-12pm | Finish FundDashboard: testnet explorer links, progress bars, auto-refresh |
| Sat 12-2pm | Polish dashboard, help with integration |
| Sat 2-3:30pm | Demo prep, bug fixes |

### Tianqi — Donor Experience + App Shell

You own `DonorPanel.jsx`, `MilestoneBoard.jsx`, and `App.jsx`. The donor's view and the overall app layout.

| Time | Task |
|---|---|
| Fri 7-8pm | `App.jsx` — root component with tab navigation (Donor / Committee / Milestones / Dashboard) |
| | Set up the layout: header, tab bar, render active panel |
| Fri 8-10pm | `DonorPanel.jsx` — donate XRP form, wallet balance display, NFT receipt list |
| | Stub XRPL calls with console.log (helpers aren't ready yet) |
| Fri 10pm-12am | `MilestoneBoard.jsx` — milestone cards, status badges (pending/funded/approved/released) |
| | Style both components with Tailwind |
| Sat 10am-12pm | Replace stubs with real XRPL calls (Paing/Angelina help) |
| Sat 12-2pm | Polish UI, loading states, error handling |
| Sat 2-3:30pm | Demo prep, bug fixes |

### Andrew — Governance + Data

You own `SignerPanel.jsx` and `milestones.js`. The committee approval flow and demo data.

| Time | Task |
|---|---|
| Fri 7-8pm | `src/data/milestones.js` — hardcoded demo milestones (3 milestones, see data shapes below) |
| | Read PLAN.md, understand the escrow flow and approval logic |
| Fri 8-10pm | `SignerPanel.jsx` — 3 committee member cards, approve buttons, quorum tracker (2-of-3) |
| | Approval state is React useState — no blockchain here, just UI logic |
| | When quorum reached, call `finishEscrow()` (stub it for now) |
| Fri 10pm-12am | Polish SignerPanel: animations on approval, visual quorum progress |
| | Help Tianqi with MilestoneBoard status logic if needed |
| Sat 10am-12pm | Replace stubs with real XRPL calls (Paing helps) |
| Sat 12-2pm | Help with demo script and presentation |
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
- Input: donor selects how much XRP to donate (default: 225 = sum of all milestones)
- "Fund All Milestones" button -> calls `sendPayment()` to fund account, then creates one escrow per milestone via `createEscrow()` (3 escrows total)
- Shows donor wallet balance (live)
- **NFT portfolio section:** shows Proof-of-Donation NFT + any Proof-of-Impact NFTs received
  - Each NFT card shows decoded metadata (milestone name, amount, tx links)
  - Explorer link for each NFT token ID
- Shows donation status: "Funding milestones... 1/3... 2/3... 3/3 done!"

### SignerPanel.jsx (Andrew)
- Shows a **dropdown or tabs to select which milestone** to vote on
- For the selected milestone: 3 committee member cards: **"NGO Rep"**, **"Donor Rep"**, **"Community Auditor"**
- Each card has an **"Approve"** button (toggles on/off)
- Quorum tracker per milestone: shows X/3 approvals, highlights when 2-of-3 reached
- When quorum reached for a milestone -> calls `finishEscrow()` with **that milestone's** fulfillment
- Shows summary: which milestones are approved, which are pending, which are released
- Approval state is `useState` only — not on-chain, just app logic

### MilestoneBoard.jsx (Tianqi)
- Reads initial definitions from `src/data/milestones.js`, gets runtime state via props
- Shows milestone cards with: title, description, XRP amount, status badge, approval count
- Statuses: **Pending** (gray), **Funded** (blue), **Approved** (yellow), **Released** (green)
- Each card shows its escrow sequence number and condition hash (truncated) once funded
- Visual pipeline: milestones arranged as a progress flow, so you can see the overall state at a glance

### FundDashboard.jsx (Angelina)
- Live fund account balance
- Active escrows list — one row per milestone escrow (amount, condition hash, status)
- Recent transaction history with testnet explorer links
- Overall progress: "2 of 3 milestones released, 175 of 225 XRP disbursed"
- Auto-refreshes when new transactions happen

### App.jsx (Tianqi)
- Imports all panels
- Tab bar: Donor | Committee | Milestones | Dashboard
- Manages which tab is active (useState)
- **Owns the milestone state array** — enriched with escrow data, approval votes, status
- Passes milestone state + updater functions down to all panels
- Header with app name + tagline

---

## Data Shapes

### milestones.js (Andrew)

This is the static definition. Runtime state is managed in App.jsx.

```js
export const MILESTONES = [
  {
    id: 1,
    title: "Purchase Water Filters",
    description: "Buy 500 portable water filters for rural communities",
    xrpAmount: 100,
  },
  {
    id: 2,
    title: "Distribution & Logistics",
    description: "Transport filters to 10 villages in the target region",
    xrpAmount: 75,
  },
  {
    id: 3,
    title: "Training Program",
    description: "Train local volunteers on filter maintenance",
    xrpAmount: 50,
  },
];
```

### Runtime milestone state (managed in App.jsx by Tianqi)

Each milestone gets enriched at runtime with escrow + voting data:

```js
// Shape of a milestone in React state after escrows are created
{
  ...MILESTONES[i],
  status: "pending",        // pending | funded | approved | released
  escrowSequence: null,     // set after EscrowCreate
  condition: null,          // hex string
  fulfillment: null,        // hex string (secret — revealed on quorum)
  approvals: {              // per-milestone voting
    ngoRep: false,
    donorRep: false,
    communityAuditor: false,
  },
}
```

**Status transitions:**
- `pending` → `funded`: after EscrowCreate succeeds for this milestone
- `funded` → `approved`: after 2-of-3 approvals received (app state)
- `approved` → `released`: after EscrowFinish succeeds (on-chain)

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

### Multi-milestone donation flow (how the pieces connect):
```jsx
// In DonorPanel: when donor clicks "Fund All Milestones"
const handleFundAll = async (milestones, fundWallet, beneficiary) => {
  // 1. Send total XRP to fund account
  await sendPayment({ wallet: donorWallet, destination: fundWallet.address, amount: totalXRP });

  // 2. Create one escrow per milestone
  for (const milestone of milestones) {
    const { condition, fulfillment } = await generateCondition(); // Angelina's function
    const { sequence } = await createEscrow({                     // Paing's function
      fromWallet: fundWallet,
      destination: beneficiary,
      amount: milestone.xrpAmount,
      condition,
    });
    // 3. Update milestone state with escrow data
    updateMilestone(milestone.id, {
      status: "funded",
      escrowSequence: sequence,
      condition,
      fulfillment, // stored in state — revealed when quorum hits
    });
  }

  // 4. Mint donation receipt NFT
  await mintNFT({ wallet: fundWallet, uri: "...", memo: "donation-receipt" });
};
```

### How to stub (until helpers are ready):
```jsx
const handleFundAll = async () => {
  setLoading(true);
  try {
    for (const m of milestones) {
      console.log("Creating escrow for milestone", m.id, m.xrpAmount, "XRP");
      await new Promise(r => setTimeout(r, 500)); // fake delay
    }
  } finally {
    setLoading(false);
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

1. **"Here's the problem"** — show a real NGO scandal headline (misused funds, no accountability)
2. **Switch to app** — show the dashboard, explain: 3 milestones, 225 XRP total, all pending
3. **Donor funds all milestones** — click "Fund All Milestones", watch 3 escrows get created. Proof-of-Donation NFT appears in donor's portfolio.
4. **Show testnet explorer** — 3 separate EscrowCreate txs, each with its own condition hash. Funds locked.
5. **Milestone 1 vote** — switch to Committee tab, select Milestone 1, NGO Rep + Donor Rep approve (2-of-3)
6. **EscrowFinish #1 fires** — Milestone 1 goes green, 100 XRP released
7. **Proof-of-Impact NFT** — appears in donor's portfolio. Click it — shows milestone name, amount, escrow tx hash, release tx hash. Every claim verifiable on-chain.
8. **Show the pipeline** — Milestone 1 released, Milestones 2 & 3 still locked. Partial release visible on-chain.
9. **"This is the donor's impact portfolio"** — they collect one NFT per milestone. Not a jpeg — a cryptographic proof of where their money went.
10. **Closing** — "Every milestone traceable, every disbursement voted on, every receipt on-chain"

---

## Coordination Rules

1. **Only edit files you own** (see project structure above)
2. **Pull before push** — always `git pull --rebase` first
3. **Commit often** — small commits, clear messages
4. **Talk before touching shared state** — if you need to change how data flows between components, discuss first
5. **Saturday morning = integration time** — that's when we wire everything together
6. **If something breaks, say it out loud** — we're sitting together, use that
