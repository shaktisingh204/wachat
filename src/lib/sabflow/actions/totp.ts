
'use server';

import { createHmac, randomBytes } from 'crypto';

// Base32 alphabet (RFC 4648)
const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(base32: string): Buffer {
    const input = base32.toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
    let bits = 0;
    let value = 0;
    const output: number[] = [];

    for (const char of input) {
        const idx = BASE32_CHARS.indexOf(char);
        if (idx === -1) throw new Error(`Invalid base32 character: ${char}`);
        value = (value << 5) | idx;
        bits += 5;
        if (bits >= 8) {
            output.push((value >>> (bits - 8)) & 0xff);
            bits -= 8;
        }
    }

    return Buffer.from(output);
}

function base32Encode(buffer: Buffer): string {
    let bits = 0;
    let value = 0;
    let output = '';

    for (const byte of buffer) {
        value = (value << 8) | byte;
        bits += 8;
        while (bits >= 5) {
            output += BASE32_CHARS[(value >>> (bits - 5)) & 0x1f];
            bits -= 5;
        }
    }

    if (bits > 0) {
        output += BASE32_CHARS[(value << (5 - bits)) & 0x1f];
    }

    return output;
}

function computeTotp(secret: string, counter: number, digits: number, algorithm: string): string {
    const key = base32Decode(secret);
    const counterBuf = Buffer.alloc(8);
    // Write 64-bit big-endian counter
    const high = Math.floor(counter / 0x100000000);
    const low = counter >>> 0;
    counterBuf.writeUInt32BE(high, 0);
    counterBuf.writeUInt32BE(low, 4);

    const algoMap: Record<string, string> = {
        SHA1: 'sha1',
        SHA256: 'sha256',
        SHA512: 'sha512',
    };
    const hmacAlgo = algoMap[algorithm.toUpperCase()] ?? 'sha1';
    const hmac = createHmac(hmacAlgo, key).update(counterBuf).digest();

    const offset = hmac[hmac.length - 1] & 0x0f;
    const code =
        ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff);

    return String(code % Math.pow(10, digits)).padStart(digits, '0');
}

export async function executeTotpAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        switch (actionName) {
            case 'generateTotp': {
                const secret = String(inputs.secret ?? '').trim().toUpperCase();
                if (!secret) throw new Error('secret is required.');
                const digits = Number(inputs.digits ?? 6);
                const period = Number(inputs.period ?? 30);
                const algorithm = String(inputs.algorithm ?? 'SHA1').toUpperCase();

                const now = Math.floor(Date.now() / 1000);
                const counter = Math.floor(now / period);
                const token = computeTotp(secret, counter, digits, algorithm);

                const remainingSeconds = period - (now % period);
                const expiresAt = new Date((counter + 1) * period * 1000).toISOString();

                logger?.log(`[TOTP] Generated token for period ${period}s, remaining ${remainingSeconds}s`);
                return { output: { token, remainingSeconds, expiresAt } };
            }

            case 'verifyTotp': {
                const secret = String(inputs.secret ?? '').trim().toUpperCase();
                const token = String(inputs.token ?? '').trim();
                if (!secret) throw new Error('secret is required.');
                if (!token) throw new Error('token is required.');
                const digits = Number(inputs.digits ?? 6);
                const period = Number(inputs.period ?? 30);
                const algorithm = String(inputs.algorithm ?? 'SHA1').toUpperCase();

                const now = Math.floor(Date.now() / 1000);
                const counter = Math.floor(now / period);

                // Check ±1 window
                let valid = false;
                for (const offset of [-1, 0, 1]) {
                    if (computeTotp(secret, counter + offset, digits, algorithm) === token) {
                        valid = true;
                        break;
                    }
                }

                logger?.log(`[TOTP] Verification result: ${valid}`);
                return { output: { valid } };
            }

            case 'generateSecret': {
                const label = String(inputs.label ?? 'SabFlow').trim();
                const issuer = String(inputs.issuer ?? 'SabNode').trim();
                const secretBytes = randomBytes(20);
                const secret = base32Encode(secretBytes);
                const otpauthUrl = `otpauth://totp/${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;

                logger?.log(`[TOTP] Generated new secret for label: ${label}`);
                return { output: { secret, otpauthUrl } };
            }

            default:
                throw new Error(`Unknown TOTP action: "${actionName}"`);
        }
    } catch (err: any) {
        logger?.log(`[TOTP] Error: ${err.message}`);
        return { error: err.message };
    }
}
