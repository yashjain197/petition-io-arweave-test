import React from 'react';
import { useAccount, usePublicClient, useReadContract } from 'wagmi';
import { PetitionCoreABI } from '../abi/PetitionCore';
import { PETITION_CORE, NETWORK } from '../config/constants';
import { bytes32ToTxId } from '../utils/arweaveId';
import { hashKeccak } from '../services/crypto';
import { buildCampaignSignaturesPDF, downloadPdfBytes } from '../services/pdf';

export default function DownloadAllSignaturesButton({ campaignId }) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [busy, setBusy] = React.useState(false);

  const { data: campaign } = useReadContract({
    abi: PetitionCoreABI,
    address: PETITION_CORE,
    functionName: 'getCampaignInfo',
    args: [BigInt(campaignId)],
  });

  const onDownload = async () => {
    try {
      if (!address) throw new Error('Connect wallet first');
      setBusy(true);

      if (!campaign) throw new Error('Campaign not found');
      const isOwner = address.toLowerCase() === campaign.beneficiary.toLowerCase() || address.toLowerCase() === campaign.creator.toLowerCase();
      if (!isOwner) throw new Error('Only creator/beneficiary can export');

      // Important: pass account so msg.sender is set for view calls guarded in the contract
      const total = await publicClient.readContract({
        abi: PetitionCoreABI,
        address: PETITION_CORE,
        functionName: 'getCampaignSignaturesCount',
        args: [BigInt(campaignId)],
        account: address,
      });

      const pageSize = 50n;
      let offset = 0n;
      const rows = [];

      const gwProto = import.meta.env.VITE_ARWEAVE_GATEWAY_PROTO || 'https';
      const gwHost = import.meta.env.VITE_ARWEAVE_GATEWAY_HOST || 'ar-io.net';
      const gwPort = import.meta.env.VITE_ARWEAVE_GATEWAY_PORT ? `:${import.meta.env.VITE_ARWEAVE_GATEWAY_PORT}` : '';

      while (offset < total) {
        const limit = (total - offset) > pageSize ? pageSize : (total - offset);
        const items = await publicClient.readContract({
          abi: PetitionCoreABI,
          address: PETITION_CORE,
          functionName: 'getCampaignSignaturesDetailed',
          args: [BigInt(campaignId), offset, limit],
          account: address, // ensures onlyCreatorOrBeneficiary modifier passes
        });

        for (const it of items) {
          const signer = it.signer;
          const ts = Number(it.timestamp);
          const msg = it.message;
          const txId = bytes32ToTxId(it.signedArTxId);
          const url = `${gwProto}://${gwHost}${gwPort}/${txId}`;
          let imageBytes = null;
          try {
            const resp = await fetch(url);
            if (resp.ok) {
              const bytes = new Uint8Array(await resp.arrayBuffer());
              const onchain = String(it.signedContentHash).toLowerCase();
              const got = String(hashKeccak(bytes)).toLowerCase();
              if (onchain === got) {
                imageBytes = bytes; // may be PNG (public) or encrypted (will render as unavailable)
              }
            }
          } catch (e) {
            console.warn('Fetch failed for', txId, e);
          }

          rows.push({
            signer,
            message: msg,
            timestamp: ts,
            arweaveTxId: txId,
            imageBytes,
          });
        }

        offset += limit;
      }

      const pdfBytes = await buildCampaignSignaturesPDF({
        network: NETWORK || 'sepolia',
        campaign: {
          id: String(campaign.id),
          title: campaign.title,
          description: campaign.description,
          beneficiary: campaign.beneficiary,
          targetAmount: String(campaign.targetAmount),
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
