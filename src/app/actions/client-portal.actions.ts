'use server';

/**
 * Client Portal — server actions for `/portal/client/*`.
 *
 * Every action:
 *   1. Resolves the current session via `requireClient()`.
 *   2. Asserts `session.user.role === 'client'` — otherwise returns an
 *      empty payload / error. Pages also redirect from the layout, so
 *      this is the defence-in-depth boundary.
 *   3. Scopes every query by `clientId === session.user._id` — never
 *      exposes data from another client.
 *
 * Shared types live in `@/lib/client-portal/types`; helpers and
 * doc-mappers live in `@/lib/client-portal/{db,mappers}` to keep this
 * file under the 400-line cap.
 */

import { ObjectId, type Filter, type Document } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { hashPassword } from '@/lib/auth';
import { getErrorMessage } from '@/lib/utils';

import {
    asNumber,
    asString,
    clientIdFilter,
    requireClient,
    toIso,
} from '@/lib/client-portal/db';
import {
    mapArticle,
    mapContract,
    mapEstimate,
    mapInvoice,
    mapProject,
    mapTicket,
} from '@/lib/client-portal/mappers';
import type {
    ClientActivityItem,
    ClientContract,
    ClientEstimate,
    ClientInvoice,
    ClientKbArticle,
    ClientPortalBrand,
    ClientPortalKpis,
    ClientProfile,
    ClientProject,
    ClientProjectTask,
    ClientTicket,
    ClientTicketReply,
} from '@/lib/client-portal/types';

    const ctx = await requireClient();
    if (!ctx) return empty;
    try {
        const { db } = await connectToDatabase();
        const [openTickets, unpaidInvoices, activeProjects, pendingEstimates] = await Promise.all([
            db.collection('crm_tickets').countDocuments({
                ...clientIdFilter(ctx),
                status: { $nin: ['resolved', 'closed', 'Resolved', 'Closed'] },
            } as Filter<Document>),
            db.collection('crm_invoices').countDocuments({
                ...clientIdFilter(ctx),
                status: { $in: ['Sent', 'Overdue', 'Partially Paid'] },
            } as Filter<Document>),
            db.collection('crm_projects').countDocuments({
                ...clientIdFilter(ctx),
                status: { $in: ['active', 'planning', 'on-hold'] },
            } as Filter<Document>),
            db.collection('crm_estimates').countDocuments({
                ...clientIdFilter(ctx),
                status: { $in: ['waiting', 'sent', 'Sent', null] },
            } as Filter<Document>),
        ]);
        return { openTickets, unpaidInvoices, activeProjects, pendingEstimates };
    } catch {
        return empty;
    }
}

export async function getClientPortalActivity(limit: number = 10): Promise<ClientActivityItem[]> {
    const ctx = await requireClient();
    if (!ctx) return [];
    try {
        const { db } = await connectToDatabase();
        const sort = { updatedAt: -1, createdAt: -1 } as const;
        const [tickets, invoices, estimates, projects] = await Promise.all([
            db.collection('crm_tickets').find(clientIdFilter(ctx)).sort(sort).limit(limit).toArray(),
            db.collection('crm_invoices').find(clientIdFilter(ctx)).sort(sort).limit(limit).toArray(),
            db.collection('crm_estimates').find(clientIdFilter(ctx)).sort(sort).limit(limit).toArray(),
            db.collection('crm_projects').find(clientIdFilter(ctx)).sort(sort).limit(limit).toArray(),
        ]);

        const out: ClientActivityItem[] = [];
        for (const t of tickets) {
            const d = t as { _id: ObjectId; subject?: string; updatedAt?: Date; createdAt?: Date };
            out.push({
                type: 'ticket',
                title: `Ticket: ${asString(d.subject) || 'Untitled'}`,
                link: `/portal/client/tickets/${String(d._id)}`,
                when: toIso(d.updatedAt ?? d.createdAt) ?? '',
            });
        }
        for (const i of invoices) {
            const d = i as { _id: ObjectId; invoiceNumber?: string; updatedAt?: Date; createdAt?: Date };
            out.push({
                type: 'invoice',
                title: `Invoice ${d.invoiceNumber ?? ''}`.trim(),
                link: `/portal/client/invoices/${String(d._id)}`,
                when: toIso(d.updatedAt ?? d.createdAt) ?? '',
            });
        }
        for (const e of estimates) {
            const d = e as { _id: ObjectId; number?: string; updatedAt?: Date; createdAt?: Date };
            out.push({
                type: 'estimate',
                title: `Estimate ${d.number ?? ''}`.trim(),
                link: `/portal/client/estimates`,
                when: toIso(d.updatedAt ?? d.createdAt) ?? '',
            });
        }
        for (const p of projects) {
            const d = p as { _id: ObjectId; name?: string; updatedAt?: Date; createdAt?: Date };
            out.push({
                type: 'project',
                title: `Project: ${d.name ?? 'Untitled'}`,
                link: `/portal/client/projects/${String(d._id)}`,
                when: toIso(d.updatedAt ?? d.createdAt) ?? '',
            });
        }
        return out
            .filter((x) => x.when)
            .sort((a, b) => (a.when < b.when ? 1 : -1))
            .slice(0, limit);
    } catch {
        return [];
    }
}

/* ─── Projects ──────────────────────────────────────────────── */

export async function getClientProjects(): Promise<ClientProject[]> {
    const ctx = await requireClient();
    if (!ctx) return [];
    try {
        const { db } = await connectToDatabase();
        const docs = await db
            .collection('crm_projects')
            .find(clientIdFilter(ctx))
            .sort({ createdAt: -1 })
            .toArray();
        return docs.map(mapProject);
    } catch {
        return [];
    }
}

export async function getClientProjectById(id: string): Promise<{
    project: ClientProject;
    tasks: ClientProjectTask[];
    invoices: ClientInvoice[];
} | null> {
    const ctx = await requireClient();
    if (!ctx || !ObjectId.isValid(id)) return null;
    try {
        const { db } = await connectToDatabase();
        const projectObjId = new ObjectId(id);
        const doc = await db.collection('crm_projects').findOne({
            _id: projectObjId,
            ...clientIdFilter(ctx),
        } as Filter<Document>);
        if (!doc) return null;
        const [taskDocs, invoiceDocs] = await Promise.all([
            db.collection('crm_project_tasks')
                .find({ projectId: projectObjId } as Filter<Document>)
                .sort({ dueDate: 1, createdAt: -1 })
                .limit(200)
                .toArray(),
            db.collection('crm_invoices')
                .find({
                    ...clientIdFilter(ctx),
                    $or: [{ projectId: projectObjId }, { projectId: id }],
                } as Filter<Document>)
                .sort({ invoiceDate: -1 })
                .toArray(),
        ]);
        return {
            project: mapProject(doc),
            tasks: taskDocs.map((t) => {
                const d = t as {
                    _id: ObjectId;
                    title?: string;
                    status?: string;
                    priority?: string;
                    dueDate?: Date;
                    assigneeName?: string;
                };
                return {
                    _id: String(d._id),
                    title: asString(d.title),
                    status: asString(d.status) || 'todo',
                    priority: d.priority,
                    dueDate: toIso(d.dueDate),
                    assigneeName: d.assigneeName,
                };
            }),
            invoices: invoiceDocs.map(mapInvoice),
        };
    } catch {
        return null;
    }
}

/* ─── Invoices ──────────────────────────────────────────────── */

export async function getClientInvoices(): Promise<ClientInvoice[]> {
    const ctx = await requireClient();
    if (!ctx) return [];
    try {
        const { db } = await connectToDatabase();
        const docs = await db
            .collection('crm_invoices')
            .find(clientIdFilter(ctx))
            .sort({ invoiceDate: -1, createdAt: -1 })
            .toArray();
        return docs.map(mapInvoice);
    } catch {
        return [];
    }
}

export async function getClientInvoiceById(id: string): Promise<ClientInvoice | null> {
    const ctx = await requireClient();
    if (!ctx || !ObjectId.isValid(id)) return null;
    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection('crm_invoices').findOne({
            _id: new ObjectId(id),
            ...clientIdFilter(ctx),
        } as Filter<Document>);
        return doc ? mapInvoice(doc) : null;
    } catch {
        return null;
    }
}

/* ─── Estimates / Contracts ─────────────────────────────────── */

export async function getClientEstimates(): Promise<ClientEstimate[]> {
    const ctx = await requireClient();
    if (!ctx) return [];
    const { db } = await connectToDatabase();
    const docs = await db
        .collection('crm_estimates')
        .find(clientIdFilter(ctx))
        .sort({ createdAt: -1 })
        .toArray();
    return docs.map(mapEstimate);
}

export async function getClientContracts(): Promise<ClientContract[]> {
    const ctx = await requireClient();
    if (!ctx) return [];
    try {
        const { db } = await connectToDatabase();
        const docs = await db
            .collection('crm_contracts')
            .find(clientIdFilter(ctx))
            .sort({ createdAt: -1 })
            .toArray();

        const contractIds = docs.map(d => d._id);
        const signs = await db.collection('contract_signs').find({ contractId: { $in: contractIds } }).toArray();
        const amendments = await db.collection('crm_contract_amendments').find({ contractId: { $in: contractIds } }).toArray().catch(() => []);

        return docs.map((doc) => {
            const base = mapContract(doc);
            const docSigns = signs.filter(s => String(s.contractId) === String(doc._id));
            const docAmendments = amendments.filter(a => String(a.contractId) === String(doc._id));

            return {
                ...base,
                signatures: docSigns.map(s => ({
                    fullName: asString(s.fullName),
                    signedAt: toIso(s.signedAt),
                    place: asString(s.place),
                    party: asString(s.party)
                })),
                amendments: docAmendments.map(a => ({
                    _id: String(a._id),
                    title: asString(a.title) || 'Untitled Amendment',
                    createdAt: toIso(a.createdAt),
                    status: asString(a.status) || 'draft'
                }))
            };
        });
    } catch {
        return [];
    }
}

/* ─── Tickets ───────────────────────────────────────────────── */

export async function getClientTickets(): Promise<ClientTicket[]> {
    const ctx = await requireClient();
    if (!ctx) return [];
    try {
        const { db } = await connectToDatabase();
        const docs = await db
            .collection('crm_tickets')
            .find({
                $or: [
                    { clientId: ctx.userId },
                    { clientId: ctx.userId.toString() },
                    { requesterEmail: ctx.email },
                ],
            } as Filter<Document>)
            .sort({ updatedAt: -1, createdAt: -1 })
            .toArray();
            
        const tickets = docs.map(mapTicket);

        const openTicketIds = tickets
            .filter((t) => t.status !== 'resolved' && t.status !== 'closed')
            .map((t) => new ObjectId(t._id));

        if (openTicketIds.length > 0) {
            const replies = await db
                .collection('crm_ticket_replies')
                .find({ ticketId: { $in: openTicketIds } })
                .sort({ createdAt: -1 })
                .toArray();

            const latestReplyByTicket = new Map<string, any>();
            for (const r of replies) {
                const tid = String(r.ticketId);
                if (!latestReplyByTicket.has(tid)) {
                    latestReplyByTicket.set(tid, r);
                }
            }

            for (const t of tickets) {
                const latest = latestReplyByTicket.get(t._id);
                if (
                    latest &&
                    latest.isStaff &&
                    t.status !== 'resolved' &&
                    t.status !== 'closed'
                ) {
                    t.awaitingClientResponse = true;
                }
            }
        }

        return tickets;
    } catch {
        return [];
    }
}

export async function getClientTicketById(
    id: string,
): Promise<{ ticket: ClientTicket; replies: ClientTicketReply[] } | null> {
    const ctx = await requireClient();
    if (!ctx || !ObjectId.isValid(id)) return null;
    try {
        const { db } = await connectToDatabase();
        const ticketObjId = new ObjectId(id);
        const doc = await db.collection('crm_tickets').findOne({
            _id: ticketObjId,
            $or: [
                { clientId: ctx.userId },
                { clientId: ctx.userId.toString() },
                { requesterEmail: ctx.email },
            ],
        } as Filter<Document>);
        if (!doc) return null;

        const replyDocs = await db
            .collection('crm_ticket_replies')
            .find({ ticketId: ticketObjId } as Filter<Document>)
            .sort({ createdAt: 1 })
            .toArray();

        const replies: ClientTicketReply[] = replyDocs
            .filter((r) => !(r as { isInternal?: boolean }).isInternal)
            .map((r) => {
                const reply = r as {
                    _id: ObjectId;
                    message?: string;
                    body?: string;
                    authorName?: string;
                    userId?: ObjectId | string;
                    isStaff?: boolean;
                    createdAt?: Date;
                };
                const replyUserId = reply.userId ? String(reply.userId) : '';
                const isStaff =
                    reply.isStaff !== undefined
                        ? Boolean(reply.isStaff)
                        : replyUserId !== ctx.userId.toString();
                return {
                    _id: String(reply._id),
                    message: asString(reply.message ?? reply.body),
                    authorName: asString(reply.authorName) || (isStaff ? 'Support' : 'You'),
                    isStaff,
                    createdAt: toIso(reply.createdAt),
                };
            });

        return { ticket: mapTicket(doc), replies };
    } catch {
        return null;
    }
}

export async function createClientTicket(input: {
    subject: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    description: string;
}): Promise<{ ok?: boolean; id?: string; error?: string }> {
    const ctx = await requireClient();
    if (!ctx) return { error: 'Access denied.' };
    const subject = (input.subject ?? '').trim();
    const description = (input.description ?? '').trim();
    if (!subject) return { error: 'Subject is required.' };
    if (!description) return { error: 'Description is required.' };
    const priority = (['low', 'medium', 'high', 'urgent'] as const).includes(input.priority)
        ? input.priority
        : 'medium';
    try {
        const { db } = await connectToDatabase();
        const now = new Date();
        const session = await getSession();
        const userName = (session as { user?: { name?: string } } | null)?.user?.name ?? '';
        const res = await db.collection('crm_tickets').insertOne({
            subject,
            description,
            priority,
            status: 'open',
            clientId: ctx.userId,
            requesterEmail: ctx.email,
            requesterName: userName,
            source: 'client-portal',
            createdAt: now,
            updatedAt: now,
        });
        revalidatePath('/portal/client/tickets');
        return { ok: true, id: String(res.insertedId) };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function replyToClientTicket(
    ticketId: string,
    message: string,
): Promise<{ ok?: boolean; error?: string }> {
    const ctx = await requireClient();
    if (!ctx) return { error: 'Access denied.' };
    const text = (message ?? '').trim();
    if (!text) return { error: 'Reply cannot be empty.' };
    if (!ObjectId.isValid(ticketId)) return { error: 'Invalid ticket id.' };
    try {
        const { db } = await connectToDatabase();
        const ticketObjId = new ObjectId(ticketId);
        const ticket = await db.collection('crm_tickets').findOne({
            _id: ticketObjId,
            $or: [
                { clientId: ctx.userId },
                { clientId: ctx.userId.toString() },
                { requesterEmail: ctx.email },
            ],
        } as Filter<Document>);
        if (!ticket) return { error: 'Ticket not found.' };

        const session = await getSession();
        const userName = (session as { user?: { name?: string } } | null)?.user?.name ?? 'Client';
        const now = new Date();
        await db.collection('crm_ticket_replies').insertOne({
            ticketId: ticketObjId,
            userId: ctx.userId,
            authorName: userName,
            isStaff: false,
            isInternal: false,
            message: text,
            createdAt: now,
        });
        await db.collection('crm_tickets').updateOne(
            { _id: ticketObjId } as Filter<Document>,
            {
                $set: {
                    status: 'waiting',
                    lastReplyAt: now,
                    updatedAt: now,
                },
            },
        );
        revalidatePath(`/portal/client/tickets/${ticketId}`);
        return { ok: true };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

/* ─── Knowledge Base ────────────────────────────────────────── */

export async function getClientKnowledgeBase(
    filter?: { search?: string; category?: string },
): Promise<ClientKbArticle[]> {
    const ctx = await requireClient();
    if (!ctx) return [];
    try {
        const { db } = await connectToDatabase();
        const q: Filter<Document> = {
            status: 'published',
            $or: [
                { audience: 'client' },
                { audience: 'public' },
                { visibility: 'portal' },
                { visibility: 'public' },
            ],
        };
        if (filter?.category) {
            (q as Record<string, unknown>).category = filter.category;
        }
        if (filter?.search) {
            const rx = { $regex: filter.search, $options: 'i' };
            (q as Record<string, unknown>).$and = [
                { $or: [{ title: rx }, { body: rx }, { excerpt: rx }] },
            ];
        }
        const docs = await db
            .collection('crm_kb_articles')
            .find(q)
            .sort({ updatedAt: -1, createdAt: -1 })
            .limit(200)
            .toArray();
        return docs.map(mapArticle);
    } catch {
        return [];
    }
}

export async function getClientKnowledgeBaseArticle(id: string): Promise<ClientKbArticle | null> {
    const ctx = await requireClient();
    if (!ctx || !ObjectId.isValid(id)) return null;
    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection('crm_kb_articles').findOne({
            _id: new ObjectId(id),
            status: 'published',
            $or: [
                { audience: 'client' },
                { audience: 'public' },
                { visibility: 'portal' },
                { visibility: 'public' },
            ],
        } as Filter<Document>);
        return doc ? mapArticle(doc) : null;
    } catch {
        return null;
    }
}

/* ─── Profile + branding ────────────────────────────────────── */

export async function getClientProfile(): Promise<ClientProfile | null> {
    const ctx = await requireClient();
    if (!ctx) return null;
    try {
        const { db } = await connectToDatabase();
        const [user, details] = await Promise.all([
            db.collection('users').findOne(
                { _id: ctx.userId },
                { projection: { password: 0 } },
            ),
            db.collection('client_details').findOne({ userId: ctx.userId }),
        ]);
        if (!user) return null;
        const u = user as {
            _id: ObjectId;
            name?: string;
            email?: string;
            mobile?: string;
            avatarUrl?: string;
            twoFactorEnabled?: boolean;
            notificationPreferences?: { email: boolean; sms: boolean };
        };
        const d = details as {
            companyName?: string;
            contactName?: string;
            country?: string;
            website?: string;
            mobile?: string;
        } | null;
        return {
            _id: String(u._id),
            name: asString(u.name),
            email: asString(u.email),
            mobile: u.mobile ?? d?.mobile,
            avatarUrl: u.avatarUrl,
            twoFactorEnabled: u.twoFactorEnabled ?? false,
            notificationPreferences: u.notificationPreferences ?? { email: true, sms: false },
            company: d
                ? {
                      companyName: d.companyName,
                      contactName: d.contactName,
                      country: d.country,
                      website: d.website,
                  }
                : undefined,
        };
    } catch {
        return null;
    }
}

export async function updateClientProfile(input: {
    name?: string;
    mobile?: string;
    password?: string;
    avatarUrl?: string;
    twoFactorEnabled?: boolean;
    notificationPreferences?: { email: boolean; sms: boolean };
}): Promise<{ ok?: boolean; error?: string }> {
    const ctx = await requireClient();
    if (!ctx) return { error: 'Access denied.' };
    try {
        const { db } = await connectToDatabase();
        const update: Record<string, unknown> = { updatedAt: new Date() };
        if (typeof input.name === 'string' && input.name.trim()) {
            update.name = input.name.trim();
        }
        if (typeof input.mobile === 'string') {
            update.mobile = input.mobile.trim();
        }
        if (typeof input.password === 'string' && input.password.length >= 8) {
            update.password = await hashPassword(input.password);
        }
        if (typeof input.avatarUrl === 'string') {
            update.avatarUrl = input.avatarUrl;
        }
        if (typeof input.twoFactorEnabled === 'boolean') {
            update.twoFactorEnabled = input.twoFactorEnabled;
        }
        if (input.notificationPreferences) {
            update.notificationPreferences = input.notificationPreferences;
        }
        if (Object.keys(update).length === 1) {
            return { error: 'Nothing to update.' };
        }
        await db.collection('users').updateOne(
            { _id: ctx.userId } as Filter<Document>,
            { $set: update },
        );
        if (typeof input.mobile === 'string') {
            await db.collection('client_details').updateOne(
                { userId: ctx.userId } as Filter<Document>,
                { $set: { mobile: input.mobile.trim(), updatedAt: new Date() } },
                { upsert: false },
            );
        }
        revalidatePath('/portal/client/profile');
        return { ok: true };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function getClientPortalBrand(): Promise<ClientPortalBrand> {
    try {
        const { db } = await connectToDatabase();
        const company = await db
            .collection('companies')
            .findOne({}, { sort: { createdAt: 1 } });
        if (!company) return { name: 'SabNode', logo: null };
        const c = company as {
            companyName?: string;
            name?: string;
            companyLogo?: string;
            logo?: string;
        };
        return {
            name: c.companyName ?? c.name ?? 'SabNode',
            logo: c.companyLogo ?? c.logo ?? null,
        };
    } catch {
        return { name: 'SabNode', logo: null };
    }
}
