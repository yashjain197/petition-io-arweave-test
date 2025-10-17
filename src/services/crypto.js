// src/services/crypto.js
import { keccak256, toBytes } from 'viem';

export async function generateKey(){
  return await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt','decrypt']
  );
}

export async function exportKeyRaw(key){
  const raw = await crypto.subtle.exportKey('raw', key);
  return new Uint8Array(raw);
}

export async function importKeyRaw(raw){
  return await crypto.subtle.importKey('raw', raw, {name:'AES-GCM'}, true, ['encrypt','decrypt']);
}

export function randomNonce(){
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  return nonce;
}

export async function encryptBytes(key, bytes, nonce){
  const ct = await crypto.subtle.encrypt({name:'AES-GCM', iv: nonce}, key, bytes);
  return new Uint8Array(ct);
}

export async function decryptBytes(key, ct, nonce){
  const pt = await crypto.subtle.decrypt({name:'AES-GCM', iv: nonce}, key, ct);
  return new Uint8Array(pt);
}

export function hashKeccak(bytes){
  return keccak256(bytes);
}
