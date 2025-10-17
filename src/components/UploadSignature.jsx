// src/components/UploadSignature.jsx
import React from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { ProfileABI } from '../abi/Profile';
import { PROFILE, ARWEAVE_ORIGIN } from '../config/constants';

import { uploadToArweave } from '../services/arweave_classic';
import SignaturePad from './SignaturePad';
import Toast from './Toast';
import {
  generateKey,
  exportKeyRaw,
  encryptBytes,
  randomNonce,
  hashKeccak,
} from '../services/crypto';

function dataUrlToUint8(dataUrl) {
  const base64 = dataUrl.split(',')[1];
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function arrBufToU8(ab) { return ab instanceof Uint8Array ? ab : new Uint8Array(ab); }
function u8ToB64(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
}

async function devAutoMineIfLocal() {
  // If you still need local mining, compare ARWEAVE_ORIGIN rather than host/port
  try {
    if (ARWEAVE_ORIGIN === 'http://localhost:1984') {
      await fetch(`${ARWEAVE_ORIGIN}/mine`);
    }
  } catch {}
}

export default function UploadSignature() {
  const { address } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();

  const [msg, setMsg] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [txId, setTxId] = React.useState('');
  const [dlUrl, setDlUrl] = React.useState('');
  const [activate, setActivate] = React.useState(true);

  // Public vs encrypted
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

      // 2) Encrypt or use plaintext
      let storedBytes = plainU8;
      if (!makePublic) {
        const key = await generateKey();
        const rawKey = arrBufToU8(await exportKeyRaw(key));
        localStorage.setItem('sig_key', u8ToB64(rawKey));
        const nonce = randomNonce(); // 12 bytes
        localStorage.setItem('sig_nonce', u8ToB64(nonce));
        storedBytes = await encryptBytes(key, plainU8, nonce);
      }

      // 3) Upload to Arweave
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

      // 4) Save version on Profile
      const contentHash = hashKeccak(storedBytes);
      await writeContractAsync({
        abi: ProfileABI,
        address: PROFILE,
        functionName: 'saveSignatureVersion',
        args: [arTxId, contentHash, activate],
      });

      // 5) If public, offer direct download
      if (makePublic) {
        const blob = new Blob([plainU8], { type: 'image/png' });
        const url = URL.createObjectURL(blob);
        setDlUrl(url);
      }

      setMsg(makePublic
        ? 'Signature uploaded (public) and version saved on Profile.'
        : 'Signature uploaded (encrypted) and version saved on Profile.');
    } catch (err) {
      console.error(err);
      setMsg(err?.shortMessage || err?.message || 'Failed to upload signature');
    } finally {
      setBusy(false);
    }
  };

  const gatewayUrl = txId ? `${ARWEAVE_ORIGIN}/${txId}` : '';

  return (
    <div className="card">
      <h3>Upload / Update Signature</h3>
      <p className="small">
        Choose public if creator/beneficiary should see the image; choose encrypted if only this device should decrypt later.
      </p>

      <div className="row" style={{ gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
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
        <label className="small">
          <input
            type="checkbox"
            checked={activate}
            onChange={(e) => setActivate(e.target.checked)}
            disabled={busy || isPending}
            style={{ marginRight: 6 }}
          />
          Activate this version after upload
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
