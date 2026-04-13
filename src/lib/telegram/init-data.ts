import 'server-only';

import crypto from 'node:crypto';

/**
 * Validate Telegram Mini App `initData` as described in
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * Steps:
 *   1. Parse the query-string payload.
 *   2. Extract the `hash` field.
 *   3. Build `data_check_string`: remaining entries joined by `\n` after
 *      sorting by key name (`key=value`).
 *   4. Compute `secret_key = HMAC_SHA256("WebAppData", bot_token)`.
 *   5. Expected = `HMAC_SHA256(secret_key, data_check_string)` as hex.
 *   6. Constant-time compare with the provided hash.
 *
 * Also checks `auth_date` is recent (default: 24h) to reject replayed payloads.
 */

export interface InitDataResult {
    ok: boolean;
    reason?: 'no-hash' | 'bad-hash' | 'expired' | 'malformed';
    user?: {
        id: number;
        username?: string;
        first_name?: string;
        last_name?: string;
        language_code?: string;
        is_premium?: boolean;
        photo_url?: string;
    };
    authDate?: Date;
    raw?: Record<string, string>;
}

export function validateInitData(
    initData: string,
    botToken: string,
    maxAgeSeconds = 86_400,
): InitDataResult {
    if (!initData) return { ok: false, reason: 'malformed' };

    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return { ok: false, reason: 'no-hash' };
    params.delete('hash');

    const entries: [string, string][] = [];
    params.forEach((v, k) => entries.push([k, v]));
    entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const expected = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    const hashBuf = Buffer.from(hash, 'hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    if (hashBuf.length !== expectedBuf.length) return { ok: false, reason: 'bad-hash' };

    let equal = false;
    try {
        equal = crypto.timingSafeEqual(hashBuf, expectedBuf);
    } catch {
        return { ok: false, reason: 'bad-hash' };
    }
    if (!equal) return { ok: false, reason: 'bad-hash' };

    const raw = Object.fromEntries(entries);
    const authDateSec = Number(raw.auth_date);
    if (!Number.isFinite(authDateSec)) return { ok: false, reason: 'malformed' };
    const authDate = new Date(authDateSec * 1000);
    const ageSec = Math.floor(Date.now() / 1000) - authDateSec;
    if (ageSec > maxAgeSeconds) return { ok: false, reason: 'expired', authDate, raw };

    let user: InitDataResult['user'];
    if (raw.user) {
        try {
            user = JSON.parse(raw.user);
        } catch {
            /* ignore malformed user json */
        }
    }

    return { ok: true, authDate, user, raw };
}

/**
 * Validate a Telegram Login Widget payload (used by the `<telegram-login>`
 * widget / `?tgAuthResult=` redirect). Docs:
 * https://core.telegram.org/widgets/login#checking-authorization
 */
export function validateLoginWidget(
    payload: Record<string, string | number>,
    botToken: string,
    maxAgeSeconds = 86_400,
): InitDataResult {
    const { hash, ...rest } = payload as Record<string, string>;
    if (!hash) return { ok: false, reason: 'no-hash' };

    const entries = Object.entries(rest)
        .map(([k, v]) => [k, String(v)] as [string, string])
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join('\n');

    const secretKey = crypto.createHash('sha256').update(botToken).digest();
    const expected = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    const hashBuf = Buffer.from(hash, 'hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    if (hashBuf.length !== expectedBuf.length) return { ok: false, reason: 'bad-hash' };
    let equal = false;
    try {
        equal = crypto.timingSafeEqual(hashBuf, expectedBuf);
    } catch {
        return { ok: false, reason: 'bad-hash' };
    }
    if (!equal) return { ok: false, reason: 'bad-hash' };

    const authDateSec = Number(rest.auth_date);
    if (!Number.isFinite(authDateSec)) return { ok: false, reason: 'malformed' };
    const authDate = new Date(authDateSec * 1000);
    if (Math.floor(Date.now() / 1000) - authDateSec > maxAgeSeconds) {
        return { ok: false, reason: 'expired', authDate };
    }

    return {
        ok: true,
        authDate,
        user: {
            id: Number(rest.id),
            username: rest.username,
            first_name: rest.first_name,
            last_name: rest.last_name,
            photo_url: rest.photo_url,
        },
        raw: rest,
    };
}
