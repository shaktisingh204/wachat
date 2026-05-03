/**
 * CIDR matcher for IP allowlists.
 *
 * Supports IPv4 and IPv6, with single-IP rules treated as /32 or /128.
 *
 * Rules are loaded through `IpAllowStore` so that we can mock the data layer
 * in tests; the default Mongo-backed implementation lives below.
 */

import type { IpAllowRule } from './types';

export type IpAllowStore = {
    listForOrg(orgId: string): Promise<IpAllowRule[]>;
};

const COLLECTION = 'ip_allow_rules';

export function createMongoIpAllowStore(): IpAllowStore {
    return {
        async listForOrg(orgId) {
            const mod = await import('@/lib/mongodb');
            const { db } = await mod.connectToDatabase();
            const rows = await db.collection(COLLECTION).find({ orgId }).toArray();
            return rows as unknown as IpAllowRule[];
        },
    };
}

/* ── IP parsing ─────────────────────────────── */

function ipv4ToBigInt(ip: string): bigint | null {
    const parts = ip.split('.');
    if (parts.length !== 4) return null;
    let out = 0n;
    for (const p of parts) {
        const n = Number(p);
        if (!Number.isInteger(n) || n < 0 || n > 255) return null;
        out = (out << 8n) | BigInt(n);
    }
    return out;
}

function ipv6ToBigInt(ip: string): bigint | null {
    // Handle :: (zero-run compression) and IPv4-mapped tails.
    let raw = ip;
    let v4Tail: bigint | null = null;
    if (raw.includes('.')) {
        const lastColon = raw.lastIndexOf(':');
        const tail = raw.slice(lastColon + 1);
        v4Tail = ipv4ToBigInt(tail);
        if (v4Tail === null) return null;
        raw = raw.slice(0, lastColon);
    }
    let head: string[] = [];
    let tail: string[] = [];
    if (raw.includes('::')) {
        const [a, b] = raw.split('::');
        head = a ? a.split(':') : [];
        tail = b ? b.split(':') : [];
    } else {
        head = raw.split(':');
    }
    const expectedGroups = v4Tail !== null ? 6 : 8;
    const fillCount = expectedGroups - head.length - tail.length;
    if (fillCount < 0) return null;
    const groups = [...head, ...new Array(fillCount).fill('0'), ...tail];
    let out = 0n;
    for (const g of groups) {
        if (g.length === 0 || g.length > 4) return null;
        const n = parseInt(g, 16);
        if (Number.isNaN(n) || n < 0 || n > 0xffff) return null;
        out = (out << 16n) | BigInt(n);
    }
    if (v4Tail !== null) out = (out << 32n) | v4Tail;
    return out;
}

export type ParsedIp = { value: bigint; family: 4 | 6 };

export function parseIp(ip: string): ParsedIp | null {
    if (ip.includes(':')) {
        const v = ipv6ToBigInt(ip);
        return v === null ? null : { value: v, family: 6 };
    }
    const v = ipv4ToBigInt(ip);
    return v === null ? null : { value: v, family: 4 };
}

export type ParsedCidr = { base: bigint; mask: bigint; family: 4 | 6 };

export function parseCidr(cidr: string): ParsedCidr | null {
    const [ip, prefixStr] = cidr.split('/');
    const parsed = parseIp(ip);
    if (!parsed) return null;
    const total = parsed.family === 4 ? 32 : 128;
    const prefix = prefixStr === undefined ? total : Number(prefixStr);
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > total) return null;
    if (prefix === 0) {
        return { base: 0n, mask: 0n, family: parsed.family };
    }
    const mask = ((1n << BigInt(prefix)) - 1n) << BigInt(total - prefix);
    return { base: parsed.value & mask, mask, family: parsed.family };
}

export function ipMatchesCidr(ip: string, cidr: string): boolean {
    const parsedIp = parseIp(ip);
    const parsedCidr = parseCidr(cidr);
    if (!parsedIp || !parsedCidr) return false;
    if (parsedIp.family !== parsedCidr.family) return false;
    return (parsedIp.value & parsedCidr.mask) === parsedCidr.base;
}

/**
 * Match `ip` against any allow-rule for `orgId`. Returns `true` when allowed
 * or when the org has no rules (open by default — callers can flip this).
 */
export async function isAllowed(
    orgId: string,
    ip: string,
    store: IpAllowStore = createMongoIpAllowStore(),
): Promise<boolean> {
    const rules = await store.listForOrg(orgId);
    if (rules.length === 0) return true;
    return rules.some((r) => ipMatchesCidr(ip, r.cidr));
}

/** Sync variant — when you already have the rules in memory. */
export function matchAny(ip: string, rules: IpAllowRule[]): boolean {
    if (rules.length === 0) return true;
    return rules.some((r) => ipMatchesCidr(ip, r.cidr));
}
