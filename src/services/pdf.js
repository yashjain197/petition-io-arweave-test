import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const MARGIN = 48;
const A4 = [595.28, 841.89]; // pt
const COLORS = {
  text: rgb(0.12, 0.12, 0.15),
  heading: rgb(0.05, 0.05, 0.1),
  subtle: rgb(0.78, 0.78, 0.82),
};

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
  return cursorY - lineHeight;
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

// Existing single-receipt builder kept as-is
export async function buildSignedPetitionPDF({
  network,
  signerAddress,
  campaign,
  txHash,
  signatureVersionId,
  arweaveTxId,
  signaturePngBytes,
  generatedAt,
}) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage(A4);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let current = { page, y: page.getHeight() - MARGIN };
  const inner = page.getWidth() - 2 * MARGIN;

  current.y = drawSectionTitle(current.page, 'Petition Signing Receipt', MARGIN, current.y, bold, 20, COLORS.heading);
  current = ensureSpace(pdfDoc, current.page, current.y, 20);

  const meta = [
    `Network: ${network}`,
    `Timestamp: ${generatedAt.toISOString()}`,
    `Transaction: ${txHash}`,
    `Signer: ${signerAddress}`,
  ].join('  •  ');
  current.y = drawWrapped(current.page, meta, MARGIN, current.y, inner, font, 10, 4, COLORS.text);
  drawDivider(current.page, MARGIN, current.y + 6, inner);
  current.y -= 16;

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

  current.y = drawSectionTitle(current.page, 'Description', MARGIN, current.y, bold, 14, COLORS.heading);
  current = ensureSpace(pdfDoc, current.page, current.y, 60);
  current.y = drawWrapped(current.page, campaign.description || '-', MARGIN, current.y, inner, font, 12, 6, COLORS.text);
  current.y -= 16;

  if (signaturePngBytes && signaturePngBytes.length) {
    const png = await pdfDoc.embedPng(signaturePngBytes);
    const maxW = inner;
    const maxH = 140;
    const scaled = png.scaleToFit(maxW, maxH);
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

  const bytes = await pdfDoc.save();
  return bytes;
}

// New: build a campaign-wide table of signatures with thumbnails
export async function buildCampaignSignaturesPDF({
  network,
  campaign, // { id, title, description, beneficiary, targetAmount }
  rows,     // [{ signer, message, timestamp, arweaveTxId, imageBytes|null }]
  generatedAt,
}) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage(A4);
  let y = page.getHeight() - MARGIN;
  const inner = page.getWidth() - 2 * MARGIN;

  y = drawSectionTitle(page, 'Campaign Signatures Export', MARGIN, y, bold, 20, COLORS.heading);
  y = drawWrapped(page, `Network: ${network}  •  Generated: ${generatedAt.toISOString()}`, MARGIN, y, inner, font, 10, 4, COLORS.text);
  y -= 8;
  y = drawWrapped(page, `Campaign #${campaign.id} — ${campaign.title}`, MARGIN, y, inner, bold, 12, 4, COLORS.text);
  y = drawWrapped(page, `Beneficiary: ${campaign.beneficiary}  •  Target (wei): ${campaign.targetAmount}`, MARGIN, y, inner, font, 11, 4, COLORS.text);
  drawDivider(page, MARGIN, y + 6, inner);
  y -= 16;

  // Table header
  const colX = {
    idx: MARGIN,
    addr: MARGIN + 40,
    msg: MARGIN + 260,
    time: MARGIN + 460,
    sig: MARGIN + 520,
  };
  const rowH = 66; // room for a 48px thumbnail
  page.drawText('#', { x: colX.idx, y, size: 11, font: bold, color: COLORS.heading });
  page.drawText('Address', { x: colX.addr, y, size: 11, font: bold, color: COLORS.heading });
  page.drawText('Message', { x: colX.msg, y, size: 11, font: bold, color: COLORS.heading });
  page.drawText('Time', { x: colX.time, y, size: 11, font: bold, color: COLORS.heading });
  page.drawText('Signature', { x: colX.sig, y, size: 11, font: bold, color: COLORS.heading });
  y -= 14;
  drawDivider(page, MARGIN, y + 6, inner);
  y -= 8;

  let index = 1;
  for (const r of rows) {
    if (y - rowH < MARGIN) {
      page = pdfDoc.addPage(A4);
      y = page.getHeight() - MARGIN;
    }

    // Address, message, time
    page.drawText(String(index), { x: colX.idx, y, size: 10, font, color: COLORS.text });
    const addrShort = `${r.signer.slice(0, 6)}…${r.signer.slice(-4)}`;
    page.drawText(addrShort, { x: colX.addr, y, size: 10, font, color: COLORS.text });
    const msg = (r.message || '').slice(0, 40);
    page.drawText(msg, { x: colX.msg, y, size: 10, font, color: COLORS.text });
    const dt = new Date(r.timestamp * 1000).toISOString().split('.')[0].replace('T', ' ');
    page.drawText(dt, { x: colX.time, y, size: 9, font, color: COLORS.text });

    // Thumbnail
    let drew = false;
    if (r.imageBytes && r.imageBytes.length) {
      try {
        const png = await pdfDoc.embedPng(r.imageBytes); // will fail if not valid PNG
        const scaled = png.scaleToFit(56, 48);
        page.drawImage(png, { x: colX.sig, y: y - (scaled.height - 12), width: scaled.width, height: scaled.height });
        drew = true;
      } catch {
        // not a PNG (likely encrypted octet-stream)
      }
    }
    if (!drew) {
      page.drawText('unavailable', { x: colX.sig, y, size: 9, font, color: COLORS.subtle });
    }

    y -= rowH;
    index++;
  }

  const bytes = await pdfDoc.save();
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
