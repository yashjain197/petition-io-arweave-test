import React from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { PetitionCoreABI } from '../abi/PetitionCore';
import { PETITION_CORE } from '../config/constants';
import SignCampaign from './SignCampaign';
import CreateCampaign from './CreateCampaign';
import DownloadReceiptButton from './DownloadReceiptButton';
import DownloadAllSignaturesButton from './DownloadAllSignaturesButton';

function useActiveCampaigns(){
  const { data } = useReadContract({
    abi: PetitionCoreABI,
    address: PETITION_CORE,
    functionName: 'getActiveCampaigns',
    args: [0n, 100n]
  });
  return data || [];
}

function useCampaign(id){
  return useReadContract({
    abi: PetitionCoreABI,
    address: PETITION_CORE,
    functionName: 'getCampaignInfo',
    args: [BigInt(id)],
    query: { enabled: id !== undefined }
  });
}

export default function CampaignList(){
  const ids = useActiveCampaigns();

  return (
    <div>
      <div className="card">
        <h3>Create Campaign</h3>
        <CreateCampaign />
      </div>

      <h2>Active Campaigns</h2>
      <div className="list">
        {ids.map((id)=> <CampaignCard key={String(id)} id={id} />)}
        {ids.length===0 && <div className="small">No active campaigns</div>}
      </div>
    </div>
  );
}

function CampaignCard({ id }) {
  const { address } = useAccount();
  const { data } = useCampaign(id);
  if (!data) return null;
  const c = data;
  const isOwner = address && (address.toLowerCase() === c.beneficiary.toLowerCase() || address.toLowerCase() === c.creator.toLowerCase());

  return (
    <div className="card">
      <h3>{c.title}</h3>
      <div className="small">Beneficiary: {c.beneficiary}</div>
      <p>{c.description}</p>
      <div className="small">Target: {String(c.targetAmount)} wei</div>
      <div className="small">Raised: {String(c.totalRaised)} wei • Signatures: {String(c.signatureCount)}</div>
      <div className="row" style={{ marginTop: 8 }}>
        <SignCampaign campaignId={id} />
        <div style={{ flex: 1 }} />
        <div className="row" style={{ gap: 8 }}>
          <React.Suspense fallback={<span className="small">…</span>}>
            <DownloadReceiptButton campaignId={id} />
          </React.Suspense>
          {isOwner && (
            <React.Suspense fallback={<span className="small">…</span>}>
              <DownloadAllSignaturesButton campaignId={id} />
            </React.Suspense>
          )}
        </div>
      </div>
    </div>
  );
}
