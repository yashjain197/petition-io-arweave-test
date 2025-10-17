// src/components/ProfilePage.jsx
import React from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { ProfileABI } from '../abi/Profile';
import { PROFILE, ARWEAVE_GATEWAY_PROTO, ARWEAVE_GATEWAY_HOST, ARWEAVE_GATEWAY_PORT } from '../config/constants';
import { uploadToArweave } from '../services/arweave_classic';
import { hashKeccak } from '../services/crypto';

function bytesFromString(str) {
  const encoder = new TextEncoder();
  return encoder.encode(str || '');
}

function linkFor(txId) {
  if (!txId) return '';
  return `${ARWEAVE_GATEWAY_PROTO}://${ARWEAVE_GATEWAY_HOST}${ARWEAVE_GATEWAY_PORT}/${txId}`;
}

export default function ProfilePage() {
  const { address } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();

  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState('');

  // File states
  const [profileDocFile, setProfileDocFile] = React.useState(null);
  const [avatarFile, setAvatarFile] = React.useState(null);

  // Text fields + toggles (upload as Arweave docs when provided)
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [bio, setBio] = React.useState('');
  const [twitter, setTwitter] = React.useState('');
  const [github, setGithub] = React.useState('');
  const [etherscan, setEtherscan] = React.useState('');
  const [telegram, setTelegram] = React.useState('');
  const [ens, setEns] = React.useState('');

  const [uploadFirstName, setUploadFirstName] = React.useState(false);
  const [uploadLastName, setUploadLastName] = React.useState(false);
  const [uploadBio, setUploadBio] = React.useState(false);
  const [uploadTwitter, setUploadTwitter] = React.useState(false);
  const [uploadGithub, setUploadGithub] = React.useState(false);
  const [uploadEtherscan, setUploadEtherscan] = React.useState(false);
  const [uploadTelegram, setUploadTelegram] = React.useState(false);
  const [uploadEns, setUploadEns] = React.useState(false);

  // Uploaded pointers (for quick feedback/links)
  const [uploaded, setUploaded] = React.useState({
    profileDoc: { txId: '', hash: '' },
    avatar: { txId: '', hash: '' },
    firstName: { txId: '', hash: '' },
    lastName: { txId: '', hash: '' },
    bio: { txId: '', hash: '' },
    twitter: { txId: '', hash: '' },
    github: { txId: '', hash: '' },
    etherscan: { txId: '', hash: '' },
    telegram: { txId: '', hash: '' },
    ens: { txId: '', hash: '' },
  });

  async function uploadBytes(bytes, contentType = 'application/octet-stream') {
    const tags = [{ name: 'Content-Type', value: contentType }, { name: 'App-Name', value: 'Petition.io' }, { name: 'App-Version', value: '1.0.0' }];
    const txId = await uploadToArweave(bytes, tags);
    const hash = hashKeccak(bytes);
    return { txId, hash };
  }

  async function tryUploadFile(file, fallbackType) {
    if (!file) return { txId: '', hash: '' };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const contentType = file.type || fallbackType || 'application/octet-stream';
    return uploadBytes(bytes, contentType);
  }

  async function tryUploadText(value) {
    if (!value || !value.trim()) return { txId: '', hash: '' };
    const bytes = bytesFromString(value.trim());
    return uploadBytes(bytes, 'text/plain');
  }

  const onSave = async (e) => {
    e.preventDefault();
    try {
      if (!address) throw new Error('Connect your wallet first');

      setBusy(true);
      setMsg('Uploading profile assets to Arweave…');

      // 1) Upload files if provided
      const profDoc = await tryUploadFile(profileDocFile, 'application/json');
      const avatar = await tryUploadFile(avatarFile, 'image/png');

      // 2) Upload text fields conditionally
      const fName = uploadFirstName ? await tryUploadText(firstName) : { txId: '', hash: '' };
      const lName = uploadLastName ? await tryUploadText(lastName) : { txId: '', hash: '' };
      const b = uploadBio ? await tryUploadText(bio) : { txId: '', hash: '' };
      const tw = uploadTwitter ? await tryUploadText(twitter) : { txId: '', hash: '' };
      const gh = uploadGithub ? await tryUploadText(github) : { txId: '', hash: '' };
      const es = uploadEtherscan ? await tryUploadText(etherscan) : { txId: '', hash: '' };
      const tg = uploadTelegram ? await tryUploadText(telegram) : { txId: '', hash: '' };
      const eName = uploadEns ? await tryUploadText(ens) : { txId: '', hash: '' };

      setUploaded({
        profileDoc: profDoc,
        avatar,
        firstName: fName,
        lastName: lName,
        bio: b,
        twitter: tw,
        github: gh,
        etherscan: es,
        telegram: tg,
        ens: eName,
      });

      setMsg('Confirm the wallet transaction to save profile pointers on-chain…');

      // 3) Call updateProfile with pointers (empty strings => no change)
      await writeContractAsync({
        abi: ProfileABI,
        address: PROFILE,
        functionName: 'updateProfile',
        args: [
          profDoc.txId, profDoc.hash,
          avatar.txId, avatar.hash,
          fName.txId, fName.hash,
          lName.txId, lName.hash,
          b.txId, b.hash,
          tw.txId, tw.hash,
          gh.txId, gh.hash,
          es.txId, es.hash,
          tg.txId, tg.hash,
          eName.txId, eName.hash,
        ],
      });

      setMsg('Profile updated successfully.');
    } catch (err) {
      console.error(err);
      setMsg(err?.shortMessage || err?.message || 'Failed to update profile');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <h3>Profile</h3>
      <p className="small">Upload profile JSON and avatar image, and optionally upload text fields as Arweave documents, then save pointers on-chain.</p>

      {/* Files */}
      <div className="row" style={{ gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ minWidth: 280 }}>
          <div className="label">Profile JSON</div>
          <input className="input" type="file" accept="application/json" onChange={(e) => setProfileDocFile(e.target.files?.[0] || null)} />
          {uploaded.profileDoc.txId && (
            <div className="small">Arweave: <a href={linkFor(uploaded.profileDoc.txId)} target="_blank" rel="noreferrer">{uploaded.profileDoc.txId}</a></div>
          )}
        </div>
        <div style={{ minWidth: 280 }}>
          <div className="label">Avatar (PNG)</div>
          <input className="input" type="file" accept="image/png" onChange={(e) => setAvatarFile(e.target.files?.[0] || null)} />
          {uploaded.avatar.txId && (
            <div className="small">Arweave: <a href={linkFor(uploaded.avatar.txId)} target="_blank" rel="noreferrer">{uploaded.avatar.txId}</a></div>
          )}
        </div>
      </div>

      {/* Text fields */}
      <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 240 }}>
          <div className="label">First name</div>
          <input className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Alice" />
          <label className="small"><input type="checkbox" checked={uploadFirstName} onChange={(e)=>setUploadFirstName(e.target.checked)} style={{ marginRight: 6 }} />Upload to Arweave</label>
          {uploaded.firstName.txId && <div className="small"><a href={linkFor(uploaded.firstName.txId)} target="_blank" rel="noreferrer">view</a></div>}
        </div>
        <div style={{ minWidth: 240 }}>
          <div className="label">Last name</div>
          <input className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" />
          <label className="small"><input type="checkbox" checked={uploadLastName} onChange={(e)=>setUploadLastName(e.target.checked)} style={{ marginRight: 6 }} />Upload to Arweave</label>
          {uploaded.lastName.txId && <div className="small"><a href={linkFor(uploaded.lastName.txId)} target="_blank" rel="noreferrer">view</a></div>}
        </div>
        <div style={{ minWidth: 320, flex: 1 }}>
          <div className="label">Bio</div>
          <input className="input" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Short bio" />
          <label className="small"><input type="checkbox" checked={uploadBio} onChange={(e)=>setUploadBio(e.target.checked)} style={{ marginRight: 6 }} />Upload to Arweave</label>
          {uploaded.bio.txId && <div className="small"><a href={linkFor(uploaded.bio.txId)} target="_blank" rel="noreferrer">view</a></div>}
        </div>
      </div>

      <div className="row" style={{ gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
        <div style={{ minWidth: 240 }}>
          <div className="label">Twitter (X)</div>
          <input className="input" value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="@handle" />
          <label className="small"><input type="checkbox" checked={uploadTwitter} onChange={(e)=>setUploadTwitter(e.target.checked)} style={{ marginRight: 6 }} />Upload to Arweave</label>
          {uploaded.twitter.txId && <div className="small"><a href={linkFor(uploaded.twitter.txId)} target="_blank" rel="noreferrer">view</a></div>}
        </div>
        <div style={{ minWidth: 240 }}>
          <div className="label">GitHub</div>
          <input className="input" value={github} onChange={(e) => setGithub(e.target.value)} placeholder="username" />
          <label className="small"><input type="checkbox" checked={uploadGithub} onChange={(e)=>setUploadGithub(e.target.checked)} style={{ marginRight: 6 }} />Upload to Arweave</label>
          {uploaded.github.txId && <div className="small"><a href={linkFor(uploaded.github.txId)} target="_blank" rel="noreferrer">view</a></div>}
        </div>
        <div style={{ minWidth: 240 }}>
          <div className="label">Etherscan</div>
          <input className="input" value={etherscan} onChange={(e) => setEtherscan(e.target.value)} placeholder="username" />
          <label className="small"><input type="checkbox" checked={uploadEtherscan} onChange={(e)=>setUploadEtherscan(e.target.checked)} style={{ marginRight: 6 }} />Upload to Arweave</label>
          {uploaded.etherscan.txId && <div className="small"><a href={linkFor(uploaded.etherscan.txId)} target="_blank" rel="noreferrer">view</a></div>}
        </div>
        <div style={{ minWidth: 240 }}>
          <div className="label">Telegram</div>
          <input className="input" value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="@handle" />
          <label className="small"><input type="checkbox" checked={uploadTelegram} onChange={(e)=>setUploadTelegram(e.target.checked)} style={{ marginRight: 6 }} />Upload to Arweave</label>
          {uploaded.telegram.txId && <div className="small"><a href={linkFor(uploaded.telegram.txId)} target="_blank" rel="noreferrer">view</a></div>}
        </div>
        <div style={{ minWidth: 240 }}>
          <div className="label">ENS</div>
          <input className="input" value={ens} onChange={(e) => setEns(e.target.value)} placeholder="name.eth" />
          <label className="small"><input type="checkbox" checked={uploadEns} onChange={(e)=>setUploadEns(e.target.checked)} style={{ marginRight: 6 }} />Upload to Arweave</label>
          {uploaded.ens.txId && <div className="small"><a href={linkFor(uploaded.ens.txId)} target="_blank" rel="noreferrer">view</a></div>}
        </div>
      </div>

      <div className="row" style={{ marginTop: 16 }}>
        <button className="primary" onClick={onSave} disabled={busy || isPending}>
          {busy ? 'Saving…' : 'Save Profile'}
        </button>
        {msg && <div className="small" style={{ marginLeft: 12 }}>{msg}</div>}
      </div>
    </div>
  );
}
