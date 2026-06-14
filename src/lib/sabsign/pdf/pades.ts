import 'server-only';

/**
 * PAdES digital signatures (adapter). When a per-deployment P12 signing
 * certificate is configured, the flattened signed PDF is additionally given a
 * PAdES-B-B cryptographic signature; otherwise the image-stamp + audit-trail
 * (legally-valid SES) remains the default. Verification detects + inspects an
 * embedded signature.
 *
 * Enable by setting:
 *   SABSIGN_PADES_P12_BASE64     — base64 of the .p12/.pfx cert bundle
 *   SABSIGN_PADES_P12_PASSWORD   — its passphrase
 */

export function padesEnabled(): boolean {
  return (
    !!process.env.SABSIGN_PADES_P12_BASE64 && !!process.env.SABSIGN_PADES_P12_PASSWORD
  );
}

export interface PadesMeta {
  reason?: string;
  name?: string;
  contactInfo?: string;
  location?: string;
}

/**
 * Apply a PAdES signature to `pdfBytes`. No-op (returns input) when PAdES isn't
 * configured. Never throws into the caller — a signing failure falls back to
 * the unsigned (image-stamped) document.
 */
export async function signPdfPades(
  pdfBytes: Uint8Array,
  meta: PadesMeta = {},
): Promise<Uint8Array> {
  if (!padesEnabled()) return pdfBytes;
  try {
    const { PDFDocument } = await import('pdf-lib');
    const { pdflibAddPlaceholder } = await import('@signpdf/placeholder-pdf-lib');
    const signpdfMod: unknown = await import('@signpdf/signpdf');
    const { P12Signer } = await import('@signpdf/signer-p12');

    const p12 = Buffer.from(process.env.SABSIGN_PADES_P12_BASE64 as string, 'base64');
    const pdfDoc = await PDFDocument.load(pdfBytes);
    pdflibAddPlaceholder({
      pdfDoc,
      reason: meta.reason ?? 'Signed with SabSign',
      contactInfo: meta.contactInfo ?? '',
      name: meta.name ?? 'SabSign',
      location: meta.location ?? '',
    });
    const withPlaceholder = Buffer.from(await pdfDoc.save());
    const signer = new P12Signer(p12, {
      passphrase: process.env.SABSIGN_PADES_P12_PASSWORD as string,
    });
    const signpdf =
      (signpdfMod as { default?: { sign: (b: Buffer, s: unknown) => Promise<Buffer> } })
        .default ?? (signpdfMod as { sign: (b: Buffer, s: unknown) => Promise<Buffer> });
    const signed = await signpdf.sign(withPlaceholder, signer);
    return new Uint8Array(signed);
  } catch (e) {
    console.error('[sabsign] PAdES signing failed, returning unsigned PDF:', e);
    return pdfBytes;
  }
}

export interface PdfSignatureInfo {
  signed: boolean;
  /** Subject common-name(s) extracted from the embedded certificate, if any. */
  signers: string[];
}

/**
 * Inspect a PDF for an embedded signature. Detects the PAdES/PKCS#7 signature
 * dictionary and extracts signer certificate subject CNs via node-forge.
 * (Presence + signer identity; full byte-range chain validation is a refinement.)
 */
export async function verifyPdfSignature(pdfBytes: Uint8Array): Promise<PdfSignatureInfo> {
  const buf = Buffer.from(pdfBytes);
  const text = buf.toString('latin1');
  const signed = text.includes('/ByteRange') && /\/Type\s*\/Sig/.test(text);
  if (!signed) return { signed: false, signers: [] };

  const signers: string[] = [];
  try {
    // Pull the /Contents <hex> PKCS#7 blob and parse it with forge.
    const m = /\/Contents\s*<([0-9A-Fa-f]+)>/.exec(text);
    if (m) {
      const forge = (await import('node-forge')).default ?? (await import('node-forge'));
      const der = (forge as typeof import('node-forge')).util.hexToBytes(m[1].replace(/0+$/, ''));
      const asn1 = (forge as typeof import('node-forge')).asn1.fromDer(der, false);
      const p7 = (forge as typeof import('node-forge')).pkcs7.messageFromAsn1(asn1) as {
        certificates?: Array<{ subject: { getField: (s: string) => { value: string } | null } }>;
      };
      for (const cert of p7.certificates ?? []) {
        const cn = cert.subject.getField('CN');
        if (cn?.value) signers.push(cn.value);
      }
    }
  } catch (e) {
    console.warn('[sabsign] signature certificate parse failed:', e);
  }
  return { signed: true, signers };
}
