# Blockchain for Social Good

## Milestone Escrow for Nonprofit Funding

This project aims to demonstrate a transparent funding platform that helps donors and nonprofit organizations manage grant disbursements through milestone-based escrow on the **XRP Ledger** (XRPL). 

Instead of releasing the full amount upfront, funds are locked and released in stages as project milestones are completed and approved, improving accountability, reducing misuse, and giving donors clear visibility into how funds move.

## Setup

### Prerequisites

Before running the app, make sure you have:

- Node.js 20+ installed
- npm installed
- Internet access, since the app connects to the XRPL Testnet
- XRPL Testnet wallet credentials set in a `.env` file (see below)

### Environment Variables

Create a `.env` file in the project root with the following variables:

```env
VITE_DONOR_SEED=...
VITE_DONOR_ADDRESS=...

VITE_FUND_SEED=...
VITE_FUND_ADDRESS=...

VITE_BENEFICIARY_SEED=...
VITE_BENEFICIARY_ADDRESS=...

VITE_RESERVE_SEED=...
VITE_RESERVE_ADDRESS=...
```

###  Install Dependencies
```bash
npm install
```

### Run the App
Start the development server:
```bash
npm run dev
```

Then open the local URL shown in the terminal, example:
```bash
http://localhost:5173
```

<!-- # React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project. -->
