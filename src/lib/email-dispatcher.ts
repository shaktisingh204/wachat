/**
 * Transactional email dispatcher (Phase 4 wiring).
 *
 * Thin wrapper over the existing per-tenant `getTransporter()` helper in
 * `src/lib/email-service.ts`. Callers (portal magic links, automation
 * actions, dunning, reports delivery) hit this single entry point so the
 * SMTP / Google OAuth / Outlook OAuth credential resolution and signing
 * stays in one place.
 *
 * The dispatcher itself never throws — every code path returns a result
 * object so failures don't break the caller's flow. Callers are still
 * expected to wrap the call in try/catch as defence-in-depth.
 */
import 'server-only';

import { ObjectId } from 'mongodb';

import type { EmailSettings, WithId } from './definitions';
import { connectToDatabase } from './mongodb';

export interface DispatchTransactionalEmailInput {
    /** Owning tenant userId — same value as `email_settings.userId`. */
    tenantUserId: string;
    to: string | string[];
    subject: string;
    /** Plain text body. Used when `html` is absent. */
    body?: string;
    /** Optional rendered HTML body. */
    html?: string;
    /** Optional CC / BCC. */
    cc?: string | string[];
    bcc?: string | string[];
    /** Nodemailer-compatible attachments. CSV report delivery uses this. */
    attachments?: Array<{
        filename: string;
        content: string | Buffer;
        contentType?: string;
    }>;
    /** Optional template id — surfaced in logs for correlation. */
    templateId?: string;
}

export interface DispatchTransactionalEmailResult {
    ok: boolean;
    messageId?: string;
    /** Recipients the transport accepted (normalised to an array). */
    accepted?: string[];
    /** Machine-readable reason when `ok === false`. */
    error?: string;
}

/**
 * Send a transactional email through the tenant's configured transport.
 *
 * Resolves the tenant's `email_settings` doc by `tenantUserId`, builds a
 * Nodemailer transport (SMTP / Google OAuth2 / Outlook OAuth2), and sends.
 *
 * Failure modes (returned, never thrown):
 *   - `tenant_user_id_missing` — caller didn't pass a tenant id.
 *   - `recipient_missing` — empty `to`.
 *   - `email_settings_missing` — tenant hasn't configured a sender yet.
 *   - `send_failed: <underlying message>` — transport-level error.
 */
export async function dispatchTransactionalEmail(
    input: DispatchTransactionalEmailInput,
): Promise<DispatchTransactionalEmailResult> {
    const tenantUserId = (input.tenantUserId ?? '').toString().trim();
    if (!tenantUserId || !ObjectId.isValid(tenantUserId)) {
        return { ok: false, error: 'tenant_user_id_missing' };
    }
    const recipients = normaliseRecipients(input.to);
    if (recipients.length === 0) {
        return { ok: false, error: 'recipient_missing' };
    }

    try {
        const { db } = await connectToDatabase();
        const settings = await db
            .collection<WithId<EmailSettings>>('email_settings')
            .findOne({ userId: new ObjectId(tenantUserId) });
        if (!settings) {
            return { ok: false, error: 'email_settings_missing' };
        }

        // Lazy import keeps the (heavy) nodemailer / msal modules out of
        // the warm path for callers that never trigger a real send.
        const { getTransporter } = await import('./email-service');
        const transporter = await getTransporter(tenantUserId);

        const fromAddress = settings.fromEmail ?? '';
        const fromName = settings.fromName ?? '';
        const from = fromName
            ? `"${fromName.replace(/"/g, '\\"')}" <${fromAddress}>`
            : fromAddress;

        const html = input.html;
        const text = input.body ?? (html ? stripHtml(html) : '');

        const info = await transporter.sendMail({
            from,
            to: recipients.join(','),
            cc: input.cc
                ? normaliseRecipients(input.cc).join(',') || undefined
                : undefined,
            bcc: input.bcc
                ? normaliseRecipients(input.bcc).join(',') || undefined
                : undefined,
            subject: input.subject,
            text,
            html,
            attachments: input.attachments,
        });

        return {
            ok: true,
            messageId:
                typeof (info as { messageId?: unknown }).messageId === 'string'
                    ? (info as { messageId: string }).messageId
                    : undefined,
            accepted: Array.isArray((info as { accepted?: unknown[] }).accepted)
                ? (info as { accepted: unknown[] }).accepted.map(String)
                : recipients,
        };
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn('[email-dispatcher] send failed', {
            tenantUserId,
            templateId: input.templateId,
            error: msg,
        });
        return { ok: false, error: `send_failed: ${msg}` };
    }
}

function normaliseRecipients(input: string | string[] | undefined): string[] {
    if (!input) return [];
    const arr = Array.isArray(input) ? input : [input];
    return arr
        .map((s) => (typeof s === 'string' ? s.trim() : ''))
        .filter((s) => s.length > 0 && s.includes('@'));
}

function stripHtml(html: string): string {
    return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}
