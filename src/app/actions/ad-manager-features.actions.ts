'use server';

/**
 * Server-action shim for the "extra features" surface of Ad Manager —
 * automated rules, custom conversions, catalog browse, campaign
 * comparison, budget recommendations, conversion funnel, etc.
 *
 * All Meta Graph traffic now lands on the Rust BFF
 * (`/v1/ad-manager/graph`); the bodies here are thin marshallers that
 * preserve the legacy `useFormState` envelopes (`{ message, error }`,
 * `{ rules, error }`, `{ catalogs, error }`, …).
 */
import { revalidatePath } from 'next/cache';

import { rustClient, RustApiError } from '@/lib/rust-client';

function rustErr(e: unknown): string {
    if (e instanceof RustApiError) return e.message;
    if (e instanceof Error) return e.message;
    return 'An unexpected error occurred.';
}

function withAct(id: string): string {
    return id.startsWith('act_') ? id : `act_${id}`;
}

async function graph<T = any>(
    path: string,
    opts: {
        method?: 'GET' | 'POST' | 'DELETE';
        params?: Record<string, unknown>;
        body?: Record<string, unknown>;
        tokenKind?: 'adManager' | 'metaSuite';
    } = {},
): Promise<{ data?: T; error?: string }> {
    try {
        const res = await rustClient.adManager.graph<T>({
            path: path.replace(/^\//, ''),
            method: opts.method,
            params: opts.params,
            body: opts.body,
            tokenKind: opts.tokenKind,
        });
        if (res.error) return { error: res.error };
        return { data: res.data };
    } catch (e) {
        return { error: rustErr(e) };
    }
}

// =================================================================
//  AUTOMATED RULES
// =================================================================

export async function getAutomatedRules(adAccountId: string) {
    const res = await graph<{ data: any[] }>(`${withAct(adAccountId)}/adrules_library`, {
        params: {
            fields: 'id,name,status,evaluation_spec,execution_spec,schedule_spec,created_time,updated_time',
            limit: 50,
        },
    });
    if (res.error) return { error: res.error };
    return { rules: res.data?.data || [] };
}

export async function createAutomatedRule(_prevState: any, formData: FormData) {
    try {
        const res = await rustClient.adManager.fromFormCreateAutomatedRule(formData);
        if (!res.error) revalidatePath('/dashboard/ad-manager/automated-rules');
        return res;
    } catch (e) {
        return { error: rustErr(e) };
    }
}

export async function deleteAutomatedRule(ruleId: string) {
    const res = await graph(ruleId, { method: 'DELETE' });
    if (res.error) return { success: false, error: res.error };
    revalidatePath('/dashboard/ad-manager/automated-rules');
    return { success: true };
}

// =================================================================
//  CUSTOM CONVERSIONS
// =================================================================

export async function createCustomConversion(_prevState: any, formData: FormData) {
    try {
        const res = await rustClient.adManager.fromFormCreateCustomConversion(formData);
        if (!res.error) revalidatePath('/dashboard/ad-manager/custom-conversions');
        return res;
    } catch (e) {
        return { error: rustErr(e) };
    }
}

export async function deleteCustomConversion(conversionId: string) {
    const res = await graph(conversionId, { method: 'DELETE' });
    if (res.error) return { success: false, error: res.error };
    revalidatePath('/dashboard/ad-manager/custom-conversions');
    return { success: true };
}

// =================================================================
//  CATALOGS
// =================================================================

export async function getAdCatalogs(adAccountId: string) {
    const res = await graph<{ data: any[] }>(`${withAct(adAccountId)}/owned_product_catalogs`, {
        params: { fields: 'id,name,product_count,vertical', limit: 50 },
    });
    if (res.error) return { error: res.error };
    return { catalogs: res.data?.data || [] };
}

export async function createAdCatalog(adAccountId: string, name: string) {
    const accRes = await graph<any>(`${withAct(adAccountId)}`, {
        params: { fields: 'business{id}' },
    });
    if (accRes.error) return { error: accRes.error };
    const businessId = accRes.data?.business?.id;
    if (!businessId) return { error: 'No business found for this ad account.' };

    const res = await graph(`${businessId}/owned_product_catalogs`, {
        method: 'POST',
        body: { name },
    });
    if (res.error) return { error: res.error };
    revalidatePath('/dashboard/ad-manager/catalogs');
    return { message: `Catalog "${name}" created.` };
}

// =================================================================
//  CAMPAIGN COMPARISON
// =================================================================

export async function compareCampaigns(campaignIds: string[]) {
    // Fully Rust: parallel Graph fan-out + reshape happens server-side.
    try {
        const res = await rustClient.adManager.compareCampaigns(campaignIds);
        if (res.error) return { error: res.error };
        return { comparisons: res.comparisons };
    } catch (e) {
        return { error: rustErr(e) };
    }
}

// =================================================================
//  BUDGET RECOMMENDATIONS
// =================================================================

export async function getBudgetRecommendations(adAccountId: string) {
    // Fully Rust: heuristic + Graph fan-out runs server-side. The TS shim
    // just normalises the act_ prefix and forwards.
    try {
        const res = await rustClient.adManager.getBudgetRecommendations(withAct(adAccountId));
        if (res.error) return { error: res.error };
        return { recommendations: res.recommendations };
    } catch (e) {
        return { error: rustErr(e) };
    }
}

// =================================================================
//  AD PREVIEW
// =================================================================

export async function getAdPreviews(adAccountId: string) {
    const res = await graph<{ data: any[] }>(`${withAct(adAccountId)}/ads`, {
        params: {
            fields: 'id,name,status,creative{id,name,thumbnail_url,image_url,title,body,object_story_spec}',
            effective_status: '["ACTIVE","PAUSED"]',
            limit: 20,
        },
    });
    if (res.error) return { error: res.error };
    return { ads: res.data?.data || [] };
}

// =================================================================
//  CONVERSION FUNNEL
// =================================================================

export async function getConversionFunnel(adAccountId: string) {
    // Fully Rust: action-array parsing + funnel computation server-side.
    try {
        const res = await rustClient.adManager.getConversionFunnel(withAct(adAccountId));
        if (res.error) return { error: res.error };
        return { funnel: res.funnel };
    } catch (e) {
        return { error: rustErr(e) };
    }
}

// =================================================================
//  CAMPAIGN CALENDAR DATA
// =================================================================

export async function getCampaignCalendarData(adAccountId: string) {
    const res = await graph<{ data: any[] }>(`${withAct(adAccountId)}/campaigns`, {
        params: {
            fields: 'id,name,status,effective_status,start_time,stop_time,daily_budget,objective',
            limit: 100,
        },
    });
    if (res.error) return { error: res.error };
    return { campaigns: res.data?.data || [] };
}

// =================================================================
//  EXPORT CAMPAIGNS CSV
// =================================================================

export async function exportCampaignsData(adAccountId: string) {
    const res = await graph<{ data: any[] }>(`${withAct(adAccountId)}/insights`, {
        params: {
            fields: 'campaign_id,campaign_name,impressions,reach,clicks,spend,cpc,cpm,ctr',
            level: 'campaign',
            date_preset: 'last_30d',
            limit: 100,
        },
    });
    if (res.error) return { error: res.error };
    return { data: res.data?.data || [] };
}

// =================================================================
//  PIXEL EVENT STATS
// =================================================================

export async function getPixelEventStats(pixelId: string) {
    const res = await graph<{ data: any[] }>(`${pixelId}/stats`, {
        params: { aggregation: 'event' },
    });
    if (res.error) return { error: res.error };
    return { stats: res.data?.data || [] };
}

// =================================================================
//  SEND TEST CONVERSION EVENT
// =================================================================

export async function sendTestConversionEvent(pixelId: string, eventName: string) {
    const res = await graph(`${pixelId}/events`, {
        method: 'POST',
        body: {
            data: JSON.stringify([
                {
                    event_name: eventName,
                    event_time: Math.floor(Date.now() / 1000),
                    action_source: 'website',
                    user_data: { em: ['test@example.com'] },
                },
            ]),
            test_event_code: 'TEST_' + Date.now(),
        },
    });
    if (res.error) return { error: res.error };
    return { message: `Test "${eventName}" event sent to pixel ${pixelId}.` };
}
