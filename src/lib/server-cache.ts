import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';

import { getSession as _getSession } from '@/app/actions/user.actions';
import { getProjects as _getProjects } from '@/app/actions/project.actions';
import { getDecodedSession } from '@/lib/auth';

// Layered cache:
//   1. `React.cache` dedupes calls within a single render (layout +
//      RBACGuard + page can all reach for the session, hit Mongo once).
//   2. A small in-memory TTL map dedupes across requests so consecutive
//      navigations from the same user skip the Mongo + plan + serialize
//      pipeline entirely. The TTL is short enough that plan/credit
//      changes show up within seconds; write paths can also call
//      `invalidateSessionCache` / `invalidateProjectsCache` for
//      immediate consistency.

type Entry<T> = { value: T; expires: number };

const SESSION_TTL_MS = 10_000;
const PROJECTS_TTL_MS = 30_000;

const sessionCache = new Map<string, Entry<unknown>>();
const projectsCache = new Map<string, Entry<unknown>>();

function readEntry<T>(map: Map<string, Entry<unknown>>, key: string): T | null {
    const e = map.get(key);
    if (!e) return null;
    if (e.expires <= Date.now()) {
        map.delete(key);
        return null;
    }
    return e.value as T;
}

function writeEntry<T>(map: Map<string, Entry<unknown>>, key: string, value: T, ttl: number) {
    map.set(key, { value, expires: Date.now() + ttl });
}

async function sessionCacheKey(): Promise<string | null> {
    try {
        const cookieStore = await cookies();
        const cookie = cookieStore.get('session')?.value;
        if (!cookie) return null;
        const decoded = await getDecodedSession(cookie);
        if (!decoded) return null;
        // userId on custom JWTs, sub on OAuth tokens; fall back to email.
        return (decoded as any).userId || (decoded as any).sub || decoded.email || null;
    } catch {
        return null;
    }
}

export const getCachedSession = cache(async () => {
    const key = await sessionCacheKey();
    if (key) {
        const hit = readEntry<Awaited<ReturnType<typeof _getSession>>>(sessionCache, key);
        if (hit) return hit;
    }
    const fresh = await _getSession();
    if (key && fresh) writeEntry(sessionCache, key, fresh, SESSION_TTL_MS);
    return fresh;
});

export const getCachedProjects = cache(async () => {
    // Project list is per-user; key by the (cached) session's user id.
    const session = await getCachedSession();
    const userId = session?.user?._id ?? null;
    if (userId) {
        const hit = readEntry<Awaited<ReturnType<typeof _getProjects>>>(projectsCache, userId);
        if (hit) return hit;
    }
    const fresh = await _getProjects();
    if (userId && fresh) writeEntry(projectsCache, userId, fresh, PROJECTS_TTL_MS);
    return fresh;
});

export function invalidateSessionCache(key?: string | null) {
    if (!key) {
        sessionCache.clear();
        return;
    }
    sessionCache.delete(key);
}

export function invalidateProjectsCache(userId?: string | null) {
    if (!userId) {
        projectsCache.clear();
        return;
    }
    projectsCache.delete(userId);
}

export type ResolvedWorkspace =
    | { ok: true; workspaceId: string }
    | { ok: false; error: string };

export async function resolveWorkspace(): Promise<ResolvedWorkspace> {
    const session = await getCachedSession();
    const userId = (session?.user as { _id?: unknown } | undefined)?._id;
    if (!userId) return { ok: false, error: 'unauthorized' };
    return { ok: true, workspaceId: String(userId) };
}
