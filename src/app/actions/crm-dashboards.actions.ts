'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/index.ts';
import { getErrorMessage } from '@/lib/utils';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { crmDashboardsApi } from '@/lib/rust-client/crm-dashboards';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { writeAuditEntry } from '@/lib/audit-log';

/* ============================================================== */
/*  §6.5 Dashboard widget builder — layout persistence + data      */
/*       resolvers. Shape is additive to the existing Mongo doc;   */
/*       the Rust crate stays untouched.                            */
/* ============================================================== */

type WidgetKind =
    | 'metric'
    | 'line'
    | 'bar'
    | 'donut'
    | 'funnel'
    | 'table';

type WidgetDataSourceType = 'saved_view' | 'report' | 'metric_query';

interface WidgetDataSource {
    type: WidgetDataSourceType;
    /** Mongo `_id` of a saved view, report, or the metric-query slug. */
    ref: string;
}

interface DashboardWidget {
    id: string;
    kind: WidgetKind;
    title: string;
    /** Layout grid coords. `w` is 1-12, `h` is 1-6. */
    x: number;
    y: number;
    w: number;
    h: number;
    dataSource: WidgetDataSource;
    /** Kind-specific configuration blob (axis keys, metric expression, …). */
    config?: Record<string, unknown>;
}

interface ResolvedWidgetData {
    rows: any[];
    /** Optional human-readable note (e.g. "stub"). */
    note?: string;
    error?: string;
}

const WIDGET_KINDS: ReadonlySet<WidgetKind> = new Set([
    'metric',
    'line',
    'bar',
    'donut',
    'funnel',
    'table',
]);

const DATA_SOURCE_TYPES: ReadonlySet<WidgetDataSourceType> = new Set([
    'saved_view',
    'report',
    'metric_query',
]);

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    const i = Math.round(n);
    if (i < min) return min;
    if (i > max) return max;
    return i;
}

function sanitizeWidget(raw: any, idx: number): DashboardWidget | null {
    if (!raw || typeof raw !== 'object') return null;
    const kind: WidgetKind = WIDGET_KINDS.has(raw.kind) ? raw.kind : 'metric';
    const dsRaw = raw.dataSource ?? raw.source ?? {};
    const dsType: WidgetDataSourceType = DATA_SOURCE_TYPES.has(dsRaw.type)
        ? dsRaw.type
        : 'saved_view';
    const ref = typeof dsRaw.ref === 'string' ? dsRaw.ref : String(dsRaw.ref ?? '');

    return {
        id: typeof raw.id === 'string' && raw.id ? raw.id : new ObjectId().toHexString(),
        kind,
        title: typeof raw.title === 'string' && raw.title.trim()
            ? raw.title.trim()
            : `Widget ${idx + 1}`,
        x: clampInt(raw.x, 0, 11, 0),
        y: clampInt(raw.y, 0, 999, idx),
        w: clampInt(raw.w, 1, 12, 6),
        h: clampInt(raw.h, 1, 6, 2),
        dataSource: { type: dsType, ref },
        config:
            raw.config && typeof raw.config === 'object' && !Array.isArray(raw.config)
                ? (raw.config as Record<string, unknown>)
                : undefined,
    };
}

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

export async function saveDashboard(
    _prev: any,
    formData: FormData
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const name = (formData.get('name') as string)?.trim();
        if (!name) return { error: 'Dashboard name is required.' };

        const description = (formData.get('description') as string)?.trim() || undefined;
        const layout = (formData.get('layout') as string) || '2col';
        const sharedWith = (formData.get('sharedWith') as string) || 'private';
        const isDefault = formData.get('isDefault') === 'on';

        const refreshIntervalRaw = formData.get('refreshInterval') as string;
        const refreshInterval =
            refreshIntervalRaw !== '' && refreshIntervalRaw !== null
                ? parseInt(refreshIntervalRaw, 10) || 0
                : undefined;

        const now = new Date();

        const insertResult = await db.collection('crm_dashboards').insertOne({
            name,
            ...(description !== undefined ? { description } : {}),
            layout,
            ...(refreshInterval !== undefined ? { refreshInterval } : {}),
            isDefault,
            sharedWith,
            widgets: [],
            status: 'active',
            userId: userObjectId,
            createdAt: now,
            updatedAt: now,
        });

        revalidatePath('/dashboard/sabbi/dashboards');
        return {
            message: 'Dashboard created. Add widgets to customize your view.',
            id: insertResult.insertedId.toString(),
        };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function updateDashboard(
    _prev: any,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    const id = (formData.get('id') as string) || '';
    if (!id || !ObjectId.isValid(id)) {
        return { error: 'Invalid dashboard ID.' };
    }

    try {
        const { db } = await connectToDatabase();

        const name = (formData.get('name') as string)?.trim();
        if (!name) return { error: 'Dashboard name is required.' };

        const description = (formData.get('description') as string)?.trim() || '';
        const layout = (formData.get('layout') as string) || '2col';
        const sharedWith = (formData.get('sharedWith') as string) || 'private';
        const isDefault = formData.get('isDefault') === 'on';
        const status = (formData.get('status') as string) || 'active';

        const refreshIntervalRaw = formData.get('refreshInterval') as string;
        const refreshInterval =
            refreshIntervalRaw !== '' && refreshIntervalRaw !== null
                ? parseInt(refreshIntervalRaw, 10) || 0
                : 0;

        const result = await db.collection('crm_dashboards').updateOne(
            {
                _id: new ObjectId(id),
                userId: new ObjectId(session.user._id),
            },
            {
                $set: {
                    name,
                    description,
                    layout,
                    refreshInterval,
                    isDefault,
                    sharedWith,
                    status,
                    updatedAt: new Date(),
                },
            },
        );

        if (result.matchedCount === 0) {
            return { error: 'Dashboard not found or permission denied.' };
        }

        revalidatePath('/dashboard/sabbi/dashboards');
        revalidatePath(`/dashboard/sabbi/dashboards/${id}`);
        return { message: 'Dashboard updated.', id };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function getDashboardById(id: string): Promise<any | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!ObjectId.isValid(id)) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmDashboardsApi.getById(id);
            return JSON.parse(JSON.stringify(doc));
        } catch (e) {
            console.error('[getDashboardById] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'dashboard',
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const dashboard = await db.collection('crm_dashboards').findOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id),
        });
        if (!dashboard) return null;
        return JSON.parse(JSON.stringify(dashboard));
    } catch (e) {
        console.error('Failed to fetch dashboard by id:', e);
        return null;
    }
}

/* ============================================================== */
/*  §6.5 Layout persistence                                         */
/* ============================================================== */

/**
 * Persist a widget layout for `dashboardId`. Widgets are stored as an
 * additive `widgets[]` array on the existing Mongo doc — the Rust DTO
 * already declares `widgets: Vec<bson::Document>`, so this stays
 * schema-compatible with both fall-back paths.
 */
export async function saveDashboardLayout(
    dashboardId: string,
    widgets: DashboardWidget[],
): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };
    if (!dashboardId || !ObjectId.isValid(dashboardId)) {
        return { error: 'Invalid dashboard ID.' };
    }
    if (!Array.isArray(widgets)) return { error: 'Widgets payload must be an array.' };

    const clean = widgets
        .map((w, i) => sanitizeWidget(w, i))
        .filter((w): w is DashboardWidget => !!w);

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_dashboards').updateOne(
            {
                _id: new ObjectId(dashboardId),
                userId: new ObjectId(session.user._id),
            },
            {
                $set: {
                    widgets: clean,
                    updatedAt: new Date(),
                },
            },
        );

        if (result.matchedCount === 0) {
            return { error: 'Dashboard not found or permission denied.' };
        }

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'update',
                entityKind: 'dashboard',
                entityId: dashboardId,
                reason: `layout: ${clean.length} widget(s)`,
            });
        } catch {
            /* non-fatal */
        }

        revalidatePath('/dashboard/sabbi/dashboards');
        revalidatePath(`/dashboard/sabbi/dashboards/${dashboardId}`);
        revalidatePath(`/dashboard/sabbi/dashboards/${dashboardId}/edit`);
        return { message: `Saved ${clean.length} widget(s).` };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteDashboard(
    dashboardId: string,
): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };
    if (!dashboardId || !ObjectId.isValid(dashboardId)) {
        return { error: 'Invalid dashboard ID.' };
    }
    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_dashboards').deleteOne({
            _id: new ObjectId(dashboardId),
            userId: new ObjectId(session.user._id),
        });
        if (result.deletedCount === 0) {
            return { error: 'Dashboard not found or permission denied.' };
        }
        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'delete',
                entityKind: 'dashboard',
                entityId: dashboardId,
            });
        } catch {
            /* non-fatal */
        }
        revalidatePath('/dashboard/sabbi/dashboards');
        return { message: 'Dashboard deleted.' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

/* ============================================================== */
/*  §6.5 Server-side widget data resolver                           */
/* ============================================================== */

/**
 * Turn a `WidgetDataSource` into rows for a widget. Used by the
 * detail page render path (server-rendered, no real-time).
 *
 * NOTE: `report` is stubbed — the cross-module Reports engine is
 * being wired in §6.8. Until then, picking a "Report" data source
 * surfaces an inline notice in the widget renderer.
 */
export async function resolveWidgetData(
    dataSource: WidgetDataSource,
): Promise<ResolvedWidgetData> {
    const session = await getSession();
    if (!session?.user) return { rows: [], error: 'Access denied' };
    if (!dataSource || !dataSource.type || !DATA_SOURCE_TYPES.has(dataSource.type)) {
        return { rows: [], error: 'Unknown data source.' };
    }

    try {
        if (dataSource.type === 'saved_view') {
            if (!dataSource.ref || !ObjectId.isValid(dataSource.ref)) {
                return { rows: [], error: 'Pick a saved view.' };
            }
            const { db } = await connectToDatabase();
            const view = await db.collection('crm_saved_views').findOne({
                _id: new ObjectId(dataSource.ref),
                userId: new ObjectId(session.user._id),
            });
            if (!view) return { rows: [], error: 'Saved view not found.' };
            const collection = (view as any).collection || (view as any).entity;
            const filter = (view as any).filter ?? {};
            if (!collection || typeof collection !== 'string') {
                return { rows: [], error: 'Saved view is missing a target collection.' };
            }
            const cursor = db
                .collection(collection)
                .find({ ...filter, userId: new ObjectId(session.user._id) })
                .limit(50);
            const docs = await cursor.toArray();
            return { rows: JSON.parse(JSON.stringify(docs)) };
        }

        if (dataSource.type === 'metric_query') {
            const ref = dataSource.ref || '';
            const { db } = await connectToDatabase();
            const userId = new ObjectId(session.user._id);
            // Built-in metric slugs. New slugs land here as additive
            // cases; the resolver stays a single function so widgets
            // pick by string and we don't grow a third lookup table.
            switch (ref) {
                case 'crm.leads.count': {
                    const value = await db
                        .collection('crm_leads')
                        .countDocuments({ userId });
                    return { rows: [{ label: 'Leads', value }] };
                }
                case 'crm.deals.open.count': {
                    const value = await db
                        .collection('crm_deals')
                        .countDocuments({ userId, status: { $ne: 'closed' } });
                    return { rows: [{ label: 'Open deals', value }] };
                }
                case 'crm.invoices.outstanding.count': {
                    const value = await db
                        .collection('crm_invoices')
                        .countDocuments({ userId, status: { $in: ['draft', 'sent', 'overdue'] } });
                    return { rows: [{ label: 'Outstanding invoices', value }] };
                }
                default:
                    return {
                        rows: [],
                        error: `Unknown metric_query slug "${ref}". Add a case in resolveWidgetData.`,
                    };
            }
        }

        // dataSource.type === 'report' — stubbed.
        return {
            rows: [],
            note: 'Reports engine not wired yet — see §6.8.',
        };
    } catch (e) {
        return { rows: [], error: getErrorMessage(e) };
    }
}
