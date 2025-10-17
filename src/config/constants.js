// src/config/constants.js
export const NETWORK = import.meta.env.VITE_NETWORK || 'sepolia'; // [memory:21]
export const RPC_URL = import.meta.env.VITE_RPC_URL; // [memory:21]
export const PETITION_CORE = import.meta.env.VITE_PETITION_CORE; // [memory:21]
export const PROFILE = import.meta.env.VITE_PROFILE; // [memory:21]
export const PETITION_CORE_DEPLOY_BLOCK = import.meta.env.VITE_PETITION_CORE_DEPLOY_BLOCK
  ? BigInt(import.meta.env.VITE_PETITION_CORE_DEPLOY_BLOCK)
  : 0n; // [memory:21]
export const ARWEAVE_GATEWAY_PORT = import.meta.env.VITE_ARWEAVE_GATEWAY_PORT || ''; // [memory:21]
export const ARWEAVE_GATEWAY_PROTO = import.meta.env.VITE_ARWEAVE_GATEWAY_PROTO || 'https'; // [memory:21]
export const ARWEAVE_GATEWAY_HOST = import.meta.env.VITE_ARWEAVE_GATEWAY_HOST || 'ar-io.net'; // [memory:21]
const ARWEAVE_GATEWAY_PORT_RAW = (import.meta.env.VITE_ARWEAVE_GATEWAY_PORT || '').toString().replace(/^:/, ''); // [memory:21]
export const ARWEAVE_ORIGIN = (() => {
  const p = ARWEAVE_GATEWAY_PROTO; // [memory:21]
  const h = ARWEAVE_GATEWAY_HOST; // [memory:21]
  const port = ARWEAVE_GATEWAY_PORT_RAW; // [memory:21]
  if (!port) return `${p}://${h}`; // [memory:21]
  if ((p === 'https' && port === '443') || (p === 'http' && port === '80')) return `${p}://${h}`; // [memory:21]
  return `${p}://${h}:${port}`; // [memory:21]
})(); // [memory:21]
