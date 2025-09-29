import React from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { PetitionCoreABI } from '../abi/PetitionCore';
import { PETITION_CORE } from '../config/constants';
import { bytes32ToTxId } from '../utils/arweaveId';
import { importKeyRaw, decryptBytes, hashKeccak } from '../services/crypto';

function b64ToBytes(b64){
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i=0;i<bin.length;i++) out[i] = bin.charCodeAt(i);
  return out;
}

export default function ActiveSignatureCard(){
  const { address } = useAccount();
  const { data, refetch } = useReadContract({
    abi: PetitionCoreABI,
    address: PETITION_CORE,
    functionName: 'getActiveSignature',
    args: address ? [address] : undefined,
    query: { enabled: !!address }
  });

  const versionId = data?.[0];
  const version = data?.[1];

  const onDownload = async ()=>{
    if (!versionId) return alert('No active signature');
    try{
      const txId = bytes32ToTxId(version.arTxId);
      const url = `https://arweave.net/${txId}`;
      const resp = await fetch(url);
      const ct = new Uint8Array(await resp.arrayBuffer());

      // Verify hash matches on-chain snapshot
      const onchain = String(version.contentHash).toLowerCase();
      const got = String(hashKeccak(ct)).toLowerCase();
      if (onchain !== got) {
        console.warn('Integrity mismatch', { onchain, got });
      }

      const keyB64 = localStorage.getItem('sig_key');
      const nonceB64 = localStorage.getItem('sig_nonce');
      if (!keyB64 || !nonceB64) throw new Error('Missing local key/nonce (demo storage)');
      const key = await importKeyRaw(b64ToBytes(keyB64));
      const nonce = b64ToBytes(nonceB64);

      const pt = await decryptBytes(key, ct, nonce);
      const blob = new Blob([pt], { type: 'image/png' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `signature_${versionId}.png`;
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
          <button className="primary" onClick={onDownload}>Decrypt & Download</button>
        </div>
      </div>
      {!address && <div className="small">Connect wallet to view</div>}
      {address && !versionId && <div className="small">No active signature yet</div>}
      {versionId && (
        <>
          <div>ID: {String(versionId)}</div>
          <div className="small">encScheme: {version.encScheme} • saved: {new Date(Number(version.createdAt)*1000).toLocaleString()}</div>
          <div className="small">Arweave tx (bytes32): {version.arTxId}</div>
        </>
      )}
    </div>
  );
}
