'use server';

/**
 * =================================================================
 *  SabNode Ad Manager – Meta Marketing API surface (BFF-backed)
 * =================================================================
 *
 *  Every Graph call now lands on the Rust BFF
 *  (`/v1/ad-manager/graph`) which holds the user's
 *  `adManagerAccessToken` and proxies to graph.facebook.com/v23.0/*.
 *  The functions in this file are thin shims that translate the
 *  legacy `(path, opts)` shape into a JSON body the Rust handler
 *  understands and then re-shape the response into the `{ data?,
 *  error? }` envelope the UI components expect.
 *
 *  Stateful endpoints (Mongo-touching: ad accounts list, the
 *  `ad_campaigns` quick-create mirror, asset uploads) call dedicated
 *  Rust routes — the Mongo writes never run on the Next.js process.
 */
import { revalidatePath } from 'next/cache';
import type { WithId } from 'mongodb';

import type { ActionResult } from '@/lib/ad-manager/validators';
import { AD_PREVIEW_FORMATS } from '@/components/zoruui-domain/ad-manager/constants';
import { getSession } from '@/app/actions/user.actions';
import { rustClient, RustApiError } from '@/lib/rust-client';
import NodeCache from 'node-cache';
import type { AdCampaign, CustomAudience, FacebookPage, AdAccount } from '@/lib/definitions';

const cache = new NodeCache({ stdTTL: 60, checkperiod: 120 });

// -----------------------------------------------------------------
//  Helpers
// -----------------------------------------------------------------

function withActPrefix(id: string): string {
    if (!id) return id;
    return id.startsWith('act_') ? id : `act_${id}`;
}

function rustErr(e: unknown): string {
    if (e instanceof RustApiError) return e.message;
    if (e instanceof Error) return e.message;
    return 'An unexpected error occurred.';
}

type GraphOpts = {
    method?: 'GET' | 'POST' | 'DELETE';
    params?: Record<string, unknown>;
    body?: Record<string, unknown>;
    tokenKind?: 'adManager' | 'metaSuite';
};

async function graph<T = any>(path: string, opts: GraphOpts = {}): Promise<ActionResult<T>> {
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
//  AD ACCOUNTS
// =================================================================
export async function getAdAccounts(): Promise<{ accounts: AdAccount[]; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { accounts: [], error: 'Authentication required.' };
    try {
        const res = await rustClient.adManager.getAdAccounts();
        return { accounts: res.accounts || [], error: res.error };
    } catch (e) {
        return { accounts: [], error: rustErr(e) };
    }
}

export async function getAdAccountDetails(adAccountId: string): Promise<ActionResult> {
    return graph(withActPrefix(adAccountId), {
        params: {
            fields: [
                'id,account_id,name,account_status,currency,timezone_name,business_country_code',
                'amount_spent,balance,spend_cap,funding_source_details',
                'disable_reason,capabilities,business{id,name}',
                'min_daily_budget,min_campaign_group_spend_cap,owner',
                'created_time,age,is_prepay_account',
            ].join(','),
        },
    });
}

export async function deleteAdAccount(accountId: string): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Authentication required' };
    try {
        const res = await rustClient.adManager.deleteAdAccount(accountId);
        revalidatePath('/dashboard/ad-manager/ad-accounts');
        return res;
    } catch (e) {
        return { success: false, error: rustErr(e) || 'Failed to disconnect ad account.' };
    }
}

// =================================================================
//  CAMPAIGNS
// =================================================================

const CAMPAIGN_FIELDS = [
    'id', 'name', 'objective', 'status', 'effective_status',
    'buying_type', 'special_ad_categories', 'special_ad_category_country',
    'bid_strategy', 'daily_budget', 'lifetime_budget',
    'budget_remaining', 'spend_cap', 'start_time', 'stop_time',
    'created_time', 'updated_time', 'configured_status',
    'pacing_type', 'source_campaign_id', 'can_use_spend_cap',
    'issues_info',
].join(',');

export async function listCampaigns(adAccountId: string, opts?: { limit?: number; effective_status?: string[] }): Promise<ActionResult<any[]>> {
    const params: any = { fields: CAMPAIGN_FIELDS, limit: opts?.limit ?? 100 };
    if (opts?.effective_status) params.effective_status = JSON.stringify(opts.effective_status);
    
    const cacheKey = `campaigns_${adAccountId}_${JSON.stringify(params)}`;
    const cached = cache.get<any[]>(cacheKey);
    if (cached) return { data: cached };

    const res = await graph<{ data: any[] }>(`${withActPrefix(adAccountId)}/campaigns`, { params });
    if (res.error) return { error: res.error };
    
    cache.set(cacheKey, res.data?.data || []);
    return { data: res.data?.data || [] };
}

export async function getCampaign(campaignId: string): Promise<ActionResult> {
    const cacheKey = `campaign_${campaignId}`;
    const cached = cache.get<any>(cacheKey);
    if (cached) return { data: cached };

    const res = await graph(campaignId, { params: { fields: CAMPAIGN_FIELDS } });
    if (!res.error && res.data) cache.set(cacheKey, res.data);
    return res;
}

export async function createCampaign(
    adAccountId: string,
    payload: {
        name: string;
        objective: string;
        status?: 'ACTIVE' | 'PAUSED';
        special_ad_categories?: string[];
        buying_type?: 'AUCTION' | 'RESERVED';
        bid_strategy?: string;
        daily_budget?: number;
        lifetime_budget?: number;
        spend_cap?: number;
        start_time?: string;
        stop_time?: string;
    },
): Promise<ActionResult<{ id: string }>> {
    const body: Record<string, any> = {
        name: payload.name,
        objective: payload.objective,
        status: payload.status || 'PAUSED',
        special_ad_categories: JSON.stringify(
            (payload.special_ad_categories || []).filter((c) => c !== 'NONE'),
        ),
    };
    if (payload.buying_type) body.buying_type = payload.buying_type;
    if (payload.bid_strategy) body.bid_strategy = payload.bid_strategy;
    if (payload.daily_budget) body.daily_budget = payload.daily_budget;
    if (payload.lifetime_budget) body.lifetime_budget = payload.lifetime_budget;
    if (payload.spend_cap) body.spend_cap = payload.spend_cap;
    if (payload.start_time) body.start_time = payload.start_time;
    if (payload.stop_time) body.stop_time = payload.stop_time;

    const res = await graph<{ id: string }>(`${withActPrefix(adAccountId)}/campaigns`, { method: 'POST', body });
    if (res.error) return { error: res.error };
    revalidatePath('/dashboard/ad-manager/campaigns');
    return { data: res.data };
}

export async function updateCampaign(campaignId: string, patch: Record<string, any>): Promise<ActionResult> {
    const body: Record<string, any> = { ...patch };
    if (body.special_ad_categories && Array.isArray(body.special_ad_categories)) {
        body.special_ad_categories = JSON.stringify(body.special_ad_categories);
    }
    const res = await graph(campaignId, { method: 'POST', body });
    if (!res.error) revalidatePath('/dashboard/ad-manager/campaigns');
    return res;
}

export async function deleteCampaign(campaignId: string): Promise<ActionResult> {
    const res = await graph(campaignId, { method: 'DELETE' });
    if (!res.error) {
        try {
            await rustClient.adManager.deleteLocalCampaignsByMetaId(campaignId);
        } catch {
            // Local mirror cleanup is best-effort; the Graph delete is the
            // source of truth.
        }
        revalidatePath('/dashboard/ad-manager/campaigns');
    }
    return res;
}

export async function duplicateCampaign(
    campaignId: string,
    opts?: { deep_copy?: boolean; rename_options?: { rename_prefix?: string } },
): Promise<ActionResult> {
    const body: Record<string, any> = { deep_copy: opts?.deep_copy ?? true };
    if (opts?.rename_options) body.rename_options = JSON.stringify(opts.rename_options);
    return graph(`${campaignId}/copies`, { method: 'POST', body });
}

// =================================================================
//  AD SETS
// =================================================================

const ADSET_FIELDS = [
    'id', 'account_id', 'name', 'campaign_id', 'status', 'effective_status', 'configured_status',
    'daily_budget', 'lifetime_budget', 'budget_remaining',
    'bid_amount', 'bid_strategy', 'billing_event', 'optimization_goal',
    'start_time', 'end_time', 'pacing_type', 'attribution_spec',
    'destination_type', 'promoted_object', 'targeting', 'use_new_app_click',
    'created_time', 'updated_time', 'recommendations', 'issues_info',
].join(',');

export async function listAdSets(
    parentId: string,
    level: 'account' | 'campaign' = 'account',
    opts?: { limit?: number; effective_status?: string[] },
): Promise<ActionResult<any[]>> {
    const prefix = level === 'account' ? withActPrefix(parentId) : parentId;
    const params: any = { fields: ADSET_FIELDS, limit: opts?.limit ?? 100 };
    if (opts?.effective_status) params.effective_status = JSON.stringify(opts.effective_status);
    const res = await graph<{ data: any[] }>(`${prefix}/adsets`, { params });
    if (res.error) return { error: res.error };
    return { data: res.data?.data || [] };
}

export async function getAdSet(adSetId: string): Promise<ActionResult> {
    return graph(adSetId, { params: { fields: ADSET_FIELDS } });
}

export async function createAdSet(
    adAccountId: string,
    payload: {
        name: string;
        campaign_id: string;
        status?: 'ACTIVE' | 'PAUSED';
        daily_budget?: number;
        lifetime_budget?: number;
        bid_amount?: number;
        bid_strategy?: string;
        billing_event: string;
        optimization_goal: string;
        targeting: Record<string, any>;
        start_time?: string;
        end_time?: string;
        promoted_object?: Record<string, any>;
        destination_type?: string;
        attribution_spec?: any[];
        pacing_type?: string[];
    },
): Promise<ActionResult<{ id: string }>> {
    if (!payload.daily_budget && !payload.lifetime_budget) {
        return { error: 'Either daily_budget or lifetime_budget is required' };
    }

    const body: Record<string, any> = {
        name: payload.name,
        campaign_id: payload.campaign_id,
        status: payload.status || 'PAUSED',
        billing_event: payload.billing_event,
        optimization_goal: payload.optimization_goal,
        targeting: JSON.stringify(payload.targeting),
    };
    if (payload.daily_budget) body.daily_budget = payload.daily_budget;
    if (payload.lifetime_budget) body.lifetime_budget = payload.lifetime_budget;
    if (payload.bid_amount) body.bid_amount = payload.bid_amount;
    if (payload.bid_strategy) body.bid_strategy = payload.bid_strategy;
    if (payload.start_time) body.start_time = payload.start_time;
    if (payload.end_time) body.end_time = payload.end_time;
    if (payload.promoted_object) body.promoted_object = JSON.stringify(payload.promoted_object);
    if (payload.destination_type) body.destination_type = payload.destination_type;
    if (payload.attribution_spec) body.attribution_spec = JSON.stringify(payload.attribution_spec);
    if (payload.pacing_type) body.pacing_type = JSON.stringify(payload.pacing_type);

    const res = await graph<{ id: string }>(`${withActPrefix(adAccountId)}/adsets`, { method: 'POST', body });
    if (!res.error) revalidatePath('/dashboard/ad-manager/campaigns');
    return res;
}

export async function updateAdSet(adSetId: string, patch: Record<string, any>): Promise<ActionResult> {
    const body: Record<string, any> = { ...patch };
    if (body.targeting && typeof body.targeting !== 'string') body.targeting = JSON.stringify(body.targeting);
    if (body.promoted_object && typeof body.promoted_object !== 'string') body.promoted_object = JSON.stringify(body.promoted_object);
    const res = await graph(adSetId, { method: 'POST', body });
    if (!res.error) revalidatePath('/dashboard/ad-manager/campaigns');
    return res;
}

export async function deleteAdSet(adSetId: string): Promise<ActionResult> {
    return graph(adSetId, { method: 'DELETE' });
}

export async function duplicateAdSet(adSetId: string, opts?: { deep_copy?: boolean }): Promise<ActionResult> {
    return graph(`${adSetId}/copies`, { method: 'POST', body: { deep_copy: opts?.deep_copy ?? true } });
}

// =================================================================
//  ADS
// =================================================================

const AD_FIELDS = [
    'id', 'name', 'adset_id', 'campaign_id', 'status', 'effective_status', 'configured_status',
    'creative{id,name,title,body,image_url,thumbnail_url,object_story_spec,effective_object_story_id}',
    'tracking_specs', 'conversion_specs', 'recommendations', 'issues_info',
    'created_time', 'updated_time', 'preview_shareable_link',
].join(',');

export async function listAds(
    parentId: string,
    level: 'account' | 'campaign' | 'adset' = 'account',
    opts?: { limit?: number; effective_status?: string[] },
): Promise<ActionResult<any[]>> {
    const prefix = level === 'account' ? withActPrefix(parentId) : parentId;
    const params: any = { fields: AD_FIELDS, limit: opts?.limit ?? 100 };
    if (opts?.effective_status) params.effective_status = JSON.stringify(opts.effective_status);
    const res = await graph<{ data: any[] }>(`${prefix}/ads`, { params });
    if (res.error) return { error: res.error };
    return { data: res.data?.data || [] };
}

export async function getAd(adId: string): Promise<ActionResult> {
    return graph(adId, { params: { fields: AD_FIELDS } });
}

export async function createAd(
    adAccountId: string,
    payload: {
        name: string;
        adset_id: string;
        creative_id?: string;
        creative?: Record<string, any>;
        status?: 'ACTIVE' | 'PAUSED';
        tracking_specs?: any[];
    },
): Promise<ActionResult<{ id: string }>> {
    const body: Record<string, any> = {
        name: payload.name,
        adset_id: payload.adset_id,
        status: payload.status || 'PAUSED',
    };
    if (payload.creative_id) body.creative = JSON.stringify({ creative_id: payload.creative_id });
    else if (payload.creative) body.creative = JSON.stringify(payload.creative);
    if (payload.tracking_specs) body.tracking_specs = JSON.stringify(payload.tracking_specs);

    return graph(`${withActPrefix(adAccountId)}/ads`, { method: 'POST', body });
}

export async function updateAd(adId: string, patch: Record<string, any>): Promise<ActionResult> {
    return graph(adId, { method: 'POST', body: patch });
}

export async function deleteAd(adId: string): Promise<ActionResult> {
    return graph(adId, { method: 'DELETE' });
}

export async function duplicateAd(adId: string): Promise<ActionResult> {
    return graph(`${adId}/copies`, { method: 'POST' });
}

export async function getAdPreview(adId: string, adFormat: string): Promise<ActionResult<{ body: string }>> {
    const res = await graph<{ data: { body: string }[] }>(`${adId}/previews`, { params: { ad_format: adFormat } });
    if (res.error) return { error: res.error };
    return { data: { body: res.data?.data?.[0]?.body || '' } };
}

// =================================================================
//  AD CREATIVES
// =================================================================

const CREATIVE_FIELDS = [
    'id', 'name', 'title', 'body', 'image_url', 'thumbnail_url',
    'object_story_spec', 'call_to_action_type', 'link_url',
    'effective_object_story_id', 'status', 'asset_feed_spec',
    'url_tags', 'template_url', 'instagram_actor_id', 'video_id',
].join(',');

export async function listCreatives(adAccountId: string): Promise<ActionResult<any[]>> {
    const res = await graph<{ data: any[] }>(`${withActPrefix(adAccountId)}/adcreatives`, {
        params: { fields: CREATIVE_FIELDS, limit: 200 },
    });
    if (res.error) return { error: res.error };
    return { data: res.data?.data || [] };
}

export async function createCreative(
    adAccountId: string,
    payload: {
        name: string;
        object_story_spec?: Record<string, any>;
        asset_feed_spec?: Record<string, any>;
        url_tags?: string;
        degrees_of_freedom_spec?: Record<string, any>;
    },
): Promise<ActionResult<{ id: string }>> {
    const body: Record<string, any> = { name: payload.name };
    if (payload.object_story_spec) body.object_story_spec = JSON.stringify(payload.object_story_spec);
    if (payload.asset_feed_spec) body.asset_feed_spec = JSON.stringify(payload.asset_feed_spec);
    if (payload.url_tags) body.url_tags = payload.url_tags;
    if (payload.degrees_of_freedom_spec) body.degrees_of_freedom_spec = JSON.stringify(payload.degrees_of_freedom_spec);
    return graph(`${withActPrefix(adAccountId)}/adcreatives`, { method: 'POST', body });
}

export async function deleteCreative(creativeId: string): Promise<ActionResult> {
    return graph(creativeId, { method: 'DELETE' });
}

export async function generatePreviewFromCreative(
    adAccountId: string,
    creativePayload: Record<string, any>,
    adFormat: string,
): Promise<ActionResult<{ body: string }>> {
    const res = await graph<{ data: { body: string }[] }>(
        `${withActPrefix(adAccountId)}/generatepreviews`,
        { params: { ad_format: adFormat, creative: JSON.stringify(creativePayload) } },
    );
    if (res.error) return { error: res.error };
    return { data: { body: res.data?.data?.[0]?.body || '' } };
}

// =================================================================
//  ASSETS: IMAGES & VIDEOS — multipart, routed via dedicated Rust endpoint
// =================================================================

export async function uploadAdImage(formData: FormData): Promise<{ imageHash?: string; imageUrl?: string; error?: string }> {
    try {
        return await rustClient.adManager.uploadImage(formData);
    } catch (e) {
        return { error: rustErr(e) };
    }
}

export async function listAdImages(adAccountId: string): Promise<ActionResult<any[]>> {
    const res = await graph<{ data: any[] }>(`${withActPrefix(adAccountId)}/adimages`, {
        params: { fields: 'hash,name,url,width,height,created_time', limit: 100 },
    });
    if (res.error) return { error: res.error };
    return { data: res.data?.data || [] };
}

export async function uploadAdVideo(formData: FormData): Promise<{ videoId?: string; error?: string }> {
    try {
        return await rustClient.adManager.uploadVideo(formData);
    } catch (e) {
        return { error: rustErr(e) };
    }
}

export async function listAdVideos(adAccountId: string): Promise<ActionResult<any[]>> {
    const res = await graph<{ data: any[] }>(`${withActPrefix(adAccountId)}/advideos`, {
        params: { fields: 'id,title,source,picture,thumbnails,length,created_time', limit: 50 },
    });
    if (res.error) return { error: res.error };
    return { data: res.data?.data || [] };
}

// =================================================================
//  AUDIENCES
// =================================================================

const AUDIENCE_FIELDS = [
    'id', 'name', 'description', 'subtype', 'data_source',
    'approximate_count_lower_bound', 'approximate_count_upper_bound',
    'delivery_status', 'operation_status', 'time_created', 'time_updated',
    'retention_days', 'lookalike_spec', 'customer_file_source',
    'rule', 'rule_aggregation', 'is_value_based',
].join(',');

export async function getCustomAudiences(adAccountId: string): Promise<{ audiences?: CustomAudience[]; error?: string }> {
    if (!adAccountId) return { audiences: [] };
    const res = await graph<{ data: any[] }>(`${withActPrefix(adAccountId)}/customaudiences`, {
        params: { fields: AUDIENCE_FIELDS, limit: 100 },
    });
    if (res.error) return { error: res.error };
    return { audiences: (res.data?.data || []) as any };
}

export async function createCustomAudience(
    adAccountId: string,
    payload: {
        name: string;
        description?: string;
        subtype: 'CUSTOM' | 'WEBSITE' | 'APP' | 'ENGAGEMENT' | 'OFFLINE_CONVERSION';
        customer_file_source?: string;
        retention_days?: number;
        rule?: Record<string, any>;
    },
): Promise<ActionResult<{ id: string }>> {
    const body: Record<string, any> = { name: payload.name, subtype: payload.subtype };
    if (payload.description) body.description = payload.description;
    if (payload.customer_file_source) body.customer_file_source = payload.customer_file_source;
    if (payload.retention_days) body.retention_days = payload.retention_days;
    if (payload.rule) body.rule = JSON.stringify(payload.rule);
    const res = await graph<{ id: string }>(`${withActPrefix(adAccountId)}/customaudiences`, { method: 'POST', body });
    if (!res.error) revalidatePath('/dashboard/ad-manager/audiences');
    return res;
}

export async function createLookalikeAudience(
    adAccountId: string,
    payload: { name: string; origin_audience_id: string; country: string; ratio?: number },
): Promise<ActionResult> {
    const body = {
        name: payload.name,
        subtype: 'LOOKALIKE',
        origin_audience_id: payload.origin_audience_id,
        lookalike_spec: JSON.stringify({ type: 'similarity', country: payload.country, ratio: payload.ratio ?? 0.01 }),
    };
    const res = await graph(`${withActPrefix(adAccountId)}/customaudiences`, { method: 'POST', body });
    if (!res.error) revalidatePath('/dashboard/ad-manager/audiences');
    return res;
}

export async function deleteCustomAudience(audienceId: string): Promise<ActionResult> {
    const res = await graph(audienceId, { method: 'DELETE' });
    if (!res.error) revalidatePath('/dashboard/ad-manager/audiences');
    return res;
}

export async function getSavedAudiences(adAccountId: string): Promise<ActionResult<any[]>> {
    const res = await graph<{ data: any[] }>(`${withActPrefix(adAccountId)}/saved_audiences`, {
        params: { fields: 'id,name,description,targeting,approximate_count_lower_bound,run_status' },
    });
    if (res.error) return { error: res.error };
    return { data: res.data?.data || [] };
}

// =================================================================
//  TARGETING SEARCH / REACH ESTIMATE / DELIVERY ESTIMATE
// =================================================================

export async function searchTargeting(
    query: string,
    type: 'adinterest' | 'adgeolocation' | 'adworkposition' | 'adworkemployer' | 'adeducationschool' | 'adeducationmajor' | 'adlocale' = 'adinterest',
    locationTypes?: string[],
): Promise<ActionResult<any[]>> {
    const params: any = { type, q: query, limit: 25 };
    if (locationTypes && type === 'adgeolocation') params.location_types = JSON.stringify(locationTypes);
    const res = await graph<{ data: any[] }>('search', { params });
    if (res.error) return { error: res.error };
    return { data: res.data?.data || [] };
}

export async function browseTargeting(
    type: 'adinterest_category' | 'behaviors' | 'demographics',
): Promise<ActionResult<any[]>> {
    const res = await graph<{ data: any[] }>('targetingbrowse', { params: { type } });
    if (res.error) return { error: res.error };
    return { data: res.data?.data || [] };
}

export async function getReachEstimate(
    adAccountId: string,
    targeting: Record<string, any>,
    opts?: { optimization_goal?: string; currency?: string },
): Promise<ActionResult> {
    const params: any = { targeting_spec: JSON.stringify(targeting) };
    if (opts?.optimization_goal) params.optimization_goal = opts.optimization_goal;
    return graph(`${withActPrefix(adAccountId)}/reachestimate`, { params });
}

export async function getDeliveryEstimate(
    adAccountId: string,
    payload: { targeting_spec: Record<string, any>; optimization_goal: string; daily_budget?: number },
): Promise<ActionResult> {
    return graph(`${withActPrefix(adAccountId)}/delivery_estimate`, {
        params: {
            targeting_spec: JSON.stringify(payload.targeting_spec),
            optimization_goal: payload.optimization_goal,
            daily_budget: payload.daily_budget,
        },
    });
}

// =================================================================
//  INSIGHTS
// =================================================================

const DEFAULT_INSIGHT_FIELDS = [
    'campaign_id', 'campaign_name', 'adset_id', 'adset_name', 'ad_id', 'ad_name',
    'account_currency', 'impressions', 'reach', 'frequency', 'clicks', 'unique_clicks',
    'cpc', 'cpm', 'cpp', 'ctr', 'spend', 'objective',
    'actions', 'action_values', 'cost_per_action_type',
    'video_p25_watched_actions', 'video_p50_watched_actions',
    'video_p75_watched_actions', 'video_p100_watched_actions',
    'inline_link_clicks', 'inline_post_engagement', 'website_ctr',
    'outbound_clicks', 'cost_per_unique_click',
    'purchase_roas', 'conversion_values',
].join(',');

export async function getInsights(
    objectId: string,
    opts?: {
        level?: 'account' | 'campaign' | 'adset' | 'ad';
        time_range?: { since: string; until: string };
        date_preset?: string;
        breakdowns?: string[];
        action_breakdowns?: string[];
        fields?: string[];
        time_increment?: number | string;
        limit?: number;
    },
): Promise<ActionResult<any[]>> {
    if (!objectId) return { error: 'objectId is required' };
    if (opts) {
        // Validation now runs in Rust + Graph; opts pass through.
    }
    const isAct = objectId.startsWith('act_') || /^\d+$/.test(objectId);
    const nodeId = opts?.level === 'account' && isAct ? withActPrefix(objectId) : objectId;

    const params: any = {
        fields: (opts?.fields || DEFAULT_INSIGHT_FIELDS.split(',')).join(','),
        level: opts?.level || 'ad',
        limit: opts?.limit ?? 100,
    };
    if (opts?.time_range) params.time_range = JSON.stringify(opts.time_range);
    if (opts?.date_preset) params.date_preset = opts.date_preset;
    if (opts?.breakdowns?.length) params.breakdowns = opts.breakdowns.join(',');
    if (opts?.action_breakdowns?.length) params.action_breakdowns = opts.action_breakdowns.join(',');
    if (opts?.time_increment) params.time_increment = opts.time_increment;

    const res = await graph<{ data: any[] }>(`${nodeId}/insights`, { params });
    if (res.error) return { error: res.error };
    return { data: res.data?.data || [] };
}

export async function exportInsightsAsync(
    objectId: string,
    opts?: { level?: string; date_preset?: string; fields?: string[]; breakdowns?: string[] },
): Promise<ActionResult<{ report_run_id: string }>> {
    const params: any = {
        level: opts?.level || 'ad',
        fields: (opts?.fields || DEFAULT_INSIGHT_FIELDS.split(',')).join(','),
    };
    if (opts?.date_preset) params.date_preset = opts.date_preset;
    if (opts?.breakdowns?.length) params.breakdowns = opts.breakdowns.join(',');
    return graph(`${objectId}/insights`, { method: 'POST', params });
}

// =================================================================
//  PIXELS / DATASETS
// =================================================================

export async function listPixels(adAccountId: string): Promise<ActionResult<any[]>> {
    const res = await graph<{ data: any[] }>(`${withActPrefix(adAccountId)}/adspixels`, {
        params: { fields: 'id,name,code,last_fired_time,is_created_by_business,creation_time,owner_business' },
    });
    if (res.error) return { error: res.error };
    return { data: res.data?.data || [] };
}

export async function createPixel(adAccountId: string, name: string): Promise<ActionResult> {
    return graph(`${withActPrefix(adAccountId)}/adspixels`, { method: 'POST', body: { name } });
}

export async function getPixelStats(pixelId: string, aggregation: 'event' | 'browser_type' | 'url' = 'event'): Promise<ActionResult> {
    return graph(`${pixelId}/stats`, { params: { aggregation } });
}

// =================================================================
//  BATCH STATUS UPDATE
// =================================================================

export async function updateEntityStatus(
    id: string,
    type: 'campaign' | 'adset' | 'ad',
    status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED',
): Promise<{ success: boolean; error?: string }> {
    const res = await graph(id, { method: 'POST', body: { status } });
    if (res.error) return { success: false, error: res.error };
    if (type === 'campaign') {
        try {
            await rustClient.adManager.updateLocalCampaignStatus(id, status);
        } catch {
            // best-effort mirror update
        }
    }
    revalidatePath('/dashboard/ad-manager/campaigns');
    return { success: true };
}

export async function batchUpdateStatus(
    ids: string[],
    status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED',
): Promise<{ success: boolean; errors?: string[] }> {
    const batch = ids.map((id) => ({ method: 'POST', relative_url: `${id}?status=${status}` }));
    const res = await graph('', { method: 'POST', body: { batch: JSON.stringify(batch) } });
    if (res.error) return { success: false, errors: [res.error] };
    revalidatePath('/dashboard/ad-manager/campaigns');
    return { success: true };
}

// =================================================================
//  FACEBOOK PAGES + INSTAGRAM ACCOUNTS (creative wizard) — metaSuite token
// =================================================================

export async function getFacebookPagesForAdCreation(): Promise<{ pages?: FacebookPage[]; error?: string }> {
    const res = await graph<{ data: any[] }>('me/accounts', {
        params: { fields: 'id,name,access_token,category,picture{url}' },
        tokenKind: 'metaSuite',
    });
    if (res.error) return { error: res.error };
    return { pages: (res.data?.data || []) as any };
}

export async function getInstagramAccountsForPage(pageId: string): Promise<ActionResult<any[]>> {
    const res = await graph<any>(pageId, {
        params: { fields: 'instagram_business_account{id,username,profile_picture_url}' },
        tokenKind: 'metaSuite',
    });
    if (res.error) return { error: res.error };
    const ig = res.data?.instagram_business_account;
    return { data: ig ? [ig] : [] };
}

// =================================================================
//  LEGACY: local DB backed "quick create" wizard
// =================================================================

export async function getAdCampaigns(adAccountId: string): Promise<{ campaigns?: WithId<AdCampaign>[]; error?: string }> {
    if (!adAccountId) return { campaigns: [] };
    try {
        // Rust merges the local `ad_campaigns` rows with the current Graph
        // status + insights in one round trip.
        const res = await rustClient.adManager.decoratedLocalCampaigns(adAccountId);
        if (res.error) return { error: res.error };
        return { campaigns: res.campaigns as WithId<AdCampaign>[] };
    } catch (e) {
        return { error: rustErr(e) };
    }
}

export async function handleCreateAdCampaign(
    _prevState: any,
    formData: FormData,
): Promise<{ message?: string; error?: string }> {
    // Rust parses multipart, validates required fields, runs the 4-step
    // Graph orchestration, and inserts the local mirror — all in one
    // round trip.
    try {
        const res = await rustClient.adManager.fromFormCreateAdCampaign(formData);
        if (!res.error) revalidatePath('/dashboard/ad-manager/campaigns');
        return res;
    } catch (e) {
        return { error: rustErr(e) };
    }
}

// Back-compat shims used by the old page routes -------------------

export async function getAdSets(campaignId: string): Promise<{ adSets?: any[]; error?: string }> {
    const res = await listAdSets(campaignId, 'campaign');
    if (res.error) return { error: res.error };
    return { adSets: res.data || [] };
}

export async function getAds(adSetId: string): Promise<{ ads?: any[]; error?: string }> {
    // Rust fetches and reshapes — flattens insights and coalesces imageUrl.
    try {
        const res = await rustClient.adManager.reshapedAds(adSetId);
        if (res.error) return { error: res.error };
        return { ads: res.ads };
    } catch (e) {
        return { error: rustErr(e) };
    }
}

// =================================================================
//  EXTENDED META MARKETING API COVERAGE
// =================================================================

// ----- Ad Labels -------------------------------------------------

export async function listAdLabels(adAccountId: string): Promise<ActionResult<any[]>> {
    const res = await graph<{ data: any[] }>(`${withActPrefix(adAccountId)}/adlabels`, {
        params: { fields: 'id,name,created_time,updated_time' },
    });
    return res.error ? { error: res.error } : { data: res.data?.data || [] };
}

export async function createAdLabel(adAccountId: string, name: string): Promise<ActionResult> {
    return graph(`${withActPrefix(adAccountId)}/adlabels`, { method: 'POST', body: { name } });
}

export async function attachAdLabel(objectId: string, labelId: string): Promise<ActionResult> {
    return graph(`${objectId}/adlabels`, {
        method: 'POST',
        body: { adlabels: JSON.stringify([{ id: labelId }]) },
    });
}

// ----- Custom Conversions ----------------------------------------

const CUSTOM_CONVERSION_FIELDS = [
    'id', 'name', 'description', 'custom_event_type', 'rule',
    'account_id', 'aggregation_rule', 'creation_time', 'last_fired_time',
    'pixel', 'default_conversion_value',
].join(',');

export async function listCustomConversions(adAccountId: string): Promise<ActionResult<any[]>> {
    const res = await graph<{ data: any[] }>(`${withActPrefix(adAccountId)}/customconversions`, {
        params: { fields: CUSTOM_CONVERSION_FIELDS },
    });
    return res.error ? { error: res.error } : { data: res.data?.data || [] };
}

export async function createCustomConversion(
    adAccountId: string,
    payload: {
        name: string;
        description?: string;
        custom_event_type: string;
        rule: Record<string, any>;
        default_conversion_value?: number;
    },
): Promise<ActionResult> {
    return graph(`${withActPrefix(adAccountId)}/customconversions`, {
        method: 'POST',
        body: {
            name: payload.name,
            description: payload.description || '',
            custom_event_type: payload.custom_event_type,
            rule: JSON.stringify(payload.rule),
            default_conversion_value: payload.default_conversion_value,
        },
    });
}

// ----- Offline / CAPI events -------------------------------------

export async function sendConversionApiEvent(
    pixelId: string,
    payload: { event_name: string; event_time: number; user_data: Record<string, any>; custom_data?: Record<string, any>; action_source?: string; event_source_url?: string },
): Promise<ActionResult> {
    return graph(`${pixelId}/events`, {
        method: 'POST',
        body: {
            data: JSON.stringify([{
                event_name: payload.event_name,
                event_time: payload.event_time,
                action_source: payload.action_source || 'website',
                event_source_url: payload.event_source_url,
                user_data: payload.user_data,
                custom_data: payload.custom_data,
            }]),
        },
    });
}

export async function listOfflineEventSets(adAccountId: string): Promise<ActionResult<any[]>> {
    const res = await graph<{ data: any[] }>(`${withActPrefix(adAccountId)}/offline_conversion_data_sets`, {
        params: { fields: 'id,name,description,event_stats,valid_entries,matched_entries' },
    });
    return res.error ? { error: res.error } : { data: res.data?.data || [] };
}

export async function uploadOfflineEvents(
    dataSetId: string,
    events: Array<Record<string, any>>,
): Promise<ActionResult> {
    return graph(`${dataSetId}/events`, {
        method: 'POST',
        body: { upload_tag: `sabnode_${Date.now()}`, data: JSON.stringify(events) },
    });
}

// ----- Lead Forms / Lead Ads -------------------------------------

export async function listLeadGenForms(pageId: string): Promise<ActionResult<any[]>> {
    const res = await graph<{ data: any[] }>(`${pageId}/leadgen_forms`, {
        params: { fields: 'id,name,status,locale,leads_count,created_time,privacy_policy_url' },
    });
    return res.error ? { error: res.error } : { data: res.data?.data || [] };
}

export async function getLeadsFromForm(formId: string, since?: number): Promise<ActionResult<any[]>> {
    const params: any = { fields: 'id,created_time,field_data,form_id,ad_id,adset_id,campaign_id' };
    if (since) params.filtering = JSON.stringify([{ field: 'time_created', operator: 'GREATER_THAN', value: since }]);
    const res = await graph<{ data: any[] }>(`${formId}/leads`, { params });
    return res.error ? { error: res.error } : { data: res.data?.data || [] };
}

// =================================================================
//  CRM lead-gen integration bridge
// =================================================================
//
//  The CRM "Facebook Ads → Leads" integration
//  (/dashboard/crm/settings/integrations/facebook-ads) owns the
//  durable lead-sync config: page id, page access token, field
//  mapping per form, and campaign routing. The Ad Manager Lead Forms
//  page uses the helpers below to surface that connection state and
//  upsert individual forms with sensible defaults — heavy mapping
//  edits still happen on the CRM page.

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

interface CrmLeadGenSyncStatus {
    configured: boolean;
    pageId: string;
    isActive: boolean;
    syncedFormIds: string[];
    error?: string;
}

export async function getCrmLeadGenSyncStatus(): Promise<CrmLeadGenSyncStatus> {
    const { getLeadGenConfig } = await import('@/lib/rust-client/wachat-facebook-leadgen-config');
    try {
        const { config, error } = await getLeadGenConfig();
        if (error) return { configured: false, pageId: '', isActive: false, syncedFormIds: [], error };
        if (!config || !config.pageId) {
            return { configured: false, pageId: '', isActive: false, syncedFormIds: [] };
        }
        return {
            configured: true,
            pageId: config.pageId,
            isActive: !!config.isActive,
            syncedFormIds: (config.forms ?? []).map((f) => f.formId),
        };
    } catch (e) {
        return { configured: false, pageId: '', isActive: false, syncedFormIds: [], error: rustErr(e) };
    }
}

export async function syncLeadFormToCrm(input: {
    pageId: string;
    pageAccessToken: string;
    formId: string;
    formName: string;
}): Promise<{ ok: boolean; error?: string }> {
    if (!input.pageId || !input.pageAccessToken || !input.formId) {
        return { ok: false, error: 'pageId, pageAccessToken and formId are required.' };
    }

    const { getLeadGenConfig, saveLeadGenConfig } = await import('@/lib/rust-client/wachat-facebook-leadgen-config');
    try {
        const session = await getSession();
        if (!session?.user) return { ok: false, error: 'Not authenticated.' };

        const current = await getLeadGenConfig();
        const existing = current.config;

        if (existing?.pageId && existing.pageId !== input.pageId) {
            return {
                ok: false,
                error: `CRM is already wired to Facebook Page ${existing.pageId}. Switch pages from CRM Settings → Integrations → Facebook Ads.`,
            };
        }

        const defaultMapping = STANDARD_FB_FIELDS.map((fb) => ({
            fbField: fb,
            crmField: DEFAULT_FB_TO_CRM[fb] ?? 'ignore',
        }));

        const previousForms = existing?.forms ?? [];
        const alreadyIdx = previousForms.findIndex((f) => f.formId === input.formId);
        const formEntry =
            alreadyIdx >= 0
                ? { ...previousForms[alreadyIdx], formName: input.formName || previousForms[alreadyIdx].formName }
                : {
                      formId: input.formId,
                      formName: input.formName,
                      fieldMapping: defaultMapping,
                      defaultRouting: { pipelineId: '', stage: '', assignedTo: '' },
                      campaignRules: [],
                  };

        const nextForms =
            alreadyIdx >= 0
                ? previousForms.map((f, i) => (i === alreadyIdx ? formEntry : f))
                : [...previousForms, formEntry];

        const { error } = await saveLeadGenConfig({
            tenantId: existing?.tenantId ?? '',
            pageId: input.pageId,
            pageAccessToken: input.pageAccessToken,
            isActive: existing?.isActive ?? true,
            forms: nextForms,
        });
        if (error) return { ok: false, error };

        revalidatePath('/dashboard/crm/settings/integrations/facebook-ads');
        return { ok: true };
    } catch (e) {
        return { ok: false, error: rustErr(e) };
    }
}

// ----- Catalogs / Product sets / DPA -----------------------------

export async function listCatalogs(businessId: string): Promise<ActionResult<any[]>> {
    const res = await graph<{ data: any[] }>(`${businessId}/owned_product_catalogs`, {
        params: { fields: 'id,name,product_count,vertical,feed_count' },
    });
    return res.error ? { error: res.error } : { data: res.data?.data || [] };
}

export async function listProductSets(catalogId: string): Promise<ActionResult<any[]>> {
    const res = await graph<{ data: any[] }>(`${catalogId}/product_sets`, {
        params: { fields: 'id,name,product_count,filter' },
    });
    return res.error ? { error: res.error } : { data: res.data?.data || [] };
}

export async function createProductSet(
    catalogId: string,
    payload: { name: string; filter?: Record<string, any> },
): Promise<ActionResult> {
    return graph(`${catalogId}/product_sets`, {
        method: 'POST',
        body: { name: payload.name, filter: payload.filter ? JSON.stringify(payload.filter) : undefined },
    });
}

// ----- Customer file audience (SHA-256 hashed) -------------------

export async function addUsersToCustomAudience(
    audienceId: string,
    schema: string[],
    hashedUsers: string[][],
): Promise<ActionResult> {
    return graph(`${audienceId}/users`, {
        method: 'POST',
        body: { payload: JSON.stringify({ schema, data: hashedUsers }) },
    });
}

export async function removeUsersFromCustomAudience(
    audienceId: string,
    schema: string[],
    hashedUsers: string[][],
): Promise<ActionResult> {
    return graph(`${audienceId}/users`, {
        method: 'DELETE',
        body: { payload: JSON.stringify({ schema, data: hashedUsers }) },
    });
}

// ----- Saved audiences CRUD -------------------------------------

export async function createSavedAudience(
    adAccountId: string,
    payload: { name: string; description?: string; targeting: Record<string, any> },
): Promise<ActionResult> {
    return graph(`${withActPrefix(adAccountId)}/saved_audiences`, {
        method: 'POST',
        body: {
            name: payload.name,
            description: payload.description || '',
            targeting: JSON.stringify(payload.targeting),
        },
    });
}

export async function deleteSavedAudience(audienceId: string): Promise<ActionResult> {
    return graph(audienceId, { method: 'DELETE' });
}

// ----- Async report jobs -----------------------------------------

export async function getReportRunStatus(reportRunId: string): Promise<ActionResult> {
    return graph(reportRunId, {
        params: { fields: 'id,async_status,async_percent_completion,date_start,date_stop' },
    });
}

export async function getReportRunInsights(reportRunId: string): Promise<ActionResult<any[]>> {
    const res = await graph<{ data: any[] }>(`${reportRunId}/insights`, { params: { limit: 1000 } });
    return res.error ? { error: res.error } : { data: res.data?.data || [] };
}

// ----- Interest suggestions / validation -------------------------

export async function suggestTargeting(interestList: string[]): Promise<ActionResult<any[]>> {
    const res = await graph<{ data: any[] }>('search', {
        params: {
            type: 'adinterestsuggestion',
            interest_list: JSON.stringify(interestList),
            limit: 25,
        },
    });
    return res.error ? { error: res.error } : { data: res.data?.data || [] };
}

export async function validateTargeting(
    interests: Array<{ id: string; name: string }>,
): Promise<ActionResult<any[]>> {
    const res = await graph<{ data: any[] }>('search', {
        params: {
            type: 'adinterestvalid',
            interest_list: JSON.stringify(interests.map((i) => i.name)),
            interest_fbid_list: JSON.stringify(interests.map((i) => i.id)),
        },
    });
    return res.error ? { error: res.error } : { data: res.data?.data || [] };
}

// ----- Ad account users / assigned agencies ----------------------

export async function listAdAccountUsers(adAccountId: string): Promise<ActionResult<any[]>> {
    const res = await graph<{ data: any[] }>(`${withActPrefix(adAccountId)}/assigned_users`, {
        params: { fields: 'id,name,email,role,permitted_tasks,business' },
    });
    return res.error ? { error: res.error } : { data: res.data?.data || [] };
}

export async function listAdAccountAgencies(adAccountId: string): Promise<ActionResult<any[]>> {
    const res = await graph<{ data: any[] }>(`${withActPrefix(adAccountId)}/agencies`, {
        params: { fields: 'id,name,verification_status,permitted_tasks' },
    });
    return res.error ? { error: res.error } : { data: res.data?.data || [] };
}

// ----- Payment methods / invoices --------------------------------

export async function getAdAccountSpend(adAccountId: string, _since?: string, _until?: string): Promise<ActionResult> {
    return graph(withActPrefix(adAccountId), {
        params: { fields: 'amount_spent,balance,currency,funding_source_details,min_daily_budget,spend_cap' },
    });
}

export async function listBusinessInvoices(businessId: string): Promise<ActionResult<any[]>> {
    const res = await graph<{ data: any[] }>(`${businessId}/business_invoices`, {
        params: {
            fields: 'id,invoice_id,billing_period,billed_amount_details,due_date,issue_date,payment_status,invoice_date,type',
        },
    });
    return res.error ? { error: res.error } : { data: res.data?.data || [] };
}

// ----- Carousel / dynamic / instant-experience creatives ---------

export async function createCarouselCreative(
    adAccountId: string,
    payload: {
        name: string;
        page_id: string;
        message: string;
        link: string;
        cards: Array<{ name: string; description?: string; link?: string; image_hash?: string; image_url?: string; call_to_action?: { type: string; value: Record<string, any> } }>;
    },
): Promise<ActionResult> {
    return createCreative(adAccountId, {
        name: payload.name,
        object_story_spec: {
            page_id: payload.page_id,
            link_data: {
                message: payload.message,
                link: payload.link,
                child_attachments: payload.cards.map((c) => ({
                    name: c.name,
                    description: c.description,
                    link: c.link || payload.link,
                    image_hash: c.image_hash,
                    image_url: c.image_url,
                    call_to_action: c.call_to_action,
                })),
                multi_share_optimized: true,
                multi_share_end_card: true,
            },
        },
    });
}

export async function createDynamicProductAdCreative(
    adAccountId: string,
    payload: { name: string; page_id: string; product_set_id: string; message: string; link: string },
): Promise<ActionResult> {
    return createCreative(adAccountId, {
        name: payload.name,
        object_story_spec: {
            page_id: payload.page_id,
            template_data: {
                message: payload.message,
                link: payload.link,
                call_to_action: { type: 'SHOP_NOW' },
                name: '{{product.name}}',
                description: '{{product.description}}',
            },
            product_set_id: payload.product_set_id,
        } as any,
    });
}

// ----- Draft campaigns (plan before publish) ---------------------

export async function createDraftCampaign(
    adAccountId: string,
    payload: Parameters<typeof createCampaign>[1],
): Promise<ActionResult<{ id: string }>> {
    return createCampaign(adAccountId, { ...payload, status: 'PAUSED' });
}

// ----- Rules & automated actions ---------------------------------

export async function listAdRules(adAccountId: string): Promise<ActionResult<any[]>> {
    const res = await graph<{ data: any[] }>(`${withActPrefix(adAccountId)}/adrules_library`, {
        params: { fields: 'id,name,status,schedule,execution_spec,evaluation_spec,created_time' },
    });
    return res.error ? { error: res.error } : { data: res.data?.data || [] };
}

export async function createAdRule(
    adAccountId: string,
    payload: {
        name: string;
        evaluation_spec: Record<string, any>;
        execution_spec: Record<string, any>;
        schedule_spec?: Record<string, any>;
    },
): Promise<ActionResult> {
    return graph(`${withActPrefix(adAccountId)}/adrules_library`, {
        method: 'POST',
        body: {
            name: payload.name,
            evaluation_spec: JSON.stringify(payload.evaluation_spec),
            execution_spec: JSON.stringify(payload.execution_spec),
            schedule_spec: payload.schedule_spec ? JSON.stringify(payload.schedule_spec) : undefined,
        },
    });
}

// ----- Account insights comparisons ------------------------------

export async function compareInsights(
    objectId: string,
    rangeA: { since: string; until: string },
    rangeB: { since: string; until: string },
    level: 'account' | 'campaign' | 'adset' | 'ad' = 'account',
): Promise<ActionResult<{ a: any[]; b: any[] }>> {
    const [a, b] = await Promise.all([
        getInsights(objectId, { level, time_range: rangeA }),
        getInsights(objectId, { level, time_range: rangeB }),
    ]);
    if (a.error) return { error: a.error };
    if (b.error) return { error: b.error };
    return { data: { a: a.data || [], b: b.data || [] } };
}

// ----- Reach & Frequency prediction ------------------------------

export async function createReachFrequencyPrediction(
    adAccountId: string,
    payload: {
        campaign_group_id?: string;
        name: string;
        target_spec: Record<string, any>;
        budget: number;
        start_time: string;
        end_time: string;
        buying_type?: 'RESERVED' | 'AUCTION';
        prediction_mode?: number;
        story_event_type?: number;
        destination_id?: string;
        destination_ids?: string[];
        instream_packages?: string[];
    },
): Promise<ActionResult<{ id: string }>> {
    return graph(`${withActPrefix(adAccountId)}/reachfrequencypredictions`, {
        method: 'POST',
        body: {
            name: payload.name,
            target_spec: JSON.stringify(payload.target_spec),
            budget: payload.budget,
            start_time: payload.start_time,
            end_time: payload.end_time,
            buying_type: payload.buying_type || 'RESERVED',
            prediction_mode: payload.prediction_mode,
            story_event_type: payload.story_event_type,
            destination_id: payload.destination_id,
            destination_ids: payload.destination_ids ? JSON.stringify(payload.destination_ids) : undefined,
            instream_packages: payload.instream_packages ? JSON.stringify(payload.instream_packages) : undefined,
        },
    });
}

export async function listReachFrequencyPredictions(adAccountId: string): Promise<ActionResult<any[]>> {
    const res = await graph<{ data: any[] }>(`${withActPrefix(adAccountId)}/reachfrequencypredictions`, {
        params: {
            fields: 'id,name,status,budget,reservation_status,impression_curve,prediction_mode,start_time,end_time,target_audience_size,frequency_cap',
        },
    });
    return res.error ? { error: res.error } : { data: res.data?.data || [] };
}

// ----- Targeting sentence lines ----------------------------------

export async function getTargetingSentenceLines(
    adAccountId: string,
    targeting: Record<string, any>,
): Promise<ActionResult<any[]>> {
    const res = await graph<{ data: any[] }>(`${withActPrefix(adAccountId)}/targetingsentencelines`, {
        params: { targeting_spec: JSON.stringify(targeting) },
    });
    return res.error ? { error: res.error } : { data: res.data?.data || [] };
}

// ----- All previews ----------------------------------------------

export async function getAllAdPreviews(adId: string): Promise<ActionResult<Record<string, string>>> {
    const results: Record<string, string> = {};
    const tasks = AD_PREVIEW_FORMATS.map(async (fmt) => {
        const res = await graph<{ data: { body: string }[] }>(`${adId}/previews`, { params: { ad_format: fmt } });
        if (!res.error && res.data?.data?.[0]?.body) results[fmt] = res.data.data[0].body;
    });
    await Promise.allSettled(tasks);
    return { data: results };
}

// ----- Async insights export with polling ------------------------

export async function runAsyncInsightsJob(
    objectId: string,
    opts: {
        level?: 'account' | 'campaign' | 'adset' | 'ad';
        date_preset?: string;
        time_range?: { since: string; until: string };
        fields?: string[];
        breakdowns?: string[];
    },
    onProgress?: (pct: number) => void,
): Promise<ActionResult<any[]>> {
    const params: any = {
        level: opts.level || 'ad',
        fields: (opts.fields || ['campaign_id', 'adset_id', 'ad_id', 'impressions', 'clicks', 'spend']).join(','),
    };
    if (opts.date_preset) params.date_preset = opts.date_preset;
    if (opts.time_range) params.time_range = JSON.stringify(opts.time_range);
    if (opts.breakdowns) params.breakdowns = opts.breakdowns.join(',');

    const kick = await graph<{ report_run_id: string }>(`${objectId}/insights`, { method: 'POST', params });
    if (kick.error || !kick.data?.report_run_id) return { error: kick.error || 'Failed to start report' };
    const runId = kick.data.report_run_id;

    const started = Date.now();
    while (Date.now() - started < 120_000) {
        const status = await graph<{ async_status: string; async_percent_completion: number }>(runId, {
            params: { fields: 'async_status,async_percent_completion' },
        });
        if (status.error) return { error: status.error };
        onProgress?.(status.data?.async_percent_completion || 0);
        if (status.data?.async_status === 'Job Completed') break;
        if (status.data?.async_status === 'Job Failed' || status.data?.async_status === 'Job Skipped') {
            return { error: `Async report ${status.data.async_status}` };
        }
        await new Promise((r) => setTimeout(r, 1_500));
    }

    const results = await graph<{ data: any[] }>(`${runId}/insights`, { params: { limit: 5000 } });
    return results.error ? { error: results.error } : { data: results.data?.data || [] };
}

// ----- Extended credit / business-level billing ------------------

export async function listExtendedCredits(businessId: string): Promise<ActionResult<any[]>> {
    const res = await graph<{ data: any[] }>(`${businessId}/extendedcredits`, {
        params: {
            fields: 'id,credit_type,credit_available,credit_used,legal_entity_name,max_balance,owner_business',
        },
    });
    return res.error ? { error: res.error } : { data: res.data?.data || [] };
}

export async function listBusinessUsers(businessId: string): Promise<ActionResult<any[]>> {
    const res = await graph<{ data: any[] }>(`${businessId}/business_users`, {
        params: { fields: 'id,name,email,role,title,two_fac_status' },
    });
    return res.error ? { error: res.error } : { data: res.data?.data || [] };
}

export async function listBusinessPartners(businessId: string): Promise<ActionResult<any[]>> {
    const res = await graph<{ data: any[] }>(`${businessId}/business_partners`, {
        params: { fields: 'id,name,verification_status,two_factor_type' },
    });
    return res.error ? { error: res.error } : { data: res.data?.data || [] };
}

// ----- Page posts (metaSuite) ------------------------------------

export async function listPagePromotablePosts(pageId: string): Promise<ActionResult<any[]>> {
    const res = await graph<{ data: any[] }>(`${pageId}/promotable_posts`, {
        params: {
            fields: 'id,message,created_time,picture,type,status_type,insights{name,values}',
            is_published: true,
        },
        tokenKind: 'metaSuite',
    });
    return res.error ? { error: res.error } : { data: res.data?.data || [] };
}

export async function listInstantExperiences(pageId: string): Promise<ActionResult<any[]>> {
    const res = await graph<{ data: any[] }>(`${pageId}/canvases`, {
        params: { fields: 'id,name,canvas_link,body_elements,is_published,update_time' },
        tokenKind: 'metaSuite',
    });
    return res.error ? { error: res.error } : { data: res.data?.data || [] };
}

export async function listBrandedContentHandles(pageId: string): Promise<ActionResult<any[]>> {
    const res = await graph<{ data: any[] }>(`${pageId}/branded_content_ad_handlers`, {
        tokenKind: 'metaSuite',
    });
    return res.error ? { error: res.error } : { data: res.data?.data || [] };
}

export async function getInstagramBusinessAccount(pageId: string): Promise<ActionResult> {
    const res = await graph<any>(pageId, {
        params: {
            fields: 'instagram_business_account{id,username,name,profile_picture_url,followers_count,media_count,biography}',
        },
        tokenKind: 'metaSuite',
    });
    if (res.error) return { error: res.error };
    return { data: res.data?.instagram_business_account || null };
}

// ----- Audience sharing -----------------------------------------

export async function shareCustomAudience(audienceId: string, accountIds: string[]): Promise<ActionResult> {
    return graph(`${audienceId}/adaccounts`, {
        method: 'POST',
        body: { adaccounts: JSON.stringify(accountIds.map((a) => withActPrefix(a))) },
    });
}

export async function listSharedAudienceAccounts(audienceId: string): Promise<ActionResult<any[]>> {
    const res = await graph<{ data: any[] }>(`${audienceId}/adaccounts`, {
        params: { fields: 'id,account_id,name' },
    });
    return res.error ? { error: res.error } : { data: res.data?.data || [] };
}

export async function createWebsiteRetargetingAudience(
    adAccountId: string,
    payload: {
        name: string;
        pixel_id: string;
        rule: { inclusions: Record<string, any>; exclusions?: Record<string, any> };
        retention_days?: number;
    },
): Promise<ActionResult<{ id: string }>> {
    return createCustomAudience(adAccountId, {
        name: payload.name,
        subtype: 'WEBSITE',
        retention_days: payload.retention_days ?? 180,
        rule: payload.rule,
    });
}

export async function sharePixelWithAdAccount(pixelId: string, adAccountId: string): Promise<ActionResult> {
    return graph(`${pixelId}/shared_accounts`, {
        method: 'POST',
        body: { account_id: adAccountId.replace(/^act_/, '') },
    });
}

export async function listVideoCopyrights(pageId: string): Promise<ActionResult<any[]>> {
    const res = await graph<{ data: any[] }>(`${pageId}/video_copyrights`, {
        params: {
            fields: 'id,copyright_content_id,creation_time,ownership_countries,reference_file,monitoring_status',
        },
        tokenKind: 'metaSuite',
    });
    return res.error ? { error: res.error } : { data: res.data?.data || [] };
}

export async function getSupportedActionTypes(): Promise<ActionResult<string[]>> {
    return {
        data: [
            'link_click', 'post_engagement', 'page_engagement', 'post_reaction',
            'comment', 'share', 'like', 'rsvp', 'video_view', 'lead',
            'mobile_app_install', 'app_custom_event', 'app_use',
            'app_custom_event.fb_mobile_purchase', 'app_custom_event.fb_mobile_complete_registration',
            'onsite_conversion.lead_grouped', 'onsite_conversion.messaging_conversation_started_7d',
            'offsite_conversion.fb_pixel_purchase',
            'offsite_conversion.fb_pixel_lead',
            'offsite_conversion.fb_pixel_add_to_cart',
            'offsite_conversion.fb_pixel_initiate_checkout',
            'offsite_conversion.fb_pixel_view_content',
            'offsite_conversion.fb_pixel_add_payment_info',
            'offsite_conversion.fb_pixel_complete_registration',
            'offsite_conversion.fb_pixel_subscribe',
            'offsite_conversion.fb_pixel_custom',
        ],
    };
}

export async function listOffers(pageId: string): Promise<ActionResult<any[]>> {
    const res = await graph<{ data: any[] }>(`${pageId}/offers`, {
        params: { fields: 'id,title,details,terms,expiration_time,online_code,barcode_type,barcode' },
        tokenKind: 'metaSuite',
    });
    return res.error ? { error: res.error } : { data: res.data?.data || [] };
}

export async function getAdAccountActivities(
    adAccountId: string,
    opts?: { since?: string; until?: string; limit?: number },
): Promise<ActionResult<any[]>> {
    const params: any = {
        fields: 'actor_name,application_id,event_type,event_time,object_id,object_name,object_type,translated_event_type,extra_data',
        limit: opts?.limit ?? 100,
    };
    if (opts?.since) params.since = opts.since;
    if (opts?.until) params.until = opts.until;
    const res = await graph<{ data: any[] }>(`${withActPrefix(adAccountId)}/activities`, { params });
    return res.error ? { error: res.error } : { data: res.data?.data || [] };
}

export async function listAdStudies(adAccountId: string): Promise<ActionResult<any[]>> {
    const res = await graph<{ data: any[] }>(`${withActPrefix(adAccountId)}/ads_reporting_mmm_reports`, {
        params: { fields: 'id,name,description,start_time,end_time,status,results' },
    });
    return res.error ? { error: res.error } : { data: res.data?.data || [] };
}

export async function searchAdEducationSchool(query: string): Promise<ActionResult<any[]>> {
    return searchTargeting(query, 'adeducationschool');
}

export async function searchAdEducationMajor(query: string): Promise<ActionResult<any[]>> {
    return searchTargeting(query, 'adeducationmajor');
}

export async function searchAdWorkPosition(query: string): Promise<ActionResult<any[]>> {
    return searchTargeting(query, 'adworkposition');
}

export async function searchAdWorkEmployer(query: string): Promise<ActionResult<any[]>> {
    return searchTargeting(query, 'adworkemployer');
}

export async function searchAdLocale(query: string): Promise<ActionResult<any[]>> {
    return searchTargeting(query, 'adlocale');
}

export async function listApplications(): Promise<ActionResult<any[]>> {
    const res = await graph<{ data: any[] }>('me/applications', {
        params: { fields: 'id,name,namespace,link,icon_url,category,object_store_urls' },
        tokenKind: 'metaSuite',
    });
    return res.error ? { error: res.error } : { data: res.data?.data || [] };
}

export async function getAdAccountCapabilities(adAccountId: string): Promise<ActionResult> {
    return graph(withActPrefix(adAccountId), {
        params: {
            fields: [
                'capabilities',
                'business_country_code',
                'min_campaign_group_spend_cap',
                'min_daily_budget',
                'disable_reason',
                'io_number',
                'offsite_pixels_tos_accepted',
                'tos_accepted',
            ].join(','),
        },
    });
}

export async function getAdAccountTransactions(adAccountId: string): Promise<ActionResult<any[]>> {
    const res = await graph<{ data: any[] }>(`${withActPrefix(adAccountId)}/transactions`, {
        params: {
            fields: 'id,account_id,app_amount,billing_start_time,billing_end_time,charge_type,currency,provider_amount,status,time,tracking_id,transaction_type,tx_type,vat_invoice_id,download_invoice_uri'
        }
    });
    return res.error ? { error: res.error } : { data: res.data?.data || [] };
}
