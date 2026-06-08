import 'server-only';

/**
 * Tenant-scoped Mongo helpers for the SabBigin home + dashboard pages.
 *
 * SabBigin doesn't own its own entity collections — these helpers read
 * directly from the existing CRM collections (`crm_deals`, `crm_contacts`,
 * `crm_tasks`, `crm_activities`) scoped by the session `userId`. The
 * standard Sales CRM hub already does the same trick via
 * `src/app/dashboard/crm/_components/hub-data.ts`; this is a SabBigin-flavored
 * narrower variant.
 */

import { ObjectId, type Filter, type Document } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';

interface SabbiginScope {
    userId: ObjectId;
}

async function getScope(): Promise<SabbiginScope | null> {
    const session = await getSession();
    if (!session?.user?._id) return null;
    try {
        return { userId: new ObjectId(session.user._id) };
    } catch {
        return null;
    }
}

export async function sabbiginCount(
    collection: string,
    extra: Filter<Document> = {},
): Promise<number> {
    try {
        const scope = await getScope();
        if (!scope) return 0;
        const { db } = await connectToDatabase();
        return await db
            .collection(collection)
            .countDocuments({ userId: scope.userId, ...extra });
    } catch {
        return 0;
    }
}

export async function sabbiginRecent<T extends Document = Document>(
    collection: string,
    options: {
        sortField?: string;
        limit?: number;
        filter?: Filter<Document>;
    } = {},
): Promise<T[]> {
    try {
        const scope = await getScope();
        if (!scope) return [];
        const { db } = await connectToDatabase();
        const sort: Document = { [options.sortField ?? 'createdAt']: -1 };
        const rows = await db
            .collection(collection)
            .find({ userId: scope.userId, ...(options.filter ?? {}) }, { sort } as any)
            .limit(options.limit ?? 5)
            .toArray();
        return JSON.parse(JSON.stringify(rows)) as T[];
    } catch {
        return [];
    }
}

export async function sabbiginSum(
    collection: string,
    field: string,
    extra: Filter<Document> = {},
): Promise<number> {
    try {
        const scope = await getScope();
        if (!scope) return 0;
        const { db } = await connectToDatabase();
        const result = await db
            .collection(collection)
            .aggregate([
                { $match: { userId: scope.userId, ...extra } },
                { $group: { _id: null, total: { $sum: `$${field}` } } },
            ])
            .toArray();
        return (result[0]?.total as number) ?? 0;
    } catch {
        return 0;
    }
}

/** Inclusive start-of-day → exclusive end-of-day. */
export function todayRange(): { gte: Date; lt: Date } {
    const now = new Date();
    const gte = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lt = new Date(gte);
    lt.setDate(lt.getDate() + 1);
    return { gte, lt };
}

export function startOfMonth(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
}

export function formatCurrency(value: number, currency = 'INR'): string {
    if (!Number.isFinite(value)) return '—';
    try {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency,
            maximumFractionDigits: 0,
            notation: value >= 1_00_00_000 ? 'compact' : 'standard',
        }).format(value);
    } catch {
        return `${currency} ${value}`;
    }
}

/** Short, human date for list rows (e.g. "8 Jun, 14:30"). */
export function formatDateTime(value?: string | Date | null): string {
    if (!value) return 'No date';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return 'No date';
    return new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    }).format(d);
}

/**
 * Map a deal/pipeline stage name to a 20ui Badge tone so colour only ever
 * carries meaning. Closing stages read green, lost/dead stages read danger,
 * everything mid-funnel stays informational.
 */
export type StageTone = 'success' | 'danger' | 'info' | 'warning' | 'neutral';

export function stageTone(stage?: string | null): StageTone {
    const s = (stage ?? '').toLowerCase();
    if (!s) return 'neutral';
    if (/(won|closed|deal done|complete)/.test(s)) return 'success';
    if (/(lost|dead|not serviceable|cancel)/.test(s)) return 'danger';
    if (/(negotiat|proposal|qualif)/.test(s)) return 'warning';
    return 'info';
}
