export const NETWORK = import.meta.env.VITE_NETWORK || 'sepolia'; // [web:84]
export const RPC_URL = import.meta.env.VITE_RPC_URL; // [web:84]
export const PETITION_CORE = import.meta.env.VITE_PETITION_CORE; // [web:84]
export const PETITION_CORE_DEPLOY_BLOCK = import.meta.env.VITE_PETITION_CORE_DEPLOY_BLOCK
  ? BigInt(import.meta.env.VITE_PETITION_CORE_DEPLOY_BLOCK)
  : 0n; // [web:78]
