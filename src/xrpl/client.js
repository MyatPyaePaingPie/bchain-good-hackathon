import { Client } from "xrpl";

const TESTNET_URL = "wss://s.altnet.rippletest.net:51233";

let client = null;

/**
 * Get a connected XRPL testnet client. Reuses existing connection if alive.
 */
export async function getClient() {
  if (client && client.isConnected()) return client;
  client = new Client(TESTNET_URL);
  await client.connect();
  return client;
}

/**
 * Disconnect the client. Call on app unmount.
 */
export async function disconnect() {
  if (client && client.isConnected()) {
    await client.disconnect();
    client = null;
  }
}

/**
 * Get XRP balance for an address.
 * Returns string like "99.999988" (human-readable XRP, not drops).
 */
export async function getBalance(address) {
  const c = await getClient();
  const response = await c.request({
    command: "account_info",
    account: address,
    ledger_index: "validated",
  });
  // Balance is in drops (1 XRP = 1,000,000 drops)
  const drops = response.result.account_data.Balance;
  return (Number(drops) / 1_000_000).toString();
}

/**
 * Get recent transactions for an address.
 */
export async function getAccountTx(address, limit = 20) {
  const c = await getClient();
  const response = await c.request({
    command: "account_tx",
    account: address,
    limit,
    ledger_index_min: -1,
    ledger_index_max: -1,
  });
  return response.result.transactions;
}

/**
 * Get all escrow objects where this address is the source.
 */
export async function getAccountEscrows(address) {
  const c = await getClient();
  const response = await c.request({
    command: "account_objects",
    account: address,
    type: "escrow",
    ledger_index: "validated",
  });
  return response.result.account_objects;
}

/**
 * Send a simple XRP payment.
 * amount is in XRP (e.g. "100"), not drops.
 */
export async function sendPayment({ wallet, destination, amount }) {
  const c = await getClient();
  const { Wallet } = await import("xrpl");
  const senderWallet = Wallet.fromSeed(wallet.seed);

  const prepared = await c.autofill({
    TransactionType: "Payment",
    Account: senderWallet.address,
    Destination: destination,
    Amount: String(Number(amount) * 1_000_000), // XRP to drops
  });

  const signed = senderWallet.sign(prepared);
  const result = await c.submitAndWait(signed.tx_blob);
  return result;
}
