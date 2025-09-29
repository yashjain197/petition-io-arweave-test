// src/components/DownloadReceiptButton.jsx
import React from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { PetitionCoreABI } from '../abi/PetitionCore';
import { PETITION_CORE, NETWORK, PETITION_CORE_DEPLOY_BLOCK } from '../config/constants';
import { bytes32ToTxId } from '../utils/arweaveId';
import { importKeyRaw, decryptBytes, hashKeccak } from '../services/crypto';
import { buildSignedPetitionPDF, downloadPdfBytes } from '../services/pdf';
import { parseAbiItem } from 'viem';

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const signatureAddedEvent = parseAbiItem(
  'event SignatureAdded(uint256 indexed campaignId, uint256 indexed signatureId, address indexed signer, string message, uint256 signatureVersionId, bytes32 signedArTxId, bytes32 signedContentHash)'
); // typed filter [web:78]

export default function DownloadReceiptButton({ campaignId }) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [busy, setBusy] = React.useState(false);

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

      // 4) Fetch tx hash from event logs scoped by indexed args
      const logs = await publicClient.getLogs({
        address: PETITION_CORE,
        event: signatureAddedEvent,
        args: {
          campaignId: BigInt(campaignId),
          signatureId: BigInt(signatureId),
          signer: address,
        },
        fromBlock: PETITION_CORE_DEPLOY_BLOCK, // narrow if set
        toBlock: 'latest',
      }); // returns decoded logs with transactionHash [web:78]
      if (!logs.length) throw new Error('Could not locate signature event log for tx hash'); // [web:78]
      // if multiple (should not), pick first (earliest)
      const ethTxHash = logs[0].transactionHash; // ethers-style 0x… [web:78]

      // 5) Download & decrypt signature PNG
      const gwProto = import.meta.env.VITE_ARWEAVE_GATEWAY_PROTO || 'http';
      const gwHost = import.meta.env.VITE_ARWEAVE_GATEWAY_HOST || 'localhost';
      const gwPort = import.meta.env.VITE_ARWEAVE_GATEWAY_PORT ? `:${import.meta.env.VITE_ARWEAVE_GATEWAY_PORT}` : '';
      const txId = bytes32ToTxId(arTxIdBytes32);
      const resp = await fetch(`${gwProto}://${gwHost}${gwPort}/${txId}`);
      if (!resp.ok) throw new Error('Failed to fetch encrypted signature');
      const ct = new Uint8Array(await resp.arrayBuffer());

      // Verify integrity
      const onchainHash = String(contentHashBytes32).toLowerCase();
      const computed = String(hashKeccak(ct)).toLowerCase();
      if (onchainHash !== computed) console.warn('Integrity mismatch', { onchainHash, computed });

      // Decrypt with local key/nonce
      const keyB64 = localStorage.getItem('sig_key');
      const nonceB64 = localStorage.getItem('sig_nonce');
      if (!keyB64 || !nonceB64) throw new Error('Missing local key/nonce (upload a signature on this device first)');
      const key = await importKeyRaw(b64ToBytes(keyB64));
      const nonce = b64ToBytes(nonceB64);
      const png = await decryptBytes(key, ct, nonce);

      // 6) Build + download PDF with real Ethereum tx hash
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
        txHash: ethTxHash,     // actual Ethereum TX hash [web:78]
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
