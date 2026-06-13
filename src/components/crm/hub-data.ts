import 'server-only';

import { ObjectId, type Filter, type Document } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';

export interface HubScope {
    userId: ObjectId;
}

export async function getHubScope(): Promise<HubScope | null> {
    const session = await getSession();
    if (!session?.user?._id) return null;
    try {
        return { userId: new ObjectId(session.user._id) };
    } catch {
        return null;
    }
}

export async function countByUser(
    collection: string,
    extra: Filter<Document> = {},
): Promise<number> {
    try {
        const scope = await getHubScope();
        if (!scope) return 0;
        const { db } = await connectToDatabase();
        return await db
            .collection(collection)
            .countDocuments({ userId: scope.userId, ...extra });
    } catch {
        return 0;
    }
}

export async function recentByUser<T extends Document = Document>(
    collection: string,
    options: {
        sortField?: string;
        limit?: number;
        projection?: Document;
        filter?: Filter<Document>;
    } = {},
): Promise<T[]> {
    try {
        const scope = await getHubScope();
        if (!scope) return [];
        const { db } = await connectToDatabase();
        const sort: Document = { [options.sortField ?? 'createdAt']: -1 };
        const rows = await db
            .collection(collection)
            .find(
                { userId: scope.userId, ...(options.filter ?? {}) },
                { projection: options.projection, sort } as any,
            )
            .limit(options.limit ?? 5)
            .toArray();
        return JSON.parse(JSON.stringify(rows)) as T[];
    } catch {
        return [];
    }
}

export async function sumByUser(
    collection: string,
    field: string,
    extra: Filter<Document> = {},
): Promise<number> {
    try {
        const scope = await getHubScope();
        if (!scope) return 0;
        const { db } = await connectToDatabase();
        const result = await db
            .collection(collection)
            .aggregate([
                { $match: { userId: scope.userId, ...extra } },
                { $group: { _id: null, total: { $sum: `$${field}` } } },
            ])
            .toArray();
        const total = result[0]?.total;
        return typeof total === 'number' ? total : 0;
    } catch {
        return 0;
    }
}

export function startOfDay(d = new Date()): Date {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

export function startOfWeek(d = new Date()): Date {
    const x = startOfDay(d);
    x.setDate(x.getDate() - x.getDay());
    return x;
}

export function startOfMonth(d = new Date()): Date {
    const x = new Date(d.getFullYear(), d.getMonth(), 1);
    return x;
}

export function formatCurrency(value: number, currency = 'USD'): string {
    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency,
            maximumFractionDigits: 0,
        }).format(value);
    } catch {
        return `${currency} ${Math.round(value).toLocaleString()}`;
    }
}

export function formatDate(value: Date | string | undefined | null): string {
    if (!value) return '—';
    try {
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        }).format(new Date(value));
    } catch {
        return '—';
    }
}
