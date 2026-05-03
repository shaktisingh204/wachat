/**
 * RCS Business Messaging adapter (Google Jibe).
 *
 * Uses the RBM REST API:
 *   POST https://rcsbusinessmessaging.googleapis.com/v1/phones/{phoneNumber}/agentMessages
 *
 * Auth is service-account based; callers pass an OAuth access token which our
 * standard JWT signer mints upstream of this adapter.
 */

import {
    ChannelAdapter,
    ChannelCredentials,
    ChannelError,
    ContactRef,
    MessageContent,
    SendOptions,
    SendResult,
} from '../types';

interface RcsCreds extends ChannelCredentials {
    /** Pre-minted Google OAuth access token (scope: rcsbusinessmessaging). */
    accessToken?: string;
    /** Brand agent id, e.g. "agent-id". */
    agentId?: string;
}

const RBM_BASE = 'https://rcsbusinessmessaging.googleapis.com/v1';

export const rcsAdapter: ChannelAdapter = {
    channel: 'rcs',
    displayName: 'RCS Business Messaging',

    async send(
        creds: ChannelCredentials,
        to: ContactRef,
        content: MessageContent,
        opts?: SendOptions,
    ): Promise<SendResult> {
        const c = creds as RcsCreds;
        if (!c.accessToken) {
            throw new ChannelError({
                channel: 'rcs',
                code: 'MISSING_CREDENTIALS',
                message: 'RCS adapter requires `accessToken`',
            });
        }

        const messageId = opts?.idempotencyKey ?? `rcs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        const body =
            content.kind === 'text'
                ? {
                      messageId,
                      contentMessage: { text: content.text ?? '' },
                  }
                : {
                      messageId,
                      contentMessage: {
                          richCard: content.raw?.richCard ?? { standaloneCard: { thumbnailImageAlignment: 'LEFT', cardOrientation: 'VERTICAL', cardContent: { title: content.text ?? '' } } },
                      },
                  };

        const url = `${RBM_BASE}/phones/${encodeURIComponent(to.address)}/agentMessages?messageId=${encodeURIComponent(messageId)}`;

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${c.accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new ChannelError({
                channel: 'rcs',
                code: `HTTP_${res.status}`,
                message: `RBM send failed: ${text}`,
                retryable: res.status >= 500,
            });
        }

        return {
            messageId,
            providerMessageId: messageId,
            status: 'sent',
        };
    },
};

export default rcsAdapter;
