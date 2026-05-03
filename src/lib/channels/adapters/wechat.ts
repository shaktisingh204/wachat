/**
 * WeChat Work (企业微信) adapter.
 *
 * For SaaS use cases SabNode targets WeChat Work rather than the consumer
 * Official Account platform — it's the only WeChat surface that allows
 * push messages from CRMs without 48h windows.
 *
 * Docs: https://developer.work.weixin.qq.com/document/path/90235
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

interface WeChatCreds extends ChannelCredentials {
    /** Pre-fetched access_token (caller refreshes via gettoken endpoint). */
    accessToken?: string;
    /** AgentId for the application sending the message. */
    agentId?: string;
}

const WW_API = 'https://qyapi.weixin.qq.com/cgi-bin';

export const wechatAdapter: ChannelAdapter = {
    channel: 'wechat',
    displayName: 'WeChat Work',

    async send(
        creds: ChannelCredentials,
        to: ContactRef,
        content: MessageContent,
        opts?: SendOptions,
    ): Promise<SendResult> {
        const c = creds as WeChatCreds;
        if (!c.accessToken || !c.agentId) {
            throw new ChannelError({
                channel: 'wechat',
                code: 'MISSING_CREDENTIALS',
                message: 'WeChat Work adapter requires `accessToken` and `agentId`',
            });
        }

        const body = {
            touser: to.address, // pipe-separated user ids per WeChat spec
            msgtype: content.kind === 'image' ? 'image' : 'text',
            agentid: Number(c.agentId),
            text: content.kind === 'text' ? { content: content.text ?? '' } : undefined,
            image:
                content.kind === 'image' && content.media?.[0]
                    ? { media_id: (content.raw?.mediaId as string | undefined) ?? content.media[0].url }
                    : undefined,
            safe: 0,
        };

        const url = `${WW_API}/message/send?access_token=${encodeURIComponent(c.accessToken)}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new ChannelError({
                channel: 'wechat',
                code: `HTTP_${res.status}`,
                message: `WeChat Work send failed: ${text}`,
                retryable: res.status >= 500,
            });
        }

        const json = (await res.json()) as { errcode?: number; errmsg?: string; msgid?: string };
        if (typeof json.errcode === 'number' && json.errcode !== 0) {
            throw new ChannelError({
                channel: 'wechat',
                code: `WECHAT_${json.errcode}`,
                message: json.errmsg ?? 'WeChat error',
                retryable: json.errcode >= 60000,
            });
        }

        const messageId = opts?.idempotencyKey ?? json.msgid ?? `wc_${Date.now()}`;
        return { messageId, providerMessageId: json.msgid, status: 'sent' };
    },
};

export default wechatAdapter;
