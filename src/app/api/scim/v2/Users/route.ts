/**
 * SCIM 2.0 Users endpoint stub — wired to the pure handlers in
 * `@/lib/identity/scim`. Persistence is intentionally left as a TODO so
 * that this stub compiles cleanly without coupling to a specific store yet.
 *
 * Auth note: production deployments MUST gate this route behind a SCIM
 * bearer token (rotated per tenant). The stub simply checks `Authorization`
 * is present so type-checks pass and route shape is correct.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    buildScimUser,
    paginate,
    scimError,
    type ScimUserInput,
} from '@/lib/identity/scim';
import type { ScimUser } from '@/lib/identity/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function requireAuth(req: NextRequest): NextResponse | null {
    const auth = req.headers.get('authorization');
    if (!auth?.toLowerCase().startsWith('bearer ')) {
        return NextResponse.json(
            scimError(401, 'Missing or invalid Authorization header'),
            { status: 401 },
        );
    }
    return null;
}

async function loadUsers(): Promise<ScimUser[]> {
    // TODO: wire to Mongo `scim_users` collection. Returning [] keeps the
    // stub honest and well-typed for now.
    return [];
}

export async function GET(req: NextRequest) {
    const unauthorized = requireAuth(req);
    if (unauthorized) return unauthorized;

    try {
        const url = new URL(req.url);
        const filter = url.searchParams.get('filter');
        const startIndex = Number(url.searchParams.get('startIndex') ?? '1');
        const count = Number(url.searchParams.get('count') ?? '50');

        const users = await loadUsers();
        const list = paginate(users, { filter, startIndex, count });
        console.log('[SCIM_USERS_GET] returning', list.totalResults, 'users');
        return NextResponse.json(list, {
            status: 200,
            headers: { 'Content-Type': 'application/scim+json' },
        });
    } catch (err) {
        console.error('[SCIM_USERS_GET] error', err);
        return NextResponse.json(scimError(500, 'Internal error'), { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const unauthorized = requireAuth(req);
    if (unauthorized) return unauthorized;

    try {
        let body: ScimUserInput;
        try {
            body = (await req.json()) as ScimUserInput;
        } catch {
            return NextResponse.json(scimError(400, 'Invalid JSON body'), { status: 400 });
        }
        if (!body?.userName) {
            console.warn('[SCIM_USERS_POST] missing userName');
            return NextResponse.json(
                scimError(400, 'userName is required', 'invalidValue'),
                { status: 400 },
            );
        }
        const locationBase = `${new URL(req.url).origin}/api/scim/v2/Users`;
        const user = buildScimUser({ ...body, locationBase });
        console.log('[SCIM_USERS_POST] created user', user.id);
        // TODO: persist to Mongo here.
        return NextResponse.json(user, {
            status: 201,
            headers: {
                'Content-Type': 'application/scim+json',
                ...(user.meta.location ? { Location: user.meta.location } : {}),
            },
        });
    } catch (err) {
        console.error('[SCIM_USERS_POST] error', err);
        return NextResponse.json(scimError(500, 'Internal error'), { status: 500 });
    }
}
