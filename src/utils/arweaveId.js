// Conversions between Arweave base64url txId and bytes32
import { hexToBytes, toHex } from 'viem';

// base64url -> Uint8Array
function base64UrlToBytes(b64url) {
  let s = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4;
  if (pad) s += '='.repeat(4 - pad);
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Uint8Array -> base64url
function bytesToBase64Url(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

// export function txIdToBytes32(txId) {
//   const bytes = base64UrlToBytes(txId);
//   const slice = bytes.subarray(0, 32); // Arweave txId → 32 bytes
//   return toHex(slice); // 0x-prefixed
// }

export function bytes32ToTxId(b32) {
  const bytes = hexToBytes(b32);
  return bytesToBase64Url(bytes);
}


function b64urlToBytes(b64url) {
  // Arweave uses base64url (no padding)
  let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '='; // pad
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function txIdToBytes32(txId) {
  const bytes = b64urlToBytes(txId);
  if (bytes.length !== 32) {
    throw new Error(`Arweave txId decoded to ${bytes.length} bytes, expected 32`);
  }
  // to 0x + 64 hex
  let hex = '0x';
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');
  return hex;
}