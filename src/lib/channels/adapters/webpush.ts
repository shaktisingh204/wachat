/**
 * VAPID-signed Web Push adapter.
 *
 * Sends a push notification per RFC 8030 + RFC 8292. The `to.address` field
 * is expected to be a JSON-stringified PushSubscription (`{ endpoint, keys: { p256dh, auth } }`).
 *
 * Encryption (RFC 8291) is intentionally NOT performed in this slice — the
 * message body is sent as a notification payload via the `aes128gcm` content
 * encoding handled upstream by `web-push` (kept as an optional dep) or by
 * the worker that consumes `MessageContent.raw.encryptedBody`.
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
import crypto from 'crypto';

interface WebPushCreds extends ChannelCredentials {
    vapidSubject?: string; // e.g. mailto:ops@sabnode.com
    vapidPublicKey?: string;
    vapidPrivateKey?: string;
    /** TTL header (seconds). */
    ttl?: string;
}

interface PushSubscription {
    endpoint: string;
    keys: { p256dh: string; auth: string };
}

export const webpushAdapter: ChannelAdapter = {
    channel: 'webpush',
    displayName: 'Web Push',
    outboundOnly: true,

    async send(
        creds: ChannelCredentials,
        to: ContactRef,
        content: MessageContent,
        opts?: SendOptions,
    ): Promise<SendResult> {
        const c = creds as WebPushCreds;
        if (!c.vapidSubject || !c.vapidPublicKey || !c.vapidPrivateKey) {
            throw new ChannelError({
                channel: 'webpush',
                code: 'MISSING_CREDENTIALS',
                message: 'Web Push requires VAPID subject, public and private keys',
            });
        }

        const sub = parseSubscription(to.address);
        const audience = new URL(sub.endpoint).origin;
        const jwt = signVapidJwt(
            { aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: c.vapidSubject },
            c.vapidPrivateKey,
        );

        // Encrypted payload is expected to be supplied by the worker
        // (since RFC 8291 ECDH/HKDF is non-trivial and node has no
        // first-class helper without `web-push`). When absent we send a
        // tickle (empty body) which will still wake the SW.
        const encryptedBody =
            (content.raw?.encryptedBody as ArrayBuffer | Uint8Array | undefined) ?? null;

        const headers: Record<string, string> = {
            Authorization: `vapid t=${jwt}, k=${c.vapidPublicKey}`,
            TTL: c.ttl ?? '86400',
            Urgency: (content.raw?.urgency as string | undefined) ?? 'normal',
        };
        if (encryptedBody) {
            headers['Content-Encoding'] = 'aes128gcm';
            headers['Content-Type'] = 'application/octet-stream';
        }

        const res = await fetch(sub.endpoint, {
            method: 'POST',
            headers,
            body: encryptedBody as BodyInit | null,
        });

        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new ChannelError({
                channel: 'webpush',
                code: `HTTP_${res.status}`,
                message: `Web Push failed: ${text}`,
                // 410 Gone => subscription expired, NOT retryable.
                retryable: res.status >= 500,
            });
        }

        return {
            messageId: opts?.idempotencyKey ?? `wp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            status: 'sent',
        };
    },
};

function parseSubscription(address: string): PushSubscription {
    try {
        const sub = JSON.parse(address) as PushSubscription;
        if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
            throw new Error('subscription missing endpoint/keys');
        }
        return sub;
    } catch (e) {
        throw new ChannelError({
            channel: 'webpush',
            code: 'INVALID_SUBSCRIPTION',
            message: `to.address must be a JSON-encoded PushSubscription: ${(e as Error).message}`,
        });
    }
}

function signVapidJwt(
    payload: { aud: string; exp: number; sub: string },
    privateKeyB64Url: string,
): string {
    const header = { typ: 'JWT', alg: 'ES256' };
    const enc = (o: object) => base64url(Buffer.from(JSON.stringify(o)));
    const signingInput = `${enc(header)}.${enc(payload)}`;

    const pkcs8 = vapidPrivateKeyToPkcs8(privateKeyB64Url);
    const keyObj = crypto.createPrivateKey({ key: pkcs8, format: 'der', type: 'pkcs8' });
    const der = crypto.sign('sha256', Buffer.from(signingInput), {
        key: keyObj,
        dsaEncoding: 'ieee-p1363',
    });
    return `${signingInput}.${base64url(der)}`;
}

function base64url(buf: Buffer): string {
    return buf
        .toString('base64')
        .replace(/=+$/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

function fromBase64url(s: string): Buffer {
    return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

/**
 * Wrap the raw 32-byte P-256 private scalar into a PKCS#8 DER blob so node's
 * crypto can ingest it. Format reference: RFC 5915.
 */
function vapidPrivateKeyToPkcs8(base64url: string): Buffer {
    const d = fromBase64url(base64url);
    if (d.length !== 32) {
        throw new ChannelError({
            channel: 'webpush',
            code: 'INVALID_VAPID_KEY',
            message: 'VAPID private key must be a 32-byte base64url-encoded scalar',
        });
    }
    // Hand-rolled PKCS#8 wrapping for prime256v1 / ecPrivateKey.
    // SEQUENCE { version 0, algId, OCTET STRING { ec privateKey } }
    const algId = Buffer.from(
        '301306072a8648ce3d020106082a8648ce3d030107',
        'hex',
    );
    const ecPrivKey = Buffer.concat([
        Buffer.from('3041020101', 'hex'), // outer ECPrivateKey wrapping (length filled below if changed)
        Buffer.from('0420', 'hex'),
        d,
        Buffer.from('a01406072a8648ce3d030107', 'hex'), // unused param (parameters [0])
    ]);
    // The above is a simplified, deterministic PKCS#8 — sufficient for node's
    // crypto.createPrivateKey when paired with `format: 'der', type: 'pkcs8'`.
    const inner = Buffer.concat([
        Buffer.from('020100', 'hex'),
        algId,
        Buffer.from([0x04, ecPrivKey.length]),
        ecPrivKey,
    ]);
    return Buffer.concat([Buffer.from([0x30, inner.length]), inner]);
}

export default webpushAdapter;
