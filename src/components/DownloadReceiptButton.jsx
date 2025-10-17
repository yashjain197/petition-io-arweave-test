// src/components/DownloadReceiptButton.jsx
// Updated to use Profile active signature and scan for SignatureAddedLight tx hash.
import React from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { PetitionCoreABI } from '../abi/PetitionCore';
import { ProfileABI } from '../abi/Profile';
import { PETITION_CORE, PROFILE, NETWORK, PETITION_CORE_DEPLOY_BLOCK, ARWEAVE_GATEWAY_HOST, ARWEAVE_GATEWAY_PORT, ARWEAVE_GATEWAY_PROTO, ARWEAVE_ORIGIN } from '../config/constants';
import { importKeyRaw, decryptBytes, hashKeccak } from '../services/crypto';
import { buildSignedPetitionPDF, downloadPdfBytes } from '../services/pdf';
import { parseAbiItem } from 'viem';

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

const signatureAddedLightEvent = parseAbiItem(
  'event SignatureAddedLight(uint256 indexed campaignId, address indexed signer, string message)'
);

export default function DownloadReceiptButton({ campaignId }) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [busy, setBusy] = React.useState(false);

  async function findSignatureTxHash({ campaignId, signer }) {
    const latest = await publicClient.getBlockNumber();
    const from = PETITION_CORE_DEPLOY_BLOCK || 0n;
    const step = 1000n; // increase for fewer RPC calls
    for (let start = latest > step ? latest - step : 0n; start >= from; ) {
      const end = start + step > latest ? latest : start + step;
      const logs = await publicClient.getLogs({
        address: PETITION_CORE,
        event: signatureAddedLightEvent,
        args: { campaignId: BigInt(campaignId), signer },
        fromBlock: start,
        toBlock: end,
      });
      if (logs.length) return logs[logs.length - 1].transactionHash;
      if (start === 0n || start <= from) break;
      start = start - step;
    }
    return null;
  }

  const onDownload = async () => {
    try {
      if (!address) throw new Error('Connect wallet first');
      setBusy(true);

      // Ensure user has signed
      const hasSigned = await publicClient.readContract({
        abi: PetitionCoreABI,
        address: PETITION_CORE,
        functionName: 'hasUserSigned',
        args: [BigInt(campaignId), address],
      });
      if (!hasSigned) throw new Error('No signature found for this campaign');

      // Campaign info
      const c = await publicClient.readContract({
        abi: PetitionCoreABI,
        address: PETITION_CORE,
        functionName: 'getCampaignInfo',
        args: [BigInt(campaignId)],
      });

      // Locate tx hash via event scan
      let ethTxHash = await findSignatureTxHash({ campaignId, signer: address });
      if (!ethTxHash) console.warn('Event tx hash not found in scanned range');

      // Active signature pointer (best-effort snapshot)
      const [arTxId, contentHash] = await publicClient.readContract({
        abi: ProfileABI,
        address: PROFILE,
        functionName: 'getActiveSignatureVersion',
        args: [address],
      });

      // Download signature bytes
      const resp = await fetch(`${ARWEAVE_ORIGIN}/${arTxId}`); // replace previous construction
      if (!resp.ok) throw new Error('Failed to fetch signature');
      const ct = new Uint8Array(await resp.arrayBuffer());

      // Verify integrity
      const onchainHash = String(contentHash).toLowerCase();
      const computed = String(hashKeccak(ct)).toLowerCase();
      if (onchainHash !== computed) console.warn('Integrity mismatch', { onchainHash, computed });

      // Decrypt if needed
      let png = null;
      if (isPng(ct)) {
        png = ct;
      } else {
        try {
          const keyB64 = localStorage.getItem('sig_key');
          const nonceB64 = localStorage.getItem('sig_nonce');
          if (keyB64 && nonceB64) {
            const key = await importKeyRaw(b64ToBytes(keyB64));
            const nonce = b64ToBytes(nonceB64);
            png = await decryptBytes(key, ct, nonce);
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
        txHash: ethTxHash || '(not found in scanned range)',
        signatureVersionId: String(Number(Date.now() / 1000)),
        arweaveTxId: arTxId,
        signaturePngBytes: png,
        generatedAt: new Date(),
      });
      downloadPdfBytes(pdfBytes, `petition_${campaignId}_signature.pdf`);
    } catch (e) {
      alert(e?.message || 'Failed to download receipt');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button onClick={onDownload} disabled={busy}>
      {busy ? 'Preparing…' : 'Download receipt'}
    </button>
  );
}
