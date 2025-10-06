import React from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { PetitionCoreABI } from '../abi/PetitionCore';
import { PETITION_CORE } from '../config/constants';

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

export default function UploadSignature() {
  const { address } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();

  const [msg, setMsg] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [txId, setTxId] = React.useState('');
  const [dlUrl, setDlUrl] = React.useState('');

  // New: toggle for public (plaintext) storage so beneficiary can view
  const [makePublic, setMakePublic] = React.useState(true);

  const handleBytes = async (inputFromPad) => {
    setMsg('');
    setTxId('');
    setDlUrl('');
    setBusy(true);
    try {
      if (!address) throw new Error('Connect your wallet first');

      // 1) Normalize PNG bytes
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

      // 2) Encrypt or use plaintext based on toggle
      let storedBytes = plainU8;
      let encScheme = 0; // 0 = plaintext/public
      let nonce = new Uint8Array(0);

      if (!makePublic) {
        // AES-GCM encryption (only signer device can decrypt)
        const key = await generateKey();
        const rawKey = arrBufToU8(await exportKeyRaw(key));
        localStorage.setItem('sig_key', u8ToB64(rawKey));
        nonce = randomNonce(); // 12 bytes
        localStorage.setItem('sig_nonce', u8ToB64(nonce));
        storedBytes = await encryptBytes(key, plainU8, nonce);
        encScheme = 1; // AES-GCM
      }

      // 3) Upload to Arweave (use content-type image/png for public)
      const tags = makePublic
        ? [
            { name: 'Content-Type', value: 'image/png' },
            { name: 'App-Name', value: 'Petition.io' },
            { name: 'App-Version', value: '1.0.0' },
          ]
        : [
            { name: 'Content-Type', value: 'application/octet-stream' },
            { name: 'X-Enc', value: 'aes-256-gcm' },
            { name: 'App-Name', value: 'Petition.io' },
            { name: 'App-Version', value: '1.0.0' },
          ];

      const arTxId = await uploadToArweave(storedBytes, tags);
      setTxId(arTxId);

      await devAutoMineIfLocal();

      // 4) Save snapshot on-chain
 // keccak256 already returns a 0x-prefixed 32-byte hex string – use directly
      const contentHashBytes32 = hashKeccak(storedBytes);

      const arIdBytes32 = txIdToBytes32(arTxId);
            // If public, use zero bytes32; if encrypted, pad the 12-byte nonce to 32 bytes
      const nonceBytes32 = makePublic
        ? '0x0000000000000000000000000000000000000000000000000000000000000000'
        : toHex(nonce, { size: 32 });
      await writeContractAsync({
        abi: PetitionCoreABI,
        address: PETITION_CORE,
        functionName: 'updateSignature',
        args: [arIdBytes32, contentHashBytes32, encScheme, nonceBytes32],
      });

      // 5) If public, offer direct download of plaintext PNG
      if (makePublic) {
        const blob = new Blob([plainU8], { type: 'image/png' });
        const url = URL.createObjectURL(blob);
        setDlUrl(url);
      } else {
        // If encrypted, also show local decrypt result for user verification
        const keyB64 = localStorage.getItem('sig_key');
        const nonceB64 = localStorage.getItem('sig_nonce');
        if (keyB64 && nonceB64) {
          // No-op demo: proof of decrypt works
        }
      }

      setMsg(makePublic
        ? 'Signature uploaded (public) and pointer saved on-chain.'
        : 'Signature uploaded (encrypted) and pointer saved on-chain.');
    } catch (err) {
      console.error(err);
      setMsg(err?.shortMessage || err?.message || 'Failed to upload signature');
    } finally {
      setBusy(false);
    }
  };

  const gatewayUrl = txId
    ? `${import.meta.env.VITE_ARWEAVE_GATEWAY_PROTO || 'https'}://${import.meta.env.VITE_ARWEAVE_GATEWAY_HOST || 'ar-io.net'}${import.meta.env.VITE_ARWEAVE_GATEWAY_PORT ? `:${import.meta.env.VITE_ARWEAVE_GATEWAY_PORT}` : ''}/${txId}`
    : '';

  return (
    <div className="card">
      <h3>Upload / Update Signature</h3>
      <p className="small">
        Choose public if creator/beneficiary should see the image; choose encrypted if only this device should decrypt later. 
      </p>

      <div className="row" style={{ gap: 12, marginBottom: 10 }}>
        <label className="small">
          <input
            type="checkbox"
            checked={makePublic}
            onChange={(e) => setMakePublic(e.target.checked)}
            disabled={busy || isPending}
            style={{ marginRight: 6 }}
          />
          Make signature public to beneficiary (plaintext)
        </label>
      </div>

      <SignaturePad onSave={handleBytes} disabled={busy || isPending} />

      <div style={{ marginTop: 10, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {txId && (
          <a className="button" href={gatewayUrl} target="_blank" rel="noreferrer">
            Open at Gateway
          </a>
        )}
        {dlUrl && (
          <a className="button primary" href={dlUrl} download="signature.png">
            Download PNG
          </a>
        )}
      </div>

      <Toast msg={busy ? 'Processing… confirm wallet popups' : msg} onClose={() => setMsg('')} />
    </div>
  );
}
