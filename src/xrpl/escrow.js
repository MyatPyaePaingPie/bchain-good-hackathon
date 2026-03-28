import { Wallet } from "xrpl";
import { getClient } from "./client.js";

const RIPPLE_EPOCH_OFFSET = 946684800;

/**
 * Create a conditional escrow.
 *
 * @param {Object} opts
 * @param {Object} opts.fromWallet - { address, seed } of the funding account
 * @param {string} opts.destination - destination address (beneficiary)
 * @param {number|string} opts.amount - XRP amount (not drops)
 * @param {string} opts.condition - hex-encoded crypto-condition
 * @param {number} opts.cancelAfterDays - days until escrow can be cancelled (default 30)
 * @returns {{ result, sequence }} - tx result and escrow sequence number
 */
export async function createEscrow({
  fromWallet,
  destination,
  amount,
  condition,
  cancelAfterDays = 30,
}) {
  const c = await getClient();
  const wallet = Wallet.fromSeed(fromWallet.seed);

  // CancelAfter: Ripple epoch timestamp
  const cancelAfter =
    Math.floor(Date.now() / 1000) -
    RIPPLE_EPOCH_OFFSET +
    cancelAfterDays * 24 * 60 * 60;

  const prepared = await c.autofill({
    TransactionType: "EscrowCreate",
    Account: wallet.address,
    Destination: destination,
    Amount: String(Math.floor(Number(amount) * 1_000_000)), // XRP to drops
    Condition: condition,
    CancelAfter: cancelAfter,
  });

  const signed = wallet.sign(prepared);
  const result = await c.submitAndWait(signed.tx_blob);

  // The escrow sequence is the Sequence from the creating transaction
  const sequence = prepared.Sequence;

  return { result, sequence };
}

/**
 * Finish (release) a conditional escrow.
 *
 * @param {Object} opts
 * @param {string} opts.ownerAddress - address that created the escrow
 * @param {number} opts.escrowSequence - sequence number of the EscrowCreate tx
 * @param {string} opts.condition - hex-encoded condition
 * @param {string} opts.fulfillment - hex-encoded fulfillment (the preimage proof)
 * @param {Object} opts.wallet - { address, seed } of whoever submits the finish
 * @returns tx result
 */
export async function finishEscrow({
  ownerAddress,
  escrowSequence,
  condition,
  fulfillment,
  wallet,
}) {
  const c = await getClient();
  const signerWallet = Wallet.fromSeed(wallet.seed);

  // EscrowFinish fee is higher for conditional escrows:
  // 330 drops + 10 drops per 16 bytes of fulfillment
  const fulfillmentBytes = fulfillment.length / 2; // hex string -> byte count
  const extraFee = 330 + Math.ceil(fulfillmentBytes / 16) * 10;

  const prepared = await c.autofill({
    TransactionType: "EscrowFinish",
    Account: signerWallet.address,
    Owner: ownerAddress,
    OfferSequence: escrowSequence,
    Condition: condition,
    Fulfillment: fulfillment,
    Fee: String(extraFee),
  });

  const signed = signerWallet.sign(prepared);
  const result = await c.submitAndWait(signed.tx_blob);
  return result;
}
