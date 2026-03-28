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

**Flow:**
```
Donor donates XRP --> Fund Account
     |
Fund Account --> EscrowCreate (crypto-condition = SHA256(secret)) --> locked
     |
NFT receipt minted to donor
     |
Committee members click "approve" in SignerPanel (2-of-3 in app state)
     |
Quorum reached --> app reveals fulfillment --> EscrowFinish submitted
     |
Funds released to beneficiary + proof-of-disbursement NFT minted
```

**Key design decision:** Escrow gating uses crypto-conditions (NOT on-chain multisig). The 2-of-3 approval logic lives in the app as React state. When quorum is hit, the app submits EscrowFinish with the stored fulfillment. Simple, demoable, works.

**No backend.** Everything runs in the browser. Wallet seeds are testnet-only (no real money). State resets on refresh — that's fine for a 3-minute demo.

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
- Input field: XRP amount to donate
- "Donate" button -> calls `sendPayment()` then `createEscrow()` from xrpl helpers
- Shows donor wallet balance (live)
- Lists NFT receipts received (token IDs with testnet explorer links)
- Shows donation history

### SignerPanel.jsx (Andrew)
- 3 committee member cards: **"NGO Rep"**, **"Donor Rep"**, **"Community Auditor"**
- Each card has an **"Approve"** button (toggles on/off)
- Quorum tracker: shows X/3 approvals, highlights when 2-of-3 reached
- When quorum reached -> calls `finishEscrow()` with the stored fulfillment
- Approval state is `useState` only — not on-chain, just app logic

### MilestoneBoard.jsx (Tianqi)
- Reads from `src/data/milestones.js`
- Shows milestone cards with: title, description, XRP amount, status badge
- Statuses: **Pending** (gray), **Funded** (blue), **Approved** (yellow), **Released** (green)
- Status updates based on escrow/approval state passed down as props

### FundDashboard.jsx (Angelina)
- Live fund account balance
- Active escrows list (amount, condition hash, status)
- Recent transaction history with testnet explorer links
- Progress bars for milestone funding
- Auto-refreshes when new transactions happen

### App.jsx (Tianqi)
- Imports all panels
- Tab bar: Donor | Committee | Milestones | Dashboard
- Manages which tab is active (useState)
- Passes shared state down (wallet addresses, escrow data, approval state)
- This is where the app-level state lives (milestones, approvals, escrow records)
- Header with app name + tagline

---

## Data Shapes

### milestones.js (Andrew)
```js
export const milestones = [
  {
    id: 1,
    title: "Purchase Water Filters",
    description: "Buy 500 portable water filters for rural communities",
    xrpAmount: 100,
    status: "pending", // pending | funded | approved | released
  },
  {
    id: 2,
    title: "Distribution & Logistics",
    description: "Transport filters to 10 villages in the target region",
    xrpAmount: 75,
    status: "pending",
  },
  {
    id: 3,
    title: "Training Program",
    description: "Train local volunteers on filter maintenance",
    xrpAmount: 50,
    status: "pending",
  },
];
```

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

### How to stub (until Paing's code is ready):
```jsx
const handleDonate = async () => {
  setLoading(true);
  try {
    // TODO: replace with real XRPL call
    console.log("Donating", amount, "XRP");
    await new Promise(r => setTimeout(r, 1000)); // fake delay
    // const result = await createEscrow(...)
  } finally {
    setLoading(false);
  }
};
```

---

## Technical Gotchas (everyone should know)

1. **No backend.** All transactions happen in-browser via xrpl.js -> XRPL testnet WebSocket. Wallet seeds are in the frontend. This is fine for testnet demos.
2. **Crypto-conditions:** SHA-256 preimage/fulfillment pairs generated with Web Crypto API (browser-native). NOT the `five-bells-condition` npm package (that's Node-only).
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
2. **Switch to app** — show the clean dashboard, explain the 4 panels
3. **Donor donates 100 XRP** — click donate, show tx confirmation, NFT receipt appears
4. **Show testnet explorer** — the EscrowCreate tx is right there, funds locked
5. **Committee approves** — NGO Rep clicks approve, Donor Rep clicks approve (2 of 3)
6. **EscrowFinish fires** — beneficiary balance increases, second NFT minted
7. **"Anyone can audit this"** — open testnet explorer, show the full tx chain
8. **Closing** — "Every dollar traceable, every disbursement approved, every receipt on-chain"

---

## Coordination Rules

1. **Only edit files you own** (see project structure above)
2. **Pull before push** — always `git pull --rebase` first
3. **Commit often** — small commits, clear messages
4. **Talk before touching shared state** — if you need to change how data flows between components, discuss first
5. **Saturday morning = integration time** — that's when we wire everything together
6. **If something breaks, say it out loud** — we're sitting together, use that
