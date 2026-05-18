'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import type { CrmForm, CrmContact, CrmDeal, User } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { crmFormsApi } from '@/lib/rust-client/crm-forms';
import { crmFormSubmissionsApi } from '@/lib/rust-client/crm-form-submissions';
import { RustApiError } from '@/lib/rust-client/fetcher';

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

export async function handleFormSubmission(formId: string, formData: Record<string, any>): Promise<{ success: boolean; message: string; error?: string }> {
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

        // Log the submission
        await db.collection('crm_form_submissions').insertOne({
            formId: form._id,
            userId: form.userId,
            data: formData,
            submittedAt: new Date(),
        });

        // Find or create account
        let accountId: ObjectId | undefined;
        if (formData.organisation) {
            let account = await db.collection('crm_accounts').findOne({ name: formData.organisation, userId: form.userId });
            if (!account) {
                const newAccount = { userId: form.userId, name: formData.organisation, createdAt: new Date(), status: 'active' };
                const result = await db.collection('crm_accounts').insertOne(newAccount as any);
                accountId = result.insertedId;
            } else {
                accountId = account._id;
            }
        }

        // Find or create contact
        const email = formData.email as string;
        if (!email) return { success: false, error: "Email is required in form submission.", message: '' };

        let contact: WithId<CrmContact>;
        const existingContact = await db.collection<CrmContact>('crm_contacts').findOne({ email, userId: user._id });

        const contactData: Partial<CrmContact> = {
            userId: user._id,
            name: formData.name || email,
            email: email,
            phone: formData.phone,
            company: formData.organisation,
            jobTitle: formData.designation,
            status: 'new_lead',
            leadSource: formData.leadSource || `Form: ${form.name}`,
            createdAt: new Date(),
            accountId: accountId,
        };

        if (existingContact) {
            contact = existingContact;
        } else {
            const result = await db.collection('crm_contacts').insertOne(contactData as CrmContact);
            contact = { ...contactData, _id: result.insertedId } as WithId<CrmContact>;
        }

        const defaultPipeline = (user.crmPipelines || [])[0];
        const defaultStage = defaultPipeline?.stages[0]?.name;

        // Create the deal
        const newDeal: Partial<CrmDeal> = {
            userId: user._id,
            name: formData.dealName || `Lead from ${form.name}`,
            stage: defaultStage,
            description: formData.description,
            accountId: accountId,
            contactIds: [contact._id],
            createdAt: new Date(),
            value: 0,
            currency: 'INR', // Default currency
            pipelineId: defaultPipeline?.id,
            leadSource: `Form: ${form.name}`,
        };

        await db.collection('crm_deals').insertOne(newDeal as any);
        await db.collection('crm_forms').updateOne({ _id: form._id }, { $inc: { submissionCount: 1 } });

        revalidatePath('/dashboard/crm/sales-crm/all-leads');
        revalidatePath('/dashboard/crm/deals');

        return { success: true, message: form.settings.successMessage || 'Submission successful.' };
    } catch (e) {
        console.error("CRM Form Submission API Error:", e);
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

/* ─── Legacy-name aliases used by the CustomFormForm UI ─────────────── */

export interface SaveFormState {
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
