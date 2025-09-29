import React from 'react';
import { useWriteContract, useReadContract } from 'wagmi';
import { PetitionCoreABI } from '../abi/PetitionCore';
import { PETITION_CORE } from '../config/constants';

export default function SignCampaign({campaignId}){
  const [message, setMessage] = React.useState('');
  const { writeContractAsync } = useWriteContract();
  const { data: feeWei } = useReadContract({
    abi: PetitionCoreABI,
    address: PETITION_CORE,
    functionName: '_calculateSignatureFee',
    args: [30n], // default non-DAO fee cents; contract will refund diff if DAO member
  });

  const onSign = async ()=>{
    await writeContractAsync({
      abi: PetitionCoreABI,
      address: PETITION_CORE,
      functionName: 'signPetition',
      args: [BigInt(campaignId), message],
      value: feeWei ?? 0n,
    });
    setMessage('');
    alert('Signed!');
  };

  return (
    <div className="row" style={{marginTop:8}}>
      <input className="input" placeholder="Optional message" value={message} onChange={e=>setMessage(e.target.value)} />
      <button className="primary" onClick={onSign}>Sign</button>
    </div>
  );
}
