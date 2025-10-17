// src/components/ContributeCampaign.jsx
import React from 'react';
import { useAccount, usePublicClient, useReadContract, useWriteContract } from 'wagmi';
import { PetitionCoreABI } from '../abi/PetitionCore';
import { ProfileABI } from '../abi/Profile';
import { PETITION_CORE, PROFILE, NETWORK, ARWEAVE_GATEWAY_HOST, ARWEAVE_GATEWAY_PORT, ARWEAVE_GATEWAY_PROTO, ARWEAVE_ORIGIN } from '../config/constants';
import { parseEther, formatEther, parseEventLogs } from 'viem';
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
  for (let i=0;i<bin.length;i++) out[i] = bin.charCodeAt(i);
  return out;
}

export default function ContributeCampaign({ campaignId }) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();

  const [amountEth, setAmountEth] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState('');

  // Fee estimates
  const { data: fee15 } = useReadContract({
    abi: PetitionCoreABI,
    address: PETITION_CORE,
    functionName: '_calculateSignatureFee',
    args: [15n],
  });
  const { data: fee30 } = useReadContract({
    abi: PetitionCoreABI,
    address: PETITION_CORE,
    functionName: '_calculateSignatureFee',
    args: [30n],
  });

  async function alreadySigned() {
    if (!address) return false;
    try {
      const found = await publicClient.readContract({
        abi: PetitionCoreABI,
        address: PETITION_CORE,
        functionName: 'hasUserSigned',
        args: [BigInt(campaignId), address],
      });
      return Boolean(found);
    } catch {
      return false;
    }
  }

  async function hasActiveSignature() {
    if (!address) return false;
    try {
      const res = await publicClient.readContract({
        abi: ProfileABI,
        address: PROFILE,
        functionName: 'getActiveSignatureVersion',
        args: [address],
      });
      return Boolean(res && res[3]); // isActive
    } catch {
      return false;
    }
  }

  const onContribute = async () => {
    setMsg('');
    try {
      if (!address) throw new Error('Connect wallet first');
      setBusy(true);

      const amountWei = parseEther((amountEth || '0').toString());
      if (amountWei <= 0n) throw new Error('Enter a positive contribution amount');

      const signed = await alreadySigned();
      if (!signed) {
        const okActive = await hasActiveSignature();
        if (!okActive) throw new Error('No active signature found. Please upload/activate a signature first.');
      }

      const feeWei = signed ? 0n : (fee30 && fee15 ? (fee30 > fee15 ? fee30 : fee15) : 0n);

      const hash = await writeContractAsync({
        abi: PetitionCoreABI,
        address: PETITION_CORE,
        functionName: 'contributeETH',
        args: [BigInt(campaignId)],
        value: amountWei + feeWei,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      // Detect auto-sign by SignatureAddedLight
      let autoSigned = false;
      try {
        const logs = parseEventLogs({
          abi: PetitionCoreABI,
          logs: receipt.logs,
          eventName: 'SignatureAddedLight',
        });
        autoSigned = logs.some(l => String(l.args.signer).toLowerCase() === String(address).toLowerCase());
      } catch {}

      // UX
      const feeNote = !signed ? ` (included est. fee ≈ ${feeWei ? formatEther(feeWei) : '0'} ETH)` : '';
      setMsg(`Contributed successfully${autoSigned ? ' and auto-signed' : ''}.${feeNote}`);
      setAmountEth('');

      if (autoSigned) {
        // Use active signature pointer from Profile
        const [arTxId, contentHash] = await publicClient.readContract({
          abi: ProfileABI,
          address: PROFILE,
          functionName: 'getActiveSignatureVersion',
          args: [address],
        });

        // Campaign info for PDF
        const c = await publicClient.readContract({
          abi: PetitionCoreABI,
          address: PETITION_CORE,
          functionName: 'getCampaignInfo',
          args: [BigInt(campaignId)],
        });

        // Fetch signature bytes
        const url = `${ARWEAVE_ORIGIN}/${arTxId}`;
        let raw = null;
        try {
          const resp = await fetch(url);
          if (resp.ok) raw = new Uint8Array(await resp.arrayBuffer());
        } catch {}

        let pngBytes = null;
        if (raw && String(hashKeccak(raw)).toLowerCase() === String(contentHash).toLowerCase()) {
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
              }
            } catch {}
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
          signatureVersionId: String(Number(Date.now() / 1000)), // no version id on-chain; use timestamp marker
          arweaveTxId: arTxId,
          signaturePngBytes: pngBytes,
          generatedAt: new Date(),
        });
        downloadPdfBytes(pdfBytes, `petition_${campaignId}_signature.pdf`);
      }
    } catch (e) {
      setMsg(e?.shortMessage || e?.message || 'Contribution failed');
    } finally {
      setBusy(false);
    }
  };

  const est15Eth = fee15 ? formatEther(fee15) : '…';
  const est30Eth = fee30 ? formatEther(fee30) : '…';

  return (
    <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
      <input
        className="input"
        placeholder="Amount (ETH)"
        value={amountEth}
        onChange={(e) => setAmountEth(e.target.value)}
        disabled={busy || isPending}
        style={{ maxWidth: 200 }}
      />
      <button className="primary" onClick={onContribute} disabled={busy || isPending}>
        {busy ? 'Contributing…' : 'Contribute'}
      </button>
      <div className="small">
        Auto-sign if needed; estimates: 15¢ ≈ {est15Eth} ETH, 30¢ ≈ {est30Eth} ETH
      </div>
      {msg && <div className="small">{msg}</div>}
    </div>
  );
}
