'use server';

/**
 * Bulk-export server actions (CRM_REBUILD_PLAN §5.9).
 *
 * `exportEntityToCsv(entityKind, filters)` — returns a CSV string for the
 * given entity, scoped to the current tenant. Capped at 10k rows to keep
 * the response small. Uses the same `targetSchema` per entity as the
 * import wizard, so an export can be re-imported losslessly for the
 * subset of fields the schema covers.
 *
 * Permissions: read scoped via the `crm_<entity>` 'view' verb.
 */

import { ObjectId, type Filter, type Document } from 'mongodb';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { requirePermission } from '@/lib/rbac-server';
import { getAdapter } from '@/lib/bulk-import/registry';

const MAX_EXPORT_ROWS = 10_000;

export type EntityKindToCollection = Record<string, { coll: string; perm: string }>;

const ENTITY_MAP: EntityKindToCollection = {
    contact: { coll: 'crm_contacts', perm: 'crm_contact' },
    lead: { coll: 'crm_leads', perm: 'crm_lead' },
    account: { coll: 'crm_accounts', perm: 'crm_account' },
    item: { coll: 'crm_products', perm: 'crm_product' },
};

function escapeCsv(v: unknown): string {
    if (v == null) return '';
    if (Array.isArray(v)) return `"${v.join(', ').replace(/"/g, '""')}"`;
    if (v instanceof Date) return v.toISOString();
    const s = String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

function buildFilter(
    userOid: ObjectId,
    filters: Record<string, unknown> | undefined,
): Filter<Document> {
    const f: Filter<Document> = { userId: userOid };
    if (!filters) return f;
    for (const [k, v] of Object.entries(filters)) {
        if (v === undefined || v === null || v === '') continue;
        if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
            (f as Record<string, unknown>)[k] = v;
        }
    }
    return f;
}

export async function exportEntityToCsv(
    entityKind: string,
    filters?: Record<string, unknown>,
): Promise<{ csv?: string; rowCount?: number; capped?: boolean; error?: string }> {
    const mapping = ENTITY_MAP[entityKind];
    if (!mapping) return { error: `Unknown entity "${entityKind}".` };

    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required.' };

    const guard = await requirePermission(mapping.perm, 'view');
    if (!guard.ok) return { error: guard.error };

    const adapter = getAdapter(entityKind);
    if (!adapter) return { error: `No adapter registered for "${entityKind}".` };

    try {
        const { db } = await connectToDatabase();
        const userOid = new ObjectId(String(session.user._id));
        const mongoFilter = buildFilter(userOid, filters);

        const total = await db.collection(mapping.coll).countDocuments(mongoFilter);
        const capped = total > MAX_EXPORT_ROWS;
        const rows = await db
            .collection(mapping.coll)
            .find(mongoFilter)
            .sort({ createdAt: -1 })
            .limit(MAX_EXPORT_ROWS)
            .toArray();

        const fields = adapter.targetSchema.map((f) => f.field);
        const header = fields.join(',');
        const body = rows.map((r) => {
            const rec = r as Record<string, unknown>;
            return fields.map((f) => escapeCsv(rec[f])).join(',');
        });
        const csv = [header, ...body].join('\n');

        return { csv, rowCount: rows.length, capped };
    } catch (e) {
        console.error('[exportEntityToCsv] failed:', e);
        return { error: 'Export failed.' };
    }
}
