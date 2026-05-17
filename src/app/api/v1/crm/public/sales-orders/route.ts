/**
 * CRM Public API — /v1/crm/sales-orders (Phase 7 foundation, hand-written).
 * Replaces the previous codegen'd stub.
 */
import { makeCrmCollectionHandlers } from '@/lib/api/crm-rest-handler';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface CreateInput { customerName: string; [k: string]: unknown }
type UpdateInput = Partial<CreateInput>;

const STRING_FIELDS = ["orderNumber","customerName","accountId","currency","status","deliveryDate","notes"] as const;

const handlers = makeCrmCollectionHandlers<CreateInput, UpdateInput>({
    entity: 'sales-orders',
    collection: 'crm_sales_orders',
    searchableFields: ["orderNumber","customerName"],
    webhookEvents: { created: 'sales-order.created' },
    coerceCreate: (body) => {
        if (!body || typeof body !== 'object') return 'Body must be a JSON object';
        const b = body as Record<string, unknown>;
        if (typeof b.customerName !== 'string' || !(b.customerName as string).trim()) {
            return 'customerName is required';
        }
        const out: CreateInput = { customerName: (b.customerName as string).trim() };
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
