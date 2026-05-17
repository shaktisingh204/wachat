/**
 * CRM Public API — /v1/crm/vendors (Phase 7 foundation, hand-written).
 * Replaces the previous codegen'd stub.
 */
import { makeCrmCollectionHandlers } from '@/lib/api/crm-rest-handler';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface CreateInput { name: string; [k: string]: unknown }
type UpdateInput = Partial<CreateInput>;

const STRING_FIELDS = ["name","email","phone","address","gstin","pan","currency","paymentTerms"] as const;

const handlers = makeCrmCollectionHandlers<CreateInput, UpdateInput>({
    entity: 'vendors',
    collection: 'crm_vendors',
    searchableFields: ["name","email","phone"],
    webhookEvents: { created: 'vendor.created' },
    coerceCreate: (body) => {
        if (!body || typeof body !== 'object') return 'Body must be a JSON object';
        const b = body as Record<string, unknown>;
        if (typeof b.name !== 'string' || !(b.name as string).trim()) {
            return 'name is required';
        }
        const out: CreateInput = { name: (b.name as string).trim() };
        for (const k of STRING_FIELDS) {
            if (typeof b[k] === 'string') (out as Record<string, unknown>)[k] = b[k];
        }
        return out;
    },
    coerceUpdate: (body) => {
        if (!body || typeof body !== 'object') return 'Body must be a JSON object';
        const b = body as Record<string, unknown>;
        const out: UpdateInput = {};
        for (const k of STRING_FIELDS) {
            if (typeof b[k] === 'string') (out as Record<string, unknown>)[k] = b[k];
        }
        return out;
    },
});

export const GET = handlers.GET;
export const POST = handlers.POST;
