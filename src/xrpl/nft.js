/**
 * NFT helpers — Proof-of-Donation + Proof-of-Impact minting and account_nfts queries.
 *
 * Two NFT types (see PLAN.md "Proof-of-Impact NFTs"):
 *   mintDonationNFT  — minted when donor funds all milestones
 *   mintImpactNFT    — minted per milestone when its escrow is released
 *
 * Both encode a JSON metadata object as the hex URI field so anyone can
 * read the NFT on-chain, decode the URI, and verify every claim against the ledger.
 */

import { Wallet } from 'xrpl';
import { getClient } from './client.js';

// ── Encoding helpers ──────────────────────────────────────────────────────────

function toHex(str) {
  return Array.from(new TextEncoder().encode(str))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

/**
 * Decode a hex-encoded NFT URI back to a UTF-8 string.
 * @param {string} hexUri
 * @returns {string}
 */
export function decodeNFTUri(hexUri) {
  const bytes = Uint8Array.from(
    hexUri.match(/.{2}/g),
    (b) => parseInt(b, 16)
  );
  return new TextDecoder().decode(bytes);
}

// ── Low-level mint helper ─────────────────────────────────────────────────────

/**
 * Mint a single NFT with a plain string URI and optional memo.
 * wallet accepts { address, seed } — same shape as WALLETS in wallets.js.
 *
 * @param {{ wallet: { address: string, seed: string }, uri: string, memo: string }} params
 * @returns {string} NFT token ID
 */
async function mintNFT({ wallet, uri, memo }) {
  const client = await getClient();
  const signerWallet = Wallet.fromSeed(wallet.seed);

  const tx = {
    TransactionType: 'NFTokenMint',
    Account: signerWallet.address,
    NFTokenTaxon: 0,  // required by XRPL protocol
    Flags: 8,         // tfTransferable
  };

  // URI must be 1-256 bytes; omit when not provided
  if (uri) {
    tx.URI = toHex(uri);
  }

  // MemoData must be a non-empty hex string — omit the Memos array entirely
  // when memo is falsy to avoid temMALFORMED (empty MemoData is invalid)
  if (memo) {
    tx.Memos = [{ Memo: { MemoData: toHex(memo) } }];
  }

  // ── DEBUG — remove before production ────────────────────────────────────────
  console.log('[mintNFT] tx before autofill:', JSON.stringify(tx, null, 2));
  if (tx.URI) {
    const uriBytes = tx.URI.length / 2; // each byte = 2 hex chars
    console.log(`[mintNFT] URI hex length: ${tx.URI.length} chars = ${uriBytes} bytes (limit 256)`);
    if (uriBytes > 256) console.error('[mintNFT] ❌ URI exceeds 256-byte limit!');
  }
  // ─────────────────────────────────────────────────────────────────────────────

  try {
    const prepared = await client.autofill(tx);
    console.log('[mintNFT] prepared tx:', JSON.stringify(prepared, null, 2));
    const signed = signerWallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    // Prefer the direct field available in newer rippled versions
    const tokenId = result.result.meta?.nftoken_id;
    if (tokenId) return tokenId;

    // Fallback: scan AffectedNodes for the NFTokenPage entry
    const nodes = result.result.meta?.AffectedNodes ?? [];
    for (const node of nodes) {
      const created = node.CreatedNode;
      if (created?.LedgerEntryType === 'NFTokenPage') {
        const nfts = created.NewFields?.NFTokens ?? [];
        if (nfts.length > 0) return nfts[nfts.length - 1].NFToken.NFTokenID;
      }
      const modified = node.ModifiedNode;
      if (modified?.LedgerEntryType === 'NFTokenPage') {
        const finalNfts = modified.FinalFields?.NFTokens ?? [];
        const prevNfts = modified.PreviousFields?.NFTokens ?? [];
        if (finalNfts.length > prevNfts.length) {
          return finalNfts[finalNfts.length - 1].NFToken.NFTokenID;
        }
      }
    }

    throw new Error('NFT minted but token ID not found in transaction metadata');
  } catch (err) {
    throw new Error('NFT mint failed: ' + err.message);
  }
}

// ── Public minting functions ──────────────────────────────────────────────────

/**
 * Mint a Proof-of-Donation NFT.
 * Called once after the donor funds all milestone escrows.
 *
 * Metadata encoded in URI:
 *   { type, donor, totalXRP, milestones, timestamp, fund }
 *
 * @param {{
 *   wallet:         { address: string, seed: string },  // fund wallet (the minter)
 *   donor:          string,   // donor's XRPL address
 *   totalXRP:       number,   // total XRP donated across all milestones
 *   milestoneCount: number,   // number of escrows created (e.g. 3)
 * }} params
 * @returns {string} NFT token ID
 */
export async function mintDonationNFT({ wallet, donor, donorName, totalXRP, milestoneCount }) {
  const metadata = {
    type: 'proof-of-donation',
    donor,
    donorName,
    totalXRP,
    milestones: milestoneCount,
    timestamp: new Date().toISOString(),
    fund: wallet.address,
  };

  return mintNFT({
    wallet,
    uri: JSON.stringify(metadata),
    memo: 'proof-of-donation',
  });
}

/**
 * Mint a Proof-of-Impact NFT.
 * Called once per milestone after its EscrowFinish succeeds.
 *
 * Metadata encoded in URI:
 *   { type, milestone, milestoneId, xrpAmount, beneficiary,
 *     escrowTxHash, releaseTxHash, approvedBy, timestamp }
 *
 * @param {{
 *   wallet:         { address: string, seed: string },  // fund wallet (the minter)
 *   milestone:      { id: number, title: string },      // milestone definition
 *   xrpAmount:      number,   // XRP amount released
 *   beneficiary:    string,   // beneficiary's XRPL address
 *   escrowTxHash:   string,   // tx hash of the original EscrowCreate
 *   releaseTxHash:  string,   // tx hash of the EscrowFinish
 *   approvedBy:     string[], // committee member names who approved, e.g. ["NGO Rep", "Donor Rep"]
 * }} params
 * @returns {string} NFT token ID
 */
export async function mintImpactNFT({
  wallet,
  milestone,
  xrpAmount,
  beneficiary,
  escrowTxHash,
  releaseTxHash,
  approvedBy,
}) {
  // XRPL URI field is capped at 256 bytes (decoded).
  // Two tx hashes alone = 128 chars, plus a 34-char address = 162 chars before
  // any field names or JSON syntax. Use short keys to stay comfortably under
  // the limit. Full details are always recoverable from the tx hashes on-chain.
  //
  // Compact schema:
  //   t   = type ("poi" = proof-of-impact)
  //   mid = milestone ID
  //   xrp = XRP amount released
  //   to  = beneficiary address
  //   esc = EscrowCreate tx hash
  //   rel = EscrowFinish tx hash
  //
  // Worst-case size estimate: ~216 bytes (well under 256)
  const metadata = {
    t: 'poi',
    mid: milestone.id,
    mt: milestone.title,
    xrp: xrpAmount,
    to: beneficiary,
    esc: escrowTxHash,
    rel: releaseTxHash,
  };

  return mintNFT({
    wallet,
    uri: JSON.stringify(metadata),
    memo: 'proof-of-impact',
  });
}

// ── Query ─────────────────────────────────────────────────────────────────────

/**
 * Fetch all NFTs for an account and decode their URIs back to JSON metadata.
 *
 * Each returned object extends the raw XRPL NFToken with a `metadata` field:
 *   - If the URI decodes to valid JSON → metadata is the parsed object
 *   - If the URI is a plain string   → metadata is that string
 *   - If there is no URI             → metadata is null
 *
 * @param {string} address
 * @returns {Array<object>} NFToken objects with decoded metadata
 */
export async function getAccountNFTs(address) {
  const client = await getClient();

  try {
    const response = await client.request({
      command: 'account_nfts',
      account: address,
      ledger_index: 'validated',
    });

    return response.result.account_nfts.map((nft) => {
      if (!nft.URI) return { ...nft, metadata: null };

      try {
        const uriStr = decodeNFTUri(nft.URI);
        try {
          return { ...nft, metadata: JSON.parse(uriStr) };
        } catch {
          // Valid hex but not JSON — return the raw decoded string
          return { ...nft, metadata: uriStr };
        }
      } catch {
        // Couldn't decode hex — return null metadata
        return { ...nft, metadata: null };
      }
    });
  } catch (err) {
    // Account not found on ledger (no activity yet) → treat as empty
    if (err.data?.error === 'actNotFound' || err.message?.includes('actNotFound')) {
      return [];
    }
    throw err;
  }
}
