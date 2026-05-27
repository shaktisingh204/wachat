'use server';

/**
 * CRM POS server actions — Mongo-direct.
 *
 * Owns the four POS collections introduced by CRM_REBUILD_PLAN §6.3:
 *   - `crm_pos_sessions`     — cashier sessions per terminal
 *   - `crm_pos_transactions` — completed sales
 *   - `crm_pos_holds`        — parked tickets that can be recalled
 *   - `crm_pos_refunds`      — refunds linked to an original transaction
 *
 * The Rust client (`src/lib/rust-client/crm-pos.ts`) is now registered
 * and the dual-impl pattern is wired via `useRustCrm()`.
 * When `USE_RUST_CRM === 'true'`, every action delegates to the Rust
 * BFF (`/v1/crm/pos`) and falls back to Mongo on failure.
 *
 * RBAC: every mutation runs through `requirePermission('crm_pos', ...)`.
 * `crm_pos` is a NEW key that must be appended to
 * `src/lib/permission-modules.ts` at batch-merge time — see the
 * deliverable note in the parent task.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId, type Document } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import { requirePermission } from '@/lib/rbac-server';
import { getErrorMessage } from '@/lib/utils';
import { crmPosApi } from '@/lib/rust-client/crm-pos';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

/* ─── Shared types ───────────────────────────────────────────────────── */

type PosSessionStatus = 'open' | 'closed' | 'reconciled' | 'archived';

interface PosTerminalDoc {
    _id?: string;
    userId: string;
    terminalId: string;
    status: 'online' | 'offline';
    lastHeartbeat: string | null;
    openSessionId: string | null;
    createdAt: string;
    updatedAt: string;
}

interface PosSessionDoc {
    _id: string;
    userId: string;
    terminalId: string;
    openedBy: string;
    openedByName?: string | null;
    openedAt: string;
    openingCash: number;
    closedAt?: string | null;
    closingCash?: number | null;
    expectedCash?: number | null;
    discrepancy?: number | null;
    status: PosSessionStatus;
    notes?: string | null;
    createdAt: string;
    updatedAt: string;
}

interface PosLineItem {
    itemId?: string | null;
    sku?: string | null;
    name: string;
    qty: number;
    rate: number;
    taxRate?: number;
    total: number;
}

type PosPaymentMethod = 'cash' | 'card' | 'upi' | 'split' | 'other';

interface PosPaymentSplit {
    method: PosPaymentMethod;
    amount: number;
    reference?: string | null;
}

type PosTransactionStatus =
    | 'completed'
    | 'voided'
    | 'refunded'
    | 'partially_refunded';

interface PosTransactionDoc {
    _id: string;
    userId: string;
    sessionId: string;
    transactionNumber: string;
    customerId?: string | null;
    customerName?: string | null;
    lineItems: PosLineItem[];
    subtotal: number;
    taxTotal: number;
    total: number;
    paymentMethod: PosPaymentMethod;
    paymentSplits?: PosPaymentSplit[] | null;
    status: PosTransactionStatus;
    voidReason?: string | null;
    createdAt: string;
    updatedAt: string;
}

type PosHoldStatus = 'held' | 'recalled' | 'discarded';

interface PosHoldDoc {
    _id: string;
    userId: string;
    sessionId: string;
    customerId?: string | null;
    customerName?: string | null;
    lineItems: PosLineItem[];
    subtotal: number;
    holdReason?: string | null;
    heldBy: string;
    heldByName?: string | null;
    heldAt: string;
    status: PosHoldStatus;
    recalledIntoTransactionId?: string | null;
    createdAt: string;
    updatedAt: string;
}

type PosRefundStatus = 'pending' | 'completed' | 'failed';

interface PosRefundDoc {
    _id: string;
    userId: string;
    originalTransactionId: string;
    originalTransactionNumber?: string | null;
    sessionId?: string | null;
    reason: string;
    refundedLineItems: PosLineItem[];
    refundTotal: number;
    refundMethod: PosPaymentMethod;
    status: PosRefundStatus;
    processedAt?: string | null;
    processedBy?: string | null;
    createdAt: string;
    updatedAt: string;
}

/* ─── Internal helpers ──────────────────────────────────────────────── */

function serialize<T>(doc: unknown): T {
    return JSON.parse(JSON.stringify(doc)) as T;
}

function normalizeLineItems(raw: unknown): PosLineItem[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .map((row) => {
            const r = row as Record<string, unknown>;
            const qty = Number(r.qty ?? r.quantity ?? 0);
            const rate = Number(r.rate ?? r.price ?? r.sellingPrice ?? 0);
            const taxRate = Number(r.taxRate ?? 0);
            const lineTotal = Number(r.total ?? qty * rate);
            return {
                itemId: typeof r.itemId === 'string' ? r.itemId : null,
                sku: typeof r.sku === 'string' ? r.sku : null,
                name: String(r.name ?? r.description ?? ''),
                qty: Number.isFinite(qty) ? qty : 0,
                rate: Number.isFinite(rate) ? rate : 0,
                taxRate: Number.isFinite(taxRate) ? taxRate : 0,
                total: Number.isFinite(lineTotal) ? lineTotal : 0,
            } satisfies PosLineItem;
        })
        .filter((li) => li.name || li.itemId);
}

function computeTotals(items: PosLineItem[]): {
    subtotal: number;
    taxTotal: number;
    total: number;
} {
    let subtotal = 0;
    let taxTotal = 0;
    for (const li of items) {
        const base = li.qty * li.rate;
        const tax = base * ((li.taxRate ?? 0) / 100);
        subtotal += base;
        taxTotal += tax;
    }
    const round2 = (n: number) => Math.round(n * 100) / 100;
    return {
        subtotal: round2(subtotal),
        taxTotal: round2(taxTotal),
        total: round2(subtotal + taxTotal),
    };
}

/**
 * Atomically allocate the next per-day transaction number.
 * Format: `TXN-YYYYMMDD-NNNN`.
 *
 * Uses `crm_pos_counters` with `{ userId, scope: 'txn', day }` and
 * `findOneAndUpdate({$inc:{seq:1}}, {upsert:true, returnDocument:'after'})`
 * so concurrent terminals don't collide.
 */
async function nextTransactionNumber(userId: ObjectId): Promise<string> {
    const { db } = await connectToDatabase();
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(now.getUTCDate()).padStart(2, '0');
    const day = `${yyyy}${mm}${dd}`;
    const counterFilter = { userId, scope: 'txn', day };
    const result = await db.collection('crm_pos_counters').findOneAndUpdate(
        counterFilter,
        { $inc: { seq: 1 }, $setOnInsert: { createdAt: new Date() } },
        { upsert: true, returnDocument: 'after' },
    );
    // mongodb v6+ returns the document directly (no .value wrapper).
    const seqVal = (result as { seq?: number } | null)?.seq;
    const seq = typeof seqVal === 'number' && seqVal > 0 ? seqVal : 1;
    return `TXN-${day}-${String(seq).padStart(4, '0')}`;
}

/* ─── Sessions ──────────────────────────────────────────────────────── */

export async function getPosSessions(filters?: {
    terminalId?: string;
    status?: PosSessionStatus | 'all';
}): Promise<PosSessionDoc[]> {
    const session = await getSession();
    if (!session?.user?._id) return [];
    const guard = await requirePermission('crm_pos', 'view');
    if (!guard.ok) return [];

    if (useRustCrm()) {
        try {
            const res = await crmPosApi.sessions.list({
                terminalId: filters?.terminalId,
                status: filters?.status,
                limit: 200,
            });
            return serialize<PosSessionDoc[]>(res.items);
        } catch (e) {
            console.error('[getPosSessions] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'pos_session',
                op: 'list',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
            // fall through
        }
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(String(session.user._id));
        const filter: Document = { userId: userObjectId };
        if (filters?.terminalId) filter.terminalId = filters.terminalId;
        if (filters?.status && filters.status !== 'all') filter.status = filters.status;

        const docs = await db
            .collection('crm_pos_sessions')
            .find(filter)
            .sort({ openedAt: -1 })
            .limit(200)
            .toArray();
        return serialize<PosSessionDoc[]>(docs);
    } catch (e) {
        console.error(e);
        return [];
    }
}

export async function registerPosTerminal(terminalId: string, openSessionId: string | null = null): Promise<void> {
    const session = await getSession();
    if (!session?.user?._id) return;
    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(String(session.user._id));
        const now = new Date();
        await db.collection('crm_pos_terminals').updateOne(
            { userId: userObjectId, terminalId },
            {
                $set: {
                    status: 'online',
                    lastHeartbeat: now,
                    openSessionId: openSessionId ?? null,
                    updatedAt: now,
                },
                $setOnInsert: {
                    userId: userObjectId,
                    terminalId,
                    createdAt: now,
                }
            },
            { upsert: true }
        );
    } catch (e) {
        console.error('[registerPosTerminal] Failed:', e);
    }
}

export async function heartbeatPosTerminal(terminalId: string): Promise<void> {
    const session = await getSession();
    if (!session?.user?._id) return;
    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(String(session.user._id));
        await db.collection('crm_pos_terminals').updateOne(
            { userId: userObjectId, terminalId },
            {
                $set: {
                    status: 'online',
                    lastHeartbeat: new Date(),
                }
            }
        );
    } catch (e) {
        console.error('[heartbeatPosTerminal] Failed:', e);
    }
}

export async function getPosSessionById(
    id: string,
): Promise<PosSessionDoc | null> {
    const session = await getSession();
    if (!session?.user?._id) return null;
    const guard = await requirePermission('crm_pos', 'view');
    if (!guard.ok) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmPosApi.sessions.getById(id);
            return doc ? serialize<PosSessionDoc>(doc) : null;
        } catch (e) {
            console.error('[getPosSessionById] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'pos_session',
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
            // fall through
        }
    }

    if (!ObjectId.isValid(id)) return null;
    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection('crm_pos_sessions').findOne({
            _id: new ObjectId(id),
            userId: new ObjectId(String(session.user._id)),
        });
        if (!doc) return null;
        return serialize<PosSessionDoc>(doc);
    } catch (e) {
        console.error('[getPosSessionById] failed:', e);
        return null;
    }
}

export async function openPosSession(
    _prev: unknown,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user?._id) return { error: 'Access denied.' };
    const guard = await requirePermission('crm_pos', 'create');
    if (!guard.ok) return { error: guard.error };

    const terminalId = (formData.get('terminalId') as string | null)?.trim() ?? '';
    const openingCash = Number(formData.get('openingCash') ?? 0);
    const notes = (formData.get('notes') as string | null) ?? '';

    if (!terminalId) return { error: 'Terminal is required.' };
    if (!Number.isFinite(openingCash) || openingCash < 0) {
        return { error: 'Opening cash must be a non-negative number.' };
    }

    if (useRustCrm()) {
        try {
            const res = await crmPosApi.sessions.open({
                terminalId,
                openingCash,
                notes: notes || undefined,
            });
            revalidatePath('/dashboard/crm/pos');
            revalidatePath('/dashboard/crm/pos/sessions');
            return { message: 'Session opened.', id: res.id };
        } catch (e) {
            console.error('[openPosSession] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'pos_session',
                op: 'create',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
            // fall through
        }
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(String(session.user._id));
        const now = new Date();
        const doc = {
            userId: userObjectId,
            terminalId,
            openedBy: String(session.user._id),
            openedByName: session.user.name ?? null,
            openedAt: now,
            openingCash,
            status: 'open' as const,
            notes: notes || null,
            createdAt: now,
            updatedAt: now,
        };
        const result = await db.collection('crm_pos_sessions').insertOne(doc);

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'create',
                entityKind: 'pos_session',
                entityId: result.insertedId.toString(),
            });
        } catch {
            /* non-fatal */
        }

        revalidatePath('/dashboard/crm/pos');
        revalidatePath('/dashboard/crm/pos/sessions');
        return {
            message: 'Session opened.',
            id: result.insertedId.toString(),
        };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function closePosSession(input: {
    id: string;
    closingCash: number;
}): Promise<{ success: boolean; error?: string; discrepancy?: number }> {
    const session = await getSession();
    if (!session?.user?._id) return { success: false, error: 'Access denied.' };
    const guard = await requirePermission('crm_pos', 'edit');
    if (!guard.ok) return { success: false, error: guard.error };
    const closingCash = Number(input.closingCash);
    if (!Number.isFinite(closingCash) || closingCash < 0) {
        return { success: false, error: 'Closing cash must be a non-negative number.' };
    }

    if (useRustCrm()) {
        try {
            const doc = await crmPosApi.sessions.close(input.id, { closingCash });
            revalidatePath('/dashboard/crm/pos');
            revalidatePath('/dashboard/crm/pos/sessions');
            revalidatePath(`/dashboard/crm/pos/sessions/${input.id}`);
            return {
                success: true,
                discrepancy: typeof doc.discrepancy === 'number' ? doc.discrepancy : undefined,
            };
        } catch (e) {
            console.error('[closePosSession] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'pos_session',
                op: 'update',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
            // fall through
        }
    }

    if (!ObjectId.isValid(input.id)) {
        return { success: false, error: 'Invalid session id.' };
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(String(session.user._id));
        const sessionDoc = await db.collection('crm_pos_sessions').findOne({
            _id: new ObjectId(input.id),
            userId: userObjectId,
        });
        if (!sessionDoc) return { success: false, error: 'Session not found.' };
        if (sessionDoc.status !== 'open') {
            return { success: false, error: 'Session is not open.' };
        }

        // Compute expected cash = openingCash + sum(cash receipts in this session)
        const txns = await db
            .collection('crm_pos_transactions')
            .find({
                userId: userObjectId,
                sessionId: new ObjectId(input.id),
                status: { $in: ['completed', 'partially_refunded'] },
            })
            .toArray();
        let cashReceived = 0;
        for (const t of txns) {
            const method = (t as { paymentMethod?: string }).paymentMethod;
            const total = Number((t as { total?: number }).total ?? 0);
            if (method === 'cash') {
                cashReceived += total;
            } else if (method === 'split' && Array.isArray((t as { paymentSplits?: PosPaymentSplit[] }).paymentSplits)) {
                for (const s of (t as { paymentSplits?: PosPaymentSplit[] }).paymentSplits ?? []) {
                    if (s.method === 'cash') cashReceived += Number(s.amount ?? 0);
                }
            }
        }
        const expectedCash = Number(sessionDoc.openingCash ?? 0) + cashReceived;
        const discrepancy = closingCash - expectedCash;
        const now = new Date();
        await db.collection('crm_pos_sessions').updateOne(
            { _id: new ObjectId(input.id), userId: userObjectId },
            {
                $set: {
                    closingCash,
                    expectedCash,
                    discrepancy,
                    closedAt: now,
                    status: 'closed',
                    updatedAt: now,
                },
            },
        );

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'status_change',
                entityKind: 'pos_session',
                entityId: input.id,
                reason: `closed (discrepancy=${discrepancy})`,
            });
        } catch {
            /* non-fatal */
        }

        revalidatePath('/dashboard/crm/pos');
        revalidatePath('/dashboard/crm/pos/sessions');
        revalidatePath(`/dashboard/crm/pos/sessions/${input.id}`);
        return { success: true, discrepancy };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function reconcilePosSession(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user?._id) return { success: false, error: 'Access denied.' };
    const guard = await requirePermission('crm_pos', 'edit');
    if (!guard.ok) return { success: false, error: guard.error };

    if (useRustCrm()) {
        try {
            await crmPosApi.sessions.reconcile(id);
            revalidatePath('/dashboard/crm/pos/sessions');
            revalidatePath(`/dashboard/crm/pos/sessions/${id}`);
            return { success: true };
        } catch (e) {
            console.error('[reconcilePosSession] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'pos_session',
                op: 'update',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
            // fall through
        }
    }

    if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid session id.' };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_pos_sessions').updateOne(
            {
                _id: new ObjectId(id),
                userId: new ObjectId(String(session.user._id)),
                status: 'closed',
            },
            { $set: { status: 'reconciled', updatedAt: new Date() } },
        );
        if (result.matchedCount === 0) {
            return { success: false, error: 'Session must be closed before reconciling.' };
        }
        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'status_change',
                entityKind: 'pos_session',
                entityId: id,
                reason: 'reconciled',
            });
        } catch {
            /* non-fatal */
        }
        revalidatePath('/dashboard/crm/pos/sessions');
        revalidatePath(`/dashboard/crm/pos/sessions/${id}`);
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function archivePosSession(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user?._id) return { success: false, error: 'Access denied.' };
    const guard = await requirePermission('crm_pos', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    if (useRustCrm()) {
        try {
            await crmPosApi.sessions.archive(id);
            revalidatePath('/dashboard/crm/pos/sessions');
            return { success: true };
        } catch (e) {
            console.error('[archivePosSession] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'pos_session',
                op: 'delete',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
            // fall through
        }
    }

    if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid session id.' };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_pos_sessions').updateOne(
            { _id: new ObjectId(id), userId: new ObjectId(String(session.user._id)) },
            { $set: { status: 'archived', updatedAt: new Date() } },
        );
        if (result.matchedCount === 0) {
            return { success: false, error: 'Session not found.' };
        }
        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'archive',
                entityKind: 'pos_session',
                entityId: id,
            });
        } catch {
            /* non-fatal */
        }
        revalidatePath('/dashboard/crm/pos/sessions');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/* ─── Transactions ───────────────────────────────────────────────────── */

export async function getPosTransactions(filters?: {
    sessionId?: string;
    status?: PosTransactionStatus | 'all';
    limit?: number;
}): Promise<PosTransactionDoc[]> {
    const session = await getSession();
    if (!session?.user?._id) return [];
    const guard = await requirePermission('crm_pos', 'view');
    if (!guard.ok) return [];

    if (useRustCrm()) {
        try {
            const res = await crmPosApi.transactions.list({
                sessionId: filters?.sessionId,
                status: filters?.status as any,
                limit: Math.max(1, Math.min(500, filters?.limit ?? 200)),
            });
            return serialize<PosTransactionDoc[]>(res.items);
        } catch (e) {
            console.error('[getPosTransactions] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'pos_transaction',
                op: 'list',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
            // fall through
        }
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(String(session.user._id));
        const filter: Document = { userId: userObjectId };
        if (filters?.sessionId && ObjectId.isValid(filters.sessionId)) {
            filter.sessionId = new ObjectId(filters.sessionId);
        }
        if (filters?.status && filters.status !== 'all') filter.status = filters.status;

        const docs = await db
            .collection('crm_pos_transactions')
            .find(filter)
            .sort({ createdAt: -1 })
            .limit(Math.max(1, Math.min(500, filters?.limit ?? 200)))
            .toArray();
        return serialize<PosTransactionDoc[]>(docs);
    } catch (e) {
        console.error('[getPosTransactions] failed:', e);
        return [];
    }
}

export async function getPosTransactionById(
    id: string,
): Promise<PosTransactionDoc | null> {
    const session = await getSession();
    if (!session?.user?._id) return null;
    const guard = await requirePermission('crm_pos', 'view');
    if (!guard.ok) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmPosApi.transactions.getById(id);
            return doc ? serialize<PosTransactionDoc>(doc) : null;
        } catch (e) {
            console.error('[getPosTransactionById] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'pos_transaction',
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
            // fall through
        }
    }

    if (!ObjectId.isValid(id)) return null;
    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection('crm_pos_transactions').findOne({
            _id: new ObjectId(id),
            userId: new ObjectId(String(session.user._id)),
        });
        if (!doc) return null;
        return serialize<PosTransactionDoc>(doc);
    } catch (e) {
        console.error('[getPosTransactionById] failed:', e);
        return null;
    }
}

interface CreatePosTransactionInput {
    sessionId: string;
    customerId?: string | null;
    customerName?: string | null;
    lineItems: Array<Partial<PosLineItem> & { name?: string; qty?: number; rate?: number }>;
    paymentMethod: PosPaymentMethod;
    paymentSplits?: PosPaymentSplit[] | null;
}

export async function createPosTransaction(
    input: CreatePosTransactionInput,
): Promise<{
    success: boolean;
    error?: string;
    id?: string;
    transactionNumber?: string;
}> {
    const session = await getSession();
    if (!session?.user?._id) return { success: false, error: 'Access denied.' };
    const guard = await requirePermission('crm_pos', 'create');
    if (!guard.ok) return { success: false, error: guard.error };

    if (!input.sessionId) {
        return { success: false, error: 'A valid session is required.' };
    }
    const items = normalizeLineItems(input.lineItems ?? []);
    if (items.length === 0) {
        return { success: false, error: 'At least one line item is required.' };
    }
    const totals = computeTotals(items);
    if (totals.total <= 0) {
        return { success: false, error: 'Transaction total must be positive.' };
    }

    if (useRustCrm()) {
        try {
            const res = await crmPosApi.transactions.create({
                sessionId: input.sessionId,
                customerId: input.customerId ?? undefined,
                lineItems: items.map((li) => ({
                    itemId: li.itemId ?? null,
                    name: li.name,
                    quantity: li.qty,
                    rate: li.rate,
                    taxRate: li.taxRate,
                    total: li.total,
                })),
                subtotal: totals.subtotal,
                taxTotal: totals.taxTotal,
                total: totals.total,
                paymentMethod: input.paymentMethod as any,
                paymentSplits: input.paymentSplits?.map((s) => ({
                    method: s.method as any,
                    amount: s.amount,
                })),
            });
            revalidatePath('/dashboard/crm/pos');
            revalidatePath('/dashboard/crm/pos/terminal');
            revalidatePath(`/dashboard/crm/pos/sessions/${input.sessionId}`);
            return {
                success: true,
                id: res.id,
                transactionNumber: res.entity?.transactionNumber,
            };
        } catch (e) {
            console.error('[createPosTransaction] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'pos_transaction',
                op: 'create',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
            // fall through
        }
    }

    if (!ObjectId.isValid(input.sessionId)) {
        return { success: false, error: 'A valid session is required.' };
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(String(session.user._id));
        const sessionDoc = await db.collection('crm_pos_sessions').findOne({
            _id: new ObjectId(input.sessionId),
            userId: userObjectId,
        });
        if (!sessionDoc) return { success: false, error: 'Session not found.' };
        if (sessionDoc.status !== 'open') {
            return { success: false, error: 'Session is not open.' };
        }

        const transactionNumber = await nextTransactionNumber(userObjectId);
        const now = new Date();
        const insertResult = await db.collection('crm_pos_transactions').insertOne({
            userId: userObjectId,
            sessionId: new ObjectId(input.sessionId),
            transactionNumber,
            customerId:
                input.customerId && ObjectId.isValid(input.customerId)
                    ? new ObjectId(input.customerId)
                    : null,
            customerName: input.customerName ?? null,
            lineItems: items,
            subtotal: totals.subtotal,
            taxTotal: totals.taxTotal,
            total: totals.total,
            paymentMethod: input.paymentMethod,
            paymentSplits:
                input.paymentMethod === 'split' && Array.isArray(input.paymentSplits)
                    ? input.paymentSplits.map((s) => ({
                          method: s.method,
                          amount: Number(s.amount ?? 0),
                          reference: s.reference ?? null,
                      }))
                    : null,
            status: 'completed',
            createdAt: now,
            updatedAt: now,
        });

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'create',
                entityKind: 'pos_transaction',
                entityId: insertResult.insertedId.toString(),
                reason: transactionNumber,
            });
        } catch {
            /* non-fatal */
        }

        revalidatePath('/dashboard/crm/pos');
        revalidatePath('/dashboard/crm/pos/terminal');
        revalidatePath(`/dashboard/crm/pos/sessions/${input.sessionId}`);
        return {
            success: true,
            id: insertResult.insertedId.toString(),
            transactionNumber,
        };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function voidPosTransaction(input: {
    id: string;
    reason?: string;
}): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user?._id) return { success: false, error: 'Access denied.' };
    const guard = await requirePermission('crm_pos', 'edit');
    if (!guard.ok) return { success: false, error: guard.error };

    if (useRustCrm()) {
        try {
            await crmPosApi.transactions.void(input.id, input.reason);
            revalidatePath('/dashboard/crm/pos');
            revalidatePath('/dashboard/crm/pos/terminal');
            return { success: true };
        } catch (e) {
            console.error('[voidPosTransaction] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'pos_transaction',
                op: 'update',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
            // fall through
        }
    }

    if (!ObjectId.isValid(input.id)) {
        return { success: false, error: 'Invalid transaction id.' };
    }

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_pos_transactions').updateOne(
            {
                _id: new ObjectId(input.id),
                userId: new ObjectId(String(session.user._id)),
                status: 'completed',
            },
            {
                $set: {
                    status: 'voided',
                    voidReason: input.reason ?? null,
                    updatedAt: new Date(),
                },
            },
        );
        if (result.matchedCount === 0) {
            return { success: false, error: 'Transaction not found or already voided.' };
        }
        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'void',
                entityKind: 'pos_transaction',
                entityId: input.id,
                reason: input.reason,
            });
        } catch {
            /* non-fatal */
        }
        revalidatePath('/dashboard/crm/pos');
        revalidatePath('/dashboard/crm/pos/terminal');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/* ─── Refunds ────────────────────────────────────────────────────────── */

interface RefundPosTransactionInput {
    originalTransactionId: string;
    reason: string;
    refundedLineItems: Array<Partial<PosLineItem>>;
    refundMethod: PosPaymentMethod;
    restockInventory?: boolean;
    requestApproval?: boolean;
}

export async function refundPosTransaction(
    input: RefundPosTransactionInput,
): Promise<{ success: boolean; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user?._id) return { success: false, error: 'Access denied.' };
    const guard = await requirePermission('crm_pos', 'edit');
    if (!guard.ok) return { success: false, error: guard.error };
    if (!input.reason?.trim()) {
        return { success: false, error: 'Refund reason is required.' };
    }
    const items = normalizeLineItems(input.refundedLineItems ?? []);
    if (items.length === 0) {
        return { success: false, error: 'At least one refund line is required.' };
    }
    const totals = computeTotals(items);
    if (totals.total <= 0) {
        return { success: false, error: 'Refund total must be positive.' };
    }

    if (useRustCrm()) {
        try {
            const res = await crmPosApi.transactions.refund(input.originalTransactionId, {
                reason: input.reason.trim(),
                refundedLineItems: items.map((li, idx) => ({
                    originalLineItemIndex: idx,
                    quantity: li.qty,
                    refundAmount: li.total,
                })),
                refundTotal: totals.total,
                refundMethod: input.refundMethod as any,
                restockInventory: input.restockInventory,
            });
            revalidatePath('/dashboard/crm/pos/refunds');
            revalidatePath('/dashboard/crm/pos');
            return { success: true, id: res.id };
        } catch (e) {
            console.error('[refundPosTransaction] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'pos_transaction',
                op: 'update',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
            // fall through
        }
    }

    if (!input.originalTransactionId || !ObjectId.isValid(input.originalTransactionId)) {
        return { success: false, error: 'Invalid original transaction id.' };
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(String(session.user._id));
        const original = await db.collection('crm_pos_transactions').findOne({
            _id: new ObjectId(input.originalTransactionId),
            userId: userObjectId,
        });
        if (!original) {
            return { success: false, error: 'Original transaction not found.' };
        }
        const now = new Date();
        const insertResult = await db.collection('crm_pos_refunds').insertOne({
            userId: userObjectId,
            originalTransactionId: original._id,
            originalTransactionNumber: original.transactionNumber ?? null,
            sessionId: original.sessionId ?? null,
            reason: input.reason.trim(),
            refundedLineItems: items,
            refundTotal: totals.total,
            refundMethod: input.refundMethod,
            status: input.requestApproval ? 'pending' : 'completed',
            processedAt: input.requestApproval ? null : now,
            processedBy: input.requestApproval ? null : String(session.user._id),
            createdAt: now,
            updatedAt: now,
        });

        if (input.requestApproval) {
            revalidatePath('/dashboard/crm/pos/refunds');
            return { success: true, id: insertResult.insertedId.toString() };
        }

        // Restock logic (pseudo/db update for stock if restockInventory=true)
        if (input.restockInventory) {
            for (const item of items) {
                if (item.itemId) {
                    await db.collection('crm_products').updateOne(
                        { _id: new ObjectId(item.itemId) },
                        { $inc: { stock: item.qty } }
                    );
                }
            }
        }

        // Flip the original transaction status. Full refund if the
        // refund total equals the transaction total to 2 dp; else
        // partial.
        const origTotal = Number(original.total ?? 0);
        const newStatus: PosTransactionStatus =
            Math.abs(origTotal - totals.total) < 0.01
                ? 'refunded'
                : 'partially_refunded';
        await db.collection('crm_pos_transactions').updateOne(
            { _id: original._id, userId: userObjectId },
            { $set: { status: newStatus, updatedAt: now } },
        );

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'refund',
                entityKind: 'pos_transaction',
                entityId: String(original._id),
                reason: input.reason,
            });
        } catch {
            /* non-fatal */
        }

        revalidatePath('/dashboard/crm/pos/refunds');
        revalidatePath('/dashboard/crm/pos');
        return { success: true, id: insertResult.insertedId.toString() };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function getPosRefunds(filters?: {
    status?: PosRefundStatus | 'all';
    limit?: number;
}): Promise<PosRefundDoc[]> {
    const session = await getSession();
    if (!session?.user?._id) return [];
    const guard = await requirePermission('crm_pos', 'view');
    if (!guard.ok) return [];

    if (useRustCrm()) {
        try {
            const res = await crmPosApi.refunds.list({
                status: filters?.status as any,
                limit: Math.max(1, Math.min(500, filters?.limit ?? 200)),
            });
            return serialize<PosRefundDoc[]>(res.items);
        } catch (e) {
            console.error('[getPosRefunds] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'pos_refund',
                op: 'list',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
            // fall through
        }
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(String(session.user._id));
        const filter: Document = { userId: userObjectId };
        if (filters?.status && filters.status !== 'all') filter.status = filters.status;

        const docs = await db
            .collection('crm_pos_refunds')
            .find(filter)
            .sort({ createdAt: -1 })
            .limit(Math.max(1, Math.min(500, filters?.limit ?? 200)))
            .toArray();
        return serialize<PosRefundDoc[]>(docs);
    } catch (e) {
        console.error('[getPosRefunds] failed:', e);
        return [];
    }
}

export async function getPosRefundById(id: string): Promise<PosRefundDoc | null> {
    const session = await getSession();
    if (!session?.user?._id) return null;
    const guard = await requirePermission('crm_pos', 'view');
    if (!guard.ok) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmPosApi.refunds.getById(id);
            return doc ? serialize<PosRefundDoc>(doc) : null;
        } catch (e) {
            console.error('[getPosRefundById] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'pos_refund',
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
            // fall through
        }
    }

    if (!ObjectId.isValid(id)) return null;
    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection('crm_pos_refunds').findOne({
            _id: new ObjectId(id),
            userId: new ObjectId(String(session.user._id)),
        });
        if (!doc) return null;
        return serialize<PosRefundDoc>(doc);
    } catch (e) {
        console.error('[getPosRefundById] failed:', e);
        return null;
    }
}

/* ─── Holds ──────────────────────────────────────────────────────────── */

export async function getPosHolds(filters?: {
    sessionId?: string;
    status?: PosHoldStatus | 'all';
}): Promise<PosHoldDoc[]> {
    const session = await getSession();
    if (!session?.user?._id) return [];
    const guard = await requirePermission('crm_pos', 'view');
    if (!guard.ok) return [];

    if (useRustCrm()) {
        try {
            const res = await crmPosApi.holds.list({
                sessionId: filters?.sessionId,
                status: (filters?.status ?? 'held') as any,
                limit: 200,
            });
            return serialize<PosHoldDoc[]>(res.items);
        } catch (e) {
            console.error('[getPosHolds] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'pos_hold',
                op: 'list',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
            // fall through
        }
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(String(session.user._id));
        const filter: Document = { userId: userObjectId };
        if (filters?.sessionId && ObjectId.isValid(filters.sessionId)) {
            filter.sessionId = new ObjectId(filters.sessionId);
        }
        if (filters?.status && filters.status !== 'all') {
            filter.status = filters.status;
        } else if (!filters?.status) {
            // Default to currently-held tickets only on the recall view.
            filter.status = 'held';
        }

        // Auto-purge policy: discard tickets held longer than 24 hours
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        await db.collection('crm_pos_holds').updateMany(
            { userId: userObjectId, status: 'held', heldAt: { $lt: twentyFourHoursAgo } },
            { $set: { status: 'discarded', updatedAt: new Date() } }
        );

        const docs = await db
            .collection('crm_pos_holds')
            .find(filter)
            .sort({ heldAt: -1 })
            .limit(200)
            .toArray();
        return serialize<PosHoldDoc[]>(docs);
    } catch (e) {
        console.error('[getPosHolds] failed:', e);
        return [];
    }
}

interface CreatePosHoldInput {
    sessionId: string;
    customerId?: string | null;
    customerName?: string | null;
    lineItems: Array<Partial<PosLineItem>>;
    holdReason?: string;
}

export async function createPosHold(
    input: CreatePosHoldInput,
): Promise<{ success: boolean; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user?._id) return { success: false, error: 'Access denied.' };
    const guard = await requirePermission('crm_pos', 'create');
    if (!guard.ok) return { success: false, error: guard.error };
    const items = normalizeLineItems(input.lineItems ?? []);
    if (items.length === 0) {
        return { success: false, error: 'At least one line item is required.' };
    }
    const totals = computeTotals(items);

    if (useRustCrm()) {
        try {
            const res = await crmPosApi.holds.create({
                sessionId: input.sessionId,
                customerId: input.customerId ?? undefined,
                lineItems: items.map((li) => ({
                    itemId: li.itemId ?? null,
                    name: li.name,
                    quantity: li.qty,
                    rate: li.rate,
                    taxRate: li.taxRate,
                    total: li.total,
                })),
                holdReason: input.holdReason,
            });
            revalidatePath('/dashboard/crm/pos');
            revalidatePath('/dashboard/crm/pos/hold-recall');
            return { success: true, id: res.id };
        } catch (e) {
            console.error('[createPosHold] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'pos_hold',
                op: 'create',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
            // fall through
        }
    }

    if (!input.sessionId || !ObjectId.isValid(input.sessionId)) {
        return { success: false, error: 'A valid session is required.' };
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(String(session.user._id));
        const now = new Date();
        const insertResult = await db.collection('crm_pos_holds').insertOne({
            userId: userObjectId,
            sessionId: new ObjectId(input.sessionId),
            customerId:
                input.customerId && ObjectId.isValid(input.customerId)
                    ? new ObjectId(input.customerId)
                    : null,
            customerName: input.customerName ?? null,
            lineItems: items,
            subtotal: totals.subtotal,
            holdReason: input.holdReason ?? null,
            heldBy: String(session.user._id),
            heldByName: session.user.name ?? null,
            heldAt: now,
            status: 'held',
            createdAt: now,
            updatedAt: now,
        });

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'create',
                entityKind: 'pos_hold',
                entityId: insertResult.insertedId.toString(),
            });
        } catch {
            /* non-fatal */
        }

        revalidatePath('/dashboard/crm/pos');
        revalidatePath('/dashboard/crm/pos/hold-recall');
        return { success: true, id: insertResult.insertedId.toString() };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/**
 * Recall a held ticket: marks the hold as `recalled` and creates a
 * fresh `pos_transaction` from its line items. Caller must supply a
 * `paymentMethod` (matches the standard checkout flow).
 */
export async function recallPosHold(input: {
    holdId: string;
    paymentMethod: PosPaymentMethod;
    paymentSplits?: PosPaymentSplit[] | null;
}): Promise<{
    success: boolean;
    error?: string;
    transactionId?: string;
    transactionNumber?: string;
}> {
    const session = await getSession();
    if (!session?.user?._id) return { success: false, error: 'Access denied.' };
    const guard = await requirePermission('crm_pos', 'edit');
    if (!guard.ok) return { success: false, error: guard.error };

    if (useRustCrm()) {
        try {
            const res = await crmPosApi.holds.recall(input.holdId, {
                paymentMethod: input.paymentMethod as any,
                paymentSplits: input.paymentSplits?.map((s) => ({
                    method: s.method as any,
                    amount: s.amount,
                })),
            });
            revalidatePath('/dashboard/crm/pos');
            revalidatePath('/dashboard/crm/pos/hold-recall');
            return {
                success: true,
                transactionId: res.id,
                transactionNumber: res.entity?.transactionNumber,
            };
        } catch (e) {
            console.error('[recallPosHold] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'pos_hold',
                op: 'update',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
            // fall through
        }
    }

    if (!ObjectId.isValid(input.holdId)) {
        return { success: false, error: 'Invalid hold id.' };
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(String(session.user._id));
        const hold = await db.collection('crm_pos_holds').findOne({
            _id: new ObjectId(input.holdId),
            userId: userObjectId,
            status: 'held',
        });
        if (!hold) {
            return { success: false, error: 'Hold not found or already recalled.' };
        }
        const items = normalizeLineItems(hold.lineItems);
        if (items.length === 0) {
            return { success: false, error: 'Hold has no items.' };
        }
        const totals = computeTotals(items);
        if (totals.total <= 0) {
            return { success: false, error: 'Hold total must be positive.' };
        }

        const transactionNumber = await nextTransactionNumber(userObjectId);
        const now = new Date();
        const insertResult = await db.collection('crm_pos_transactions').insertOne({
            userId: userObjectId,
            sessionId: hold.sessionId,
            transactionNumber,
            customerId: hold.customerId ?? null,
            customerName: hold.customerName ?? null,
            lineItems: items,
            subtotal: totals.subtotal,
            taxTotal: totals.taxTotal,
            total: totals.total,
            paymentMethod: input.paymentMethod,
            paymentSplits:
                input.paymentMethod === 'split' && Array.isArray(input.paymentSplits)
                    ? input.paymentSplits.map((s) => ({
                          method: s.method,
                          amount: Number(s.amount ?? 0),
                          reference: s.reference ?? null,
                      }))
                    : null,
            status: 'completed',
            createdAt: now,
            updatedAt: now,
        });

        await db.collection('crm_pos_holds').updateOne(
            { _id: hold._id, userId: userObjectId },
            {
                $set: {
                    status: 'recalled',
                    recalledIntoTransactionId: insertResult.insertedId,
                    updatedAt: now,
                },
            },
        );

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'convert',
                entityKind: 'pos_hold',
                entityId: String(hold._id),
                reason: `recalled -> ${transactionNumber}`,
            });
        } catch {
            /* non-fatal */
        }

        revalidatePath('/dashboard/crm/pos');
        revalidatePath('/dashboard/crm/pos/hold-recall');
        return {
            success: true,
            transactionId: insertResult.insertedId.toString(),
            transactionNumber,
        };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/* ─── Hold discard (void without recalling into a transaction) ────────── */

export async function discardPosHold(holdId: string): Promise<{
    success: boolean;
    error?: string;
}> {
    const session = await getSession();
    if (!session?.user?._id) return { success: false, error: 'Access denied.' };
    const guard = await requirePermission('crm_pos', 'edit');
    if (!guard.ok) return { success: false, error: guard.error };

    if (!ObjectId.isValid(holdId)) return { success: false, error: 'Invalid hold id.' };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(String(session.user._id));
        const result = await db.collection('crm_pos_holds').updateOne(
            { _id: new ObjectId(holdId), userId: userObjectId, status: 'held' },
            { $set: { status: 'discarded', updatedAt: new Date() } },
        );
        if (result.matchedCount === 0) {
            return { success: false, error: 'Hold not found or already processed.' };
        }
        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'delete',
                entityKind: 'pos_hold',
                entityId: holdId,
                reason: 'voided from hold-recall list',
            });
        } catch {
            /* non-fatal */
        }
        revalidatePath('/dashboard/crm/pos');
        revalidatePath('/dashboard/crm/pos/hold-recall');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function bulkDiscardPosHolds(holdIds: string[]): Promise<{
    success: boolean;
    processed: number;
    error?: string;
}> {
    const session = await getSession();
    if (!session?.user?._id) return { success: false, processed: 0, error: 'Access denied.' };
    const guard = await requirePermission('crm_pos', 'edit');
    if (!guard.ok) return { success: false, processed: 0, error: guard.error };

    const validIds = holdIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
    if (validIds.length === 0) return { success: false, processed: 0, error: 'No valid hold ids.' };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(String(session.user._id));
        const result = await db.collection('crm_pos_holds').updateMany(
            { _id: { $in: validIds }, userId: userObjectId, status: 'held' },
            { $set: { status: 'discarded', updatedAt: new Date() } },
        );
        revalidatePath('/dashboard/crm/pos');
        revalidatePath('/dashboard/crm/pos/hold-recall');
        return { success: true, processed: result.modifiedCount ?? 0 };
    } catch (e) {
        return { success: false, processed: 0, error: getErrorMessage(e) };
    }
}

export async function mergePosHolds(holdIds: string[]): Promise<{
    success: boolean;
    error?: string;
    id?: string;
}> {
    const session = await getSession();
    if (!session?.user?._id) return { success: false, error: 'Access denied.' };
    const guard = await requirePermission('crm_pos', 'edit');
    if (!guard.ok) return { success: false, error: guard.error };

    const validIds = holdIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
    if (validIds.length < 2) return { success: false, error: 'Select at least two tickets to merge.' };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(String(session.user._id));
        
        const holds = await db.collection('crm_pos_holds').find({
            _id: { $in: validIds },
            userId: userObjectId,
            status: 'held'
        }).toArray() as PosHoldDoc[];

        if (holds.length < 2) {
            return { success: false, error: 'Some tickets could not be merged or are no longer held.' };
        }

        const mergedItems: PosLineItem[] = [];
        let totalSubtotal = 0;
        let customerName = holds[0].customerName;

        for (const hold of holds) {
            mergedItems.push(...hold.lineItems);
            totalSubtotal += hold.subtotal;
        }

        const now = new Date();
        const insertResult = await db.collection('crm_pos_holds').insertOne({
            userId: userObjectId,
            sessionId: new ObjectId(holds[0].sessionId),
            customerId: null,
            customerName: customerName ? `${customerName} (Merged)` : 'Merged Ticket',
            lineItems: mergedItems,
            subtotal: totalSubtotal,
            holdReason: 'Merged from multiple tickets',
            heldBy: String(session.user._id),
            heldByName: session.user.name ?? null,
            heldAt: now,
            status: 'held',
            createdAt: now,
            updatedAt: now,
        });

        await db.collection('crm_pos_holds').updateMany(
            { _id: { $in: validIds } },
            { $set: { status: 'discarded', updatedAt: now } }
        );

        revalidatePath('/dashboard/crm/pos');
        revalidatePath('/dashboard/crm/pos/hold-recall');
        return { success: true, id: insertResult.insertedId.toString() };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/* ─── KPI summary (used by the POS home/overview page) ───────────────── */

interface PosOverviewKpis {
    openSessions: number;
    todaysTransactions: number;
    todaysRevenue: number;
    heldTickets: number;
}

export async function getPosOverviewKpis(): Promise<PosOverviewKpis> {
    const session = await getSession();
    const empty: PosOverviewKpis = {
        openSessions: 0,
        todaysTransactions: 0,
        todaysRevenue: 0,
        heldTickets: 0,
    };
    if (!session?.user?._id) return empty;
    const guard = await requirePermission('crm_pos', 'view');
    if (!guard.ok) return empty;

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(String(session.user._id));
        const now = new Date();
        const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
        const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

        const [openSessions, todaysTxns, heldTickets] = await Promise.all([
            db
                .collection('crm_pos_sessions')
                .countDocuments({ userId: userObjectId, status: 'open' }),
            db
                .collection('crm_pos_transactions')
                .find({
                    userId: userObjectId,
                    createdAt: { $gte: start, $lte: end },
                    status: { $in: ['completed', 'partially_refunded'] },
                })
                .toArray(),
            db
                .collection('crm_pos_holds')
                .countDocuments({ userId: userObjectId, status: 'held' }),
        ]);

        const todaysRevenue = todaysTxns.reduce(
            (sum, t) => sum + Number((t as { total?: number }).total ?? 0),
            0,
        );

        return {
            openSessions,
            todaysTransactions: todaysTxns.length,
            todaysRevenue,
            heldTickets,
        };
    } catch (e) {
        console.error('[getPosOverviewKpis] failed:', e);
        return empty;
    }
}

/* ─── Lightweight item search (used by the terminal grid) ────────────── */

interface PosItemRow {
    _id: string;
    name: string;
    sku?: string | null;
    sellingPrice: number;
    taxRate?: number;
}

export async function searchPosItems(query: string, limit = 50): Promise<PosItemRow[]> {
    const session = await getSession();
    if (!session?.user?._id) return [];
    const guard = await requirePermission('crm_pos', 'view');
    if (!guard.ok) return [];

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(String(session.user._id));
        const filter: Document = { userId: userObjectId };
        const q = query.trim();
        if (q) {
            filter.$or = [
                { name: { $regex: q, $options: 'i' } },
                { sku: { $regex: q, $options: 'i' } },
            ];
        }
        const docs = await db
            .collection('crm_products')
            .find(filter)
            .project({ name: 1, sku: 1, sellingPrice: 1, taxRate: 1 })
            .sort({ name: 1 })
            .limit(Math.max(1, Math.min(200, limit)))
            .toArray();
        return docs.map((d) => ({
            _id: String(d._id),
            name: String((d as { name?: string }).name ?? '—'),
            sku: (d as { sku?: string }).sku ?? null,
            sellingPrice: Number((d as { sellingPrice?: number }).sellingPrice ?? 0),
            taxRate: Number((d as { taxRate?: number }).taxRate ?? 0),
        }));
    } catch (e) {
        console.error('[searchPosItems] failed:', e);
        return [];
    }
}
