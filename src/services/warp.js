// src/services/warp.js
// Minimal Warp (SmartWeave) write to mirror a saved signature pointer on-chain (Arweave).
// You need a Warp registry contract deployed; set its ID in VITE_WARP_REGISTRY_ID.

import { WarpFactory } from 'warp-contracts';
import Arweave from 'arweave';

const REGISTRY_ID = import.meta.env.VITE_WARP_REGISTRY_ID || ''; // set if you have it

const arweave = Arweave.init({
  host: 'ar-io.net',
  port: 443,
  protocol: 'https',
});

const warp = WarpFactory.forMainnet({ arweave });

/**
 * Mirrors a signature pointer/version to a Warp contract.
 * The registry contract should accept an input like:
 * { function: "saveSig", user, arTxId, contentHash, encScheme, nonceHex, activated }
 */
export async function mirrorSignatureToWarp({ user, arTxId, contentHashHex, encScheme, nonceHex, activated }) {
  if (!REGISTRY_ID) return; // silently no-op if not configured
  if (!window.arweaveWallet) throw new Error('ArConnect not detected');

  await window.arweaveWallet.connect(['ACCESS_ADDRESS', 'SIGN_TRANSACTION']);

  const contract = warp.contract(REGISTRY_ID).connect('use_wallet'); // ArConnect signer
  const input = {
    function: 'saveSig',
    user,
    arTxId,
    contentHash: contentHashHex, // 0x...
    encScheme,                   // e.g. 1 for AES-GCM
    nonceHex,                    // 0x...
    activated,                   // boolean
  };
  const res = await contract.writeInteraction(input, { strict: true });
  // Optionally inspect res.originalTxId / res.sortKey
  return res;
}
