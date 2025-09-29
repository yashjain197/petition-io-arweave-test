// src/lib/wallet.js
// Fixes: "Cannot destructure property 'projectId' of 'undefined'"
// Use RainbowKit's getDefaultConfig with a valid WalletConnect Project ID.
// Make sure .env.local has VITE_WALLETCONNECT_ID and VITE_RPC_URL set.

import { http } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';

const projectId = import.meta.env.VITE_WALLETCONNECT_ID;
const rpcUrl = import.meta.env.VITE_RPC_URL;

if (!projectId) {
  throw new Error('Missing VITE_WALLETCONNECT_ID in .env.local');
}
if (!rpcUrl) {
  throw new Error('Missing VITE_RPC_URL in .env.local');
}

export const config = getDefaultConfig({
  appName: 'Petition DApp',
  projectId,
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(rpcUrl),
  },
});
