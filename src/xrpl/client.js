import { Client } from "xrpl";

const TESTNET_URLS = [
  "wss://s.altnet.rippletest.net:51233",
  "wss://testnet.xrpl-labs.com",
];
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

let client = null;
let connecting = null;

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Get a connected XRPL testnet client. Retries across multiple servers.
 * Auto-reconnects on drop. Multiple concurrent callers share the same promise.
 */
export async function getClient() {
  if (client && client.isConnected()) return client;
  if (connecting) return connecting;

  connecting = (async () => {
    if (client) {
      try { client.removeAllListeners(); } catch {}
      client = null;
    }

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const url = TESTNET_URLS[attempt % TESTNET_URLS.length];
      try {
        client = new Client(url);
        await client.connect();

        client.on("disconnected", () => {
          console.warn("XRPL WebSocket disconnected — will reconnect on next request");
          client = null;
        });

        connecting = null;
        return client;
      } catch (err) {
        console.warn(`XRPL connect attempt ${attempt + 1}/${MAX_RETRIES} failed (${url}):`, err.message);
        if (client) { try { client.removeAllListeners(); } catch {} }
        client = null;
        if (attempt < MAX_RETRIES - 1) await sleep(RETRY_DELAY);
      }
    }

    connecting = null;
    throw new Error("Failed to connect to XRPL testnet after " + MAX_RETRIES + " attempts");
  })();

  return connecting;
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

  const result = await Promise.race([
    c.submitAndWait(signed.tx_blob),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Payment timed out after 30s")), 30000)
    ),
  ]);
  return result;
}
