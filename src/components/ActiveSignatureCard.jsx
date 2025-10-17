// src/components/ActiveSignatureCard.jsx
import React from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { ProfileABI } from '../abi/Profile';
import { PROFILE, ARWEAVE_ORIGIN } from '../config/constants';
import { importKeyRaw, decryptBytes, hashKeccak } from '../services/crypto';

function b64ToBytes(b64){
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i=0;i<bin.length;i++) out[i] = bin.charCodeAt(i);
  return out;
}
function isPng(bytes) {
  if (!bytes || bytes.length < 8) return false;
  const sig = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
  for (let i = 0; i < 8; i++) if (bytes[i] !== sig[i]) return false;
  return true;
}

export default function ActiveSignatureCard(){
  const { address } = useAccount();
  const { data, refetch } = useReadContract({
    abi: ProfileABI,
    address: PROFILE,
    functionName: 'getActiveSignatureVersion',
    args: address ? [address] : undefined,
    query: { enabled: !!address }
  });

  const arTxId = data?.[0];
  const contentHash = data?.[1];
  const createdAt = data?.[2];
  const isActive = data?.[3];

  const onDownload = async ()=>{
    if (!arTxId) return alert('No active signature');
    try{
      const url = `${ARWEAVE_ORIGIN}/${arTxId}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('Failed to fetch from gateway');
      const ct = new Uint8Array(await resp.arrayBuffer());

      const onchain = String(contentHash).toLowerCase();
      const got = String(hashKeccak(ct)).toLowerCase();
      if (onchain !== got) {
        console.warn('Integrity mismatch', { onchain, got });
      }

      let pt = null;
      if (isPng(ct)) {
        pt = ct;
      } else {
        const keyB64 = localStorage.getItem('sig_key');
        const nonceB64 = localStorage.getItem('sig_nonce');
        if (!keyB64 || !nonceB64) throw new Error('Missing local key/nonce (encrypted asset)');
        const key = await importKeyRaw(b64ToBytes(keyB64));
        const nonce = b64ToBytes(nonceB64);
        pt = await decryptBytes(key, ct, nonce);
      }

      const blob = new Blob([pt], { type: 'image/png' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `signature_active.png`;
      document.body.appendChild(a); a.click(); a.remove();
    }catch(e){
      alert(e.message || 'Failed to download/decrypt');
    }
  };

  return (
    <div className="card">
      <div className="row" style={{justifyContent:'space-between'}}>
        <h3>Active Signature</h3>
        <div className="row" style={{gap:8}}>
          <button onClick={()=>refetch?.()}>Refresh</button>
          <button className="primary" onClick={onDownload}>Download</button>
        </div>
      </div>
      {!address && <div className="small">Connect wallet to view</div>}
      {address && !isActive && <div className="small">No active signature yet</div>}
      {isActive && (
        <>
          <div>Arweave TX: {arTxId}</div>
          <div className="small">saved: {new Date(Number(createdAt)*1000).toLocaleString()}</div>
        </>
      )}
    </div>
  );
}
