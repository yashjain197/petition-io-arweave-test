// src/components/SignCampaign.jsx
import React from 'react';
import { useAccount, useWriteContract, usePublicClient } from 'wagmi';
import { PetitionCoreABI } from '../abi/PetitionCore';
import { ProfileABI } from '../abi/Profile';
import { PETITION_CORE, PROFILE, NETWORK, ARWEAVE_ORIGIN } from '../config/constants';
import { parseEventLogs } from 'viem';
import { importKeyRaw, decryptBytes, hashKeccak } from '../services/crypto';
import { buildSignedPetitionPDF, downloadPdfBytes } from '../services/pdf';

function isPng(bytes) {
  if (!bytes || bytes.length < 8) return false;
  const sig = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
  for (let i = 0; i < 8; i++) if (bytes[i] !== sig[i]) return false;
  return true;
}
function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export default function SignCampaign({ campaignId }) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [message, setMessage] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [feeWei, setFeeWei] = React.useState(0n);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const f = await publicClient.readContract({
          abi: PetitionCoreABI,
          address: PETITION_CORE,
          functionName: '_calculateSignatureFee',
          args: [30n],
        });
        if (mounted) setFeeWei(f);
      } catch {}
    })();
    return () => { mounted = false; };
  }, [publicClient]);

  const onSign = async () => {
    try {
      setBusy(true);

      const hash = await writeContractAsync({
        abi: PetitionCoreABI,
        address: PETITION_CORE,
        functionName: 'signPetition',
        args: [BigInt(campaignId), message],
        value: feeWei ?? 0n,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      const logs = parseEventLogs({
        abi: PetitionCoreABI,
        logs: receipt.logs,
        eventName: 'SignatureAddedLight',
      });
      const hasEv = logs.some(l => String(l.args.signer).toLowerCase() === String(address).toLowerCase());
      if (!hasEv) console.warn('SignatureAddedLight event not found for this signer');

      const c = await publicClient.readContract({
        abi: PetitionCoreABI,
        address: PETITION_CORE,
        functionName: 'getCampaignInfo',
        args: [BigInt(campaignId)],
      });

      const [arTxId, contentHash] = await publicClient.readContract({
        abi: ProfileABI,
        address: PROFILE,
        functionName: 'getActiveSignatureVersion',
        args: [address],
      });

      const url = `${ARWEAVE_ORIGIN}/${arTxId}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('Failed to fetch signature from gateway');
      const raw = new Uint8Array(await resp.arrayBuffer());

      const onchain = String(contentHash).toLowerCase();
      const got = String(hashKeccak(raw)).toLowerCase();
      if (onchain !== got) console.warn('Integrity mismatch with on-chain snapshot', { onchain, got });

      let pngBytes = null;
      if (isPng(raw)) {
        pngBytes = raw;
      } else {
        try {
          const keyB64 = localStorage.getItem('sig_key');
          const nonceB64 = localStorage.getItem('sig_nonce');
          if (keyB64 && nonceB64) {
            const key = await importKeyRaw(b64ToBytes(keyB64));
            const nonce = b64ToBytes(nonceB64);
            pngBytes = await decryptBytes(key, raw, nonce);
          } else {
            console.warn('Encrypted signature but no local key/nonce present');
          }
        } catch (e) {
          console.warn('Decrypt failed, continuing without image', e);
        }
      }

      const pdfBytes = await buildSignedPetitionPDF({
        network: NETWORK || 'sepolia',
        signerAddress: address,
        campaign: {
          id: String(c.id),
          title: c.title,
          description: c.description,
          beneficiary: c.beneficiary,
          targetAmount: String(c.targetAmount),
        },
        txHash: hash,
        signatureVersionId: String(Number(Date.now() / 1000)),
        arweaveTxId: arTxId,
        signaturePngBytes: pngBytes,
        generatedAt: new Date(),
      });
      downloadPdfBytes(pdfBytes, `petition_${campaignId}_signature.pdf`);

      setMessage('');
      alert('Signed and PDF prepared.');
    } catch (e) {
      console.error(e);
      alert(e?.shortMessage || e?.message || 'Sign flow encountered a non-critical error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="row" style={{ marginTop: 8 }}>
      <input
        className="input"
        placeholder="Optional message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        disabled={busy}
      />
      <button className="primary" onClick={onSign} disabled={busy}>
        {busy ? 'Signing…' : 'Sign'}
      </button>
    </div>
  );
}
