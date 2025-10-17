// src/components/CampaignList.jsx
import React from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { PetitionCoreABI } from '../abi/PetitionCore';
import { PETITION_CORE, ARWEAVE_GATEWAY_PROTO, ARWEAVE_GATEWAY_HOST, ARWEAVE_GATEWAY_PORT,ARWEAVE_ORIGIN } from '../config/constants';
import SignCampaign from './SignCampaign';
import CreateCampaign from './CreateCampaign';
import DownloadReceiptButton from './DownloadReceiptButton';
import ContributeCampaign from './ContributeCampaign';
import DownloadAllSignaturesButton from './DownloadAllSignaturesButton';

function useActiveCampaigns() {
  const pc = usePublicClient();
  const [ids, setIds] = React.useState([]);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const n = await pc.readContract({
          abi: PetitionCoreABI,
          address: PETITION_CORE,
          functionName: 'nextCampaignId',
        });
        const count = Number(n || 0n);
        if (count === 0) { if (mounted) setIds([]); return; }
        const calls = [];
        for (let i = 0; i < count; i++) {
          calls.push({
            abi: PetitionCoreABI,
            address: PETITION_CORE,
            functionName: 'getCampaignInfo',
            args: [BigInt(i)],
          });
        }
        const results = await pc.multicall({ contracts: calls });
        const active = [];
        for (let i = 0; i < results.length; i++) {
          const r = results[i];
          if (r.status === 'success') {
            const c = r.result;
            if (c && c.isActive) active.push(BigInt(i));
          }
        }
        if (mounted) setIds(active);
      } catch {
        if (mounted) setIds([]);
      }
    })();
    return () => { mounted = false; };
  }, [pc]);

  return ids;
}

function useCampaign(id) {
  const pc = usePublicClient();
  const [data, setData] = React.useState(null);
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      if (id === undefined) return;
      try {
        const c = await pc.readContract({
          abi: PetitionCoreABI,
          address: PETITION_CORE,
          functionName: 'getCampaignInfo',
          args: [BigInt(id)],
        });
        if (mounted) setData(c);
      } catch {
        if (mounted) setData(null);
      }
    })();
    return () => { mounted = false; };
  }, [pc, id]);
  return { data };
}

export default function CampaignList() {
  const ids = useActiveCampaigns();
  return (
    <div>
      <div className="card">
        <h3>Create Campaign</h3>
        <CreateCampaign />
      </div>
      <h2>Active Campaigns</h2>
      <div className="list">
        {ids.map((id) => (
          <CampaignCard key={String(id)} id={id} />
        ))}
        {ids.length === 0 && <div className="small">No active campaigns</div>}
      </div>
    </div>
  );
}

function CampaignCard({ id }) {
  const { address } = useAccount();
  const { data: c } = useCampaign(id);
  if (!c) return null;
  const isOwner =
    address &&
    (address.toLowerCase() === c.beneficiary.toLowerCase() ||
      address.toLowerCase() === c.creator.toLowerCase());

const imgUrl = c.imageArTxId ? `${ARWEAVE_ORIGIN}/${c.imageArTxId}` : ''; // replace previous construction


  return (
    <div className="card">
      <h3>{c.title}</h3>
      <div className="small">Beneficiary: {c.beneficiary}</div>
      {imgUrl && (
        <div style={{ margin: '8px 0' }}>
          <img
            src={imgUrl}
            alt="campaign"
            style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid #273043' }}
          />
        </div>
      )}
      <p>{c.description}</p>
      <div className="small">Target: {String(c.targetAmount)} wei</div>
      <div className="small">
        Raised: {String(c.totalRaised)} wei • Signatures: {String(c.signatureCount)}
      </div>

      <div className="row" style={{ marginTop: 8, gap: 8, alignItems: 'flex-end' }}>
        <ContributeCampaign campaignId={id} />
        <SignCampaign campaignId={id} />
        <div style={{ flex: 1 }} />
        <div className="row" style={{ gap: 8 }}>
          <DownloadReceiptButton campaignId={id} />
          {isOwner && <DownloadAllSignaturesButton campaignId={id} />}
        </div>
      </div>
    </div>
  );
}
