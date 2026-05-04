/**
 * PSTN voice adapter — places outbound calls via Twilio's REST API.
 *
 * For SabNode the voice channel is used by the Calls module (`/wachat/calls`).
 * `MessageContent` for voice carries either a TwiML URL (`raw.twimlUrl`) or
 * a text body which we render with Twilio's `<Say>`.
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

interface VoiceCreds extends ChannelCredentials {
    accountSid?: string;
    authToken?: string;
    /** E.164 caller-id we present. */
    fromNumber?: string;
    /** Optional fully-qualified TwiML callback URL. */
    twimlUrl?: string;
}

const TWILIO_API = 'https://api.twilio.com/2010-04-01';

function requireCreds(c: VoiceCreds): Required<Pick<VoiceCreds, 'accountSid' | 'authToken' | 'fromNumber'>> {
    if (!c.accountSid || !c.authToken || !c.fromNumber) {
        throw new ChannelError({
            channel: 'voice',
            code: 'MISSING_CREDENTIALS',
            message:
                'voice adapter requires accountSid, authToken and fromNumber',
        });
    }
    return {
        accountSid: c.accountSid,
        authToken: c.authToken,
        fromNumber: c.fromNumber,
    };
}

export const voiceAdapter: ChannelAdapter = {
    channel: 'voice',
    displayName: 'Voice (PSTN)',

    async send(
        creds: ChannelCredentials,
        to: ContactRef,
        content: MessageContent,
        opts?: SendOptions,
    ): Promise<SendResult> {
        const c = requireCreds(creds as VoiceCreds);

        const twiml =
            (content.raw?.twiml as string | undefined) ??
            (content.text
                ? `<Response><Say>${escapeXml(content.text)}</Say></Response>`
                : undefined);

        const twimlUrl =
            (content.raw?.twimlUrl as string | undefined) ??
            (creds as VoiceCreds).twimlUrl;

        if (!twiml && !twimlUrl) {
            throw new ChannelError({
                channel: 'voice',
                code: 'INVALID_CONTENT',
                message: 'voice send needs content.text, content.raw.twiml or twimlUrl',
            });
        }

        const body = new URLSearchParams();
        body.set('To', to.address);
        body.set('From', c.fromNumber);
        if (twimlUrl) body.set('Url', twimlUrl);
        else if (twiml) body.set('Twiml', twiml);

        const auth = Buffer.from(`${c.accountSid}:${c.authToken}`).toString('base64');
        const res = await fetch(
            `${TWILIO_API}/Accounts/${encodeURIComponent(c.accountSid)}/Calls.json`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Basic ${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    ...(opts?.idempotencyKey
                        ? { 'Idempotency-Key': opts.idempotencyKey }
                        : {}),
                },
                body,
            },
        );

        if (!res.ok) {
            const text = await safeText(res);
            throw new ChannelError({
                channel: 'voice',
                code: `HTTP_${res.status}`,
                message: `Twilio call failed: ${text}`,
                retryable: res.status >= 500,
            });
        }

        const json = (await res.json()) as { sid?: string; status?: string };
        return {
            messageId: opts?.idempotencyKey ?? json.sid ?? cryptoId(),
            providerMessageId: json.sid,
            status: mapStatus(json.status),
        };
    },
};

function mapStatus(s?: string): SendResult['status'] {
    switch (s) {
        case 'queued':
        case 'initiated':
            return 'queued';
        case 'ringing':
        case 'in-progress':
            return 'sent';
        case 'completed':
            return 'delivered';
        case 'busy':
        case 'no-answer':
        case 'failed':
        case 'canceled':
            return 'failed';
        default:
            return 'unknown';
    }
}

function escapeXml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

async function safeText(r: Response): Promise<string> {
    try {
        return await r.text();
    } catch {
        return '';
    }
}

function cryptoId(): string {
    // Lightweight non-crypto id; voice flows always have a Twilio SID,
    // this is purely a fallback when the provider response is malformed.
    return `vc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export default voiceAdapter;
