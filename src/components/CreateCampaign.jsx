// src/components/CreateCampaign.jsx
import React from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { PetitionCoreABI } from '../abi/PetitionCore';
import { PETITION_CORE } from '../config/constants';
import { parseEther } from 'viem';
import { uploadToArweave } from '../services/arweave_classic';
import { hashKeccak } from '../services/crypto';

export default function CreateCampaign() {
  const { address } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();

  const [title, setTitle] = React.useState('');
  const [desc, setDesc] = React.useState('');
  const [beneficiary, setBeneficiary] = React.useState('');
  const [targetEth, setTargetEth] = React.useState('');
  const [days, setDays] = React.useState('30');
  const [msg, setMsg] = React.useState('');

  const [imageTxId, setImageTxId] = React.useState('');
  const [imageHash, setImageHash] = React.useState('');

  React.useEffect(() => {
    if (address && !beneficiary) setBeneficiary(address);
  }, [address, beneficiary]);

  async function handleImage(e) {
    try {
      setMsg('');
      const file = e.target.files?.[0];
      if (!file) throw new Error('No file selected');

      // Only PNG is supported in UI to keep content-type stable; adjust accept if needed.
      const type = file.type || 'image/png';
      if (!type.startsWith('image/')) throw new Error('Please select an image file');

      const ab = await file.arrayBuffer();
      if (!ab || ab.byteLength === 0) throw new Error('Selected file is empty');
      const bytes = new Uint8Array(ab);

      // Use the same tag pattern as signature (no encryption)
      const tags = [
        { name: 'Content-Type', value: type },
        { name: 'App-Name', value: 'Petition.io' },
        { name: 'App-Version', value: '1.0.0' },
      ];

      const txId = await uploadToArweave(bytes, tags);
      setImageTxId(txId);
      setImageHash(hashKeccak(bytes));
      setMsg('Image uploaded to Arweave.');
    } catch (err) {
      console.error(err);
      setMsg(err?.message || 'Image upload failed');
      setImageTxId('');
      setImageHash('');
    }
  }

  const onCreate = async (e) => {
    e.preventDefault();
    try {
      if (!title.trim()) return setMsg('Title required');
      if (!beneficiary) return setMsg('Beneficiary required');
      if (!imageTxId || !imageHash) return setMsg('Campaign image required (upload image)');

      const targetWei = parseEther((targetEth || '0').toString());
      const durationDays = BigInt(Number(days || '0'));

      await writeContractAsync({
        abi: PetitionCoreABI,
        address: PETITION_CORE,
        functionName: 'createCampaign',
        args: [title, desc, beneficiary, targetWei, durationDays, imageTxId, imageHash],
      });

      setMsg('Campaign created!');
      setTitle(''); setDesc(''); setTargetEth(''); setDays('30'); setImageTxId(''); setImageHash('');
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

      <div style={{minWidth:260}}>
        <div className="label">Campaign Image</div>
        <input className="input" type="file" accept="image/*" onChange={handleImage} />
        <div className="small">{imageTxId ? `Arweave TX: ${imageTxId}` : 'Upload before creating'}</div>
      </div>

      <button className="primary" type="submit" disabled={isPending}>
        {isPending ? 'Creating…' : 'Create Campaign'}
      </button>
      {msg && <div className="small">{msg}</div>}
    </form>
  );
}
