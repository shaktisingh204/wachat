'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { createHmac } from 'crypto';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import type { CrmForm, CrmContact, CrmDeal, User } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { getTransporter } from '@/lib/email-service';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { crmFormsApi } from '@/lib/rust-client/crm-forms';
import {
    crmFormSubmissionsApi,
    type CrmFormSubmissionDoc,
    type CrmFormSubmissionStatus,
} from '@/lib/rust-client/crm-form-submissions';
import { RustApiError } from '@/lib/rust-client/fetcher';

type AutoCreateMapping = Partial<Record<
    'name' | 'email' | 'phone' | 'dealName' | 'description' | 'leadSource',
    string
>>;

interface PostSubmitSettings {
    successMessage?: string;
    redirectUrl?: string;
    emailNotifications?: {
        enabled?: boolean;
        toEmails?: string[];
        subject?: string;
        bodyTemplate?: string;
    };
    webhook?: {
        enabled?: boolean;
        url?: string;
        secret?: string;
    };
    autoCreate?: {
        lead?: boolean;
        contact?: boolean;
        mapping?: AutoCreateMapping;
    };
}

// `{{fieldId}}` interpolation for email subject/body templates.
function interpolate(template: string, data: Record<string, unknown>): string {
    return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
        const v = data[key];
        if (v == null) return '';
        if (typeof v === 'object') return JSON.stringify(v);
        return String(v);
    });
}

function pickMapped(
    data: Record<string, unknown>,
    mapping: AutoCreateMapping | undefined,
    key: keyof AutoCreateMapping,
): unknown {
    const source = mapping?.[key];
    if (source && source in data) return data[source];
    return data[key];
}

async function dispatchPostSubmit(opts: {
    form: WithId<CrmForm>;
    user: WithId<User>;
    data: Record<string, unknown>;
    postSubmit: PostSubmitSettings | undefined;
}): Promise<void> {
    const { form, user, data, postSubmit } = opts;
    if (!postSubmit) return;

    if (postSubmit.emailNotifications?.enabled && postSubmit.emailNotifications.toEmails?.length) {
        try {
            const transporter = await getTransporter(user._id.toString());
            const subject = interpolate(
                postSubmit.emailNotifications.subject || `New submission: ${form.name}`,
                data,
            );
            const bodyTpl = postSubmit.emailNotifications.bodyTemplate
                || `New submission to ${form.name}:\n\n${Object.entries(data)
                    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
                    .join('\n')}`;
            const body = interpolate(bodyTpl, data);
            await transporter.sendMail({
                to: postSubmit.emailNotifications.toEmails.join(', '),
                subject,
                text: body,
            });
        } catch (e) {
            console.error('[handleFormSubmission] email notification failed:', e);
        }
    }

    if (postSubmit.webhook?.enabled && postSubmit.webhook.url) {
        try {
            const payload = JSON.stringify({
                formId: form._id.toString(),
                formName: form.name,
                submittedAt: new Date().toISOString(),
                data,
            });
            const secret = postSubmit.webhook.secret || '';
            const signature = secret
                ? createHmac('sha256', secret).update(payload).digest('hex')
                : '';
            await fetch(postSubmit.webhook.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(signature ? { 'X-Form-Webhook-Signature': signature } : {}),
                },
                body: payload,
            });
        } catch (e) {
            console.error('[handleFormSubmission] webhook dispatch failed:', e);
        }
    }
}

function useRustCrm(): boolean {
  return process.env.USE_RUST_CRM === 'true';
}

export async function getCrmForms(
    page: number = 1,
    limit: number = 20,
    query?: string
): Promise<{ forms: WithId<CrmForm>[], total: number }> {
    const session = await getSession();
    if (!session?.user) return { forms: [], total: 0 };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const filter: any = { userId: userObjectId };
        if (query) {
            filter.name = { $regex: query, $options: 'i' };
        }

        const skip = (page - 1) * limit;

        const [forms, total] = await Promise.all([
            db.collection<CrmForm>('crm_forms').find(filter as any).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
            db.collection('crm_forms').countDocuments(filter as any)
        ]);

        return {
            forms: JSON.parse(JSON.stringify(forms)),
            total
        };
    } catch (e: any) {
        console.error("Failed to fetch CRM forms:", e);
        return { forms: [], total: 0 };
    }
}

export async function saveCrmForm(data: {
    formId?: string;
    name: string;
    settings: any;
}): Promise<{ message?: string; error?: string; formId?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    if (!data.name) return { error: 'Form Name is required.' };

    const isNew = !data.formId || data.formId.startsWith('temp_');

    const formData: Omit<CrmForm, '_id' | 'createdAt'> = {
        name: data.name,
        userId: new ObjectId(session.user._id),
        fields: data.settings.fields || [],
        settings: data.settings,
        submissionCount: 0,
        updatedAt: new Date(),
    };

    try {
        const { db } = await connectToDatabase();
        if (isNew) {
            const result = await db.collection('crm_forms').insertOne({ ...formData, createdAt: new Date() } as any);
            revalidatePath('/dashboard/crm/sales-crm/forms');
            return { message: 'Form created successfully.', formId: result.insertedId.toString() };
        } else {
            await db.collection('crm_forms').updateOne(
                { _id: new ObjectId(data.formId), userId: new ObjectId(session.user._id) },
                { $set: formData }
            );
            revalidatePath('/dashboard/crm/sales-crm/forms');
            revalidatePath(`/dashboard/crm/sales-crm/forms/${data.formId}/edit`);
            return { message: 'Form updated successfully.', formId: data.formId };
        }
    } catch (e: any) {
        return { error: 'Failed to save form.' };
    }
}

export async function getCrmFormById(formId: string): Promise<WithId<CrmForm> | null> {
    if (!ObjectId.isValid(formId)) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmFormsApi.getById(formId);
            return JSON.parse(JSON.stringify(doc));
        } catch (e) {
            console.error('[getCrmFormById] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'form',
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const form = await db.collection<CrmForm>('crm_forms').findOne({ _id: new ObjectId(formId) });
        // Publicly accessible for embedding, no session check needed here.
        return form ? JSON.parse(JSON.stringify(form)) : null;
    } catch (e) {
        return null;
    }
}

export async function handleFormSubmission(
    formId: string,
    formData: Record<string, any>,
): Promise<{ success: boolean; message: string; error?: string; redirectUrl?: string }> {
    if (!ObjectId.isValid(formId)) {
        return { success: false, error: 'Invalid Form ID.', message: '' };
    }

    try {
        const { db } = await connectToDatabase();

        const form = await db.collection<WithId<CrmForm>>('crm_forms').findOne({ _id: new ObjectId(formId) });
        if (!form) {
            return { success: false, error: 'Form not found.', message: '' };
        }

        const user = await db.collection<WithId<User>>('users').findOne({ _id: form.userId });
        if (!user) {
            return { success: false, error: 'Form owner not found.', message: '' };
        }

        const postSubmit = (form.settings?.postSubmit as PostSubmitSettings | undefined) || undefined;
        const mapping = postSubmit?.autoCreate?.mapping;
        // Default to TRUE for back-compat: forms saved before the postSubmit tab existed
        // expect the old "always create lead/contact" behavior.
        const shouldCreateLead = postSubmit?.autoCreate?.lead ?? true;
        const shouldCreateContact = postSubmit?.autoCreate?.contact ?? true;

        await db.collection('crm_form_submissions').insertOne({
            formId: form._id,
            userId: form.userId,
            data: formData,
            submittedAt: new Date(),
        });

        const mappedEmail = pickMapped(formData, mapping, 'email') as string | undefined;
        const mappedName = pickMapped(formData, mapping, 'name') as string | undefined;
        const mappedPhone = pickMapped(formData, mapping, 'phone') as string | undefined;
        const mappedDealName = pickMapped(formData, mapping, 'dealName') as string | undefined;
        const mappedDescription = pickMapped(formData, mapping, 'description') as string | undefined;
        const mappedLeadSource = pickMapped(formData, mapping, 'leadSource') as string | undefined;

        let accountId: ObjectId | undefined;
        if (formData.organisation && (shouldCreateContact || shouldCreateLead)) {
            const account = await db.collection('crm_accounts').findOne({ name: formData.organisation, userId: form.userId });
            if (!account) {
                const newAccount = { userId: form.userId, name: formData.organisation, createdAt: new Date(), status: 'active' };
                const result = await db.collection('crm_accounts').insertOne(newAccount as any);
                accountId = result.insertedId;
            } else {
                accountId = account._id;
            }
        }

        let contact: WithId<CrmContact> | undefined;
        if (shouldCreateContact) {
            if (!mappedEmail) {
                return { success: false, error: 'Email is required in form submission.', message: '' };
            }
            const existingContact = await db.collection<CrmContact>('crm_contacts').findOne({ email: mappedEmail, userId: user._id });
            const contactData: Partial<CrmContact> = {
                userId: user._id,
                name: mappedName || mappedEmail,
                email: mappedEmail,
                phone: mappedPhone,
                company: formData.organisation,
                jobTitle: formData.designation,
                status: 'new_lead',
                leadSource: mappedLeadSource || `Form: ${form.name}`,
                createdAt: new Date(),
                accountId,
            };
            if (existingContact) {
                contact = existingContact;
            } else {
                const result = await db.collection('crm_contacts').insertOne(contactData as CrmContact);
                contact = { ...contactData, _id: result.insertedId } as WithId<CrmContact>;
            }
        }

        if (shouldCreateLead) {
            const defaultPipeline = (user.crmPipelines || [])[0];
            const defaultStage = defaultPipeline?.stages[0]?.name;
            const newDeal: Partial<CrmDeal> = {
                userId: user._id,
                name: mappedDealName || `Lead from ${form.name}`,
                stage: defaultStage,
                description: mappedDescription,
                accountId,
                contactIds: contact ? [contact._id] : [],
                createdAt: new Date(),
                value: 0,
                currency: 'INR',
                pipelineId: defaultPipeline?.id,
                leadSource: mappedLeadSource || `Form: ${form.name}`,
            };
            await db.collection('crm_deals').insertOne(newDeal as any);
        }

        await db.collection('crm_forms').updateOne({ _id: form._id }, { $inc: { submissionCount: 1 } });

        // Fire-and-forget side effects. We awaited each so failures land in server logs,
        // but their errors never propagate to the caller.
        await dispatchPostSubmit({ form, user, data: formData, postSubmit });

        revalidatePath('/dashboard/crm/sales-crm/all-leads');
        revalidatePath('/dashboard/crm/deals');

        const successMessage =
            postSubmit?.successMessage
            || form.settings?.successMessage
            || 'Submission successful.';

        return {
            success: true,
            message: successMessage,
            redirectUrl: postSubmit?.redirectUrl || undefined,
        };
    } catch (e) {
        console.error('CRM Form Submission API Error:', e);
        return { success: false, error: getErrorMessage(e), message: '' };
    }
}

/**
 * Fetch a single form submission document scoped to the current user.
 *
 * Dual-impl: routes through the Rust BFF when `USE_RUST_CRM=true`, falls
 * back to the Mongo driver on error.
 */
export async function getFormSubmissionById(
    id: string,
): Promise<WithId<Record<string, unknown>> | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!ObjectId.isValid(id)) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmFormSubmissionsApi.getById(id);
            return JSON.parse(JSON.stringify(doc));
        } catch (e) {
            console.error('[getFormSubmissionById] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'form_submission',
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection('crm_form_submissions').findOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id),
        });
        if (!doc) return null;
        return JSON.parse(JSON.stringify(doc));
    } catch (e) {
        console.error('Failed to fetch form submission by id:', e);
        return null;
    }
}

/* ─── deleteCrmForm ──────────────────────────────────────────────────── */

export async function deleteCrmForm(
    formId: string,
): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };
    if (!ObjectId.isValid(formId)) return { error: 'Invalid Form ID.' };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);
        const formObjectId = new ObjectId(formId);

        const existing = await db
            .collection('crm_forms')
            .findOne({ _id: formObjectId, userId: userObjectId });
        if (!existing) return { error: 'Form not found or you do not have access.' };

        await db.collection('crm_forms').deleteOne({ _id: formObjectId });
        await db
            .collection('crm_form_submissions')
            .deleteMany({ formId: formObjectId } as any);

        revalidatePath('/dashboard/crm/sales-crm/custom-forms');
        return { message: 'Form deleted.' };
    } catch (e) {
        return { error: 'Failed to delete form.' };
    }
}

/* ─── getCrmFormKpis ─────────────────────────────────────────────────── */

interface CrmFormKpis {
    total: number;
    published: number;
    drafts: number;
    totalSubmissions: number;
}

export async function getCrmFormKpis(): Promise<CrmFormKpis> {
    const empty: CrmFormKpis = { total: 0, published: 0, drafts: 0, totalSubmissions: 0 };
    const session = await getSession();
    if (!session?.user) return empty;

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const [total, published, drafts, submissionsAgg] = await Promise.all([
            db.collection('crm_forms').countDocuments({ userId: userObjectId } as any),
            db
                .collection('crm_forms')
                .countDocuments({
                    userId: userObjectId,
                    'settings.status': 'published',
                } as any),
            db
                .collection('crm_forms')
                .countDocuments({
                    userId: userObjectId,
                    $or: [
                        { 'settings.status': 'draft' },
                        { 'settings.status': { $exists: false } },
                        { 'settings.status': null },
                    ],
                } as any),
            db
                .collection('crm_forms')
                .aggregate([
                    { $match: { userId: userObjectId } },
                    {
                        $group: {
                            _id: null,
                            total: { $sum: { $ifNull: ['$submissionCount', 0] } },
                        },
                    },
                ])
                .toArray(),
        ]);

        return {
            total,
            published,
            drafts,
            totalSubmissions: Number(submissionsAgg?.[0]?.total ?? 0),
        };
    } catch (e) {
        console.error('Failed to fetch CRM form KPIs:', e);
        return empty;
    }
}

/* ─── bulkFormAction ─────────────────────────────────────────────────── */

export async function bulkFormAction(
    ids: string[],
    op: 'delete' | 'publish' | 'draft' | 'archive',
): Promise<{ success: boolean; processed?: number; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!Array.isArray(ids) || ids.length === 0) return { success: false, error: 'No ids.' };

    const validIds = ids.filter((id) => ObjectId.isValid(id));
    if (validIds.length === 0) return { success: false, error: 'No valid ids.' };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);
        const objectIds = validIds.map((id) => new ObjectId(id));
        const match = { _id: { $in: objectIds }, userId: userObjectId } as any;

        if (op === 'delete') {
            const result = await db.collection('crm_forms').deleteMany(match);
            await db
                .collection('crm_form_submissions')
                .deleteMany({ formId: { $in: objectIds } } as any);
            revalidatePath('/dashboard/crm/sales-crm/custom-forms');
            return { success: true, processed: result.deletedCount ?? 0 };
        }
        if (op === 'publish' || op === 'draft' || op === 'archive') {
            const status = op === 'publish' ? 'published' : op === 'draft' ? 'draft' : 'archived';
            const result = await db
                .collection('crm_forms')
                .updateMany(match, {
                    $set: {
                        'settings.status': status,
                        updatedAt: new Date(),
                    },
                });
            revalidatePath('/dashboard/crm/sales-crm/custom-forms');
            return { success: true, processed: result.modifiedCount ?? 0 };
        }
        return { success: false, error: 'Unsupported op.' };
    } catch (e) {
        return { success: false, error: 'Bulk operation failed.' };
    }
}

/* ─── Legacy-name aliases used by the CustomFormForm UI ─────────────── */

interface SaveFormState {
    message?: string;
    error?: string;
    id?: string;
}

export async function getFormById(
    formId: string,
): Promise<WithId<CrmForm> | null> {
    return getCrmFormById(formId);
}

/**
 * `useActionState`-compatible wrapper around `saveCrmForm`. Decodes the
 * form fields posted by `<CustomFormForm />` (name, slug, status,
 * captcha, successMessage, redirectUrl) into the `data` shape that
 * `saveCrmForm` expects.
 */
export async function saveForm(
    _prevState: SaveFormState | undefined,
    formData: FormData,
): Promise<SaveFormState> {
    const formId = (formData.get('formId') as string | null) || undefined;
    const name = (formData.get('name') as string | null)?.trim() || '';
    if (!name) return { error: 'Form name is required.' };

    const slug = (formData.get('slug') as string | null) || undefined;
    const status = (formData.get('status') as string | null) || 'draft';
    const captcha = formData.get('captcha') === 'true';
    const successMessage =
        (formData.get('successMessage') as string | null) || undefined;
    const redirectUrl =
        (formData.get('redirectUrl') as string | null) || undefined;

    const settings: Record<string, unknown> = {
        slug,
        status,
        captcha,
        successMessage,
        redirectUrl,
        fields: [],
    };

    const result = await saveCrmForm({ formId, name, settings });
    return {
        message: result.message,
        error: result.error,
        id: result.formId,
    };
}

/* ─── Submissions inbox actions ─────────────────────────────────────── */

type FormSubmissionStatusFilter = 'all' | CrmFormSubmissionStatus;

interface GetFormSubmissionsParams {
    formId: string;
    page?: number;
    limit?: number;
    q?: string;
    status?: FormSubmissionStatusFilter;
    from?: string;
    to?: string;
}

interface GetFormSubmissionsResult {
    items: CrmFormSubmissionDoc[];
    total: number;
    page: number;
    hasMore: boolean;
}

export async function getFormSubmissions(
    params: GetFormSubmissionsParams,
): Promise<GetFormSubmissionsResult> {
    const session = await getSession();
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(Math.max(1, params.limit ?? 25), 200);
    const empty: GetFormSubmissionsResult = { items: [], total: 0, page, hasMore: false };

    if (!session?.user) return empty;
    if (!ObjectId.isValid(params.formId)) return empty;

    const status: FormSubmissionStatusFilter = params.status ?? 'all';

    if (useRustCrm()) {
        try {
            const res = await crmFormSubmissionsApi.list({
                formId: params.formId,
                page,
                limit,
                q: params.q || undefined,
                status: status === 'all' ? undefined : status,
            });
            return {
                items: JSON.parse(JSON.stringify(res.items)),
                total: res.items.length + (res.hasMore ? page * limit : (page - 1) * limit),
                page: res.page,
                hasMore: res.hasMore,
            };
        } catch (e) {
            console.error('[getFormSubmissions] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'form_submission',
                op: 'list',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);
        const filter: Filter<Record<string, unknown>> = {
            formId: new ObjectId(params.formId),
            userId: userObjectId,
        };
        if (status !== 'all') {
            (filter as Record<string, unknown>).status = status;
        }
        if (params.q && params.q.trim().length > 0) {
            const rx = { $regex: params.q.trim(), $options: 'i' };
            (filter as Record<string, unknown>).$or = [
                { sourceUrl: rx },
                { ipAddress: rx },
                { 'data.email': rx },
                { 'data.name': rx },
                { 'data.phone': rx },
            ];
        }
        const dateFilter: Record<string, Date> = {};
        if (params.from) {
            const d = new Date(params.from);
            if (!Number.isNaN(d.getTime())) dateFilter.$gte = d;
        }
        if (params.to) {
            const d = new Date(params.to);
            if (!Number.isNaN(d.getTime())) {
                d.setHours(23, 59, 59, 999);
                dateFilter.$lte = d;
            }
        }
        if (Object.keys(dateFilter).length > 0) {
            (filter as Record<string, unknown>).createdAt = dateFilter;
            (filter as Record<string, unknown>).$or = (filter as any).$or; // preserve
        }

        const skip = (page - 1) * limit;
        const [rows, total] = await Promise.all([
            db
                .collection('crm_form_submissions')
                .find(filter as any)
                .sort({ createdAt: -1, submittedAt: -1, _id: -1 })
                .skip(skip)
                .limit(limit)
                .toArray(),
            db.collection('crm_form_submissions').countDocuments(filter as any),
        ]);

        const items = rows.map((r) => {
            const created = (r as any).createdAt ?? (r as any).submittedAt ?? null;
            return {
                _id: String((r as any)._id),
                userId: (r as any).userId ? String((r as any).userId) : undefined,
                formId: (r as any).formId ? String((r as any).formId) : params.formId,
                data: (r as any).data ?? {},
                sourceUrl: (r as any).sourceUrl,
                ipAddress: (r as any).ipAddress,
                userAgent: (r as any).userAgent,
                referrer: (r as any).referrer,
                status: ((r as any).status as CrmFormSubmissionStatus) ?? 'new',
                processedAt: (r as any).processedAt
                    ? new Date((r as any).processedAt).toISOString()
                    : undefined,
                notes: (r as any).notes,
                createdAt: created ? new Date(created).toISOString() : undefined,
                updatedAt: (r as any).updatedAt
                    ? new Date((r as any).updatedAt).toISOString()
                    : undefined,
            } satisfies CrmFormSubmissionDoc;
        });

        return {
            items,
            total,
            page,
            hasMore: skip + items.length < total,
        };
    } catch (e) {
        console.error('Failed to list form submissions:', e);
        return empty;
    }
}

async function patchSubmissionMongo(
    submissionId: string,
    patch: Record<string, unknown>,
): Promise<boolean> {
    const session = await getSession();
    if (!session?.user) return false;
    if (!ObjectId.isValid(submissionId)) return false;
    try {
        const { db } = await connectToDatabase();
        const res = await db.collection('crm_form_submissions').updateOne(
            {
                _id: new ObjectId(submissionId),
                userId: new ObjectId(session.user._id),
            },
            { $set: { ...patch, updatedAt: new Date() } },
        );
        return res.matchedCount > 0;
    } catch (e) {
        console.error('patchSubmissionMongo failed:', e);
        return false;
    }
}

export async function updateSubmissionStatus(
    submissionId: string,
    status: CrmFormSubmissionStatus,
): Promise<{ success: boolean; error?: string }> {
    if (!ObjectId.isValid(submissionId)) {
        return { success: false, error: 'Invalid submission id.' };
    }

    if (useRustCrm()) {
        try {
            await crmFormSubmissionsApi.update(submissionId, {
                status,
                processedAt: status === 'processed' ? new Date().toISOString() : undefined,
            });
            revalidatePath('/dashboard/crm/sales-crm/forms', 'layout');
            return { success: true };
        } catch (e) {
            console.error('[updateSubmissionStatus] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'form_submission',
                op: 'update',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    const patch: Record<string, unknown> = { status };
    if (status === 'processed') patch.processedAt = new Date();
    const ok = await patchSubmissionMongo(submissionId, patch);
    if (!ok) return { success: false, error: 'Submission not found.' };
    revalidatePath('/dashboard/crm/sales-crm/forms', 'layout');
    return { success: true };
}

export async function updateSubmissionTags(
    submissionId: string,
    tags: string[],
): Promise<{ success: boolean; error?: string }> {
    if (!ObjectId.isValid(submissionId)) {
        return { success: false, error: 'Invalid submission id.' };
    }

    if (useRustCrm()) {
        try {
            await crmFormSubmissionsApi.update(submissionId, { tags });
            revalidatePath('/dashboard/crm/sales-crm/forms', 'layout');
            return { success: true };
        } catch (e) {
            console.error('[updateSubmissionTags] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'form_submission',
                op: 'update',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    const ok = await patchSubmissionMongo(submissionId, { tags });
    if (!ok) return { success: false, error: 'Submission not found.' };
    revalidatePath('/dashboard/crm/sales-crm/forms', 'layout');
    return { success: true };
}

export async function deleteSubmission(
    submissionId: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!ObjectId.isValid(submissionId)) {
        return { success: false, error: 'Invalid submission id.' };
    }

    if (useRustCrm()) {
        try {
            await crmFormSubmissionsApi.delete(submissionId);
            revalidatePath('/dashboard/crm/sales-crm/forms', 'layout');
            return { success: true };
        } catch (e) {
            console.error('[deleteSubmission] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'form_submission',
                op: 'delete',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const res = await db.collection('crm_form_submissions').deleteOne({
            _id: new ObjectId(submissionId),
            userId: new ObjectId(session.user._id),
        });
        if (res.deletedCount === 0) return { success: false, error: 'Submission not found.' };
        revalidatePath('/dashboard/crm/sales-crm/forms', 'layout');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

async function loadSubmissionForConversion(
    submissionId: string,
): Promise<{ doc: Record<string, unknown> | null; userId: ObjectId | null }> {
    const session = await getSession();
    if (!session?.user) return { doc: null, userId: null };
    if (!ObjectId.isValid(submissionId)) return { doc: null, userId: null };
    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        const doc = await db.collection('crm_form_submissions').findOne({
            _id: new ObjectId(submissionId),
            userId,
        });
        return { doc: doc as Record<string, unknown> | null, userId };
    } catch (e) {
        console.error('loadSubmissionForConversion failed:', e);
        return { doc: null, userId: null };
    }
}

export async function convertSubmissionToContact(
    submissionId: string,
): Promise<{ success: boolean; contactId?: string; error?: string }> {
    const { doc, userId } = await loadSubmissionForConversion(submissionId);
    if (!doc || !userId) return { success: false, error: 'Submission not found.' };

    const data = ((doc as any).data ?? {}) as Record<string, unknown>;
    const email = (data.email as string | undefined)?.trim();
    if (!email) return { success: false, error: 'Submission has no email field.' };

    try {
        const { db } = await connectToDatabase();
        const existing = await db
            .collection<CrmContact>('crm_contacts')
            .findOne({ email, userId });
        if (existing) {
            await updateSubmissionStatus(submissionId, 'processed');
            return { success: true, contactId: String(existing._id) };
        }

        const formName =
            typeof (doc as any).formName === 'string'
                ? ((doc as any).formName as string)
                : undefined;

        const contactDoc: Partial<CrmContact> = {
            userId,
            name: (data.name as string) || email,
            email,
            phone: data.phone as string | undefined,
            company: (data.organisation as string | undefined) ?? (data.company as string | undefined),
            jobTitle: data.designation as string | undefined,
            status: 'new_lead',
            leadSource: (data.leadSource as string) || (formName ? `Form: ${formName}` : 'Form'),
            createdAt: new Date(),
        };
        const result = await db
            .collection('crm_contacts')
            .insertOne(contactDoc as CrmContact);
        await updateSubmissionStatus(submissionId, 'processed');
        revalidatePath('/dashboard/crm/sales-crm/all-leads');
        return { success: true, contactId: String(result.insertedId) };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function convertSubmissionToLead(
    submissionId: string,
): Promise<{ success: boolean; leadId?: string; error?: string }> {
    const { doc, userId } = await loadSubmissionForConversion(submissionId);
    if (!doc || !userId) return { success: false, error: 'Submission not found.' };

    const data = ((doc as any).data ?? {}) as Record<string, unknown>;
    const email = (data.email as string | undefined)?.trim();

    try {
        const { db } = await connectToDatabase();

        const user = await db.collection<WithId<User>>('users').findOne({ _id: userId });
        const defaultPipeline = (user?.crmPipelines || [])[0];
        const defaultStage = defaultPipeline?.stages[0]?.name;

        let contactId: ObjectId | undefined;
        if (email) {
            const existing = await db
                .collection<CrmContact>('crm_contacts')
                .findOne({ email, userId });
            if (existing) {
                contactId = existing._id;
            } else {
                const contactDoc: Partial<CrmContact> = {
                    userId,
                    name: (data.name as string) || email,
                    email,
                    phone: data.phone as string | undefined,
                    company: (data.organisation as string | undefined) ?? (data.company as string | undefined),
                    jobTitle: data.designation as string | undefined,
                    status: 'new_lead',
                    leadSource: 'Form submission',
                    createdAt: new Date(),
                };
                const r = await db
                    .collection('crm_contacts')
                    .insertOne(contactDoc as CrmContact);
                contactId = r.insertedId;
            }
        }

        const formName =
            typeof (doc as any).formName === 'string'
                ? ((doc as any).formName as string)
                : 'Form submission';

        const newDeal: Partial<CrmDeal> = {
            userId,
            name: (data.dealName as string | undefined) || `Lead from ${formName}`,
            stage: defaultStage,
            description: data.description as string | undefined,
            contactIds: contactId ? [contactId] : [],
            createdAt: new Date(),
            value: 0,
            currency: 'INR',
            pipelineId: defaultPipeline?.id,
            leadSource: `Form: ${formName}`,
        };
        const result = await db.collection('crm_deals').insertOne(newDeal as any);
        await updateSubmissionStatus(submissionId, 'processed');
        revalidatePath('/dashboard/crm/sales-crm/all-leads');
        revalidatePath('/dashboard/crm/deals');
        return { success: true, leadId: String(result.insertedId) };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

function csvEscape(v: unknown): string {
    if (v == null) return '';
    const s = typeof v === 'string' ? v : typeof v === 'object' ? JSON.stringify(v) : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

export async function exportSubmissions(
    formId: string,
    format: 'csv' | 'xlsx',
    filters?: { q?: string; status?: FormSubmissionStatusFilter; from?: string; to?: string },
): Promise<{
    success: boolean;
    data?: string;
    filename: string;
    mimeType: string;
    error?: string;
}> {
    const session = await getSession();
    if (!session?.user) {
        return { success: false, filename: '', mimeType: '', error: 'Access denied.' };
    }
    if (!ObjectId.isValid(formId)) {
        return { success: false, filename: '', mimeType: '', error: 'Invalid form id.' };
    }

    const form = await getCrmFormById(formId);
    if (!form) {
        return { success: false, filename: '', mimeType: '', error: 'Form not found.' };
    }

    const all: CrmFormSubmissionDoc[] = [];
    let page = 1;
    const limit = 200;
    while (page < 500) {
        const chunk = await getFormSubmissions({
            formId,
            page,
            limit,
            q: filters?.q,
            status: filters?.status ?? 'all',
            from: filters?.from,
            to: filters?.to,
        });
        all.push(...chunk.items);
        if (!chunk.hasMore || chunk.items.length === 0) break;
        page += 1;
    }

    const fields: Array<{ name: string; label?: string }> = Array.isArray(form.fields)
        ? form.fields
              .map((f: any) => ({
                  name: typeof f?.name === 'string' ? f.name : typeof f?.id === 'string' ? f.id : '',
                  label: typeof f?.label === 'string' ? f.label : undefined,
              }))
              .filter((f) => f.name)
        : [];

    if (fields.length === 0) {
        const keySet = new Set<string>();
        for (const s of all) {
            const data = (s.data ?? {}) as Record<string, unknown>;
            for (const k of Object.keys(data)) keySet.add(k);
        }
        for (const k of keySet) fields.push({ name: k, label: k });
    }

    const metaHeaders = ['Submitted At', 'Status', 'Source URL', 'IP Address'];
    const fieldHeaders = fields.map((f) => f.label || f.name);
    const headerRow = [...fieldHeaders, ...metaHeaders];

    const rows = all.map((s) => {
        const data = (s.data ?? {}) as Record<string, unknown>;
        return [
            ...fields.map((f) => data[f.name]),
            s.createdAt ?? '',
            s.status ?? '',
            s.sourceUrl ?? '',
            s.ipAddress ?? '',
        ];
    });

    const date = new Date().toISOString().slice(0, 10);
    const safeFormName = (form.name || 'form').replace(/[^a-z0-9-_]+/gi, '-');

    if (format === 'csv') {
        const csv = [
            headerRow.map(csvEscape).join(','),
            ...rows.map((r) => r.map(csvEscape).join(',')),
        ].join('\n');
        const b64 = Buffer.from(csv, 'utf-8').toString('base64');
        return {
            success: true,
            data: b64,
            filename: `${safeFormName}-submissions-${date}.csv`,
            mimeType: 'text/csv;charset=utf-8',
        };
    }

    try {
        const ExcelJS = (await import('exceljs')).default;
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Submissions');
        [headerRow, ...rows].forEach((row) => worksheet.addRow(row));
        const buf = Buffer.from(await workbook.xlsx.writeBuffer());
        return {
            success: true,
            data: buf.toString('base64'),
            filename: `${safeFormName}-submissions-${date}.xlsx`,
            mimeType:
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        };
    } catch (e) {
        console.error('xlsx export failed, falling back to csv-as-xlsx:', e);
        const csv = [
            headerRow.map(csvEscape).join(','),
            ...rows.map((r) => r.map(csvEscape).join(',')),
        ].join('\n');
        return {
            success: true,
            data: Buffer.from(csv, 'utf-8').toString('base64'),
            filename: `${safeFormName}-submissions-${date}.xlsx`,
            mimeType:
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        };
    }
}
