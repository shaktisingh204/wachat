'use server';

import { revalidatePath } from 'next/cache';

import {
    getLeadGenConfig,
    saveLeadGenConfig,
    deleteLeadGenForm,
    getLeadGenConfigForms,
    getLeadGenActivity,
} from '@/lib/rust-client/wachat-facebook-leadgen-config';
import type { LeadGenConfig } from '@/lib/rust-client/wachat-facebook-leadgen-config';
import {
    getFacebookPagesForAdCreation,
    listLeadGenForms,
} from '@/app/actions/ad-manager.actions';

/* Turbopack needs direct async-function exports in 'use server' files,
   so we wrap the rust-client calls. */
export async function getLeadGenConfigAction() {
    return getLeadGenConfig();
}
export async function getLeadGenConfigFormsAction() {
    return getLeadGenConfigForms();
}
export async function getLeadGenActivityAction() {
    return getLeadGenActivity();
}

export async function saveLeadGenConfigAction(config: Partial<LeadGenConfig>) {
    return saveLeadGenConfig(config);
}

export async function deleteLeadGenFormAction(formId: string) {
    return deleteLeadGenForm(formId);
}

const STANDARD_FB_FIELDS = [
    'full_name',
    'email',
    'phone_number',
    'company_name',
    'job_title',
] as const;

const DEFAULT_FB_TO_CRM: Record<string, string> = {
    full_name: 'firstName',
    email: 'email',
    phone_number: 'phone',
    company_name: 'company',
    job_title: 'title',
};

type FbPageSummary = { id: string; name: string };

type AutoSetupResult =
    | { ok: true; config: LeadGenConfig | null; pickedPage: FbPageSummary; importedFormCount: number }
    | { ok: false; needsMetaConnect: true; error?: string }
    | { ok: false; needsPagePick: true; pages: FbPageSummary[] }
    | { ok: false; error: string };

export async function autoSetupFacebookLeadGen(input?: {
    pageId?: string;
    defaultRouting?: { pipelineId: string; stage: string; assignedTo: string };
}): Promise<AutoSetupResult> {
    const pagesRes = await getFacebookPagesForAdCreation();
    if (pagesRes.error) {
        return { ok: false, needsMetaConnect: true, error: pagesRes.error };
    }
    const pages = (pagesRes.pages ?? []) as Array<{ id: string; name: string; access_token?: string }>;
    if (pages.length === 0) {
        return { ok: false, needsMetaConnect: true };
    }

    let chosen = pages.find((p) => p.id === input?.pageId);
    if (!chosen) {
        if (pages.length > 1 && !input?.pageId) {
            return {
                ok: false,
                needsPagePick: true,
                pages: pages.map((p) => ({ id: p.id, name: p.name })),
            };
        }
        chosen = pages[0];
    }

    if (!chosen.access_token) {
        return {
            ok: false,
            error: 'Selected Facebook page is missing an access token. Reconnect Meta and try again.',
        };
    }

    const existing = await getLeadGenConfig();
    const existingForms = existing.config?.forms ?? [];
    const existingByFormId = new Map(existingForms.map((f) => [f.formId, f]));

    const formsRes = await listLeadGenForms(chosen.id);
    if (formsRes.error) return { ok: false, error: formsRes.error };

    const defaultRouting = input?.defaultRouting ?? {
        pipelineId: '',
        stage: '',
        assignedTo: '',
    };

    const fbForms = (formsRes.data ?? []) as Array<{ id: string; name: string }>;
    const mergedForms = fbForms.map((f) => {
        const prior = existingByFormId.get(f.id);
        if (prior) return { ...prior, formName: f.name || prior.formName };
        return {
            formId: f.id,
            formName: f.name,
            fieldMapping: STANDARD_FB_FIELDS.map((fb) => ({
                fbField: fb,
                crmField: DEFAULT_FB_TO_CRM[fb] ?? 'ignore',
            })),
            defaultRouting: { ...defaultRouting },
            campaignRules: [],
        };
    });

    const saveRes = await saveLeadGenConfig({
        tenantId: existing.config?.tenantId ?? '',
        pageId: chosen.id,
        pageAccessToken: chosen.access_token,
        isActive: true,
        forms: mergedForms,
    });
    if (saveRes.error) return { ok: false, error: saveRes.error };

    revalidatePath('/dashboard/crm/settings/integrations/facebook-ads');
    revalidatePath('/dashboard/ad-manager/lead-forms');

    return {
        ok: true,
        config: saveRes.config,
        pickedPage: { id: chosen.id, name: chosen.name },
        importedFormCount: mergedForms.length,
    };
}

export async function disconnectFacebookLeadGen(): Promise<{ ok: boolean; error?: string }> {
    const existing = await getLeadGenConfig();
    if (!existing.config?.pageId) return { ok: true };
    const res = await saveLeadGenConfig({
        tenantId: existing.config.tenantId,
        pageId: existing.config.pageId,
        pageAccessToken: existing.config.pageAccessToken,
        isActive: false,
        forms: existing.config.forms,
    });
    if (res.error) return { ok: false, error: res.error };
    revalidatePath('/dashboard/crm/settings/integrations/facebook-ads');
    revalidatePath('/dashboard/ad-manager/lead-forms');
    return { ok: true };
}
