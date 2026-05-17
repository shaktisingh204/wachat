/**
 * CRM Public API — /v1/crm/tasks (Phase 7 foundation, hand-written).
 * Replaces the previous codegen'd stub.
 */
import { makeCrmCollectionHandlers } from '@/lib/api/crm-rest-handler';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface CreateInput { title: string; [k: string]: unknown }
type UpdateInput = Partial<CreateInput>;

const STRING_FIELDS = ["title","description","status","priority","assigneeId","dueDate","relatedEntityType","relatedEntityId"] as const;

const handlers = makeCrmCollectionHandlers<CreateInput, UpdateInput>({
    entity: 'tasks',
    collection: 'crm_tasks',
    searchableFields: ["title","description"],
    webhookEvents: { created: 'task.created' },
    coerceCreate: (body) => {
        if (!body || typeof body !== 'object') return 'Body must be a JSON object';
        const b = body as Record<string, unknown>;
        if (typeof b.title !== 'string' || !(b.title as string).trim()) {
            return 'title is required';
        }
        const out: CreateInput = { title: (b.title as string).trim() };
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
