// src/services/arweave_classic.js
// Robust ArConnect/Wander path for ArLocal: try dispatch() first, else sign()+post().
// Works with http://localhost:1984 (ArLocal) and Wander “Custom” gateway.

import Arweave from 'arweave';

const AR_HOST = import.meta.env.VITE_ARWEAVE_GATEWAY_HOST || 'localhost';
const AR_PORT = Number(import.meta.env.VITE_ARWEAVE_GATEWAY_PORT || 1984);
const AR_PROTOCOL = import.meta.env.VITE_ARWEAVE_GATEWAY_PROTO || 'http';

const arweave = Arweave.init({
  host: AR_HOST,
  port: AR_PORT,
  protocol: AR_PROTOCOL,
});

function toUint8(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (typeof input === 'string' && input.startsWith('data:')) {
    const base64 = input.split(',')[1];
    const bin = atob(base64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  throw new Error('Unsupported input type for Arweave upload');
}

/**
 * Upload bytes to Arweave via Wander/ArConnect (ArLocal).
 * - Requests DISPATCH + SIGN_TRANSACTION perms.
 * - Prefers wallet.dispatch(tx) (signs & posts).
 * - Fallback: wallet.sign(tx) then POST the (possibly returned) signed tx.
 *
 * @param {Uint8Array|ArrayBuffer|string(dataURL)} bytes
 * @param {Array<{name:string,value:string}>} tags
 * @returns {Promise<string>} txId
 */
export async function uploadToArweave(bytes, tags = []) {
  if (!window.arweaveWallet) {
    throw new Error('ArConnect/Wander not detected. Install and unlock the wallet.');
  }

  // Ask for the right permissions (include DISPATCH for the one-shot flow)
  await window.arweaveWallet.connect([
    'ACCESS_ADDRESS',
    'SIGN_TRANSACTION',
    'DISPATCH',
  ]);

  const u8 = toUint8(bytes);
  let tx = await arweave.createTransaction({ data: u8 });

  // sensible default: encrypted binary
  if (!tags.some(t => (t.name || '').toLowerCase() === 'content-type')) {
    tx.addTag('Content-Type', 'application/octet-stream');
  }
  for (const t of tags) tx.addTag(t.name, t.value);

  // --- Path 1: dispatch() (signs + posts) ---
  if (typeof window.arweaveWallet.dispatch === 'function') {
    try {
      const res = await window.arweaveWallet.dispatch(tx);
      // Most wallets return { id, type }. If not, fall through to sign+post.
      if (res && res.id) return res.id;
      // If we got here with no id, continue to fallback path
    } catch (e) {
      // Some wallet builds may not support dispatch on custom gateways — fallback
      console.debug('dispatch() failed, falling back to sign()+post():', e?.message || e);
    }
  }

  // --- Path 2: sign() + post() ---
  // Some wallets return a NEW signed tx; others mutate in place.
  let signed = null;
  try {
    signed = await window.arweaveWallet.sign(tx);
  } catch (e) {
    // If sign() throws, surface a clear error
    throw new Error(`Wallet refused to sign: ${e?.message || e}`);
  }

  // If the wallet returned a new tx object, prefer it.
  if (signed && signed.id && signed.signature) {
    tx = signed;
  } else {
    // If it mutated in place, ensure signature exists now.
    if (!tx.signature || tx.signature.length === 0) {
      throw new Error('Wallet did not sign the transaction (signature missing)');
    }
  }

  // Post to ArLocal
  const res = await arweave.transactions.post(tx);
  if (res.status !== 200 && res.status !== 202) {
    throw new Error(`Arweave post failed: HTTP ${res.status}`);
  }

  return tx.id;
}
