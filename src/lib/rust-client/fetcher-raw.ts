/**
 * Variant of {@link rustFetch} that returns the response body as raw text
 * (e.g. for CSV exports). Mirrors the auth handshake of `fetcher.ts`.
 */
import 'server-only';

import { cookies } from 'next/headers';

import { issueRustJwt } from '@/lib/jwt-for-rust';
import { getDecodedSession } from '@/lib/auth';
import { RustApiError } from './fetcher';
import type { RustErrorEnvelope } from './types';

const DEFAULT_BASE_URL = 'http://localhost:8080';

function getBaseUrl(): string {
    return process.env.RUST_API_URL || DEFAULT_BASE_URL;
}

export async function rawRustFetch(path: string, init?: RequestInit): Promise<string> {
    const cookieStore = await cookies();
    const cookie = cookieStore.get('session')?.value;
    const decoded = cookie ? await getDecodedSession(cookie) : null;
    const userId = decoded
        ? ((decoded as any).userId || (decoded as any).sub || (decoded as any)._id)
        : null;
    if (!userId) {
        throw new RustApiError(
            401,
            { ok: false, error: { code: 'UNAUTHORIZED', message: 'No active session' } },
            'No active session for Rust call',
        );
    }
    const token = await issueRustJwt({
        userId: String(userId),
        tenantId: String(userId),
        roles: [],
    });
    const headers = new Headers(init?.headers);
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('Accept', '*/*');
    const url = `${getBaseUrl()}${path}`;
    const res = await fetch(url, { ...init, headers, cache: 'no-store' });
    if (!res.ok) {
        let envelope: RustErrorEnvelope | null = null;
        try {
            envelope = (await res.json()) as RustErrorEnvelope;
        } catch {
            /* non-JSON body */
        }
        throw new RustApiError(
            res.status,
            envelope,
            `Rust API ${res.status} ${res.statusText}`,
        );
    }
    return await res.text();
}
