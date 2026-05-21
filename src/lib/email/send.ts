/**
 * Lightweight email-send fallback.
 *
 * The production path is `dispatchTransactionalEmail` in
 * `@/lib/email-dispatcher`, which resolves the tenant's configured SMTP /
 * Google OAuth / Outlook OAuth transport. This stub is used when:
 *  - a tenant has not yet configured `email_settings`, OR
 *  - a caller does not have a tenant context (cron jobs, scripts).
 *
 * It logs the request and returns `{ ok: true }` so caller code can be
 * written without branching on send availability.
 */

import 'server-only';

export interface SendEmailResult {
    ok: boolean;
    error?: string;
}

export async function sendEmail(
    to: string,
    subject: string,
    html: string,
): Promise<SendEmailResult> {
    // TODO: wire to a platform-wide SMTP fallback once provisioned.
    console.log('[email/send] stub send', {
        to,
        subject,
        bodyLength: html.length,
    });
    return { ok: true };
}
