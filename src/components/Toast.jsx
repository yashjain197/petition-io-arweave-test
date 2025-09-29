import React from 'react';
export default function Toast({msg, onClose}){
  if(!msg) return null;
  return (
    <div style={{position:'fixed',right:16,bottom:16,background:'#111827',border:'1px solid #374151',padding:12,borderRadius:12}}>
      {msg}
      <button style={{marginLeft:12}} onClick={onClose}>x</button>
    </div>
  );
}
