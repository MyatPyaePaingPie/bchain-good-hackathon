/**
 * Crypto-conditions for XRPL escrows — PREIMAGE-SHA-256 via Web Crypto API.
 *
 * Do NOT import five-bells-condition — it is Node-only and breaks in the browser.
 *
 * EscrowFinish fee note (for escrow.js / Paing):
 *   fulfillment = 36 bytes → fee = 330 + 10 * ceil(36/16) = 330 + 30 = 360 drops
 */

function toHex(uint8Array) {
    return Array.from(uint8Array)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  }
  
  /**
   * Generate a PREIMAGE-SHA-256 crypto-condition using a random 32-byte preimage.
   *
   * DER encoding layout (32-byte preimage):
   *   Fulfillment (36 bytes): A0 22  80 20  {preimage[32]}
   *   Condition   (39 bytes): A0 25  80 20  {sha256(preimage)[32]}  81 01 20
   *
   * @returns {{ preimage: string, fulfillment: string, condition: string }}
   *   All three values are uppercase hex strings.
   *   - preimage    : raw secret — store this, reveal only at EscrowFinish time
   *   - fulfillment : submit as Fulfillment in EscrowFinish
   *   - condition   : submit as Condition in EscrowCreate
   */
  export async function generateCondition() {
    // 1. Random 32-byte preimage
    const preimage = crypto.getRandomValues(new Uint8Array(32));
  
    // 2. SHA-256 hash of the preimage (used in the condition)
    const hashBuffer = await crypto.subtle.digest('SHA-256', preimage);
    const hash = new Uint8Array(hashBuffer);
  
    // 3. Build Fulfillment: A0 22 80 20 {preimage}
    const fulfillmentBytes = new Uint8Array(36);
    fulfillmentBytes[0] = 0xa0; // PREIMAGE-SHA-256 context-constructed tag
    fulfillmentBytes[1] = 0x22; // inner length = 34
    fulfillmentBytes[2] = 0x80; // context-primitive tag for preimage field
    fulfillmentBytes[3] = 0x20; // preimage length = 32
    fulfillmentBytes.set(preimage, 4);
  
    // 4. Build Condition: A0 25 80 20 {hash} 81 01 20
    //    cost = preimage length = 32 = 0x20 (1 byte)
    const conditionBytes = new Uint8Array(39);
    conditionBytes[0] = 0xa0; // same type tag
    conditionBytes[1] = 0x25; // inner length = 37
    conditionBytes[2] = 0x80; // fingerprint field tag
    conditionBytes[3] = 0x20; // hash length = 32
    conditionBytes.set(hash, 4);
    conditionBytes[36] = 0x81; // cost field tag
    conditionBytes[37] = 0x01; // cost field length = 1
    conditionBytes[38] = 0x20; // cost value = 32
  
    return {
      preimage: toHex(preimage),
      fulfillment: toHex(fulfillmentBytes),
      condition: toHex(conditionBytes),
    };
  }
  