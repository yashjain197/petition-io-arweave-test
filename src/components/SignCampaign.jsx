// src/components/SignCampaign.jsx
import React from 'react';
import { useAccount, useWriteContract, useReadContract, usePublicClient } from 'wagmi';
import { PetitionCoreABI } from '../abi/PetitionCore';
import { PETITION_CORE, NETWORK } from '../config/constants';
import { parseAbiItem, parseEventLogs, hexToBytes } from 'viem';
import { bytes32ToTxId } from '../utils/arweaveId';
import { importKeyRaw, decryptBytes, hashKeccak } from '../services/crypto';
import { buildSignedPetitionPDF, downloadPdfBytes } from '../services/pdf';

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export default function SignCampaign({ campaignId }) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const { data: feeWei } = useReadContract({
    abi: PetitionCoreABI,
    address: PETITION_CORE,
    functionName: '_calculateSignatureFee',
    args: [30n],
  });

  const [message, setMessage] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const onSign = async () => {
    try {
      setBusy(true);

      // 1) Send tx
      const hash = await writeContractAsync({
        abi: PetitionCoreABI,
        address: PETITION_CORE,
        functionName: 'signPetition',
        args: [BigInt(campaignId), message],
        value: feeWei ?? 0n,
      });

      // 2) Wait for receipt
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      // 3) Parse SignatureAdded from logs to get exact snapshot
      const logs = parseEventLogs({
        abi: PetitionCoreABI,
        logs: receipt.logs,
        eventName: 'SignatureAdded',
      });
      if (!logs.length) throw new Error('SignatureAdded event not found');
      const ev = logs[logs.length - 1]; // last occurrence
      const {
        campaignId: evCampaignId,
        signatureId,
        signer,
        signatureVersionId,
        signedArTxId,
        signedContentHash,
      } = ev.args;

      // 4) Read campaign info (for PDF details)
      const c = await publicClient.readContract({
        abi: PetitionCoreABI,
        address: PETITION_CORE,
        functionName: 'getCampaignInfo',
        args: [BigInt(campaignId)],
      });

      // 5) Fetch encrypted signature bytes from Arweave using the snapshotted txId
      const gwProto = import.meta.env.VITE_ARWEAVE_GATEWAY_PROTO || 'http';
      const gwHost = import.meta.env.VITE_ARWEAVE_GATEWAY_HOST || 'localhost';
      const gwPort = import.meta.env.VITE_ARWEAVE_GATEWAY_PORT ? `:${import.meta.env.VITE_ARWEAVE_GATEWAY_PORT}` : '';
      const arIdB32 = signedArTxId; // 0x...
      const arTxId = bytes32ToTxId(arIdB32);
      const url = `${gwProto}://${gwHost}${gwPort}/${arTxId}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('Failed to fetch encrypted signature from gateway');
      const ct = new Uint8Array(await resp.arrayBuffer());

      // 6) Verify integrity against snapshotted content hash
      const onchain = String(signedContentHash).toLowerCase();
      const got = String(hashKeccak(ct)).toLowerCase();
      if (onchain !== got) {
        console.warn('Integrity mismatch with on-chain snapshot', { onchain, got });
      }

      // 7) Decrypt with locally stored key/nonce
      const keyB64 = localStorage.getItem('sig_key');
      const nonceB64 = localStorage.getItem('sig_nonce');
      if (!keyB64 || !nonceB64) throw new Error('Missing local key/nonce to decrypt signature');
      const key = await importKeyRaw(b64ToBytes(keyB64));
      const nonce = b64ToBytes(nonceB64);
      const pt = await decryptBytes(key, ct, nonce); // PNG bytes

      // 8) Build and download PDF
      const pdfBytes = await buildSignedPetitionPDF({
        network: NETWORK || 'sepolia',
        signerAddress: address,
        campaign: {
          id: String(c.id),
          title: c.title,
          description: c.description,
          beneficiary: c.beneficiary,
          targetAmount: String(c.targetAmount),
        },
        txHash: hash,
        signatureVersionId: String(signatureVersionId),
        arweaveTxId: arTxId,
        signaturePngBytes: pt,
        generatedAt: new Date(),
      });
      downloadPdfBytes(pdfBytes, `petition_${campaignId}_signature_${String(signatureId)}.pdf`);

      setMessage('');
      alert('Signed and PDF downloaded!');
    } catch (e) {
      console.error(e);
      alert(e?.shortMessage || e?.message || 'Sign failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="row" style={{ marginTop: 8 }}>
      <input
        className="input"
        placeholder="Optional message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        disabled={busy}
      />
      <button className="primary" onClick={onSign} disabled={busy}>
        {busy ? 'Signing…' : 'Sign'}
      </button>
    </div>
  );
}
