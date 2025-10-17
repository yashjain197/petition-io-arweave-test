// src/components/NavBar.jsx
import React from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export default function NavBar({ onChange, current }){
  return (
    <nav>
      <div className="row">
        <button
          className={current === 'campaigns' ? 'primary' : ''}
          onClick={() => onChange('campaigns')}
        >
          Campaigns
        </button>
        <button
          className={current === 'signature' ? 'primary' : ''}
          onClick={() => onChange('signature')}
        >
          My Signature
        </button>
        <button
          className={current === 'profile' ? 'primary' : ''}
          onClick={() => onChange('profile')}
        >
          Profile
        </button>
      </div>
      <ConnectButton />
    </nav>
  );
}
