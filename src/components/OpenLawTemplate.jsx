import React from 'react';
import { getOpenLawClient, compileTemplate, exportDocument } from '../services/openlaw';

// Basic demo: compile a template with variables { SignerAddress, SignatureImageUrl }
const SAMPLE_TEMPLATE = `
This Petition Agreement is made by [[SignerAddress:EthAddress]]\n\n
The signer hereby signs: [[SignatureImageUrl:Text]]
` ;

export default function OpenLawTemplate(){
  const [template, setTemplate] = React.useState(SAMPLE_TEMPLATE);
  const [addr, setAddr] = React.useState('');
  const [sigUrl, setSigUrl] = React.useState('');
  const [downUrl, setDownUrl] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const onCompile = async ()=>{
    setBusy(true); setDownUrl('');
    try{
      await getOpenLawClient();
      const params = { SignerAddress: addr, SignatureImageUrl: sigUrl };
      const { executionResult } = await compileTemplate(template, params);
      const blob = await exportDocument(executionResult);
      const url = URL.createObjectURL(blob);
      setDownUrl(url);
    }catch(e){ alert(e.message || 'OpenLaw error'); }
    setBusy(false);
  };

  return (
    <div className="card">
      <h3>OpenLaw Template (demo)</h3>
      <div className="label">Template</div>
      <textarea className="input" style={{height:140}} value={template} onChange={e=>setTemplate(e.target.value)} />

      <div className="row" style={{marginTop:12}}>
        <div style={{flex:1}}>
          <div className="label">SignerAddress</div>
          <input className="input" value={addr} onChange={e=>setAddr(e.target.value)} placeholder="0x..." />
        </div>
        <div style={{flex:1}}>
          <div className="label">SignatureImageUrl</div>
          <input className="input" value={sigUrl} onChange={e=>setSigUrl(e.target.value)} placeholder="https://arweave.net/<txId>" />
        </div>
      </div>

      <div className="row" style={{marginTop:12}}>
        <button onClick={onCompile} className="primary" disabled={busy}>{busy?'Compiling...':'Compile & Export (HTML)'}</button>
        {downUrl && <a className="button" href={downUrl} download="agreement.html">Download</a>}
      </div>
      <p className="small">Note: For PDF export via OpenLaw servers, use their authenticated export endpoints. This demo renders HTML locally.</p>
    </div>
  );
}
