import React from 'react';
import NavBar from './components/NavBar';
import UploadSignature from './components/UploadSignature';
import ActiveSignatureCard from './components/ActiveSignatureCard';
import CampaignList from './components/CampaignList';

export default function App(){
  const [view, setView] = React.useState('campaigns');

  return (
    <div className="app">
      <NavBar onChange={setView} current={view} />
      <main>
        {view === 'campaigns' && <CampaignList />}
        {view === 'signature' && (
          <>
            <ActiveSignatureCard />
            <UploadSignature />
          </>
        )}
      </main>
    </div>
  );
}
