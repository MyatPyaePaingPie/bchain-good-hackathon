// Testnet wallets — generated from faucet, seeds in .env
// Each wallet starts with 100 XRP on testnet

export const WALLETS = {
  donor: {
    address: import.meta.env.VITE_DONOR_ADDRESS,
    seed: import.meta.env.VITE_DONOR_SEED,
  },
  fund: {
    address: import.meta.env.VITE_FUND_ADDRESS,
    seed: import.meta.env.VITE_FUND_SEED,
  },
  beneficiary: {
    address: import.meta.env.VITE_BENEFICIARY_ADDRESS,
    seed: import.meta.env.VITE_BENEFICIARY_SEED,
  },
  reserve: {
    address: import.meta.env.VITE_RESERVE_ADDRESS,
    seed: import.meta.env.VITE_RESERVE_SEED,
  },
};
