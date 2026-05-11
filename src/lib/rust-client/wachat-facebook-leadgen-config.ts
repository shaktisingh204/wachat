import 'server-only';
import { rustFetch } from './fetcher';

export interface FieldMapping {
    fbField: string;
    crmField: string;
}

export interface Routing {
    pipelineId: string;
    stage: string;
    assignedTo: string;
}

export interface CampaignRule {
    campaignId?: string;
    adsetId?: string;
    pipelineId: string;
    stage: string;
    assignedTo: string;
}

export interface FormConfig {
    formId: string;
    formName: string;
    fieldMapping: FieldMapping[];
    defaultRouting: Routing;
    campaignRules: CampaignRule[];
}

export interface LeadGenConfig {
    _id?: string;
    tenantId: string;
    pageId: string;
    pageAccessToken: string;
    isActive: boolean;
    forms: FormConfig[];
    createdAt?: string;
    updatedAt?: string;
}

export interface LeadGenForm {
    id: string;
    name: string;
    status: string;
    leads_count?: number;
    created_time: string;
}

export interface ActivityEntry {
    _id?: string;
    tenantId: string;
    timestamp: string;
    formId: string;
    formName: string;
    facebookLeadId: string;
    crmLeadId?: string;
    leadName: string;
    status: 'created' | 'skipped' | 'error';
    errorMessage?: string;
}

export async function getLeadGenConfig(): Promise<{ config: LeadGenConfig | null; error?: string }> {
    return rustFetch('/v1/facebook/lead-gen/config');
}

export async function saveLeadGenConfig(config: Partial<LeadGenConfig>): Promise<{ config: LeadGenConfig | null; error?: string }> {
    return rustFetch('/v1/facebook/lead-gen/config', {
        method: 'POST',
        body: JSON.stringify(config),
    });
}

export async function deleteLeadGenForm(formId: string): Promise<{ config: LeadGenConfig | null; error?: string }> {
    return rustFetch(`/v1/facebook/lead-gen/config/${encodeURIComponent(formId)}`, {
        method: 'DELETE',
    });
}

export async function getLeadGenConfigForms(): Promise<{ forms: LeadGenForm[] | null; error?: string }> {
    return rustFetch('/v1/facebook/lead-gen/config/forms');
}

export async function getLeadGenActivity(): Promise<{ entries: ActivityEntry[]; error?: string }> {
    return rustFetch('/v1/facebook/lead-gen/activity');
}
