import 'server-only';

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

import type { SabSignEnvelopeDoc } from '@/lib/rust-client/sabsign-envelopes';

/**
 * Flatten an envelope's filled field values into its source PDF, producing the
 * final signed document bytes.
 *
 * Coordinate convention: fields are stored page-relative on a 0–1000 grid on
 * each axis, top-left origin (the builder's documented convention). pdf-lib's
 * origin is bottom-left, so y is flipped. NOTE: pixel-perfect placement
 * depends on the form builder writing true page-relative 0–1000 coords; until
 * the builder is upgraded to per-page pdfjs rendering, placement is
 * approximate (tracked in the plan).
 *
 * Signature/initials values may be a data-URL image (drawn as an image) or
 * typed text (drawn as text). Checkboxes draw an "X" when truthy.
 */
export async function renderSignedPdf(
  origBytes: Uint8Array,
  env: SabSignEnvelopeDoc,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(origBytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = pdf.getPages();

  for (const f of env.fields ?? []) {
    const value = f.value;
    if (value == null || value === '') continue;

    const pageIdx = Math.min(Math.max(0, (f.page ?? 1) - 1), pages.length - 1);
    const page = pages[pageIdx];
    if (!page) continue;

    const pw = page.getWidth();
    const ph = page.getHeight();
    const x = (f.x / 1000) * pw;
    const wpt = (f.w / 1000) * pw;
    const hpt = (f.h / 1000) * ph;
    const yTop = (f.y / 1000) * ph;
    const yPdf = ph - yTop - hpt; // top-left → bottom-left origin

    try {
      if (value.startsWith('data:image')) {
        const comma = value.indexOf(',');
        const meta = value.slice(0, comma);
        const b64 = value.slice(comma + 1);
        const imgBytes = Uint8Array.from(Buffer.from(b64, 'base64'));
        const img = meta.includes('jpeg') || meta.includes('jpg')
          ? await pdf.embedJpg(imgBytes)
          : await pdf.embedPng(imgBytes);
        page.drawImage(img, { x, y: yPdf, width: wpt, height: hpt });
      } else if (f.fieldType === 'checkbox') {
        if (value === 'true' || value === '1' || value === 'on' || value === 'checked') {
          const size = Math.min(hpt, 16);
          page.drawText('X', { x: x + 2, y: yPdf + 2, size, font, color: rgb(0, 0, 0) });
        }
      } else {
        const size = Math.min(12, Math.max(8, hpt * 0.55));
        page.drawText(String(value), {
          x: x + 2,
          y: yPdf + Math.max(2, (hpt - size) / 2),
          size,
          font,
          color: rgb(0.05, 0.05, 0.05),
          maxWidth: Math.max(10, wpt - 4),
        });
      }
    } catch (err) {
      // A single malformed field must not abort the whole document.
      console.error(`[sabsign] field ${f.id} render failed:`, err);
    }
  }

  return pdf.save();
}
