/**
 * Cohort retention computation. Reads from the configured source
 * collection and computes weekly/monthly retention buckets for the
 * requested number of periods.
 */

import 'server-only';

import type { CohortDefinition, CohortResult, CohortRow } from './types';

async function db() {
    const { connectToDatabase } = await import('@/lib/mongodb');
    const { db } = await connectToDatabase();
    return db;
}

const MS_DAY = 24 * 60 * 60 * 1000;
const MS_WEEK = 7 * MS_DAY;

function startOfWeek(d: Date): Date {
    // ISO week — Monday start.
    const day = d.getUTCDay() || 7;
    const out = new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
    );
    out.setUTCDate(out.getUTCDate() - (day - 1));
    return out;
}

function startOfMonth(d: Date): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function bucketKey(d: Date, period: 'week' | 'month'): string {
    if (period === 'month') {
        const m = (d.getUTCMonth() + 1).toString().padStart(2, '0');
        return `${d.getUTCFullYear()}-${m}`;
    }
    // ISO week-like key
    const start = startOfWeek(d);
    const onejan = Date.UTC(start.getUTCFullYear(), 0, 1);
    const week = Math.ceil(((start.getTime() - onejan) / MS_DAY + 1) / 7);
    return `${start.getUTCFullYear()}-W${week.toString().padStart(2, '0')}`;
}

function periodOffset(
    cohortStart: Date,
    activity: Date,
    period: 'week' | 'month',
): number {
    if (period === 'week') {
        const diff = activity.getTime() - cohortStart.getTime();
        if (diff < 0) return -1;
        return Math.floor(diff / MS_WEEK);
    }
    const months =
        (activity.getUTCFullYear() - cohortStart.getUTCFullYear()) * 12 +
        (activity.getUTCMonth() - cohortStart.getUTCMonth());
    return months < 0 ? -1 : months;
}

export async function computeCohort(
    tenantId: string,
    def: CohortDefinition,
): Promise<CohortResult> {
    if (!tenantId) throw new Error('tenantId required');
    if (!def.source) throw new Error('definition.source required');
    if (!def.cohortField || !def.activityField) {
        throw new Error('cohortField and activityField required');
    }
    if (def.periods <= 0) {
        return { period: def.period, periods: 0, rows: [] };
    }

    const database = await db();
    const filter: Record<string, unknown> = { tenantId };
    for (const f of def.filters ?? []) {
        // we trust validated filters from our own DSL
        if (f.op === 'eq') filter[f.field] = f.value;
    }

    const docs = await database
        .collection(def.source)
        .find(filter)
        .project({
            _id: 0,
            userId: 1,
            [def.cohortField]: 1,
            [def.activityField]: 1,
        })
        .toArray();

    // Group docs by userId — one cohort assignment per user.
    type Activity = { cohortDate: Date; activityDate: Date };
    const userMap = new Map<string, Activity[]>();
    for (const d of docs as any[]) {
        const userId = String(d.userId ?? '');
        if (!userId) continue;
        const cohortRaw = d[def.cohortField];
        const activityRaw = d[def.activityField];
        if (!cohortRaw || !activityRaw) continue;
        const cohortDate = new Date(cohortRaw);
        const activityDate = new Date(activityRaw);
        if (isNaN(cohortDate.getTime()) || isNaN(activityDate.getTime())) continue;
        const list = userMap.get(userId);
        const entry: Activity = { cohortDate, activityDate };
        if (list) list.push(entry);
        else userMap.set(userId, [entry]);
    }

    // Map cohort bucket -> {users: Set, retention buckets: Set per period}
    const cohortAgg = new Map<
        string,
        {
            cohortStart: Date;
            users: Set<string>;
            retention: Array<Set<string>>;
        }
    >();

    for (const [userId, activities] of userMap) {
        // Determine the user's cohort by their earliest cohortField date.
        const earliestCohort = activities.reduce(
            (min, a) => (a.cohortDate < min ? a.cohortDate : min),
            activities[0].cohortDate,
        );
        const cohortStart =
            def.period === 'week'
                ? startOfWeek(earliestCohort)
                : startOfMonth(earliestCohort);
        const key = bucketKey(cohortStart, def.period);

        let bucket = cohortAgg.get(key);
        if (!bucket) {
            bucket = {
                cohortStart,
                users: new Set(),
                retention: Array.from(
                    { length: def.periods },
                    () => new Set<string>(),
                ),
            };
            cohortAgg.set(key, bucket);
        }
        bucket.users.add(userId);

        for (const a of activities) {
            const offset = periodOffset(cohortStart, a.activityDate, def.period);
            if (offset >= 0 && offset < def.periods) {
                bucket.retention[offset].add(userId);
            }
        }
    }

    const rows: CohortRow[] = [...cohortAgg.entries()]
        .sort((a, b) => a[1].cohortStart.getTime() - b[1].cohortStart.getTime())
        .map(([cohort, b]) => ({
            cohort,
            size: b.users.size,
            retention: b.retention.map((s) =>
                b.users.size === 0 ? 0 : s.size / b.users.size,
            ),
        }));

    return { period: def.period, periods: def.periods, rows };
}
