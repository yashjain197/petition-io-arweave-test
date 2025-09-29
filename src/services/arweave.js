// src/services/arweave.js
// Irys Web Uploader (browser) + Ethers v6 adapter + Devnet (Sepolia).
// ✓ uses withRpc(<sepolia RPC>) + devnet()
// ✓ auto-funds using BigInt
// ✓ uploads a Buffer (no stream error)

import { WebUploader } from '@irys/web-upload';
import { WebEthereum } from '@irys/web-upload-ethereum';
import { EthersV6Adapter } from '@irys/web-upload-ethereum-ethers-v6';
import { BrowserProvider } from 'ethers';

// IMPORTANT: keep this in src/main.jsx
//   import { Buffer } from 'buffer';
//   if (!window.Buffer) window.Buffer = Buffer;
//   if (!window.global) window.global = window;

const SEPOLIA_RPC = import.meta.env.VITE_RPC_URL; // your Sepolia RPC URL

function toBig(x) {
  if (typeof x === 'bigint') return x;
  if (typeof x === 'number') return BigInt(Math.floor(x));
  if (typeof x === 'string') return BigInt(x);
  if (x && typeof x.toString === 'function') return BigInt(x.toString());
  throw new Error('Cannot convert value to BigInt');
}

async function getUploader() {
  if (!window?.ethereum) throw new Error('No wallet provider (window.ethereum) found');
  if (!SEPOLIA_RPC) throw new Error('Missing VITE_RPC_URL (Sepolia) in .env.local');

  // ensure wallet connected
  await window.ethereum.request?.({ method: 'eth_requestAccounts' });

  // wrap EIP-1193 -> ethers v6
  const provider = new BrowserProvider(window.ethereum);

  // build uploader
  let uploader = await WebUploader(WebEthereum).withAdapter(EthersV6Adapter(provider));

  // point to Sepolia for Devnet and then switch to Devnet
  if (typeof uploader.withRpc === 'function') {
    uploader = uploader.withRpc(SEPOLIA_RPC);
  }
  if (typeof uploader.devnet === 'function') {
    uploader = uploader.devnet();
  }

  if (typeof uploader.ready === 'function') await uploader.ready();

  // helpful debug (you can remove later)
  try {
    const bal = await uploader.getBalance();
    console.debug('[IRYS] devnet balance (atomic):', bal?.toString?.() ?? String(bal));
  } catch (e) {
    console.debug('[IRYS] getBalance error (ok on first run):', e?.message || e);
  }

  return uploader;
}

// auto-fund Devnet node balance (MetaMask popup on Sepolia)
async function ensureFunds(irys, byteLen) {
  const price = toBig(await irys.getPrice(byteLen));  // atomic units (string/BigInt)
  const bal   = toBig(await irys.getBalance());       // atomic units

  if (bal >= price) return;

  const deficit = price - bal;
  const buffer  = deficit / 10n;      // +10% buffer
  const need    = deficit + buffer;

  // fund() accepts string/number; this triggers a Sepolia tx on devnet
  await irys.fund(need.toString());
}

export async function getIrys() {
  return getUploader();
}

// Accepts Uint8Array / ArrayBuffer / Blob / dataURL
export async function uploadBytes(irys, input, tags = []) {
  if (!irys) throw new Error('Irys client not initialized');

  // normalize to ArrayBuffer
  let ab;
  if (input instanceof ArrayBuffer) ab = input;
  else if (input instanceof Uint8Array) ab = input.buffer;
  else if (input instanceof Blob) ab = await input.arrayBuffer();
  else if (typeof input === 'string' && input.startsWith('data:')) {
    const base64 = input.split(',')[1];
    const bin = atob(base64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    ab = out.buffer;
  } else {
    throw new Error('Unsupported input type for upload');
  }

  const buf = window.Buffer.from(new Uint8Array(ab));

  // fund if needed (opens MetaMask on Sepolia)
  await ensureFunds(irys, buf.byteLength);

  // store ciphertext; serve as octet-stream so gateway doesn’t try to preview gibberish
  const hasCT = tags.some(t => (t.name || '').toLowerCase() === 'content-type');
  const finalTags = hasCT ? tags : [...tags, { name: 'Content-Type', value: 'application/octet-stream' }];

  const receipt = await irys.upload(buf, { tags: finalTags });
  return receipt.id; // Arweave txId
}
