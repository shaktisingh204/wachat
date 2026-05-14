/**
 * E-sign provider adapter layer.
 *
 * Contracts can be sent for signature through one of several providers.
 * The internal provider sends a simple email with a magic-link to the
 * tenant-hosted `/sign/[contractId]/[signerToken]` page (this repo).
 *
 * Digio, DocuSign, and Aadhaar are stubbed — they keep the adapter
 * shape but return `{ ok: false, error: 'TODO' }` until a real
 * integration is wired up. They are intentionally still selectable so
 * the UI doesn't surprise users when an integration ships later.
 */

import 'server-only';

import { getTransporter } from '@/lib/email-service';

export type EsignProviderId = 'internal' | 'digio' | 'docusign' | 'aadhaar';

export interface SendForSignatureResult {
    ok: boolean;
    providerRef?: string;
    error?: string;
}

export interface SendForSignatureArgs {
    contractId: string;
    contractTitle: string;
    signerEmail: string;
    signerName: string;
    magicLinkUrl: string;
    /** Tenant userId — needed for outbound email via that tenant's mailer. */
    tenantUserId: string;
}

export interface EsignProvider {
    id: EsignProviderId;
    sendForSignature(args: SendForSignatureArgs): Promise<SendForSignatureResult>;
}

// ──────────────────────────────────────────────────────────────────
// Internal provider — uses the tenant's configured mailer to send a
// magic-link email pointing back at our `/sign/...` route.
// ──────────────────────────────────────────────────────────────────

export const internalProvider: EsignProvider = {
    id: 'internal',
    async sendForSignature({
        contractTitle,
        signerEmail,
        signerName,
        magicLinkUrl,
        tenantUserId,
    }): Promise<SendForSignatureResult> {
        try {
            const transporter = await getTransporter(tenantUserId);
            const subject = `Action required: sign "${contractTitle}"`;
            const safeName = signerName?.trim() || 'there';
            const html = `<!DOCTYPE html><html><body style="font-family:system-ui,-apple-system,sans-serif;background:#f8fafc;padding:24px;color:#0f172a">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
    <tr><td style="padding:24px 28px">
      <h1 style="margin:0 0 8px;font-size:20px;font-weight:600">Hi ${escapeHtml(safeName)},</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:22px;color:#334155">
        You've been asked to electronically sign <strong>${escapeHtml(contractTitle)}</strong>.
        This link is unique to you — please don't share it.
      </p>
      <p style="margin:0 0 24px">
        <a href="${magicLinkUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;font-weight:600;font-size:14px;padding:10px 18px;border-radius:8px;text-decoration:none">
          Review &amp; sign
        </a>
      </p>
      <p style="margin:0;font-size:12px;line-height:18px;color:#64748b">
        If the button doesn't work, paste this link into your browser:<br>
        <span style="word-break:break-all">${magicLinkUrl}</span>
      </p>
    </td></tr>
  </table>
</body></html>`;
            const text = `Hi ${safeName},\n\nYou've been asked to electronically sign "${contractTitle}".\n\nReview & sign: ${magicLinkUrl}\n\nThis link is unique to you — please don't share it.`;
            await transporter.sendMail({
                to: signerEmail,
                subject,
                html,
                text,
            });
            return { ok: true, providerRef: 'internal-email' };
        } catch (e: any) {
            const error = e?.message || 'Failed to deliver signing email.';
            // Surface but don't throw — the caller decides whether to
            // mark the contract `sent` regardless.
            console.error('[esign:internal] sendForSignature failed:', e);
            return { ok: false, error };
        }
    },
};

// ──────────────────────────────────────────────────────────────────
// Stubbed providers — preserve the shape so callers can switch over
// without conditionals once the real integration lands.
// ──────────────────────────────────────────────────────────────────

export const digioProvider: EsignProvider = {
    id: 'digio',
    async sendForSignature(): Promise<SendForSignatureResult> {
        // TODO(esign): wire to Digio's `/v3/client/document/upload` +
        // signer-request endpoints once the workspace has the API key.
        return { ok: false, error: 'Digio integration TODO' };
    },
};

export const docuSignProvider: EsignProvider = {
    id: 'docusign',
    async sendForSignature(): Promise<SendForSignatureResult> {
        // TODO(esign): wire to DocuSign eSignature REST API
        // (`/v2.1/accounts/{accountId}/envelopes`) once OAuth is set up.
        return { ok: false, error: 'DocuSign integration TODO' };
    },
};

export const aadhaarProvider: EsignProvider = {
    id: 'aadhaar',
    async sendForSignature(): Promise<SendForSignatureResult> {
        // TODO(esign): wire to NSDL/UIDAI Aadhaar e-Sign gateway. This
        // requires an ASP licence and a tenant-level KYC flow.
        return { ok: false, error: 'Aadhaar e-Sign integration TODO' };
    },
};

const PROVIDER_MAP: Record<EsignProviderId, EsignProvider> = {
    internal: internalProvider,
    digio: digioProvider,
    docusign: docuSignProvider,
    aadhaar: aadhaarProvider,
};

/**
 * Resolve a provider by id. Falls back to the internal provider when
 * the id is unknown / `'none'` / undefined so callers always get a
 * working provider object.
 */
export function getProvider(id?: string | null): EsignProvider {
    if (!id) return internalProvider;
    const key = id.toLowerCase() as EsignProviderId;
    return PROVIDER_MAP[key] ?? internalProvider;
}

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Build the public magic-link URL for a signer. Centralised so the
 * URL shape is consistent everywhere (server action, route handler,
 * re-send action, etc.).
 */
export function buildMagicLink(contractId: string, signerToken: string): string {
    const base = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
    return `${base}/sign/${encodeURIComponent(contractId)}/${encodeURIComponent(signerToken)}`;
}
