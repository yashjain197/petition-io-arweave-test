// src/services/arweave_classic.js
// Public: single-prompt wallet.dispatch({ data, tags }) with strict normalization.
// Local (ArLocal): wallet.sign(tx) + post() to local node.

import Arweave from 'arweave';
import { ARWEAVE_ORIGIN } from '../config/constants';

const AR_HOST = import.meta.env.VITE_ARWEAVE_GATEWAY_HOST || 'localhost';
const AR_PORT = Number(import.meta.env.VITE_ARWEAVE_GATEWAY_PORT || 1984);
const AR_PROTOCOL = import.meta.env.VITE_ARWEAVE_GATEWAY_PROTO || 'http';

const localClient = Arweave.init({ host: AR_HOST, port: AR_PORT, protocol: AR_PROTOCOL });

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

function normalizeTags(tags) {
  const arr = Array.isArray(tags) ? tags : [];
  const norm = arr
    .map((t) => ({
      name: typeof t?.name === 'string' ? t.name : '',
      value: typeof t?.value === 'string' ? t.value : '',
    }))
    .filter((t) => t.name && t.value);
  const hasCT = norm.some((t) => t.name.toLowerCase() === 'content-type');
  if (!hasCT) norm.unshift({ name: 'Content-Type', value: 'application/octet-stream' });
  return norm;
}

const isLocal = () => ARWEAVE_ORIGIN === 'http://localhost:1984';

/**
 * Upload bytes to Arweave.
 * - Public: dispatch raw bytes and normalized tags (no Transaction pre-create, one prompt).
 * - Local: sign+post a Transaction to ArLocal.
 *
 * @param {Uint8Array|ArrayBuffer|string(dataURL)} bytes
 * @param {Array<{name:string,value:string}>} tags
 * @returns {Promise<string>} txId
 */
export async function uploadToArweave(bytes, tags = []) {
  if (!window.arweaveWallet) throw new Error('ArConnect/Wander not detected. Install and unlock the wallet.');

  const data = toUint8(bytes);
  if (!(data instanceof Uint8Array) || data.length === 0) {
    throw new Error('Upload data must be a non-empty Uint8Array');
  }
  const finalTags = normalizeTags(tags);

  // PUBLIC NETWORK: dispatch only
  if (!isLocal()) {
    // Request only DISPATCH to minimize prompts
    await window.arweaveWallet.connect(['DISPATCH']);
    const res = await window.arweaveWallet.dispatch({ data, tags: finalTags });
    if (!res || !res.id) throw new Error('Wallet dispatch failed: missing transaction id');
    return res.id;
  }

  // LOCAL DEV (ArLocal): sign + post
  let tx = await localClient.createTransaction({ data });
  for (const t of finalTags) tx.addTag(t.name, t.value);

  await window.arweaveWallet.connect(['ACCESS_ADDRESS', 'SIGN_TRANSACTION']);
  const signed = await window.arweaveWallet.sign(tx);
  if (signed && signed.id && signed.signature) tx = signed;

  const res = await localClient.transactions.post(tx);
  if (res.status !== 200 && res.status !== 202) {
    throw new Error(`Arweave post failed: HTTP ${res.status}`);
  }
  return tx.id;
}
