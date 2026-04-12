
'use server';

import type { WithId, User } from '@/lib/definitions';
import { google } from 'googleapis';
import { googleAuthClient } from '@/lib/crm-auth';

async function getGmailClient(user: WithId<User>) {
    const settings = (user as any).sabFlowConnections?.find((c: any) => c.appName === 'Gmail');
    if (!settings?.credentials) {
        throw new Error('Gmail is not connected.');
    }
    let { accessToken, refreshToken, expiry_date } = settings.credentials;
    if (!refreshToken) throw new Error('Missing refresh token — reconnect Gmail with offline access.');

    const expiryMs = typeof expiry_date === 'number' ? expiry_date : 0;
    const needsRefresh = !accessToken || !expiryMs || Date.now() >= (expiryMs - 60_000);
    if (needsRefresh) {
        googleAuthClient.setCredentials({ refresh_token: refreshToken });
        const { credentials } = await googleAuthClient.refreshAccessToken();
        accessToken = credentials.access_token;
    }
    googleAuthClient.setCredentials({ access_token: accessToken });
    return google.gmail({ version: 'v1', auth: googleAuthClient });
}

function buildRawMessage({
    to,
    subject,
    body,
    cc,
    bcc,
}: { to: string; subject: string; body: string; cc?: string; bcc?: string }): string {
    const headers: string[] = [];
    headers.push(`To: ${to}`);
    if (cc) headers.push(`Cc: ${cc}`);
    if (bcc) headers.push(`Bcc: ${bcc}`);
    headers.push(`Subject: ${subject}`);
    // Detect HTML vs plain text heuristically
    const isHtml = /<[a-z][\s\S]*>/i.test(body);
    headers.push('MIME-Version: 1.0');
    headers.push(isHtml ? 'Content-Type: text/html; charset="UTF-8"' : 'Content-Type: text/plain; charset="UTF-8"');
    const rfc822 = headers.join('\r\n') + '\r\n\r\n' + body;
    return Buffer.from(rfc822).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function executeGmailAction(
    actionName: string,
    inputs: any,
    user: WithId<User>,
    logger: any
) {
    try {
        const gmail = await getGmailClient(user);

        switch (actionName) {
            case 'sendEmail': {
                const to = String(inputs.to ?? '').trim();
                const subject = String(inputs.subject ?? '').trim();
                const body = String(inputs.body ?? '');
                if (!to || !subject) throw new Error('to and subject are required.');
                const raw = buildRawMessage({
                    to,
                    subject,
                    body,
                    cc: inputs.cc ? String(inputs.cc) : undefined,
                    bcc: inputs.bcc ? String(inputs.bcc) : undefined,
                });
                const res = await gmail.users.messages.send({
                    userId: 'me',
                    requestBody: { raw },
                });
                logger.log(`[Gmail] Sent message ${res.data.id}`);
                return { output: { messageId: res.data.id, threadId: res.data.threadId } };
            }

            case 'listMessages': {
                const query = inputs.query ? String(inputs.query) : undefined;
                const maxResults = Math.max(1, Math.min(100, Number(inputs.maxResults) || 10));
                const res = await gmail.users.messages.list({
                    userId: 'me',
                    q: query,
                    maxResults,
                });
                const messages = res.data.messages || [];
                return { output: { messages, count: messages.length } };
            }

            case 'getMessage': {
                const messageId = String(inputs.messageId ?? '').trim();
                if (!messageId) throw new Error('messageId is required.');
                const res = await gmail.users.messages.get({
                    userId: 'me',
                    id: messageId,
                    format: 'full',
                });
                return { output: { message: res.data } };
            }

            case 'markAsRead': {
                const messageId = String(inputs.messageId ?? '').trim();
                if (!messageId) throw new Error('messageId is required.');
                await gmail.users.messages.modify({
                    userId: 'me',
                    id: messageId,
                    requestBody: { removeLabelIds: ['UNREAD'] },
                });
                return { output: { success: 'true' } };
            }

            default:
                return { error: `Gmail action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        const msg = e?.response?.data?.error?.message || e?.message || 'Gmail action failed.';
        return { error: msg };
    }
}
