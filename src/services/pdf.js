// src/services/pdf.js
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const MARGIN = 48;
const A4 = [595.28, 841.89]; // pt
const COLORS = {
  text: rgb(0.12, 0.12, 0.15),
  heading: rgb(0.05, 0.05, 0.1),
  subtle: rgb(0.78, 0.78, 0.82),
};

// Measures and draws wrapped text; returns next y
function drawWrapped(page, text, x, y, maxWidth, font, size, lineGap, color) {
  const words = String(text ?? '').split(/\s+/);
  const lineHeight = size + lineGap;
  let line = '';
  let cursorY = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    const wpt = font.widthOfTextAtSize(test, size);
    if (wpt > maxWidth) {
      if (line) page.drawText(line, { x, y: cursorY, size, font, color });
      cursorY -= lineHeight;
      line = w;
    } else {
      line = test;
    }
  }
  if (line) page.drawText(line, { x, y: cursorY, size, font, color });
  return cursorY - lineHeight; // next baseline below the last line
}

function ensureSpace(doc, page, y, needed) {
  if (y - needed >= MARGIN) return { page, y };
  const newPage = doc.addPage(A4);
  return { page: newPage, y: newPage.getHeight() - MARGIN };
}

function drawSectionTitle(page, text, x, y, font, size, color) {
  page.drawText(text, { x, y, size, font, color });
  return y - (size + 6);
}

function drawDivider(page, x, y, width) {
  page.drawLine({
    start: { x, y },
    end: { x: x + width, y },
    color: COLORS.subtle,
    thickness: 1,
  });
}

export async function buildSignedPetitionPDF({
  network,
  signerAddress,
  campaign,          // { id, title, description, beneficiary, targetAmount }
  txHash,
  signatureVersionId,
  arweaveTxId,
  signaturePngBytes, // Uint8Array (plaintext PNG)
  generatedAt,       // Date
}) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage(A4); // A4 portrait
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let current = { page, y: page.getHeight() - MARGIN };
  const inner = page.getWidth() - 2 * MARGIN;

  // Header
  current.y = drawSectionTitle(current.page, 'Petition Signing Receipt', MARGIN, current.y, bold, 20, COLORS.heading);
  current = ensureSpace(pdfDoc, current.page, current.y, 20);

  // Meta block
  const meta = [
    `Network: ${network}`,
    `Timestamp: ${generatedAt.toISOString()}`,
    `Transaction: ${txHash}`,
    `Signer: ${signerAddress}`,
  ].join('  •  ');
  current.y = drawWrapped(current.page, meta, MARGIN, current.y, inner, font, 10, 4, COLORS.text);
  drawDivider(current.page, MARGIN, current.y + 6, inner);
  current.y -= 16;

  // Campaign
  current.y = drawSectionTitle(current.page, 'Campaign', MARGIN, current.y, bold, 14, COLORS.heading);
  current = ensureSpace(pdfDoc, current.page, current.y, 90);
  current.y = drawWrapped(current.page, `ID: ${campaign.id}`, MARGIN, current.y, inner, font, 12, 4, COLORS.text);
  current.y = drawWrapped(current.page, `Title: ${campaign.title}`, MARGIN, current.y, inner, font, 12, 4, COLORS.text);
  current.y = drawWrapped(current.page, `Beneficiary: ${campaign.beneficiary}`, MARGIN, current.y, inner, font, 12, 4, COLORS.text);
  current.y = drawWrapped(current.page, `Target (wei): ${campaign.targetAmount}`, MARGIN, current.y, inner, font, 12, 4, COLORS.text);
  current.y = drawWrapped(current.page, `Signature Version ID: ${signatureVersionId}`, MARGIN, current.y, inner, font, 12, 4, COLORS.text);
  current.y = drawWrapped(current.page, `Arweave TX: ${arweaveTxId}`, MARGIN, current.y, inner, font, 12, 4, COLORS.text);
  drawDivider(current.page, MARGIN, current.y + 6, inner);
  current.y -= 20;

  // Description
  current.y = drawSectionTitle(current.page, 'Description', MARGIN, current.y, bold, 14, COLORS.heading);
  current = ensureSpace(pdfDoc, current.page, current.y, 60);
  current.y = drawWrapped(current.page, campaign.description || '-', MARGIN, current.y, inner, font, 12, 6, COLORS.text);
  current.y -= 16;

  // Signature image (scaled, capped, auto-page)
  if (signaturePngBytes && signaturePngBytes.length) {
    const png = await pdfDoc.embedPng(signaturePngBytes); // PNG embed
    const maxW = inner;
    const maxH = 140; // cap height
    const scaled = png.scaleToFit(maxW, maxH); // preserves aspect

    // Ensure space for title + image
    current = ensureSpace(pdfDoc, current.page, current.y, 18 + scaled.height);
    current.y = drawSectionTitle(current.page, 'Signature Image', MARGIN, current.y, bold, 14, COLORS.heading);
    current.page.drawImage(png, {
      x: MARGIN,
      y: current.y - scaled.height,
      width: scaled.width,
      height: scaled.height,
    });
    current.y -= scaled.height + 12;
  }

  const bytes = await pdfDoc.save(); // Uint8Array
  return bytes;
}

export function downloadPdfBytes(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'signed_petition.pdf';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
