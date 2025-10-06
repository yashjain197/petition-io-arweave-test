import React from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { PetitionCoreABI } from '../abi/PetitionCore';
import { PETITION_CORE, NETWORK, PETITION_CORE_DEPLOY_BLOCK } from '../config/constants';
import { bytes32ToTxId } from '../utils/arweaveId';
import { importKeyRaw, decryptBytes, hashKeccak } from '../services/crypto';
import { buildSignedPetitionPDF, downloadPdfBytes } from '../services/pdf';
import { parseAbiItem } from 'viem';

// PNG magic check
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

const signatureAddedEvent = parseAbiItem(
  'event SignatureAdded(uint256 indexed campaignId, uint256 indexed signatureId, address indexed signer, string message, uint256 signatureVersionId, bytes32 signedArTxId, bytes32 signedContentHash)'
);

export default function DownloadReceiptButton({ campaignId }) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [busy, setBusy] = React.useState(false);

  // Narrow-range log scan to satisfy providers with small block window limits
  async function findSignatureTxHash({ campaignId, signatureId, signer }) {
    const latest = await publicClient.getBlockNumber();
    const from = PETITION_CORE_DEPLOY_BLOCK || 0n;
    const step = 8n; // <= 10 blocks per request to fit strict providers
    for (let start = latest > step ? latest - step : 0n; start >= from; ) {
      const end = start + step > latest ? latest : start + step;
      const logs = await publicClient.getLogs({
        address: PETITION_CORE,
        event: signatureAddedEvent,
        args: { campaignId: BigInt(campaignId), signatureId: BigInt(signatureId), signer },
        fromBlock: start,
        toBlock: end,
      });
      if (logs.length) return logs[0].transactionHash;
      if (start === 0n || start <= from) break;
      start = start - step;
    }
    return null;
  }

  const onDownload = async () => {
    try {
      if (!address) throw new Error('Connect wallet first');
      setBusy(true);

      // 1) Find signatureId for (campaign, user)
      const [found, signatureId] = await publicClient.readContract({
        abi: PetitionCoreABI,
        address: PETITION_CORE,
        functionName: 'getUserSignatureIdForCampaign',
        args: [BigInt(campaignId), address],
      });
      if (!found) throw new Error('No signature found for this campaign');

      // 2) Snapshot for that signature
      const [arTxIdBytes32, contentHashBytes32, versionId] = await publicClient.readContract({
        abi: PetitionCoreABI,
        address: PETITION_CORE,
        functionName: 'getSignatureSnapshot',
        args: [BigInt(signatureId)],
      });

      // 3) Campaign info
      const c = await publicClient.readContract({
        abi: PetitionCoreABI,
        address: PETITION_CORE,
        functionName: 'getCampaignInfo',
        args: [BigInt(campaignId)],
      });

      // 4) Try to locate tx hash via paginated logs (small windows)
      let ethTxHash = await findSignatureTxHash({ campaignId, signatureId, signer: address });
      if (!ethTxHash) {
        console.warn('Event tx hash not found in scanned range; proceeding without it');
      }

      // 5) Download signature bytes from Arweave
      const gwProto = import.meta.env.VITE_ARWEAVE_GATEWAY_PROTO || 'https';
      const gwHost = import.meta.env.VITE_ARWEAVE_GATEWAY_HOST || 'ar-io.net';
      const gwPort = import.meta.env.VITE_ARWEAVE_GATEWAY_PORT ? `:${import.meta.env.VITE_ARWEAVE_GATEWAY_PORT}` : '';
      const txId = bytes32ToTxId(arTxIdBytes32);
      const resp = await fetch(`${gwProto}://${gwHost}${gwPort}/${txId}`);
      if (!resp.ok) throw new Error('Failed to fetch signature');
      const ct = new Uint8Array(await resp.arrayBuffer());

      // Verify integrity
      const onchainHash = String(contentHashBytes32).toLowerCase();
      const computed = String(hashKeccak(ct)).toLowerCase();
      if (onchainHash !== computed) console.warn('Integrity mismatch', { onchainHash, computed });

      // 6) Decide plaintext vs encrypted; decrypt only if needed and keys are present
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

      // 7) Build + download PDF (include tx hash if found)
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
        signatureVersionId: String(versionId),
        arweaveTxId: txId,
        signaturePngBytes: png,
        generatedAt: new Date(),
      });
      downloadPdfBytes(pdfBytes, `petition_${campaignId}_signature_${String(signatureId)}.pdf`);
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
