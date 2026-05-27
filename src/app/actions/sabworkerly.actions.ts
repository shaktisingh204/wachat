'use server';

/**
 * SabWorkerly — temp/agency staffing module server actions.
 *
 * Direct-Mongo implementation (tenant-scoped by `userId`) that powers the
 * Zoho-Workerly-equivalent client → worker → timesheet → invoice loop.
 *
 * ## Rust BFF cut-over (TODO)
 * The matching Rust crates are scaffolded under
 * `rust/crates/sabworkerly-{workers,clients,jobs,placements,timesheets,invoices,payroll-runs}`
 * and TS clients live at `src/lib/rust-client/sabworkerly-*.ts`. Once the
 * integrator wires those crates into `rust/Cargo.toml` workspace +
 * `rust/crates/api/Cargo.toml` deps + `rust/crates/api/src/router.rs`
 * mounts, swap each block below to delegate to the rust-client (mirror
 * `crm-contacts.ts` ↔ `crm-base.ts` pattern).
 *
 * All functions:
 *  1. Call getSession() and scope every query by `userId` (tenant isolation).
 *  2. Use ObjectId on the wire-out, hex strings on the wire-in.
 *  3. Return plain-JSON-safe values (no ObjectId / Date references) via
 *     JSON.parse(JSON.stringify(…)).
 */

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { getErrorMessage } from '@/lib/utils';

// ─── Shared helpers ───────────────────────────────────────────────────────────

type ActionResult<T = void> =
    | ({ success: true } & T)
    | { success: false; error: string };

const COLL = {
    workers: 'sabworkerly_workers',
    clients: 'sabworkerly_clients',
    jobs: 'sabworkerly_jobs',
    placements: 'sabworkerly_placements',
    timesheets: 'sabworkerly_timesheets',
    invoices: 'sabworkerly_invoices',
    payrollRuns: 'sabworkerly_payroll_runs',
} as const;

async function resolveTenant(): Promise<{ userId: ObjectId } | { error: string }> {
    const session = await getSession();
    if (!session?.user?._id) return { error: 'Not authenticated' };
    return { userId: new ObjectId(String(session.user._id)) };
}

function toJSON<T>(v: T): T {
    return JSON.parse(JSON.stringify(v)) as T;
}

function oidOr(value: string | undefined | null): ObjectId | null {
    if (!value) return null;
    try { return new ObjectId(value); } catch { return null; }
}

// ═══════════════════════════════════════════════════════════════════════════
// WORKERS
// ═══════════════════════════════════════════════════════════════════════════

export interface SabworkerlyWorker {
    _id: string;
    userId: string;
    name: string;
    email: string;
    phone?: string;
    skills: string[];
    availabilityJson?: unknown;
    status: 'active' | 'inactive' | 'on_assignment';
    hourlyRateMinor: number;
    currency: string;
    addressJson?: unknown;
    documentIds: string[];
    createdAt: string;
    updatedAt?: string;
}

export interface CreateWorkerInput {
    name: string;
    email: string;
    phone?: string;
    skills?: string[];
    availabilityJson?: unknown;
    status?: SabworkerlyWorker['status'];
    hourlyRateMinor?: number;
    currency?: string;
    addressJson?: unknown;
    documentIds?: string[];
}

export async function getSabworkerlyWorkers(opts?: {
    status?: 'active' | 'inactive' | 'on_assignment' | 'all';
    q?: string;
    limit?: number;
}): Promise<SabworkerlyWorker[]> {
    const tenant = await resolveTenant();
    if ('error' in tenant) return [];
    const { db } = await connectToDatabase();
    const filter: Record<string, unknown> = { userId: tenant.userId };
    const status = opts?.status ?? 'active';
    if (status !== 'all') filter.status = status;
    if (opts?.q?.trim()) {
        const rx = new RegExp(opts.q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
    }
    const rows = await db
        .collection(COLL.workers)
        .find(filter)
        .sort({ createdAt: -1 })
        .limit(opts?.limit ?? 100)
        .toArray();
    return toJSON(rows) as unknown as SabworkerlyWorker[];
}

export async function getSabworkerlyWorkerById(id: string): Promise<SabworkerlyWorker | null> {
    const tenant = await resolveTenant();
    if ('error' in tenant) return null;
    const oid = oidOr(id);
    if (!oid) return null;
    const { db } = await connectToDatabase();
    const row = await db.collection(COLL.workers).findOne({ _id: oid, userId: tenant.userId });
    return row ? (toJSON(row) as unknown as SabworkerlyWorker) : null;
}

export async function addSabworkerlyWorker(input: CreateWorkerInput): Promise<ActionResult<{ id: string }>> {
    const tenant = await resolveTenant();
    if ('error' in tenant) return { success: false, error: tenant.error };
    if (!input.name?.trim()) return { success: false, error: 'Name is required' };
    if (!input.email?.trim()) return { success: false, error: 'Email is required' };
    try {
        const { db } = await connectToDatabase();
        const now = new Date();
        const doc = {
            userId: tenant.userId,
            name: input.name.trim(),
            email: input.email.trim(),
            phone: input.phone,
            skills: input.skills ?? [],
            availabilityJson: input.availabilityJson ?? null,
            status: input.status ?? 'active',
            hourlyRateMinor: input.hourlyRateMinor ?? 0,
            currency: input.currency ?? 'USD',
            addressJson: input.addressJson ?? null,
            documentIds: input.documentIds ?? [],
            createdAt: now,
            updatedAt: now,
        };
        const res = await db.collection(COLL.workers).insertOne(doc);
        revalidatePath('/dashboard/sabworkerly/workers');
        return { success: true, id: String(res.insertedId) };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function updateSabworkerlyWorker(
    id: string, patch: Partial<CreateWorkerInput>,
): Promise<ActionResult> {
    const tenant = await resolveTenant();
    if ('error' in tenant) return { success: false, error: tenant.error };
    const oid = oidOr(id);
    if (!oid) return { success: false, error: 'Invalid worker id' };
    try {
        const { db } = await connectToDatabase();
        const set: Record<string, unknown> = { updatedAt: new Date() };
        for (const k of Object.keys(patch) as (keyof CreateWorkerInput)[]) {
            const v = patch[k];
            if (v !== undefined) set[k] = v;
        }
        const r = await db.collection(COLL.workers).updateOne(
            { _id: oid, userId: tenant.userId },
            { $set: set },
        );
        if (r.matchedCount === 0) return { success: false, error: 'Worker not found' };
        revalidatePath('/dashboard/sabworkerly/workers');
        revalidatePath(`/dashboard/sabworkerly/workers/${id}`);
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function deleteSabworkerlyWorker(id: string): Promise<ActionResult> {
    return updateSabworkerlyWorker(id, { status: 'inactive' });
}

// ═══════════════════════════════════════════════════════════════════════════
// CLIENTS
// ═══════════════════════════════════════════════════════════════════════════

export interface SabworkerlyClient {
    _id: string;
    userId: string;
    name: string;
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    billingAddressJson?: unknown;
    paymentTermsDays: number;
    status: 'active' | 'inactive';
    createdAt: string;
    updatedAt?: string;
}

export interface CreateClientInput {
    name: string;
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    billingAddressJson?: unknown;
    paymentTermsDays?: number;
    status?: SabworkerlyClient['status'];
}

export async function getSabworkerlyClients(opts?: {
    status?: 'active' | 'inactive' | 'all';
    q?: string;
    limit?: number;
}): Promise<SabworkerlyClient[]> {
    const tenant = await resolveTenant();
    if ('error' in tenant) return [];
    const { db } = await connectToDatabase();
    const filter: Record<string, unknown> = { userId: tenant.userId };
    const status = opts?.status ?? 'active';
    if (status !== 'all') filter.status = status;
    if (opts?.q?.trim()) {
        const rx = new RegExp(opts.q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        filter.$or = [{ name: rx }, { contactName: rx }, { contactEmail: rx }];
    }
    const rows = await db
        .collection(COLL.clients)
        .find(filter)
        .sort({ createdAt: -1 })
        .limit(opts?.limit ?? 100)
        .toArray();
    return toJSON(rows) as unknown as SabworkerlyClient[];
}

export async function getSabworkerlyClientById(id: string): Promise<SabworkerlyClient | null> {
    const tenant = await resolveTenant();
    if ('error' in tenant) return null;
    const oid = oidOr(id);
    if (!oid) return null;
    const { db } = await connectToDatabase();
    const row = await db.collection(COLL.clients).findOne({ _id: oid, userId: tenant.userId });
    return row ? (toJSON(row) as unknown as SabworkerlyClient) : null;
}

export async function addSabworkerlyClient(input: CreateClientInput): Promise<ActionResult<{ id: string }>> {
    const tenant = await resolveTenant();
    if ('error' in tenant) return { success: false, error: tenant.error };
    if (!input.name?.trim()) return { success: false, error: 'Name is required' };
    try {
        const { db } = await connectToDatabase();
        const now = new Date();
        const doc = {
            userId: tenant.userId,
            name: input.name.trim(),
            contactName: input.contactName,
            contactEmail: input.contactEmail,
            contactPhone: input.contactPhone,
            billingAddressJson: input.billingAddressJson ?? null,
            paymentTermsDays: input.paymentTermsDays ?? 30,
            status: input.status ?? 'active',
            createdAt: now,
            updatedAt: now,
        };
        const res = await db.collection(COLL.clients).insertOne(doc);
        revalidatePath('/dashboard/sabworkerly/clients');
        return { success: true, id: String(res.insertedId) };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function updateSabworkerlyClient(
    id: string, patch: Partial<CreateClientInput>,
): Promise<ActionResult> {
    const tenant = await resolveTenant();
    if ('error' in tenant) return { success: false, error: tenant.error };
    const oid = oidOr(id);
    if (!oid) return { success: false, error: 'Invalid client id' };
    try {
        const { db } = await connectToDatabase();
        const set: Record<string, unknown> = { updatedAt: new Date() };
        for (const k of Object.keys(patch) as (keyof CreateClientInput)[]) {
            const v = patch[k];
            if (v !== undefined) set[k] = v;
        }
        const r = await db.collection(COLL.clients).updateOne(
            { _id: oid, userId: tenant.userId },
            { $set: set },
        );
        if (r.matchedCount === 0) return { success: false, error: 'Client not found' };
        revalidatePath('/dashboard/sabworkerly/clients');
        revalidatePath(`/dashboard/sabworkerly/clients/${id}`);
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function deleteSabworkerlyClient(id: string): Promise<ActionResult> {
    return updateSabworkerlyClient(id, { status: 'inactive' });
}

// ═══════════════════════════════════════════════════════════════════════════
// JOBS
// ═══════════════════════════════════════════════════════════════════════════

export interface SabworkerlyJob {
    _id: string;
    userId: string;
    clientId: string;
    title: string;
    description?: string;
    skillsRequired: string[];
    shiftPattern?: string;
    hourlyChargeRateMinor: number;
    hourlyPayRateMinor: number;
    currency: string;
    startDate: string;
    endDate?: string;
    status: 'open' | 'filled' | 'closed';
    createdAt: string;
    updatedAt?: string;
}

export interface CreateJobInput {
    clientId: string;
    title: string;
    description?: string;
    skillsRequired?: string[];
    shiftPattern?: string;
    hourlyChargeRateMinor: number;
    hourlyPayRateMinor: number;
    currency?: string;
    startDate: string;
    endDate?: string;
    status?: SabworkerlyJob['status'];
}

export async function getSabworkerlyJobs(opts?: {
    status?: 'open' | 'filled' | 'closed' | 'all';
    clientId?: string;
    q?: string;
    limit?: number;
}): Promise<SabworkerlyJob[]> {
    const tenant = await resolveTenant();
    if ('error' in tenant) return [];
    const { db } = await connectToDatabase();
    const filter: Record<string, unknown> = { userId: tenant.userId };
    const status = opts?.status ?? 'open';
    if (status !== 'all') filter.status = status;
    if (opts?.clientId) {
        const cid = oidOr(opts.clientId);
        if (cid) filter.clientId = cid;
    }
    if (opts?.q?.trim()) {
        const rx = new RegExp(opts.q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        filter.$or = [{ title: rx }, { description: rx }, { shiftPattern: rx }];
    }
    const rows = await db
        .collection(COLL.jobs)
        .find(filter)
        .sort({ createdAt: -1 })
        .limit(opts?.limit ?? 100)
        .toArray();
    return toJSON(rows) as unknown as SabworkerlyJob[];
}

export async function getSabworkerlyJobById(id: string): Promise<SabworkerlyJob | null> {
    const tenant = await resolveTenant();
    if ('error' in tenant) return null;
    const oid = oidOr(id);
    if (!oid) return null;
    const { db } = await connectToDatabase();
    const row = await db.collection(COLL.jobs).findOne({ _id: oid, userId: tenant.userId });
    return row ? (toJSON(row) as unknown as SabworkerlyJob) : null;
}

export async function addSabworkerlyJob(input: CreateJobInput): Promise<ActionResult<{ id: string }>> {
    const tenant = await resolveTenant();
    if ('error' in tenant) return { success: false, error: tenant.error };
    if (!input.title?.trim()) return { success: false, error: 'Title is required' };
    const clientOid = oidOr(input.clientId);
    if (!clientOid) return { success: false, error: 'Valid clientId is required' };
    try {
        const { db } = await connectToDatabase();
        const now = new Date();
        const doc = {
            userId: tenant.userId,
            clientId: clientOid,
            title: input.title.trim(),
            description: input.description,
            skillsRequired: input.skillsRequired ?? [],
            shiftPattern: input.shiftPattern,
            hourlyChargeRateMinor: input.hourlyChargeRateMinor,
            hourlyPayRateMinor: input.hourlyPayRateMinor,
            currency: input.currency ?? 'USD',
            startDate: new Date(input.startDate),
            endDate: input.endDate ? new Date(input.endDate) : undefined,
            status: input.status ?? 'open',
            createdAt: now,
            updatedAt: now,
        };
        const res = await db.collection(COLL.jobs).insertOne(doc);
        revalidatePath('/dashboard/sabworkerly/jobs');
        return { success: true, id: String(res.insertedId) };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function updateSabworkerlyJob(
    id: string, patch: Partial<CreateJobInput>,
): Promise<ActionResult> {
    const tenant = await resolveTenant();
    if ('error' in tenant) return { success: false, error: tenant.error };
    const oid = oidOr(id);
    if (!oid) return { success: false, error: 'Invalid job id' };
    try {
        const { db } = await connectToDatabase();
        const set: Record<string, unknown> = { updatedAt: new Date() };
        for (const k of Object.keys(patch) as (keyof CreateJobInput)[]) {
            const v = patch[k];
            if (v === undefined) continue;
            if (k === 'clientId' && typeof v === 'string') {
                const cid = oidOr(v);
                if (cid) set.clientId = cid;
            } else if ((k === 'startDate' || k === 'endDate') && typeof v === 'string') {
                set[k] = new Date(v);
            } else {
                set[k] = v;
            }
        }
        const r = await db.collection(COLL.jobs).updateOne(
            { _id: oid, userId: tenant.userId },
            { $set: set },
        );
        if (r.matchedCount === 0) return { success: false, error: 'Job not found' };
        revalidatePath('/dashboard/sabworkerly/jobs');
        revalidatePath(`/dashboard/sabworkerly/jobs/${id}`);
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function deleteSabworkerlyJob(id: string): Promise<ActionResult> {
    return updateSabworkerlyJob(id, { status: 'closed' });
}

// ═══════════════════════════════════════════════════════════════════════════
// PLACEMENTS
// ═══════════════════════════════════════════════════════════════════════════

export interface SabworkerlyPlacement {
    _id: string;
    userId: string;
    jobId: string;
    workerId: string;
    startDate: string;
    endDate?: string;
    hourlyChargeRateMinor: number;
    hourlyPayRateMinor: number;
    status: 'active' | 'completed' | 'cancelled';
    createdAt: string;
    updatedAt?: string;
}

export interface CreatePlacementInput {
    jobId: string;
    workerId: string;
    startDate: string;
    endDate?: string;
    hourlyChargeRateMinor: number;
    hourlyPayRateMinor: number;
    status?: SabworkerlyPlacement['status'];
}

export async function getSabworkerlyPlacements(opts?: {
    status?: 'active' | 'completed' | 'cancelled' | 'all';
    jobId?: string;
    workerId?: string;
    limit?: number;
}): Promise<SabworkerlyPlacement[]> {
    const tenant = await resolveTenant();
    if ('error' in tenant) return [];
    const { db } = await connectToDatabase();
    const filter: Record<string, unknown> = { userId: tenant.userId };
    const status = opts?.status ?? 'active';
    if (status !== 'all') filter.status = status;
    if (opts?.jobId) {
        const j = oidOr(opts.jobId);
        if (j) filter.jobId = j;
    }
    if (opts?.workerId) {
        const w = oidOr(opts.workerId);
        if (w) filter.workerId = w;
    }
    const rows = await db
        .collection(COLL.placements)
        .find(filter)
        .sort({ startDate: -1 })
        .limit(opts?.limit ?? 100)
        .toArray();
    return toJSON(rows) as unknown as SabworkerlyPlacement[];
}

export async function getSabworkerlyPlacementById(id: string): Promise<SabworkerlyPlacement | null> {
    const tenant = await resolveTenant();
    if ('error' in tenant) return null;
    const oid = oidOr(id);
    if (!oid) return null;
    const { db } = await connectToDatabase();
    const row = await db.collection(COLL.placements).findOne({ _id: oid, userId: tenant.userId });
    return row ? (toJSON(row) as unknown as SabworkerlyPlacement) : null;
}

export async function addSabworkerlyPlacement(input: CreatePlacementInput): Promise<ActionResult<{ id: string }>> {
    const tenant = await resolveTenant();
    if ('error' in tenant) return { success: false, error: tenant.error };
    const jobOid = oidOr(input.jobId);
    const workerOid = oidOr(input.workerId);
    if (!jobOid) return { success: false, error: 'Valid jobId is required' };
    if (!workerOid) return { success: false, error: 'Valid workerId is required' };
    try {
        const { db } = await connectToDatabase();
        const now = new Date();
        const doc = {
            userId: tenant.userId,
            jobId: jobOid,
            workerId: workerOid,
            startDate: new Date(input.startDate),
            endDate: input.endDate ? new Date(input.endDate) : undefined,
            hourlyChargeRateMinor: input.hourlyChargeRateMinor,
            hourlyPayRateMinor: input.hourlyPayRateMinor,
            status: input.status ?? 'active',
            createdAt: now,
            updatedAt: now,
        };
        const res = await db.collection(COLL.placements).insertOne(doc);

        // Auto-flip parent job to 'filled' and worker to 'on_assignment'.
        if (doc.status === 'active') {
            await db.collection(COLL.jobs).updateOne(
                { _id: jobOid, userId: tenant.userId },
                { $set: { status: 'filled', updatedAt: now } },
            );
            await db.collection(COLL.workers).updateOne(
                { _id: workerOid, userId: tenant.userId },
                { $set: { status: 'on_assignment', updatedAt: now } },
            );
        }
        revalidatePath('/dashboard/sabworkerly/placements');
        revalidatePath('/dashboard/sabworkerly/jobs');
        return { success: true, id: String(res.insertedId) };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function updateSabworkerlyPlacement(
    id: string, patch: Partial<CreatePlacementInput>,
): Promise<ActionResult> {
    const tenant = await resolveTenant();
    if ('error' in tenant) return { success: false, error: tenant.error };
    const oid = oidOr(id);
    if (!oid) return { success: false, error: 'Invalid placement id' };
    try {
        const { db } = await connectToDatabase();
        const set: Record<string, unknown> = { updatedAt: new Date() };
        for (const k of Object.keys(patch) as (keyof CreatePlacementInput)[]) {
            const v = patch[k];
            if (v === undefined) continue;
            if ((k === 'startDate' || k === 'endDate') && typeof v === 'string') {
                set[k] = new Date(v);
            } else {
                set[k] = v;
            }
        }
        const r = await db.collection(COLL.placements).updateOne(
            { _id: oid, userId: tenant.userId },
            { $set: set },
        );
        if (r.matchedCount === 0) return { success: false, error: 'Placement not found' };
        revalidatePath('/dashboard/sabworkerly/placements');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function deleteSabworkerlyPlacement(id: string): Promise<ActionResult> {
    return updateSabworkerlyPlacement(id, { status: 'cancelled' });
}

// ═══════════════════════════════════════════════════════════════════════════
// TIMESHEETS
// ═══════════════════════════════════════════════════════════════════════════

export type SabworkerlyTimesheetStatus =
    | 'draft' | 'submitted' | 'approved' | 'invoiced' | 'rejected';

export interface SabworkerlyDailyHours {
    mon?: number; tue?: number; wed?: number; thu?: number;
    fri?: number; sat?: number; sun?: number;
}

export interface SabworkerlyTimesheet {
    _id: string;
    userId: string;
    placementId: string;
    workerId: string;
    weekStart: string;
    dailyHoursJson: SabworkerlyDailyHours;
    totalHours: number;
    status: SabworkerlyTimesheetStatus;
    submittedAt?: string;
    approvedBy?: string;
    approvedAt?: string;
    rejectionReason?: string;
    createdAt: string;
    updatedAt?: string;
}

export interface CreateTimesheetInput {
    placementId: string;
    workerId: string;
    weekStart: string;
    dailyHoursJson: SabworkerlyDailyHours;
    totalHours?: number;
    status?: SabworkerlyTimesheetStatus;
}

function sumDailyHours(d: SabworkerlyDailyHours): number {
    return (['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const)
        .reduce((acc, k) => acc + (Number(d[k]) || 0), 0);
}

export async function getSabworkerlyTimesheets(opts?: {
    status?: SabworkerlyTimesheetStatus | 'all';
    placementId?: string;
    workerId?: string;
    limit?: number;
}): Promise<SabworkerlyTimesheet[]> {
    const tenant = await resolveTenant();
    if ('error' in tenant) return [];
    const { db } = await connectToDatabase();
    const filter: Record<string, unknown> = { userId: tenant.userId };
    const status = opts?.status ?? 'all';
    if (status !== 'all') filter.status = status;
    if (opts?.placementId) {
        const p = oidOr(opts.placementId);
        if (p) filter.placementId = p;
    }
    if (opts?.workerId) {
        const w = oidOr(opts.workerId);
        if (w) filter.workerId = w;
    }
    const rows = await db
        .collection(COLL.timesheets)
        .find(filter)
        .sort({ weekStart: -1 })
        .limit(opts?.limit ?? 200)
        .toArray();
    return toJSON(rows) as unknown as SabworkerlyTimesheet[];
}

export async function addSabworkerlyTimesheet(input: CreateTimesheetInput): Promise<ActionResult<{ id: string }>> {
    const tenant = await resolveTenant();
    if ('error' in tenant) return { success: false, error: tenant.error };
    const placementOid = oidOr(input.placementId);
    const workerOid = oidOr(input.workerId);
    if (!placementOid) return { success: false, error: 'Valid placementId is required' };
    if (!workerOid) return { success: false, error: 'Valid workerId is required' };
    try {
        const { db } = await connectToDatabase();
        const now = new Date();
        const doc = {
            userId: tenant.userId,
            placementId: placementOid,
            workerId: workerOid,
            weekStart: new Date(input.weekStart),
            dailyHoursJson: input.dailyHoursJson,
            totalHours: input.totalHours ?? sumDailyHours(input.dailyHoursJson),
            status: input.status ?? 'draft',
            createdAt: now,
            updatedAt: now,
        };
        const res = await db.collection(COLL.timesheets).insertOne(doc);
        revalidatePath('/dashboard/sabworkerly/timesheets');
        return { success: true, id: String(res.insertedId) };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function updateSabworkerlyTimesheet(
    id: string, patch: Partial<CreateTimesheetInput>,
): Promise<ActionResult> {
    const tenant = await resolveTenant();
    if ('error' in tenant) return { success: false, error: tenant.error };
    const oid = oidOr(id);
    if (!oid) return { success: false, error: 'Invalid timesheet id' };
    try {
        const { db } = await connectToDatabase();
        const set: Record<string, unknown> = { updatedAt: new Date() };
        if (patch.dailyHoursJson) {
            set.dailyHoursJson = patch.dailyHoursJson;
            set.totalHours = patch.totalHours ?? sumDailyHours(patch.dailyHoursJson);
        } else if (patch.totalHours !== undefined) {
            set.totalHours = patch.totalHours;
        }
        if (patch.status) set.status = patch.status;
        const r = await db.collection(COLL.timesheets).updateOne(
            { _id: oid, userId: tenant.userId },
            { $set: set },
        );
        if (r.matchedCount === 0) return { success: false, error: 'Timesheet not found' };
        revalidatePath('/dashboard/sabworkerly/timesheets');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function submitSabworkerlyTimesheet(id: string): Promise<ActionResult> {
    const tenant = await resolveTenant();
    if ('error' in tenant) return { success: false, error: tenant.error };
    const oid = oidOr(id);
    if (!oid) return { success: false, error: 'Invalid timesheet id' };
    try {
        const { db } = await connectToDatabase();
        const now = new Date();
        const r = await db.collection(COLL.timesheets).updateOne(
            { _id: oid, userId: tenant.userId, status: { $in: ['draft', 'rejected'] } },
            { $set: { status: 'submitted', submittedAt: now, updatedAt: now } },
        );
        if (r.matchedCount === 0) {
            return { success: false, error: 'Timesheet not in draft/rejected state' };
        }
        revalidatePath('/dashboard/sabworkerly/timesheets');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function approveSabworkerlyTimesheet(id: string): Promise<ActionResult> {
    const tenant = await resolveTenant();
    if ('error' in tenant) return { success: false, error: tenant.error };
    const session = await getSession();
    const approver = session?.user?.email || session?.user?.name || 'unknown';
    const oid = oidOr(id);
    if (!oid) return { success: false, error: 'Invalid timesheet id' };
    try {
        const { db } = await connectToDatabase();
        const now = new Date();
        const r = await db.collection(COLL.timesheets).updateOne(
            { _id: oid, userId: tenant.userId, status: 'submitted' },
            { $set: { status: 'approved', approvedBy: approver, approvedAt: now, updatedAt: now } },
        );
        if (r.matchedCount === 0) {
            return { success: false, error: 'Timesheet not in submitted state' };
        }
        revalidatePath('/dashboard/sabworkerly/timesheets');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function rejectSabworkerlyTimesheet(id: string, reason?: string): Promise<ActionResult> {
    const tenant = await resolveTenant();
    if ('error' in tenant) return { success: false, error: tenant.error };
    const oid = oidOr(id);
    if (!oid) return { success: false, error: 'Invalid timesheet id' };
    try {
        const { db } = await connectToDatabase();
        const now = new Date();
        const r = await db.collection(COLL.timesheets).updateOne(
            { _id: oid, userId: tenant.userId, status: 'submitted' },
            {
                $set: {
                    status: 'rejected',
                    rejectionReason: reason ?? '',
                    updatedAt: now,
                },
                $unset: { approvedAt: '', approvedBy: '' },
            },
        );
        if (r.matchedCount === 0) {
            return { success: false, error: 'Timesheet not in submitted state' };
        }
        revalidatePath('/dashboard/sabworkerly/timesheets');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// INVOICES
// ═══════════════════════════════════════════════════════════════════════════

export interface SabworkerlyInvoiceLine {
    placementId: string;
    workerName: string;
    hours: number;
    rate: number;          // hourly charge rate, minor units
    amountMinor: number;   // hours * rate
}

export interface SabworkerlyInvoice {
    _id: string;
    userId: string;
    clientId: string;
    periodStart: string;
    periodEnd: string;
    timesheetIds: string[];
    lineItems: SabworkerlyInvoiceLine[];
    totalMinor: number;
    currency: string;
    status: 'draft' | 'sent' | 'paid' | 'overdue';
    sentAt?: string;
    paidAt?: string;
    createdAt: string;
    updatedAt?: string;
}

export async function getSabworkerlyInvoices(opts?: {
    status?: 'draft' | 'sent' | 'paid' | 'overdue' | 'all';
    clientId?: string;
    limit?: number;
}): Promise<SabworkerlyInvoice[]> {
    const tenant = await resolveTenant();
    if ('error' in tenant) return [];
    const { db } = await connectToDatabase();
    const filter: Record<string, unknown> = { userId: tenant.userId };
    const status = opts?.status ?? 'all';
    if (status !== 'all') filter.status = status;
    if (opts?.clientId) {
        const c = oidOr(opts.clientId);
        if (c) filter.clientId = c;
    }
    const rows = await db
        .collection(COLL.invoices)
        .find(filter)
        .sort({ createdAt: -1 })
        .limit(opts?.limit ?? 100)
        .toArray();
    return toJSON(rows) as unknown as SabworkerlyInvoice[];
}

export async function updateSabworkerlyInvoiceStatus(
    id: string,
    status: 'draft' | 'sent' | 'paid' | 'overdue',
): Promise<ActionResult> {
    const tenant = await resolveTenant();
    if ('error' in tenant) return { success: false, error: tenant.error };
    const oid = oidOr(id);
    if (!oid) return { success: false, error: 'Invalid invoice id' };
    try {
        const { db } = await connectToDatabase();
        const now = new Date();
        const set: Record<string, unknown> = { status, updatedAt: now };
        if (status === 'sent') set.sentAt = now;
        if (status === 'paid') set.paidAt = now;
        const r = await db.collection(COLL.invoices).updateOne(
            { _id: oid, userId: tenant.userId },
            { $set: set },
        );
        if (r.matchedCount === 0) return { success: false, error: 'Invoice not found' };
        revalidatePath('/dashboard/sabworkerly/invoices');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/**
 * Aggregate every APPROVED timesheet for the given client/period into a
 * single client-facing invoice. Marks each consumed timesheet as `invoiced`
 * so it can't be double-billed.
 */
export async function generateSabworkerlyInvoice(
    clientId: string,
    periodStart: string,
    periodEnd: string,
): Promise<ActionResult<{ id: string; totalMinor: number; lineCount: number }>> {
    const tenant = await resolveTenant();
    if ('error' in tenant) return { success: false, error: tenant.error };
    const clientOid = oidOr(clientId);
    if (!clientOid) return { success: false, error: 'Valid clientId is required' };
    try {
        const { db } = await connectToDatabase();
        const start = new Date(periodStart);
        const end = new Date(periodEnd);

        // Find all open placements for jobs belonging to this client.
        const clientJobs = await db.collection(COLL.jobs)
            .find({ userId: tenant.userId, clientId: clientOid }, { projection: { _id: 1 } })
            .toArray();
        if (clientJobs.length === 0) {
            return { success: false, error: 'No jobs exist for this client' };
        }
        const jobIds = clientJobs.map(j => j._id);
        const placements = await db.collection(COLL.placements)
            .find({ userId: tenant.userId, jobId: { $in: jobIds } })
            .toArray();
        if (placements.length === 0) {
            return { success: false, error: 'No placements exist for this client' };
        }
        const placementMap = new Map(placements.map(p => [String(p._id), p]));

        // Approved timesheets within range for those placements.
        const timesheets = await db.collection(COLL.timesheets)
            .find({
                userId: tenant.userId,
                placementId: { $in: placements.map(p => p._id) },
                status: 'approved',
                weekStart: { $gte: start, $lte: end },
            })
            .toArray();

        if (timesheets.length === 0) {
            return { success: false, error: 'No approved timesheets in period' };
        }

        // Hydrate worker names.
        const workerIds = Array.from(new Set(timesheets.map(t => String(t.workerId))))
            .map(id => new ObjectId(id));
        const workers = await db.collection(COLL.workers)
            .find({ _id: { $in: workerIds } }, { projection: { name: 1 } })
            .toArray();
        const workerNameMap = new Map(workers.map(w => [String(w._id), w.name as string]));

        // Build line items.
        const lineItems: SabworkerlyInvoiceLine[] = timesheets.map(ts => {
            const p = placementMap.get(String(ts.placementId));
            const rate = Number(p?.hourlyChargeRateMinor ?? 0);
            const hours = Number(ts.totalHours ?? 0);
            return {
                placementId: String(ts.placementId),
                workerName: workerNameMap.get(String(ts.workerId)) ?? 'Unknown',
                hours,
                rate,
                amountMinor: Math.round(hours * rate),
            };
        });
        const totalMinor = lineItems.reduce((acc, l) => acc + l.amountMinor, 0);

        const now = new Date();
        const doc = {
            userId: tenant.userId,
            clientId: clientOid,
            periodStart: start,
            periodEnd: end,
            timesheetIds: timesheets.map(t => t._id),
            lineItems,
            totalMinor,
            currency: 'USD',
            status: 'draft',
            createdAt: now,
            updatedAt: now,
        };
        const res = await db.collection(COLL.invoices).insertOne(doc);

        // Mark timesheets as invoiced.
        await db.collection(COLL.timesheets).updateMany(
            { _id: { $in: timesheets.map(t => t._id) } },
            { $set: { status: 'invoiced', updatedAt: now } },
        );

        revalidatePath('/dashboard/sabworkerly/invoices');
        revalidatePath('/dashboard/sabworkerly/timesheets');
        return {
            success: true,
            id: String(res.insertedId),
            totalMinor,
            lineCount: lineItems.length,
        };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// PAYROLL RUNS
// ═══════════════════════════════════════════════════════════════════════════

export interface SabworkerlyPayrollLine {
    workerId: string;
    hours: number;
    rate: number;          // hourly pay rate, minor units
    amountMinor: number;
}

export interface SabworkerlyPayrollRun {
    _id: string;
    userId: string;
    periodStart: string;
    periodEnd: string;
    timesheetIds: string[];
    lineItems: SabworkerlyPayrollLine[];
    totalMinor: number;
    currency: string;
    status: 'draft' | 'approved' | 'paid';
    processedAt?: string;
    createdAt: string;
    updatedAt?: string;
}

export async function getSabworkerlyPayrollRuns(opts?: {
    status?: 'draft' | 'approved' | 'paid' | 'all';
    limit?: number;
}): Promise<SabworkerlyPayrollRun[]> {
    const tenant = await resolveTenant();
    if ('error' in tenant) return [];
    const { db } = await connectToDatabase();
    const filter: Record<string, unknown> = { userId: tenant.userId };
    const status = opts?.status ?? 'all';
    if (status !== 'all') filter.status = status;
    const rows = await db
        .collection(COLL.payrollRuns)
        .find(filter)
        .sort({ createdAt: -1 })
        .limit(opts?.limit ?? 100)
        .toArray();
    return toJSON(rows) as unknown as SabworkerlyPayrollRun[];
}

export async function updateSabworkerlyPayrollRunStatus(
    id: string,
    status: 'draft' | 'approved' | 'paid',
): Promise<ActionResult> {
    const tenant = await resolveTenant();
    if ('error' in tenant) return { success: false, error: tenant.error };
    const oid = oidOr(id);
    if (!oid) return { success: false, error: 'Invalid payroll-run id' };
    try {
        const { db } = await connectToDatabase();
        const now = new Date();
        const set: Record<string, unknown> = { status, updatedAt: now };
        if (status === 'paid') set.processedAt = now;
        const r = await db.collection(COLL.payrollRuns).updateOne(
            { _id: oid, userId: tenant.userId },
            { $set: set },
        );
        if (r.matchedCount === 0) return { success: false, error: 'Payroll run not found' };
        revalidatePath('/dashboard/sabworkerly/payroll');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/**
 * Aggregate every APPROVED (and not-yet-invoiced) timesheet across all
 * placements in the period into a payroll run. Uses each placement's
 * `hourlyPayRateMinor` (what we pay the worker).
 *
 * Note: this can coexist with `generateSabworkerlyInvoice` — the invoice
 * uses the *charge* rate (client-facing) while payroll uses the *pay*
 * rate (worker-facing). Margin = chargeRate − payRate per hour.
 */
export async function runSabworkerlyPayroll(
    periodStart: string,
    periodEnd: string,
): Promise<ActionResult<{ id: string; totalMinor: number; lineCount: number }>> {
    const tenant = await resolveTenant();
    if ('error' in tenant) return { success: false, error: tenant.error };
    try {
        const { db } = await connectToDatabase();
        const start = new Date(periodStart);
        const end = new Date(periodEnd);

        const timesheets = await db.collection(COLL.timesheets)
            .find({
                userId: tenant.userId,
                status: { $in: ['approved', 'invoiced'] },
                weekStart: { $gte: start, $lte: end },
            })
            .toArray();
        if (timesheets.length === 0) {
            return { success: false, error: 'No approved/invoiced timesheets in period' };
        }

        const placementIds = Array.from(new Set(timesheets.map(t => String(t.placementId))))
            .map(id => new ObjectId(id));
        const placements = await db.collection(COLL.placements)
            .find({ _id: { $in: placementIds } })
            .toArray();
        const placementMap = new Map(placements.map(p => [String(p._id), p]));

        // Aggregate per worker.
        const byWorker = new Map<string, { hours: number; rate: number }>();
        for (const ts of timesheets) {
            const p = placementMap.get(String(ts.placementId));
            const rate = Number(p?.hourlyPayRateMinor ?? 0);
            const hours = Number(ts.totalHours ?? 0);
            const key = String(ts.workerId);
            const existing = byWorker.get(key);
            if (existing) {
                existing.hours += hours;
                // Keep the higher rate if mismatched (rare; surfaced for review).
                if (rate > existing.rate) existing.rate = rate;
            } else {
                byWorker.set(key, { hours, rate });
            }
        }

        const lineItems: SabworkerlyPayrollLine[] = [...byWorker.entries()].map(
            ([workerId, { hours, rate }]) => ({
                workerId,
                hours,
                rate,
                amountMinor: Math.round(hours * rate),
            }),
        );
        const totalMinor = lineItems.reduce((acc, l) => acc + l.amountMinor, 0);

        const now = new Date();
        const doc = {
            userId: tenant.userId,
            periodStart: start,
            periodEnd: end,
            timesheetIds: timesheets.map(t => t._id),
            lineItems: lineItems.map(l => ({ ...l, workerId: new ObjectId(l.workerId) })),
            totalMinor,
            currency: 'USD',
            status: 'draft',
            createdAt: now,
            updatedAt: now,
        };
        const res = await db.collection(COLL.payrollRuns).insertOne(doc);
        revalidatePath('/dashboard/sabworkerly/payroll');
        return {
            success: true,
            id: String(res.insertedId),
            totalMinor,
            lineCount: lineItems.length,
        };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD AGGREGATE
// ═══════════════════════════════════════════════════════════════════════════

export interface SabworkerlyDashboardStats {
    activeWorkers: number;
    openJobs: number;
    pendingTimesheets: number;
    unpaidInvoices: number;
    unpaidTotalMinor: number;
}

export async function getSabworkerlyDashboardStats(): Promise<SabworkerlyDashboardStats> {
    const tenant = await resolveTenant();
    if ('error' in tenant) {
        return { activeWorkers: 0, openJobs: 0, pendingTimesheets: 0, unpaidInvoices: 0, unpaidTotalMinor: 0 };
    }
    const { db } = await connectToDatabase();
    const [activeWorkers, openJobs, pendingTimesheets, unpaidInvAgg] = await Promise.all([
        db.collection(COLL.workers).countDocuments({ userId: tenant.userId, status: { $in: ['active', 'on_assignment'] } }),
        db.collection(COLL.jobs).countDocuments({ userId: tenant.userId, status: 'open' }),
        db.collection(COLL.timesheets).countDocuments({ userId: tenant.userId, status: 'submitted' }),
        db.collection(COLL.invoices).aggregate([
            { $match: { userId: tenant.userId, status: { $in: ['draft', 'sent', 'overdue'] } } },
            { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$totalMinor' } } },
        ]).toArray(),
    ]);
    const u = unpaidInvAgg[0] || { count: 0, total: 0 };
    return {
        activeWorkers,
        openJobs,
        pendingTimesheets,
        unpaidInvoices: u.count as number,
        unpaidTotalMinor: u.total as number,
    };
}
