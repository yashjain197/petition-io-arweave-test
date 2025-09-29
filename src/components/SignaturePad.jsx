import React, { useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';

export default function SignaturePad({onSave}){
  const ref = useRef(null);

  const handleClear = ()=> ref.current?.clear();
  const handleSave = async ()=>{
    if (!ref.current || ref.current.isEmpty()) return alert('Please draw a signature first');
    const dataUrl = ref.current.getTrimmedCanvas().toDataURL('image/png');
    const res = await fetch(dataUrl);
    const bytes = new Uint8Array(await res.arrayBuffer());
    onSave && onSave(bytes);
  };

  return (
    <div className="card">
      <div className="label">Draw your signature</div>
      <SignatureCanvas ref={ref} penColor="#111" canvasProps={{className:'sig', width:600, height:220}} />
      <div className="row" style={{marginTop:12}}>
        <button onClick={handleClear}>Clear</button>
        <button className="primary" onClick={handleSave}>Use this</button>
      </div>
    </div>
  );
}
