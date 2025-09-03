import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const FONT_URL = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosans/NotoSans-Regular.ttf';
const DEFAULT_POSITION = 'bottom-right';
const DEFAULT_FONT_SIZE = 11;

function computePosition(page, text, font, size, posKey, margin = 36) {
  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();
  const textWidth = font.widthOfTextAtSize(text, size);
  const textHeight = size;

  let x = margin;
  let y = pageHeight - margin - textHeight;

  if (posKey.includes('center')) x = (pageWidth - textWidth) / 2;
  else if (posKey.includes('right')) x = pageWidth - margin - textWidth;

  if (posKey.startsWith('top')) y = pageHeight - margin - textHeight;
  else if (posKey.startsWith('bottom')) y = margin;

  return { x, y };
}

export default async function handler(req, res) {
  // CORS đơn giản
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const { pdfUrl, text, pos = DEFAULT_POSITION, size } = req.query || {};
    if (!pdfUrl || !text) return res.status(400).send('Missing pdfUrl or text');

    const fontSize = Number.isFinite(Number(size)) ? Number(size) : DEFAULT_FONT_SIZE;

    const pdfResp = await fetch(pdfUrl);
    if (!pdfResp.ok) throw new Error('Fetch PDF failed');
    const pdfBytes = await pdfResp.arrayBuffer();

    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    pdfDoc.registerFontkit(fontkit);

    let drawFont;
    try {
      const f = await fetch(FONT_URL);
      if (!f.ok) throw new Error('Font fetch failed');
      const fontBytes = await f.arrayBuffer();
      drawFont = await pdfDoc.embedFont(fontBytes, { subset: true });
    } catch {
      drawFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    }

    const page = pdfDoc.getPage(0);
    const { x, y } = computePosition(page, text, drawFont, fontSize, pos);
    page.drawText(text, { x, y, size: fontSize, font: drawFont, color: rgb(0, 0, 0) });

    const outBytes = await pdfDoc.save();
    const baseName = (new URL(pdfUrl).pathname.split('/').pop() || 'document.pdf').replace(/\.pdf$/i, '');
    const outName = `${baseName}-edited.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${outName}"`);
    res.send(Buffer.from(outBytes));
  } catch (e) {
    res.status(500).send(e?.message || 'Server error');
  }
}
