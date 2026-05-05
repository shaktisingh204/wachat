'use server';

import { revalidatePath } from 'next/cache';
import type { WithId } from 'mongodb';
import type { Template, CreateTemplateState } from '@/lib/definitions';

export async function getTemplates(projectId: string): Promise<WithId<Template>[]> {
    if (!projectId) return [];
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const list = await rustClient.templates.list(projectId);
        return list as unknown as WithId<Template>[];
    } catch (e) {
        console.error('Failed to fetch templates:', e);
        return [];
    }
}

export async function handleSyncTemplates(projectId: string): Promise<{ message?: string, error?: string, count?: number }> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const r = await rustClient.templates.sync({ projectId });
        revalidatePath('/wachat/templates');
        const count = (r as any)?.upserted ?? (r as any)?.count ?? 0;
        return { message: `Successfully synced ${count} template(s).`, count };
    } catch (e: any) {
        return { error: e?.message ?? 'Sync failed' };
    }
}

export async function handleCreateTemplate(
    prevState: CreateTemplateState,
    formData: FormData
): Promise<CreateTemplateState> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        await rustClient.templates.create(formData as any);
        revalidatePath('/wachat/templates');
        return { message: 'Template submitted successfully!' };
    } catch (e: any) {
        return { error: e?.message ?? 'An unexpected error occurred.' };
    }
}

export async function handleBulkCreateTemplate(
    prevState: CreateTemplateState,
    formData: FormData
): Promise<CreateTemplateState> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const r: any = await rustClient.templates.bulkCreate(formData as any);
        revalidatePath('/wachat/templates');
        const applied = r?.applied ?? r?.successes ?? 0;
        const skipped = r?.skipped ?? 0;
        let message = `Template saved as 'LOCAL' for ${applied} project(s). They will be submitted by the next cron run.`;
        if (skipped > 0) message += ` Skipped ${skipped} project(s) (no access).`;
        return { message };
    } catch (e: any) {
        return { error: e?.message ?? 'An unexpected error occurred.' };
    }
}

export async function handleCreateFlowTemplate(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const r: any = await rustClient.templates.createFlow(formData as any);
        revalidatePath('/wachat/templates');
        return { message: `Template "${r?.name ?? ''}" created successfully and is now pending approval.` };
    } catch (e: any) {
        return { error: e?.message ?? 'An unexpected error occurred.' };
    }
}

export async function saveLibraryTemplate(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        await rustClient.templates.librarySave(formData as any);
        revalidatePath('/admin/dashboard/template-library');
        revalidatePath('/wachat/templates/library');
        return { message: `Template added to the library.` };
    } catch (e: any) {
        return { error: e?.message ?? 'An unexpected error occurred.' };
    }
}

export async function deleteLibraryTemplate(id: string): Promise<{ message?: string; error?: string }> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        await rustClient.templates.libraryDelete(id);
        revalidatePath('/admin/dashboard/template-library');
        revalidatePath('/wachat/templates/library');
        return { message: 'Custom template removed from the library.' };
    } catch (e: any) {
        return { error: e?.message ?? 'An unexpected error occurred.' };
    }
}

export async function getLibraryTemplates() {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const list = await rustClient.templates.libraryList();
        return list as unknown as any[];
    } catch (e) {
        console.error('Failed to fetch library templates:', e);
        return [];
    }
}

export async function handleApplyTemplateToProjects(sourceTemplateId: string, targetProjectIds: string[]): Promise<{ success: boolean, error?: string, applied?: number, skipped?: number }> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const r = await rustClient.templates.libraryApplyToProjects(sourceTemplateId, { targetProjectIds } as any);
        revalidatePath('/wachat/templates');
        return { success: true, applied: r.applied, skipped: r.skipped };
    } catch (e: any) {
        return { success: false, error: e?.message ?? 'An unexpected error occurred.' };
    }
}

export async function handleEditTemplate(
    prevState: any,
    formData: FormData
): Promise<{ message?: string; error?: string }> {
    try {
        const metaTemplateId = formData.get('metaTemplateId') as string;
        if (!metaTemplateId) return { error: 'Meta Template ID is required.' };
        const { rustClient } = await import('@/lib/rust-client');
        await rustClient.templates.edit(metaTemplateId, formData as any);
        revalidatePath('/wachat/templates');
        return { message: 'Template updated successfully and resubmitted for approval.' };
    } catch (e: any) {
        return { error: e?.message ?? 'An unexpected error occurred.' };
    }
}

export async function handleDeleteTemplate(
    projectId: string,
    templateName: string,
    metaTemplateId?: string
): Promise<{ message?: string; error?: string }> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        await rustClient.templates.deleteByName(projectId, templateName);
        revalidatePath('/wachat/templates');
        return { message: `Template "${templateName}" deleted successfully from Meta and local database.` };
    } catch (e: any) {
        return { error: e?.message ?? 'An unexpected error occurred.' };
    }
}

export async function handleDeleteTemplateById(
    projectId: string,
    metaTemplateId: string
): Promise<{ message?: string; error?: string }> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        await rustClient.templates.deleteById(metaTemplateId);
        revalidatePath('/wachat/templates');
        return { message: 'Template deleted successfully.' };
    } catch (e: any) {
        return { error: e?.message ?? 'An unexpected error occurred.' };
    }
}
