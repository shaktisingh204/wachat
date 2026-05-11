/**
 * GET /api/telegram/payments/export
 *
 * Thin proxy that forwards the page's CSV-export request to the Rust
 * BFF (`GET /v1/telegram/payments/export`). The browser can't call
 * Rust directly (the JWT secret is server-only), so we mint a fresh
 * Rust token here and stream Rust's response body straight through.
 *
 * Query params are passed through unchanged:
 *   projectId, from, to, status, currency, search
 *
 * Auth: session cookie. Returns 401 if no active session.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';

import { getDecodedSession } from '@/lib/auth';
import { issueRustJwt } from '@/lib/jwt-for-rust';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_BASE_URL = 'http://localhost:8080';

export async function GET(request: NextRequest) {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session')?.value;
    const decoded = sessionCookie ? await getDecodedSession(sessionCookie) : null;
    const userId = decoded
        ? ((decoded as Record<string, unknown>).userId ??
              (decoded as Record<string, unknown>).sub ??
              (decoded as Record<string, unknown>)._id)
        : null;
    if (!userId) {
        return NextResponse.json({ error: 'No active session' }, { status: 401 });
    }

    const token = await issueRustJwt({
        userId: String(userId),
        tenantId: String(userId),
        roles: [],
    });

    const baseUrl = process.env.RUST_API_URL || DEFAULT_BASE_URL;
    const search = request.nextUrl.searchParams.toString();
    const url = `${baseUrl}/v1/telegram/payments/export${search ? `?${search}` : ''}`;

    try {
        const res = await fetch(url, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'text/csv',
            },
            cache: 'no-store',
        });

        if (!res.ok) {
            const text = await res.text().catch(() => '');
            console.error(
                '[telegram-payments/export] upstream failed',
                res.status,
                text.slice(0, 200),
            );
            return NextResponse.json(
                { error: text || `Export failed (${res.status})` },
                { status: res.status },
            );
        }

        const body = await res.text();
        return new NextResponse(body, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition':
                    res.headers.get('Content-Disposition') ??
                    'attachment; filename="telegram-payments.csv"',
                'Cache-Control': 'no-store',
            },
        });
    } catch (err) {
        console.error('[telegram-payments/export] network error', err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : String(err) },
            { status: 502 },
        );
    }
}
