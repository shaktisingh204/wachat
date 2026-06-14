/**
 * GET /api/ad-manager/accounts
 *
 * Server-side proxy that fetches the authenticated user's Meta ad accounts
 * by calling graph.facebook.com server-side (never from the browser).
 *
 * This route exists to fix the CORS error that occurs when ad-account data
 * is fetched directly from the client. All graph.facebook.com traffic
 * goes through this Node.js handler, so the browser never touches Facebook
 * directly.
 *
 * Falls back gracefully: if the user's adManagerAccessToken is not stored
 * yet (freshly connected account), returns the metaAdAccounts array that
 * was saved during OAuth without making a Graph call.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';

import { getDecodedSession } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { GRAPH_API_VERSION } from '@/lib/meta/graph-version';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
    // 1. Authenticate the caller from the session cookie.
    const sessionCookie = request.cookies.get('session')?.value;
    if (!sessionCookie) {
        return NextResponse.json({ accounts: [], error: 'Not authenticated.' }, { status: 401 });
    }

    let userId: string | null = null;
    try {
        const decoded = await getDecodedSession(sessionCookie);
        userId = (decoded as any)?.userId ?? null;
    } catch {
        return NextResponse.json({ accounts: [], error: 'Invalid session.' }, { status: 401 });
    }

    if (!userId || !ObjectId.isValid(userId)) {
        return NextResponse.json({ accounts: [], error: 'Invalid session.' }, { status: 401 });
    }

    // 2. Load user from Mongo to get their stored token and cached accounts.
    const { db } = await connectToDatabase();
    const user = await db.collection('users').findOne(
        { _id: new ObjectId(userId) },
        { projection: { adManagerAccessToken: 1, metaAdAccounts: 1 } },
    );

    if (!user) {
        return NextResponse.json({ accounts: [], error: 'User not found.' }, { status: 404 });
    }

    const token: string | undefined = user.adManagerAccessToken;

    // 3. If no token is stored yet, return whatever we have from the OAuth
    //    callback (the metaAdAccounts array stored during account connection).
    if (!token) {
        const cached = (user.metaAdAccounts as { id: string; name: string; account_id: string }[] | undefined) ?? [];
        return NextResponse.json({ accounts: cached });
    }

    // 4. Token is present — fetch current ad accounts from Meta Graph API
    //    server-side (avoids CORS; browser never touches graph.facebook.com).
    try {
        const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/me/adaccounts`);
        url.searchParams.set('fields', 'id,name,account_id,account_status,currency,timezone_name');
        url.searchParams.set('access_token', token);

        const graphRes = await fetch(url.toString(), { next: { revalidate: 0 } });
        if (!graphRes.ok) {
            const errBody = await graphRes.json().catch(() => ({}));
            const errMsg = (errBody as any)?.error?.message ?? `Graph API ${graphRes.status}`;
            // Fall back to cached accounts rather than surfacing a Graph error.
            const cached = (user.metaAdAccounts as any[] | undefined) ?? [];
            if (cached.length > 0) {
                return NextResponse.json({ accounts: cached, warning: errMsg });
            }
            return NextResponse.json({ accounts: [], error: errMsg }, { status: 502 });
        }

        const body = await graphRes.json() as { data?: any[]; error?: any };
        const accounts: any[] = body.data ?? [];

        // 5. Persist the refreshed list back to Mongo so the Rust BFF has
        //    up-to-date metaAdAccounts the next time it reads the document.
        if (accounts.length > 0) {
            await db.collection('users').updateOne(
                { _id: new ObjectId(userId) },
                {
                    $set: {
                        metaAdAccounts: accounts.map((a) => ({
                            id: a.id,
                            name: a.name,
                            account_id: (a.account_id ?? a.id).replace(/^act_/, ''),
                        })),
                    },
                },
            );
        }

        return NextResponse.json({ accounts });
    } catch (err: any) {
        // Network or parse error — fall back to cached.
        const cached = (user.metaAdAccounts as any[] | undefined) ?? [];
        return NextResponse.json({ accounts: cached, warning: err.message });
    }
}
