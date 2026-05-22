'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import type { CrmContact, CrmDeal, CrmTask, CrmInvoice } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { z } from 'zod';
import { applyCustomFieldsToEntity } from '@/app/actions/worksuite/meta.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import { contactApi, type CrmContactDoc } from '@/lib/rust-client/crm-contacts';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { recordFlowAction } from '@/lib/sabflow/audit/middleware';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

/* ─── Rust-shape → legacy TS-shape adapter (CRM Contact) ─────────────── */

function rustContactDocToLegacy(doc: CrmContactDoc): WithId<CrmContact> {
    return {
        ...(doc as unknown as WithId<CrmContact>),
        _id: doc._id ? (doc._id as unknown as ObjectId) : (undefined as unknown as ObjectId),
        userId: doc.userId as unknown as ObjectId,
        accountId: doc.accountId ? (doc.accountId as unknown as ObjectId) : undefined,
        createdAt: doc.createdAt ? new Date(doc.createdAt) : new Date(),
        updatedAt: doc.updatedAt ? new Date(doc.updatedAt) : undefined,
        lastActivity: doc.lastActivity ? new Date(doc.lastActivity) : undefined,
        dateOfBirth: doc.dateOfBirth ? new Date(doc.dateOfBirth) : undefined,
    } as WithId<CrmContact>;
}

export async function getCrmContacts(
    page: number = 1,
    limit: number = 20,
    query?: string,
    accountId?: string,
    sortBy?: string,
    sortDirection?: 'asc' | 'desc'
): Promise<{ contacts: WithId<CrmContact>[], total: number }> {
    const session = await getSession();
    if (!session?.user) return { contacts: [], total: 0 };

    if (useRustCrm()) {
        try {
            const filter: Record<string, unknown> = {};
            if (accountId && ObjectId.isValid(accountId)) {
                filter.accountId = accountId;
            }
            const result = await contactApi.list({
                q: query,
                page: Math.max(0, page - 1),
                limit,
                filter: Object.keys(filter).length > 0 ? filter : undefined,
            });
            return {
                contacts: result.items.map(rustContactDocToLegacy),
                total: result.total ?? result.items.length,
            };
        } catch (e) {
            console.error('[getCrmContacts] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'contact', op: 'list', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const filter: any = { userId: userObjectId };
        if (query) {
            const queryRegex = { $regex: query, $options: 'i' };
            filter.$or = [
                { name: queryRegex },
                { email: queryRegex },
                { company: queryRegex }
            ];
        }

        if (accountId && ObjectId.isValid(accountId)) {
            filter.accountId = new ObjectId(accountId);
        }

        const sort: any = {};
        if (sortBy && sortDirection) {
            sort[sortBy] = sortDirection === 'asc' ? 1 : -1;
        } else {
            sort.lastActivity = -1; // Default sort
        }

        const skip = (page - 1) * limit;

        const [contacts, total] = await Promise.all([
            db.collection<CrmContact>('crm_contacts').find(filter as any).sort(sort).skip(skip).limit(limit).toArray(),
            db.collection('crm_contacts').countDocuments(filter as any)
        ]);

        return {
            contacts: JSON.parse(JSON.stringify(contacts)),
            total
        };
    } catch (e: any) {
        console.error("Failed to fetch CRM contacts:", e);
        return { contacts: [], total: 0 };
    }
}

export async function deleteCrmContact(contactId: string): Promise<{ success: boolean; error?: string }> {
    if (!contactId) return { success: false, error: 'Invalid contact id' };

    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied' };

    if (useRustCrm()) {
        try {
            // DELETE /v1/crm/contacts/:id is soft-delete (status → archived).
            await contactApi.delete(contactId);
            revalidatePath('/dashboard/crm/contacts');
            void recordFlowAction('crm.contact.deleted', {
                userId: String(session.user._id),
                target: contactId,
            });
            return { success: true };
        } catch (e) {
            const msg = e instanceof RustApiError ? e.message : getErrorMessage(e);
            console.error('[deleteCrmContact] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'contact', op: 'delete', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            void msg;
            // fall through
        }
    }

    if (!ObjectId.isValid(contactId)) return { success: false, error: 'Invalid contact id' };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_contacts').deleteOne({
            _id: new ObjectId(contactId),
            userId: new ObjectId(session.user._id),
        });

        if (result.deletedCount === 0) {
            return { success: false, error: 'Contact not found' };
        }

        revalidatePath('/dashboard/crm/contacts');
        void recordFlowAction('crm.contact.deleted', {
            userId: String(session.user._id),
            target: contactId,
        });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function getCrmContactById(contactId: string): Promise<WithId<CrmContact> | null> {
    if (!contactId) return null;

    const session = await getSession();
    if (!session?.user) return null;

    if (useRustCrm()) {
        try {
            const doc = await contactApi.getById(contactId);
            return doc ? rustContactDocToLegacy(doc) : null;
        } catch (e) {
            console.error('[getCrmContactById] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'contact', op: 'get', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

    if (!ObjectId.isValid(contactId)) return null;

    try {
        const { db } = await connectToDatabase();
        const contact = await db.collection<CrmContact>('crm_contacts').findOne({
            _id: new ObjectId(contactId),
            userId: new ObjectId(session.user._id)
        });

        return contact ? JSON.parse(JSON.stringify(contact)) : null;
    } catch (e) {
        return null;
    }
}

export async function addCrmContact(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: "Access denied" };

    const name = (formData.get('name') as string | null) || '';
    const email = (formData.get('email') as string | null) || '';
    if (!name || !email) {
        return { error: 'Name and Email are required.' };
    }

    const phone = (formData.get('phone') as string | null) || undefined;
    const company = (formData.get('company') as string | null) || undefined;
    const jobTitle = (formData.get('jobTitle') as string | null) || undefined;
    const statusRaw = (formData.get('status') as string | null) || undefined;
    const leadScoreRaw = formData.get('leadScore');
    const leadScore = leadScoreRaw != null && leadScoreRaw !== '' ? Number(leadScoreRaw) : undefined;
    const linkedinUrl = (formData.get('linkedinUrl') as string | null) || undefined;
    const twitterHandle = (formData.get('twitterHandle') as string | null) || undefined;
    const lifecycleStage = (formData.get('lifecycleStage') as string | null) || undefined;
    const source = (formData.get('source') as string | null) || undefined;
    const owner = (formData.get('owner') as string | null) || undefined;
    const tagsRaw = (formData.get('tags') as string | null) || '';
    const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : undefined;
    const dateOfBirth = (formData.get('dateOfBirth') as string | null) || undefined;
    const timezone = (formData.get('timezone') as string | null) || undefined;
    const accountId = (formData.get('accountId') as string | null) || undefined;

    if (useRustCrm()) {
        try {
            const { id, entity } = await contactApi.create({
                name,
                email,
                phone,
                company,
                jobTitle,
                status: statusRaw,
                leadScore,
                linkedinUrl,
                twitterHandle,
                lifecycleStage,
                source,
                owner,
                tags,
                dateOfBirth: dateOfBirth ? new Date(dateOfBirth).toISOString() : undefined,
                timezone,
                accountId: accountId && ObjectId.isValid(accountId) ? accountId : undefined,
            });
            revalidatePath('/dashboard/crm/contacts');
            void recordFlowAction('crm.contact.created', {
                userId: String(session.user._id),
                metadata: { name, email, company },
            });
            return { 
                message: 'Contact added successfully.',
                newContact: entity 
                    ? { ...rustContactDocToLegacy(entity), _id: id } 
                    : { _id: id, name } 
            };
        } catch (e) {
            console.error('[addCrmContact] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'contact', op: 'create', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

    try {
        const newContact: Partial<CrmContact> = {
            userId: new ObjectId(session.user._id),
            name,
            email,
            phone,
            company,
            jobTitle,
            status: (statusRaw as CrmContact['status']) ?? undefined,
            leadScore: leadScore ?? 0,
            createdAt: new Date(),
        };

        if (linkedinUrl) newContact.linkedinUrl = linkedinUrl;
        if (twitterHandle) newContact.twitterHandle = twitterHandle;
        if (lifecycleStage) newContact.lifecycleStage = lifecycleStage as CrmContact['lifecycleStage'];
        if (source) newContact.source = source as CrmContact['source'];
        if (owner) newContact.owner = owner;
        if (tags && tags.length) newContact.tags = tags;
        if (dateOfBirth) newContact.dateOfBirth = new Date(dateOfBirth);
        if (timezone) newContact.timezone = timezone;

        if (accountId && ObjectId.isValid(accountId)) {
            newContact.accountId = new ObjectId(accountId);
        }

        const { db } = await connectToDatabase();
        const inserted = await db.collection('crm_contacts').insertOne(newContact as CrmContact);

        revalidatePath('/dashboard/crm/contacts');
        void recordFlowAction('crm.contact.created', {
            userId: String(session.user._id),
            target: inserted.insertedId?.toString?.(),
            metadata: { name, email, company },
        });
        return { message: 'Contact added successfully.', newContact: { ...newContact, _id: inserted.insertedId } };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function updateCrmContact(
    prevState: any,
    formData: FormData,
): Promise<{ message?: string; error?: string; contactId?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    const contactId = (formData.get('contactId') as string | null) || '';
    if (!contactId || !ObjectId.isValid(contactId)) {
        return { error: 'Invalid contact id.' };
    }
    const name = (formData.get('name') as string | null) || '';
    const email = (formData.get('email') as string | null) || '';
    if (!name || !email) {
        return { error: 'Name and Email are required.' };
    }

    const phone = (formData.get('phone') as string | null) || undefined;
    const company = (formData.get('company') as string | null) || undefined;
    const jobTitle = (formData.get('jobTitle') as string | null) || undefined;
    const statusRaw = (formData.get('status') as string | null) || undefined;
    const leadScoreRaw = formData.get('leadScore');
    const leadScore = leadScoreRaw != null && leadScoreRaw !== ''
        ? Number(leadScoreRaw)
        : undefined;
    const linkedinUrl = (formData.get('linkedinUrl') as string | null) || undefined;
    const twitterHandle = (formData.get('twitterHandle') as string | null) || undefined;
    const lifecycleStage = (formData.get('lifecycleStage') as string | null) || undefined;
    const source = (formData.get('source') as string | null) || undefined;
    const owner = (formData.get('owner') as string | null) || undefined;
    const tagsRaw = (formData.get('tags') as string | null) || '';
    const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : undefined;
    const dateOfBirth = (formData.get('dateOfBirth') as string | null) || undefined;
    const timezone = (formData.get('timezone') as string | null) || undefined;
    const accountId = (formData.get('accountId') as string | null) || undefined;

    if (useRustCrm()) {
        try {
            await contactApi.update(contactId, {
                name,
                email,
                phone,
                company,
                jobTitle,
                status: statusRaw,
                leadScore,
                linkedinUrl,
                twitterHandle,
                lifecycleStage,
                source,
                owner,
                tags,
                dateOfBirth: dateOfBirth ? new Date(dateOfBirth).toISOString() : undefined,
                timezone,
                accountId:
                    accountId && ObjectId.isValid(accountId) ? accountId : undefined,
            });
            revalidatePath('/dashboard/crm/contacts');
            revalidatePath('/dashboard/crm/sales/contacts');
            revalidatePath(`/dashboard/crm/sales/contacts/${contactId}`);
            void recordFlowAction('crm.contact.updated', {
                userId: String(session.user._id),
                target: contactId,
            });
            return { message: 'Contact updated successfully.', contactId };
        } catch (e) {
            console.error('[updateCrmContact] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'contact', op: 'update', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

    try {
        const $set: Partial<CrmContact> & Record<string, any> = {
            name,
            email,
            updatedAt: new Date(),
        };
        if (phone !== undefined) $set.phone = phone;
        if (company !== undefined) $set.company = company;
        if (jobTitle !== undefined) $set.jobTitle = jobTitle;
        if (statusRaw) $set.status = statusRaw as CrmContact['status'];
        if (leadScore !== undefined) $set.leadScore = leadScore;
        if (linkedinUrl !== undefined) $set.linkedinUrl = linkedinUrl;
        if (twitterHandle !== undefined) $set.twitterHandle = twitterHandle;
        if (lifecycleStage) $set.lifecycleStage = lifecycleStage as CrmContact['lifecycleStage'];
        if (source) $set.source = source as CrmContact['source'];
        if (owner !== undefined) $set.owner = owner;
        if (tags !== undefined) $set.tags = tags;
        if (dateOfBirth) $set.dateOfBirth = new Date(dateOfBirth);
        if (timezone !== undefined) $set.timezone = timezone;
        if (accountId && ObjectId.isValid(accountId)) {
            $set.accountId = new ObjectId(accountId);
        }

        const { db } = await connectToDatabase();
        const result = await db.collection('crm_contacts').updateOne(
            {
                _id: new ObjectId(contactId),
                userId: new ObjectId(session.user._id),
            },
            { $set },
        );

        if (result.matchedCount === 0) {
            return { error: 'Contact not found.' };
        }

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'update',
            entityKind: 'contact',
            entityId: contactId,
        });

        revalidatePath('/dashboard/crm/contacts');
        revalidatePath('/dashboard/crm/sales/contacts');
        revalidatePath(`/dashboard/crm/sales/contacts/${contactId}`);
        void recordFlowAction('crm.contact.updated', {
            userId: String(session.user._id),
            target: contactId,
        });
        return { message: 'Contact updated successfully.', contactId };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function addCrmClient(prevState: any, formData: FormData): Promise<{ message?: string, error?: string, newClient?: any }> {
    const session = await getSession();
    if (!session?.user) return { error: "Access denied" };

    try {
        const { db } = await connectToDatabase();

        const gstin = formData.get('gstin') as string;
        const pan = formData.get('pan') as string;
        const billingAddress = formData.get('billingAddress') as string;
        const shippingAddress = formData.get('shippingAddress') as string;
        const annualRevenueRaw = formData.get('annualRevenue') as string;
        const employeeCountRaw = formData.get('employeeCount') as string;
        const accountCurrency = formData.get('accountCurrency') as string;
        const paymentTerms = formData.get('paymentTerms') as string;
        const category = formData.get('category') as string;

        const logoUrl = formData.get('logoUrl') as string | null;
        const attachmentsRaw = formData.get('attachmentUrls') as string | null;
        let attachmentUrls: string[] | undefined;
        if (attachmentsRaw) {
            try {
                const parsed = JSON.parse(attachmentsRaw);
                if (Array.isArray(parsed)) {
                    attachmentUrls = parsed.filter((u): u is string => typeof u === 'string' && !!u);
                }
            } catch {
                // ignore malformed JSON
            }
        }

        const accountDoc: Record<string, any> = {
            userId: new ObjectId(session.user._id),
            name: formData.get('businessName') as string,
            industry: formData.get('clientIndustry') as string,
            phone: formData.get('phone') as string,
            createdAt: new Date(),
            status: 'active',
        };
        if (gstin) accountDoc.gstin = gstin;
        if (pan) accountDoc.pan = pan;
        if (billingAddress) accountDoc.billingAddress = billingAddress;
        if (shippingAddress) accountDoc.shippingAddress = shippingAddress;
        if (annualRevenueRaw) accountDoc.annualRevenue = Number(annualRevenueRaw);
        if (employeeCountRaw) accountDoc.employeeCount = Number(employeeCountRaw);
        if (accountCurrency) accountDoc.currency = accountCurrency;
        if (paymentTerms) accountDoc.paymentTerms = paymentTerms;
        if (category) accountDoc.category = category;
        if (logoUrl) accountDoc.logoUrl = logoUrl;
        if (attachmentUrls && attachmentUrls.length) accountDoc.attachments = attachmentUrls;

        const accountResult = await db.collection('crm_accounts').insertOne(accountDoc);

        // Persist custom-field values for entity=account. Best-effort.
        const cfRaw = formData.get('customFields');
        if (typeof cfRaw === 'string' && cfRaw.length > 0 && cfRaw !== '{}') {
            try {
                const parsed = JSON.parse(cfRaw);
                if (parsed && typeof parsed === 'object') {
                    await applyCustomFieldsToEntity(
                        'account',
                        accountResult.insertedId.toString(),
                        parsed,
                    );
                }
            } catch (e) {
                console.error('[addCrmClient] customFields parse failed:', e);
            }
        }

        const newContact: Partial<CrmContact> = {
            userId: new ObjectId(session.user._id),
            accountId: accountResult.insertedId,
            name: formData.get('businessName') as string,
            email: formData.get('email') as string,
            phone: formData.get('phone') as string,
            company: formData.get('businessName') as string,
            status: 'new_lead',
            createdAt: new Date(),
        };
        const insertResult = await db.collection('crm_contacts').insertOne(newContact as CrmContact);
        const createdClient = { ...newContact, _id: insertResult.insertedId };

        // §12.21 audit trail.
        await writeAuditEntry({
            tenantUserId: session.user._id,
            action: 'create',
            entityKind: 'account',
            entityId: accountResult.insertedId.toString(),
        });
        void recordFlowAction('crm.account.created', {
            userId: String(session.user._id),
            target: accountResult.insertedId.toString(),
        });

        revalidatePath('/dashboard/crm/sales/clients');
        return { message: 'New client added successfully.', newClient: JSON.parse(JSON.stringify(createdClient)) };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function importCrmContacts(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    // This action remains as it's more about data import than role management.
    return { error: 'Not yet implemented.' }
}

export async function addCrmNote(prevState: any, formData: FormData): Promise<{ message?: string, error?: string, note?: { content: string; author: string; createdAt: string } }> {
    const session = await getSession();
    if (!session?.user) return { error: "Access denied" };

    const recordId = formData.get('recordId') as string;
    type SupportedRecordType =
        | 'contact'
        | 'account'
        | 'deal'
        | 'lead'
        | 'invoice'
        | 'quotation'
        | 'paymentReceipt'
        | 'creditNote'
        | 'proforma'
        | 'contract'
        | 'subscription';
    const recordType = formData.get('recordType') as SupportedRecordType;
    const content = formData.get('noteContent') as string;

    if (!recordId || !ObjectId.isValid(recordId) || !recordType || !content) {
        return { error: "Missing required information for note." };
    }

    const collectionMap: Record<SupportedRecordType, string> = {
        contact: 'crm_contacts',
        account: 'crm_accounts',
        deal: 'crm_deals',
        lead: 'crm_leads',
        invoice: 'crm_invoices',
        quotation: 'crm_quotations',
        paymentReceipt: 'crm_payment_receipts',
        creditNote: 'crm_credit_notes',
        proforma: 'crm_proforma_invoices',
        contract: 'crm_contracts',
        subscription: 'crm_subscriptions',
    };
    const collectionName = collectionMap[recordType];
    if (!collectionName) {
        return { error: `Unsupported record type: ${recordType}` };
    }

    try {
        const { db } = await connectToDatabase();
        const newNote = {
            content,
            author: session.user.name,
            createdAt: new Date(),
        };
        await db.collection(collectionName).updateOne(
            { _id: new ObjectId(recordId), userId: new ObjectId(session.user._id) },
            { $push: { notes: { $each: [newNote], $position: 0 } } } as any
        );
        const revalPath: Record<SupportedRecordType, string> = {
            contact: `/dashboard/crm/contacts/${recordId}`,
            account: `/dashboard/crm/accounts/${recordId}`,
            deal: `/dashboard/crm/sales-crm/deals/${recordId}`,
            lead: `/dashboard/crm/sales-crm/all-leads/${recordId}`,
            invoice: `/dashboard/crm/sales/invoices/${recordId}`,
            quotation: `/dashboard/crm/sales/quotations/${recordId}`,
            paymentReceipt: `/dashboard/crm/sales/receipts/${recordId}`,
            creditNote: `/dashboard/crm/sales/credit-notes/${recordId}`,
            proforma: `/dashboard/crm/sales/proforma/${recordId}`,
            contract: `/dashboard/crm/sales/contracts/${recordId}`,
            subscription: `/dashboard/crm/sales/subscriptions/${recordId}`,
        };
        revalidatePath(revalPath[recordType] ?? `/dashboard/crm/${recordType}s/${recordId}`);
        void recordFlowAction('crm.note.created', {
            userId: String(session.user._id),
            target: recordId,
            metadata: { recordType },
        });
        return {
            message: "Note added.",
            note: {
                content: newNote.content,
                author: newNote.author,
                createdAt: newNote.createdAt.toISOString(),
            },
        };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function saveCrmIndustry(industry: string): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: "Access denied." };

    try {
        const { db } = await connectToDatabase();
        await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            { $set: { crmIndustry: industry } }
        );
        revalidatePath('/dashboard/crm/setup');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function saveCrmProviders(prevState: any, formData: FormData) {
    const session = await getSession();
    if (!session?.user) return { error: "Access denied." };

    try {
        const { db } = await connectToDatabase();
        // Placeholder for future provider settings

        revalidatePath('/dashboard/crm/settings');
        return { message: 'Provider settings saved successfully.' };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function getCrmDashboardStats() {
    const session = await getSession();
    if (!session?.user) {
        return {
            counts: {
                contacts: 0,
                deals: 0,
                dealsWon: 0,
                pipelineValue: 0,
            },
            recentDeals: [],
            upcomingTasks: [],
            recentContacts: [],
            pipelineStages: [],
            invoiceStats: {
                overdueCount: 0,
                overdueAmount: 0,
                sentCount: 0,
                sentAmount: 0
            },
            currency: 'USD'
        };
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const [contactCount, deals, tasks, contacts, invoices] = await Promise.all([
            db.collection('crm_contacts').countDocuments({ userId: userObjectId }),
            db.collection<CrmDeal>('crm_deals').find({ userId: userObjectId }).toArray(),
            db.collection<CrmTask>('crm_tasks').find({
                userId: userObjectId,
                status: { $ne: 'Completed' }
            }).sort({ dueDate: 1 }).limit(5).toArray(),
            db.collection<CrmContact>('crm_contacts').find({ userId: userObjectId }).sort({ createdAt: -1 }).limit(5).toArray(),
            db.collection<CrmInvoice>('crm_invoices').find({
                userId: userObjectId,
                status: { $in: ['Overdue', 'Sent'] }
            }).toArray()
        ]);

        const dealCount = deals.length;
        const dealsWon = deals.filter(d => d.stage === 'Won').length;
        const pipelineValue = deals.reduce((sum, deal) => sum + (deal.value || 0), 0);

        // Process Pipeline Stages
        const pipelineStageMap = new Map<string, { count: number, value: number }>();
        deals.forEach(deal => {
            const current = pipelineStageMap.get(deal.stage) || { count: 0, value: 0 };
            pipelineStageMap.set(deal.stage, {
                count: current.count + 1,
                value: current.value + (deal.value || 0)
            });
        });

        const pipelineStages = Array.from(pipelineStageMap.entries()).map(([stage, data]) => ({
            stage,
            ...data
        })).sort((a, b) => b.value - a.value); // Sort by value desc

        // Process Invoices
        const invoiceStats = invoices.reduce((acc, inv) => {
            if (inv.status === 'Overdue') {
                acc.overdueCount++;
                acc.overdueAmount += inv.total || 0;
            } else if (inv.status === 'Sent') {
                acc.sentCount++;
                acc.sentAmount += inv.total || 0;
            }
            return acc;
        }, { overdueCount: 0, overdueAmount: 0, sentCount: 0, sentAmount: 0 });

        // Sort Recent Deals
        const recentDeals = deals
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 5);

        return {
            counts: {
                contacts: contactCount,
                deals: dealCount,
                dealsWon,
                pipelineValue
            },
            recentDeals: JSON.parse(JSON.stringify(recentDeals)),
            upcomingTasks: JSON.parse(JSON.stringify(tasks)),
            recentContacts: JSON.parse(JSON.stringify(contacts)),
            pipelineStages: JSON.parse(JSON.stringify(pipelineStages)),
            invoiceStats,
            currency: session.user.plan?.currency || 'USD'
        };

    } catch (e) {
        console.error("Failed to fetch CRM dashboard stats:", e);
        return {
            counts: {
                contacts: 0,
                deals: 0,
                dealsWon: 0,
                pipelineValue: 0,
            },
            recentDeals: [],
            upcomingTasks: [],
            recentContacts: [],
            pipelineStages: [],
            invoiceStats: {
                overdueCount: 0,
                overdueAmount: 0,
                sentCount: 0,
                sentAmount: 0
            },
            currency: 'USD'
        };
    }
}

/* ─── getCrmContactRelatedCounts ──────────────────────────────────────
 * Right-rail counts for the contact detail page (§5.6). All filters
 * are tenant-scoped on `userId`. Returns zeros on any failure so the
 * UI never blocks.
 */
export async function getCrmContactRelatedCounts(contactId: string): Promise<{
    deals: number;
    tasks: number;
    notes: number;
    tickets: number;
    invoices: number;
    attachments: number;
}> {
    const empty = { deals: 0, tasks: 0, notes: 0, tickets: 0, invoices: 0, attachments: 0 };
    if (!contactId || !ObjectId.isValid(contactId)) return empty;
    const session = await getSession();
    if (!session?.user) return empty;

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(String(session.user._id));
        const objId = new ObjectId(contactId);
        const idCandidates: unknown[] = [contactId, objId];

        const [deals, tasks, notes, tickets, invoices, attachments] = await Promise.all([
            db
                .collection('crm_deals')
                .countDocuments({
                    userId,
                    $or: [
                        { contactIds: { $in: idCandidates } },
                        { contactId: { $in: idCandidates } },
                    ],
                } as Record<string, unknown>)
                .catch(() => 0),
            db
                .collection('crm_tasks')
                .countDocuments({
                    userId,
                    $or: [
                        { contactId: { $in: idCandidates } },
                        { 'linkedEntity.kind': 'contact', 'linkedEntity.id': { $in: idCandidates } },
                    ],
                } as Record<string, unknown>)
                .catch(() => 0),
            db
                .collection('crm_notes')
                .countDocuments({
                    userId,
                    $or: [
                        { recordId: { $in: idCandidates }, recordType: 'contact' },
                        { contactId: { $in: idCandidates } },
                    ],
                } as Record<string, unknown>)
                .catch(() => 0),
            db
                .collection('crm_tickets')
                .countDocuments({
                    userId,
                    $or: [
                        { contactId: { $in: idCandidates } },
                        { requesterId: { $in: idCandidates } },
                    ],
                } as Record<string, unknown>)
                .catch(() => 0),
            db
                .collection('crm_invoices')
                .countDocuments({
                    userId,
                    $or: [
                        { contactId: { $in: idCandidates } },
                        { clientId: { $in: idCandidates } },
                    ],
                } as Record<string, unknown>)
                .catch(() => 0),
            db
                .collection('crm_attachments')
                .countDocuments({
                    userId,
                    $or: [
                        { entityKind: 'contact', entityId: { $in: idCandidates } },
                        { contactId: { $in: idCandidates } },
                    ],
                } as Record<string, unknown>)
                .catch(() => 0),
        ]);

        return {
            deals: Number(deals) || 0,
            tasks: Number(tasks) || 0,
            notes: Number(notes) || 0,
            tickets: Number(tickets) || 0,
            invoices: Number(invoices) || 0,
            attachments: Number(attachments) || 0,
        };
    } catch (e) {
        console.error('[getCrmContactRelatedCounts] failed:', e);
        return empty;
    }
}

/* ─── getCrmContactKpis + bulkContactAction ───────────────────────────
 * Headline metrics for the contacts list page. Tenant-scoped via the
 * session userId, and tolerant of permission failures (returns zeros).
 */
export interface CrmContactKpis {
    total: number;
    withDeals: number;
    newsletterSubscribed: number;
    recentlyAdded: number;
}

export async function getCrmContactKpis(): Promise<CrmContactKpis> {
    const zero: CrmContactKpis = {
        total: 0,
        withDeals: 0,
        newsletterSubscribed: 0,
        recentlyAdded: 0,
    };
    const session = await getSession();
    if (!session?.user) return zero;

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);
        const base = { userId: userObjectId };

        const since = new Date();
        since.setDate(since.getDate() - 30);

        const [total, recentlyAdded, dealAgg, newsletterSubscribed] = await Promise.all([
            db.collection('crm_contacts').countDocuments(base),
            db.collection('crm_contacts').countDocuments({
                ...base,
                createdAt: { $gte: since },
            }),
            db
                .collection('crm_deals')
                .aggregate([
                    { $match: { userId: userObjectId } },
                    { $group: { _id: null, contactIds: { $addToSet: '$contactId' } } },
                ])
                .toArray()
                .catch(() => [] as Array<{ contactIds?: unknown[] }>),
            db
                .collection('crm_contacts')
                .countDocuments({
                    ...base,
                    $or: [
                        { newsletterSubscribed: true },
                        { 'subscriptions.newsletter': true },
                        { tags: 'newsletter' },
                    ],
                } as Record<string, unknown>)
                .catch(() => 0),
        ]);

        const ids = ((dealAgg[0] as { contactIds?: unknown[] } | undefined)?.contactIds ?? []).filter(
            (v) => v != null,
        );
        const withDeals = new Set(ids.map(String)).size;

        return {
            total,
            withDeals,
            newsletterSubscribed: Number(newsletterSubscribed) || 0,
            recentlyAdded,
        };
    } catch (e) {
        console.error('[getCrmContactKpis] failed:', e);
        return zero;
    }
}

export type BulkContactOp = 'delete' | 'status' | 'assign';

export async function bulkContactAction(
    ids: string[],
    op: BulkContactOp,
    payload?: string,
): Promise<{ success: boolean; processed: number; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, processed: 0, error: 'Access denied' };

    const validIds = (ids ?? []).filter(
        (id) => typeof id === 'string' && ObjectId.isValid(id),
    );
    if (validIds.length === 0) {
        return { success: false, processed: 0, error: 'No valid contact ids.' };
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);
        const filter = {
            _id: { $in: validIds.map((id) => new ObjectId(id)) },
            userId: userObjectId,
        };

        if (op === 'delete') {
            const r = await db.collection('crm_contacts').deleteMany(filter);
            revalidatePath('/dashboard/crm/contacts');
            return { success: true, processed: r.deletedCount ?? 0 };
        }
        if (op === 'status') {
            const allowed = new Set([
                'new_lead',
                'contacted',
                'qualified',
                'unqualified',
                'customer',
                'imported',
            ]);
            const status = (payload ?? '').trim();
            if (!allowed.has(status)) {
                return { success: false, processed: 0, error: 'Invalid status' };
            }
            const r = await db
                .collection('crm_contacts')
                .updateMany(filter, { $set: { status, updatedAt: new Date() } });
            revalidatePath('/dashboard/crm/contacts');
            return { success: true, processed: r.modifiedCount ?? 0 };
        }
        if (op === 'assign') {
            const assignedTo = (payload ?? '').trim();
            const r = await db.collection('crm_contacts').updateMany(filter, {
                $set: {
                    assignedTo: assignedTo || null,
                    updatedAt: new Date(),
                },
            });
            revalidatePath('/dashboard/crm/contacts');
            return { success: true, processed: r.modifiedCount ?? 0 };
        }
        return { success: false, processed: 0, error: 'Unknown op' };
    } catch (e) {
        return { success: false, processed: 0, error: getErrorMessage(e) };
    }
}
