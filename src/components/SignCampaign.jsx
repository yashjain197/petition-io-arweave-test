import React from 'react';
import { useAccount, useWriteContract, useReadContract, usePublicClient } from 'wagmi';
import { PetitionCoreABI } from '../abi/PetitionCore';
import { PETITION_CORE, NETWORK } from '../config/constants';
import { parseEventLogs } from 'viem';
import { bytes32ToTxId } from '../utils/arweaveId';
import { importKeyRaw, decryptBytes, hashKeccak } from '../services/crypto';
import { buildSignedPetitionPDF, downloadPdfBytes } from '../services/pdf';

// Simple PNG magic check (89 50 4E 47 0D 0A 1A 0A)
function isPng(bytes) {
  if (!bytes || bytes.length < 8) return false;
  const sig = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
  for (let i = 0; i < 8; i++) if (bytes[i] !== sig[i]) return false;
  return true;
}

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

      // 3) Parse SignatureAdded from logs to get snapshot
      const logs = parseEventLogs({
        abi: PetitionCoreABI,
        logs: receipt.logs,
        eventName: 'SignatureAdded',
      });
      if (!logs.length) throw new Error('SignatureAdded event not found');
      const ev = logs[logs.length - 1];
      const {
        signatureId,
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

      // 5) Fetch signature bytes from Arweave
      const gwProto = import.meta.env.VITE_ARWEAVE_GATEWAY_PROTO || 'https';
      const gwHost = import.meta.env.VITE_ARWEAVE_GATEWAY_HOST || 'ar-io.net';
      const gwPort = import.meta.env.VITE_ARWEAVE_GATEWAY_PORT ? `:${import.meta.env.VITE_ARWEAVE_GATEWAY_PORT}` : '';
      const arTxId = bytes32ToTxId(signedArTxId);
      const url = `${gwProto}://${gwHost}${gwPort}/${arTxId}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('Failed to fetch signature from gateway');
      const raw = new Uint8Array(await resp.arrayBuffer());

      // 6) Verify integrity
      const onchain = String(signedContentHash).toLowerCase();
      const got = String(hashKeccak(raw)).toLowerCase();
      if (onchain !== got) {
        console.warn('Integrity mismatch with on-chain snapshot', { onchain, got });
      }

      // 7) Decide plaintext vs encrypted; decrypt only if needed and possible
      let pngBytes = null;
      if (isPng(raw)) {
        pngBytes = raw; // public/plain PNG
      } else {
        try {
          const keyB64 = localStorage.getItem('sig_key');
          const nonceB64 = localStorage.getItem('sig_nonce');
          if (keyB64 && nonceB64) {
            const key = await importKeyRaw(b64ToBytes(keyB64));
            const nonce = b64ToBytes(nonceB64);
            pngBytes = await decryptBytes(key, raw, nonce); // PNG bytes
          } else {
            // No local keys; keep pngBytes null (will render without image)
            console.warn('Encrypted signature but no local key/nonce present');
          }
        } catch (e) {
          console.warn('Decrypt failed, continuing without image', e);
        }
      }

      // 8) Build and download PDF (tx hash from this user’s transaction)
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
        signaturePngBytes: pngBytes,
        generatedAt: new Date(),
      });
      downloadPdfBytes(pdfBytes, `petition_${campaignId}_signature_${String(signatureId)}.pdf`);

      setMessage('');
      alert('Signed and PDF prepared.');
    } catch (e) {
      console.error(e);
      // Do not mask success of on-chain signature with UX fetch/decrypt issues
      alert(e?.shortMessage || e?.message || 'Sign flow encountered a non-critical error');
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
