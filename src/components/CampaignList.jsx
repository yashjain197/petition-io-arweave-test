// src/components/CampaignList.jsx
import React from 'react';
import { useReadContract } from 'wagmi';
import { PetitionCoreABI } from '../abi/PetitionCore';
import { PETITION_CORE } from '../config/constants';
import SignCampaign from './SignCampaign';
import CreateCampaign from './CreateCampaign';

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

function CampaignCard({id}){
  const { data } = useCampaign(id);
  if (!data) return null;
  const c = data;
  return (
    <div className="card">
      <h3>{c.title}</h3>
      <div className="small">Beneficiary: {c.beneficiary}</div>
      <p>{c.description}</p>
      <div className="small">Target: {String(c.targetAmount)} wei</div>
      <div className="small">Raised: {String(c.totalRaised)} wei • Signatures: {String(c.signatureCount)}</div>
      <SignCampaign campaignId={id} />
    </div>
  );
}
