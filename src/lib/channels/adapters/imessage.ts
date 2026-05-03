/**
 * Apple Messages for Business (AMB) — interface-only stub.
 *
 * AMB is gated behind Apple's Messages for Business Register (MSP partner
 * required) and does not expose a public REST endpoint we can call without
 * an approved partnership. This adapter exists so the routing/registry
 * surface is stable; it throws on `send()` until a real implementation is
 * provisioned.
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

interface IMessageCreds extends ChannelCredentials {
    /** Apple-issued business id (uuid). */
    businessId?: string;
    /** MSP-issued bearer token. */
    mspToken?: string;
    /** MSP gateway base url (varies per MSP). */
    mspBaseUrl?: string;
}

export const imessageAdapter: ChannelAdapter = {
    channel: 'imessage',
    displayName: 'Apple Messages for Business',
    stub: true,

    async send(
        creds: ChannelCredentials,
        _to: ContactRef,
        _content: MessageContent,
        _opts?: SendOptions,
    ): Promise<SendResult> {
        const c = creds as IMessageCreds;
        if (!c.businessId || !c.mspToken || !c.mspBaseUrl) {
            throw new ChannelError({
                channel: 'imessage',
                code: 'MISSING_CREDENTIALS',
                message:
                    'Apple Messages for Business requires businessId, mspToken and mspBaseUrl from an approved MSP',
            });
        }
        throw new ChannelError({
            channel: 'imessage',
            code: 'NOT_IMPLEMENTED',
            message:
                'Apple Messages for Business adapter is a stub — wire your MSP gateway here',
        });
    },
};

export default imessageAdapter;
