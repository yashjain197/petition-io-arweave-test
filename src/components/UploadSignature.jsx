// src/components/UploadSignature.jsx
import React from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { PetitionCoreABI } from '../abi/PetitionCore';
import { PETITION_CORE } from '../config/constants';

// Use the ArLocal/Wander uploader (ArConnect API)
import { uploadToArweave } from '../services/arweave_classic';

import {
  generateKey,
  exportKeyRaw,
  encryptBytes,
  decryptBytes,
  randomNonce,
  hashKeccak,
} from '../services/crypto';

import { txIdToBytes32 } from '../utils/arweaveId';
import { toHex } from 'viem';
import SignaturePad from './SignaturePad';
import Toast from './Toast';

/* ---------------- helpers ---------------- */

function dataUrlToUint8(dataUrl) {
  const base64 = dataUrl.split(',')[1];
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function arrBufToU8(ab) {
  return ab instanceof Uint8Array ? ab : new Uint8Array(ab);
}

function u8ToB64(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
}

// Strict bytes32 encoder: accepts Uint8Array(32) or 0x + 64 hex
function toBytes32(value) {
  if (value instanceof Uint8Array) {
    if (value.length !== 32) throw new Error(`Expected 32 bytes, got ${value.length}`);
    let hex = '0x';
    for (let i = 0; i < value.length; i++) hex += value[i].toString(16).padStart(2, '0');
    return hex;
  }
  if (typeof value === 'string' && value.startsWith('0x')) {
    if (value.length !== 66) throw new Error(`Expected 0x + 64 hex chars, got length ${value.length}`);
    return value.toLowerCase();
  }
  throw new Error('Invalid value for bytes32');
}

// Dev-helper: auto-mine ArLocal so the tx is immediately confirmed
async function devAutoMineIfLocal() {
  const host = import.meta.env.VITE_ARWEAVE_GATEWAY_HOST;
  const port = import.meta.env.VITE_ARWEAVE_GATEWAY_PORT;
  const proto = import.meta.env.VITE_ARWEAVE_GATEWAY_PROTO;
  const isLocal = host === 'localhost' && String(port) === '1984' && proto === 'http';
  if (!isLocal) return;
  try {
    await fetch(`${proto}://${host}:${port}/mine`);
  } catch {}
}

/* --------------- component ---------------- */

export default function UploadSignature() {
  const { address } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();

  const [msg, setMsg] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [txId, setTxId] = React.useState('');
  const [dlUrl, setDlUrl] = React.useState('');

  const handleBytes = async (inputFromPad) => {
    setMsg('');
    setTxId('');
    setDlUrl('');
    setBusy(true);
    try {
      if (!address) throw new Error('Connect your wallet first');

      // 1) Normalize canvas data → Uint8Array (PNG)
      let plainU8;
      if (typeof inputFromPad === 'string' && inputFromPad.startsWith('data:')) {
        plainU8 = dataUrlToUint8(inputFromPad);
      } else if (inputFromPad instanceof Uint8Array) {
        plainU8 = inputFromPad;
      } else if (inputFromPad instanceof ArrayBuffer) {
        plainU8 = new Uint8Array(inputFromPad);
      } else if (inputFromPad instanceof Blob) {
        plainU8 = new Uint8Array(await inputFromPad.arrayBuffer());
      } else {
        throw new Error('Unsupported signature input type');
      }

      // 2) Encrypt locally (AES-GCM)
      const key = await generateKey();
      const rawKey = arrBufToU8(await exportKeyRaw(key));
      localStorage.setItem('sig_key', u8ToB64(rawKey)); // demo storage
      const nonce = randomNonce(); // 12 bytes for GCM
      localStorage.setItem('sig_nonce', u8ToB64(nonce));

      const ciphertext = await encryptBytes(key, plainU8, nonce);

      // 3) Upload ciphertext to ArLocal via Wander/ArConnect (NO METAMASK HERE)
      const arTxId = await uploadToArweave(ciphertext, [
        { name: 'X-Enc', value: 'aes-256-gcm' },
        { name: 'App-Name', value: 'Petition.io' },
        { name: 'App-Version', value: '1.0.0' },
      ]);
      setTxId(arTxId);

      // Confirm immediately on ArLocal
      await devAutoMineIfLocal();

      // 4) Save pointer + integrity on Ethereum (MetaMask will pop here)
      //    - contentHash: bytes32
      //    - arTxId:      bytes32 (base64url-decoded)
      //    - nonce:       bytes32 (left-pad 12 → 32)
      const contentHash = hashKeccak(ciphertext);          // Uint8Array(32)
      const contentHashBytes32 = toBytes32(contentHash);   // 0x + 64 hex
      const arIdBytes32 = txIdToBytes32(arTxId);           // 0x + 64 hex (strict 32 bytes)
      const nonceBytes32 = toHex(nonce, { size: 32 });     // pad to 32 bytes

      await writeContractAsync({
        abi: PetitionCoreABI,
        address: PETITION_CORE,
        functionName: 'updateSignature',
        args: [arIdBytes32, contentHashBytes32, 1, nonceBytes32],
      });

      // 5) Decrypt locally for human-readable download
      const decrypted = await decryptBytes(key, ciphertext, nonce);
      const blob = new Blob([decrypted], { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      setDlUrl(url);

      setMsg('Signature uploaded to ArLocal and pointer saved on-chain.');
    } catch (err) {
      console.error(err);
      setMsg(err?.shortMessage || err?.message || 'Failed to upload signature');
    } finally {
      setBusy(false);
    }
  };

  // Build gateway URL from env (local or remote)
  const gatewayUrl = txId
    ? `${import.meta.env.VITE_ARWEAVE_GATEWAY_PROTO || 'http'}://${import.meta.env.VITE_ARWEAVE_GATEWAY_HOST || 'localhost'}${import.meta.env.VITE_ARWEAVE_GATEWAY_PORT ? `:${import.meta.env.VITE_ARWEAVE_GATEWAY_PORT}` : ''}/${txId}`
    : '';

  return (
    <div className="card">
      <h3>Upload / Update Signature</h3>
      <p className="small">
        We encrypt your signature locally, upload it to ArLocal via Wander, then save the pointer on Ethereum (Sepolia).
      </p>

      <SignaturePad onSave={handleBytes} disabled={busy || isPending} />

      <div style={{ marginTop: 10, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {txId && (
          <a className="button" href={gatewayUrl} target="_blank" rel="noreferrer">
            Open at Gateway (encrypted)
          </a>
        )}
        {dlUrl && (
          <a className="button primary" href={dlUrl} download="signature.png">
            Download decrypted PNG
          </a>
        )}
      </div>

      <Toast msg={busy ? 'Processing… confirm Wander/MetaMask popups' : msg} onClose={() => setMsg('')} />
    </div>
  );
}
