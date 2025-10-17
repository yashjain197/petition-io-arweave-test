// src/components/DownloadAllSignaturesButton.jsx
// Event-scan implementation using SignatureAddedLight to assemble a PDF for owners.
import React from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { PetitionCoreABI } from '../abi/PetitionCore';
import { ProfileABI } from '../abi/Profile';
import {
  PETITION_CORE,
  PROFILE,
  NETWORK,
  PETITION_CORE_DEPLOY_BLOCK,
  ARWEAVE_GATEWAY_HOST,
  ARWEAVE_GATEWAY_PORT,
  ARWEAVE_GATEWAY_PROTO,
  ARWEAVE_ORIGIN
} from '../config/constants';
import { parseAbiItem } from 'viem';
import { hashKeccak } from '../services/crypto';
import { buildCampaignSignaturesPDF, downloadPdfBytes } from '../services/pdf';

const evSignatureAddedLight = parseAbiItem(
  'event SignatureAddedLight(uint256 indexed campaignId, address indexed signer, string message)'
);

export default function DownloadAllSignaturesButton({ campaignId }) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [busy, setBusy] = React.useState(false);

  const onDownload = async () => {
    try {
      if (!address) throw new Error('Connect wallet first');
      setBusy(true);

      // Verify ownership
      const c = await publicClient.readContract({
        abi: PetitionCoreABI,
        address: PETITION_CORE,
        functionName: 'getCampaignInfo',
        args: [BigInt(campaignId)],
      });
      const isOwner =
        address.toLowerCase() === c.beneficiary.toLowerCase() ||
        address.toLowerCase() === c.creator.toLowerCase();
      if (!isOwner) throw new Error('Only creator/beneficiary can export');

      // Scan logs for this campaign
      const latest = await publicClient.getBlockNumber();
      const from = PETITION_CORE_DEPLOY_BLOCK || 0n;
      const step = 3000n;

      const rows = [];
      for (let start = from; start <= latest; start += step) {
        const end = start + step > latest ? latest : start + step;
        const logs = await publicClient.getLogs({
          address: PETITION_CORE,
          event: evSignatureAddedLight,
          args: { campaignId: BigInt(campaignId) },
          fromBlock: start,
          toBlock: end,
        });

        for (const lg of logs) {
          const signer = lg.args.signer;
          const message = lg.args.message || '';
          const block = await publicClient.getBlock({ blockHash: lg.blockHash });
          const ts = Number(block.timestamp);

          // Try to get current active signature pointer for the signer
          let arweaveTxId = '';
          let imageBytes = null;
          try {
            const [arTxId, contentHash] = await publicClient.readContract({
              abi: ProfileABI,
              address: PROFILE,
              functionName: 'getActiveSignatureVersion',
              args: [signer],
            });
            if (arTxId) {
              arweaveTxId = arTxId;
              const url = `${ARWEAVE_ORIGIN}/${arTxId}`;
              const resp = await fetch(url);
              if (resp.ok) {
                const bytes = new Uint8Array(await resp.arrayBuffer());
                const got = String(hashKeccak(bytes)).toLowerCase();
                if (String(contentHash).toLowerCase() === got) {
                  imageBytes = bytes; // may be encrypted; PDF helper will show 'unavailable' if not PNG
                }
              }
            }
          } catch {
            // ignore per-row failures
          }

          rows.push({
            signer,
            message,
            timestamp: ts,
            arweaveTxId,
            imageBytes,
          });
        }
      }

      const pdfBytes = await buildCampaignSignaturesPDF({
        network: NETWORK || 'sepolia',
        campaign: {
          id: String(c.id),
          title: c.title,
          description: c.description,
          beneficiary: c.beneficiary,
          targetAmount: String(c.targetAmount),
        },
        rows,
        generatedAt: new Date(),
      });

      downloadPdfBytes(pdfBytes, `campaign_${campaignId}_signatures.pdf`);
    } catch (e) {
      alert(e?.message || 'Failed to export');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button onClick={onDownload} disabled={busy}>
      {busy ? 'Preparing…' : 'Download all signatures'}
    </button>
  );
}
