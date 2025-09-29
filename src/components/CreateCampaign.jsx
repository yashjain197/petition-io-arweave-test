// src/components/CreateCampaign.jsx
import React from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { PetitionCoreABI } from '../abi/PetitionCore';
import { PETITION_CORE } from '../config/constants';
import { parseEther } from 'viem';

export default function CreateCampaign() {
  const { address } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();

  const [title, setTitle] = React.useState('');
  const [desc, setDesc] = React.useState('');
  const [beneficiary, setBeneficiary] = React.useState('');
  const [targetEth, setTargetEth] = React.useState('');
  const [days, setDays] = React.useState('30');
  const [msg, setMsg] = React.useState('');

  React.useEffect(() => {
    if (address && !beneficiary) setBeneficiary(address);
  }, [address, beneficiary]);

  const onCreate = async (e) => {
    e.preventDefault();
    try {
      if (!title.trim()) return setMsg('Title required');
      if (!beneficiary) return setMsg('Beneficiary required');

      const targetWei = parseEther((targetEth || '0').toString());
      const durationDays = BigInt(Number(days || '0'));

      await writeContractAsync({
        abi: PetitionCoreABI,
        address: PETITION_CORE,
        functionName: 'createCampaign',
        args: [title, desc, beneficiary, targetWei, durationDays],
      });

      setMsg('Campaign created!');
      setTitle(''); setDesc(''); setTargetEth(''); setDays('30');
    } catch (err) {
      console.error(err);
      setMsg(err?.shortMessage || err?.message || 'Create failed');
    }
  };

  return (
    <form className="row" onSubmit={onCreate} style={{ gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <div style={{minWidth:220, flex:1}}>
        <div className="label">Title</div>
        <input className="input" value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Save the Cats" />
      </div>
      <div style={{minWidth:280, flex:2}}>
        <div className="label">Description</div>
        <input className="input" value={desc} onChange={(e)=>setDesc(e.target.value)} placeholder="Short description" />
      </div>
      <div style={{minWidth:260, flex:1}}>
        <div className="label">Beneficiary</div>
        <input className="input" value={beneficiary} onChange={(e)=>setBeneficiary(e.target.value)} placeholder="0x..." />
      </div>
      <div style={{minWidth:160}}>
        <div className="label">Target (ETH)</div>
        <input className="input" value={targetEth} onChange={(e)=>setTargetEth(e.target.value)} placeholder="1.5" />
      </div>
      <div style={{minWidth:200}}>
        <div className="label">Duration (days, 0 = no deadline)</div>
        <input className="input" value={days} onChange={(e)=>setDays(e.target.value)} placeholder="30" />
      </div>
      <button className="primary" type="submit" disabled={isPending}>
        {isPending ? 'Creating…' : 'Create Campaign'}
      </button>
      {msg && <div className="small">{msg}</div>}
    </form>
  );
}
