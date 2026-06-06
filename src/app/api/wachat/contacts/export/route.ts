/**
 * `GET /api/wachat/contacts/export` — thin forwarder for the Rust
 * `GET /v1/wachat/contacts-export-sync/export` CSV stream.
 *
 * The Rust handler streams raw `text/csv` (NOT JSON), so it cannot go
 * through the JSON-parsing `rustFetch` / `rustFetchAsUser` helpers. This
 * route resolves the caller's session userId, mints the same short-lived
 * HS256 Rust JWT those helpers use, fetches the CSV body verbatim, and
 * re-emits it with the download headers so the browser saves a file.
 *
 * Query: `?projectId=…&phoneNumberId=…&tagIds=a,b,c` — forwarded 1:1 to
 * the Rust path built by `wachatContactsExportSyncApi.exportPath`.
 */
import 'server-only';

import { NextResponse } from 'next/server';

import { issueRustJwt } from '@/lib/jwt-for-rust';
import { getSession } from '@/app/actions/user.actions';
import { wachatContactsExportSyncApi } from '@/lib/rust-client/wachat-contacts-export-sync';

const DEFAULT_BASE_URL = 'http://localhost:8080';

function getBaseUrl(): string {
    return process.env.RUST_API_URL || DEFAULT_BASE_URL;
}

function resolveUserId(session: unknown): string | null {
    const user = (session as { user?: { _id?: unknown; id?: unknown } } | null)?.user;
    const raw = user?._id ?? user?.id;
    if (!raw) return null;
    return typeof raw === 'string' ? raw : String(raw);
}

export async function GET(req: Request): Promise<Response> {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    if (!projectId) {
        return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    const session = await getSession();
    const userId = resolveUserId(session);
    if (!userId) {
        return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const phoneNumberId = searchParams.get('phoneNumberId') || undefined;
    const tagIds = (searchParams.get('tagIds') || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

    const path = wachatContactsExportSyncApi.exportPath({ projectId, phoneNumberId, tagIds });

    const token = await issueRustJwt({
        userId,
        tenantId: userId,
        roles: [],
    });

    let upstream: Response;
    try {
        upstream = await fetch(`${getBaseUrl()}${path}`, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'text/csv',
            },
            cache: 'no-store',
        });
    } catch {
        return NextResponse.json({ error: 'Failed to reach export service.' }, { status: 502 });
    }

    if (!upstream.ok) {
        // The Rust side renders a JSON error envelope on failure; surface a
        // stable message + the upstream status so the client can toast it.
        let message = `Export failed (${upstream.status}).`;
        try {
            const envelope = (await upstream.json()) as {
                error?: { message?: string };
            } | null;
            if (envelope?.error?.message) message = envelope.error.message;
        } catch {
            // Non-JSON error body — keep the generic message.
        }
        return NextResponse.json({ error: message }, { status: upstream.status });
    }

    const csv = await upstream.text();
    return new Response(csv, {
        status: 200,
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="contacts.csv"',
            'Cache-Control': 'no-store',
        },
    });
}
