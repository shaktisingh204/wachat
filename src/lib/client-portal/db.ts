/**
 * Shared session resolution + query helpers for the Client Portal.
 *
 * All exported helpers are server-only — the file is imported by
 * `src/app/actions/client-portal.actions.ts`, which is the only
 * `'use server'` surface the portal exposes.
 */

import 'server-only';

import { ObjectId, type Filter, type Document } from 'mongodb';

import { getSession } from '@/app/actions/user.actions';

export type ClientCtx = { userId: ObjectId; email: string };

/**
 * Resolves the current request to a client context. Returns `null` if
 * the session is missing, doesn't have role='client', or carries an
 * invalid ObjectId. Pages/actions should refuse to proceed on `null`.
 */
export async function requireClient(): Promise<ClientCtx | null> {
    const session = await getSession();
    const user = (session as { user?: { _id?: string; role?: string; email?: string } } | null)?.user;
    if (!user?._id || !user.email) return null;
    if (user.role !== 'client') return null;
    if (!ObjectId.isValid(user._id)) return null;
    return { userId: new ObjectId(user._id), email: user.email.toLowerCase() };
}

export function toIso(v: unknown): string | null {
    if (!v) return null;
    if (v instanceof Date) return v.toISOString();
    const d = new Date(v as string);
    return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

export function asNumber(v: unknown): number {
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

export function asString(v: unknown): string {
    return typeof v === 'string' ? v : v == null ? '' : String(v);
}

/**
 * Build a Mongo filter that matches a `clientId`-style field against
 * the current client's user `_id`, accepting both ObjectId and string
 * forms (legacy rows wrote the string variant).
 */
export function clientIdFilter(
    ctx: ClientCtx,
    field: string = 'clientId',
): Filter<Document> {
    return {
        $or: [
            { [field]: ctx.userId },
            { [field]: ctx.userId.toString() },
        ],
    } as Filter<Document>;
}
