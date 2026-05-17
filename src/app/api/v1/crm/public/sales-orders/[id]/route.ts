/**
 * CRM Public API — /v1/crm/sales-orders/[id] (Phase 7 foundation).
 */
import { makeCrmItemHandlers } from '@/lib/api/crm-rest-handler';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface CreateInput { customerName: string }
type UpdateInput = Partial<CreateInput> & Record<string, unknown>;

const STRING_FIELDS = ["orderNumber","customerName","accountId","currency","status","deliveryDate","notes"] as const;

const handlers = makeCrmItemHandlers<CreateInput, UpdateInput>({
    entity: 'sales-orders',
    collection: 'crm_sales_orders',
    webhookEvents: { updated: 'sales-order.updated', deleted: 'sales-order.deleted' },
    coerceCreate: () => 'create not supported on /:id',
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
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
