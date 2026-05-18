'use server';

/**
 * CRM Email Template server actions.
 *
 * **Dual implementation (read path only, for now):**
 *  - When `USE_RUST_CRM === 'true'`, `getEmailTemplateById` delegates to
 *    `/v1/crm/email-templates/:id` on the Rust BFF via
 *    `src/lib/rust-client/crm-email-templates.ts`.
 *  - On any failure (including non-404 errors), it falls back to the
 *    legacy direct-Mongo path against `crm_email_templates`.
 *
 * The legacy `saveCrmEmailTemplate`, `getCrmEmailTemplates`, and
 * `deleteCrmEmailTemplate` exports are unchanged.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import type { CrmEmailTemplate } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { crmEmailTemplatesApi } from '@/lib/rust-client/crm-email-templates';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

export async function getCrmEmailTemplates(): Promise<WithId<CrmEmailTemplate>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const templates = await db.collection<CrmEmailTemplate>('crm_email_templates')
            .find({ userId: new ObjectId(session.user._id) })
            .sort({ updatedAt: -1 })
            .toArray();
        return JSON.parse(JSON.stringify(templates));
    } catch (e) {
        console.error("Failed to fetch CRM email templates:", e);
        return [];
    }
}

export async function saveCrmEmailTemplate(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: "Access denied" };

    const templateId = formData.get('templateId') as string | null;
    const isEditing = !!templateId;

    try {
        const templateData: Partial<Omit<CrmEmailTemplate, '_id'>> = {
            userId: new ObjectId(session.user._id),
            name: formData.get('name') as string,
            subject: formData.get('subject') as string,
            body: formData.get('body') as string,
            updatedAt: new Date(),
        };

        if (!templateData.name || !templateData.subject || !templateData.body) {
            return { error: 'Name, subject, and body are required.' };
        }

        const { db } = await connectToDatabase();
        if (isEditing && ObjectId.isValid(templateId)) {
            await db.collection('crm_email_templates').updateOne(
                { _id: new ObjectId(templateId), userId: new ObjectId(session.user._id) },
                { $set: templateData }
            );
        } else {
            templateData.createdAt = new Date();
            await db.collection('crm_email_templates').insertOne(templateData as CrmEmailTemplate);
        }

        revalidatePath('/dashboard/crm/settings');
        return { message: 'Email template saved successfully.' };

    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteCrmEmailTemplate(templateId: string): Promise<{ success: boolean; error?: string }> {
    if (!ObjectId.isValid(templateId)) return { success: false, error: 'Invalid Template ID.' };

    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_email_templates').deleteOne({
            _id: new ObjectId(templateId),
            userId: new ObjectId(session.user._id)
        });

        if (result.deletedCount === 0) {
            return { success: false, error: 'Template not found or you do not have permission to delete it.' };
        }

        revalidatePath('/dashboard/crm/settings');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/**
 * Fetch a single email template by id. Honors the `USE_RUST_CRM` gate:
 * try the Rust BFF first; on any non-404 failure, fall through to the
 * legacy direct-Mongo path on `crm_email_templates`.
 */
export async function getEmailTemplateById(
    id: string,
): Promise<WithId<CrmEmailTemplate> | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!id) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmEmailTemplatesApi.getById(id);
            return doc
                ? (JSON.parse(JSON.stringify(doc)) as WithId<CrmEmailTemplate>)
                : null;
        } catch (e) {
            if (e instanceof RustApiError && e.status === 404) return null;
            console.error('[getEmailTemplateById] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'email_template',
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
            // fall through to legacy
        }
    }

    if (!ObjectId.isValid(id)) return null;

    try {
        const { db } = await connectToDatabase();
        const template = await db.collection<CrmEmailTemplate>('crm_email_templates').findOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id),
        });
        if (!template) return null;
        return JSON.parse(JSON.stringify(template));
    } catch (e) {
        console.error('Failed to fetch email template by id:', e);
        return null;
    }
}

/* ─── Legacy-name aliases (kept for the email-templates UI) ─────────── */
// These aliases re-export the canonical functions under their pre-rename
// names so the existing callers in
// `src/app/dashboard/crm/settings/email-templates/**` keep compiling.
// Drop these once every caller has been migrated to the `Crm`-prefixed
// names.
export async function getEmailTemplates(): Promise<WithId<CrmEmailTemplate>[]> {
    return getCrmEmailTemplates();
}
export async function saveEmailTemplate(
    prevState: any,
    formData: FormData,
): Promise<{ message?: string; error?: string }> {
    return saveCrmEmailTemplate(prevState, formData);
}
export async function deleteEmailTemplate(
    templateId: string,
): Promise<{ success: boolean; error?: string }> {
    return deleteCrmEmailTemplate(templateId);
}
