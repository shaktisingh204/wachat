/**
 * SCIM 2.0 ResourceType handlers (RFC 7643 / 7644).
 *
 * These are pure functions: they accept input and a small storage adapter
 * (or just plain arrays) and return JSON-serialisable resource objects in
 * the shape SCIM clients expect. Routing + persistence is wired up at the
 * route handler layer.
 */

import type {
    ScimError,
    ScimGroup,
    ScimListResponse,
    ScimUser,
} from './types';

const USER_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:User';
const GROUP_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:Group';
const LIST_SCHEMA =
    'urn:ietf:params:scim:api:messages:2.0:ListResponse' as const;
const ERROR_SCHEMA =
    'urn:ietf:params:scim:api:messages:2.0:Error' as const;

export function scimError(status: number, detail: string, scimType?: string): ScimError {
    return {
        schemas: [ERROR_SCHEMA],
        status: String(status),
        detail,
        scimType,
    };
}

/* ── filtering ─────────────────────────────── */

/**
 * Tiny SCIM filter parser. Supports the most-used cases:
 *   userName eq "alice@example.com"
 *   emails.value co "@example.com"
 *   active eq true
 *   displayName sw "Eng"
 *
 * Compound expressions (and/or) and parentheses fall through to "match all"
 * intentionally — callers should treat that as a soft fallback.
 */
export type ScimFilter = {
    attr: string;
    op: 'eq' | 'ne' | 'co' | 'sw' | 'ew' | 'pr';
    value?: string | number | boolean;
};

export function parseScimFilter(input?: string | null): ScimFilter | null {
    if (!input) return null;
    const trimmed = input.trim();
    // present
    const prMatch = trimmed.match(/^([\w.]+)\s+pr$/i);
    if (prMatch) return { attr: prMatch[1], op: 'pr' };
    const m = trimmed.match(/^([\w.]+)\s+(eq|ne|co|sw|ew)\s+(.+)$/i);
    if (!m) return null;
    const attr = m[1];
    const op = m[2].toLowerCase() as ScimFilter['op'];
    let raw = m[3].trim();
    let value: ScimFilter['value'];
    if (raw.startsWith('"') && raw.endsWith('"')) {
        value = raw.slice(1, -1);
    } else if (raw === 'true' || raw === 'false') {
        value = raw === 'true';
    } else if (!Number.isNaN(Number(raw))) {
        value = Number(raw);
    } else {
        value = raw;
    }
    return { attr, op, value };
}

function getPath(obj: unknown, path: string): unknown {
    return path.split('.').reduce<unknown>((acc, key) => {
        if (acc == null) return undefined;
        if (Array.isArray(acc)) {
            // For arrays of objects, try to find the first one with this key.
            for (const el of acc) {
                if (el && typeof el === 'object' && key in (el as object)) {
                    return (el as Record<string, unknown>)[key];
                }
            }
            return undefined;
        }
        if (typeof acc === 'object') return (acc as Record<string, unknown>)[key];
        return undefined;
    }, obj);
}

export function applyScimFilter<T>(items: T[], filter: ScimFilter | null): T[] {
    if (!filter) return items;
    return items.filter((item) => {
        const v = getPath(item, filter.attr);
        switch (filter.op) {
            case 'pr':
                return v !== undefined && v !== null && v !== '';
            case 'eq':
                return v === filter.value;
            case 'ne':
                return v !== filter.value;
            case 'co':
                return typeof v === 'string' && typeof filter.value === 'string' && v.includes(filter.value);
            case 'sw':
                return typeof v === 'string' && typeof filter.value === 'string' && v.startsWith(filter.value);
            case 'ew':
                return typeof v === 'string' && typeof filter.value === 'string' && v.endsWith(filter.value);
            default:
                return false;
        }
    });
}

/* ── pagination ─────────────────────────────── */

export type ScimListQuery = {
    filter?: string | null;
    startIndex?: number;
    count?: number;
};

export function paginate<T>(items: T[], query: ScimListQuery): ScimListResponse<T> {
    const filter = parseScimFilter(query.filter);
    const filtered = applyScimFilter(items, filter);
    const startIndex = Math.max(1, Math.floor(query.startIndex ?? 1));
    const count = Math.max(0, Math.floor(query.count ?? 50));
    const slice = filtered.slice(startIndex - 1, startIndex - 1 + count);
    return {
        schemas: [LIST_SCHEMA],
        totalResults: filtered.length,
        startIndex,
        itemsPerPage: slice.length,
        Resources: slice,
    };
}

/* ── User builders ─────────────────────────────── */

export type ScimUserInput = {
    id?: string;
    externalId?: string;
    userName: string;
    name?: { givenName?: string; familyName?: string; formatted?: string };
    displayName?: string;
    active?: boolean;
    emails?: { value: string; primary?: boolean; type?: 'work' | 'home' | 'other' }[];
    locationBase?: string;
};

export function buildScimUser(input: ScimUserInput, now: Date = new Date()): ScimUser {
    const id = input.id ?? cryptoRandomId();
    const iso = now.toISOString();
    return {
        schemas: [USER_SCHEMA],
        id,
        externalId: input.externalId,
        userName: input.userName,
        name: input.name,
        displayName: input.displayName ?? input.name?.formatted ?? input.userName,
        active: input.active ?? true,
        emails: input.emails,
        meta: {
            resourceType: 'User',
            created: iso,
            lastModified: iso,
            location: input.locationBase ? `${input.locationBase}/${id}` : undefined,
            version: `W/"${iso}"`,
        },
    };
}

export function patchScimUser(
    user: ScimUser,
    patch: Partial<ScimUserInput>,
    now: Date = new Date(),
): ScimUser {
    const next: ScimUser = {
        ...user,
        userName: patch.userName ?? user.userName,
        externalId: patch.externalId ?? user.externalId,
        name: patch.name ?? user.name,
        displayName: patch.displayName ?? user.displayName,
        active: patch.active ?? user.active,
        emails: patch.emails ?? user.emails,
        meta: {
            ...user.meta,
            lastModified: now.toISOString(),
            version: `W/"${now.toISOString()}"`,
        },
    };
    return next;
}

/* ── Group builders ─────────────────────────────── */

export type ScimGroupInput = {
    id?: string;
    externalId?: string;
    displayName: string;
    members?: { value: string; display?: string; type?: 'User' | 'Group' }[];
    locationBase?: string;
};

export function buildScimGroup(input: ScimGroupInput, now: Date = new Date()): ScimGroup {
    const id = input.id ?? cryptoRandomId();
    const iso = now.toISOString();
    return {
        schemas: [GROUP_SCHEMA],
        id,
        externalId: input.externalId,
        displayName: input.displayName,
        members: input.members ?? [],
        meta: {
            resourceType: 'Group',
            created: iso,
            lastModified: iso,
            location: input.locationBase ? `${input.locationBase}/${id}` : undefined,
            version: `W/"${iso}"`,
        },
    };
}

export function patchScimGroup(
    group: ScimGroup,
    patch: Partial<ScimGroupInput>,
    now: Date = new Date(),
): ScimGroup {
    return {
        ...group,
        displayName: patch.displayName ?? group.displayName,
        externalId: patch.externalId ?? group.externalId,
        members: patch.members ?? group.members,
        meta: {
            ...group.meta,
            lastModified: now.toISOString(),
            version: `W/"${now.toISOString()}"`,
        },
    };
}

/* ── helpers ─────────────────────────────── */

function cryptoRandomId(): string {
    // Avoid depending on `crypto` at module scope so this file is also
    // edge-compatible for read-only flows.
    const g: { crypto?: { randomUUID?: () => string } } = globalThis as {
        crypto?: { randomUUID?: () => string };
    };
    if (g.crypto?.randomUUID) return g.crypto.randomUUID();
    // Last-ditch fallback (sufficient for tests).
    return `scim-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

export const SCIM_SCHEMAS = {
    USER: USER_SCHEMA,
    GROUP: GROUP_SCHEMA,
    LIST: LIST_SCHEMA,
    ERROR: ERROR_SCHEMA,
} as const;
