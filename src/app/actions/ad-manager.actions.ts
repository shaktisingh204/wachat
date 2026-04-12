'use server';

/**
 * =================================================================
 *  SabNode Ad Manager – full Meta Marketing API coverage
 * =================================================================
 *
 *  Everything the Meta Marketing Graph API exposes for managing
 *  campaigns, ad sets, ads, creatives, audiences, insights, pixels,
 *  previews, targeting search and asset uploads is proxied through
 *  this file.  UI components talk to these server actions and never
 *  hit graph.facebook.com directly.
 *
 *  Graph API version is pinned to v23.0.  All functions return a
 *  `{ data?, error? }` shape so the UI can handle errors uniformly.
 */

import { revalidatePath } from 'next/cache';
import axios, { AxiosRequestConfig } from 'axios';
import { ObjectId, type WithId } from 'mongodb';

import { getErrorMessage } from '@/lib/utils';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import type { AdCampaign, CustomAudience, FacebookPage } from '@/lib/definitions';
import {
    validate,
    friendlyGraphError,
    CreateCampaignInput,
    CreateAdSetInput,
    CreateAdInput,
    CreateCreativeInput,
    CreateCustomAudienceInput,
    CreateLookalikeInput,
    InsightsQueryInput,
    ReachEstimateInput,
    DeliveryEstimateInput,
    CustomConversionInput,
    ConversionApiEventInput,
    AdRuleInput,
    AdAccountId as AdAccountIdSchema,
    FbId as FbIdSchema,
    type ActionResult,
} from '@/lib/ad-manager/validators';
import { AD_PREVIEW_FORMATS } from '@/components/wabasimplify/ad-manager/constants';

const API_VERSION = 'v23.0';
const GRAPH = `https://graph.facebook.com/${API_VERSION}`;
const LOG_PREFIX = '[AD_MANAGER]';

// -----------------------------------------------------------------
//  Types (ActionResult is imported from validators.ts because
//  "use server" files cannot export non-async values.)
// -----------------------------------------------------------------

type GraphRequestOptions = {
    method?: 'GET' | 'POST' | 'DELETE';
    params?: Record<string, any>;
    body?: Record<string, any>;
    formData?: FormData;
};

// -----------------------------------------------------------------
//  Helpers
// -----------------------------------------------------------------
async function requireToken(): Promise<{ token?: string; error?: string }> {
    const session = await getSession();
    const token = (session?.user as any)?.adManagerAccessToken;
    if (!token) return { error: 'Ad Manager account not connected.' };
    return { token };
}

function withActPrefix(id: string): string {
    if (!id) return id;
    return id.startsWith('act_') ? id : `act_${id}`;
}

async function graph<T = any>(
    path: string,
    token: string,
    opts: GraphRequestOptions = {},
): Promise<ActionResult<T>> {
    const { method = 'GET', params = {}, body, formData } = opts;
    const url = `${GRAPH}/${path.replace(/^\//, '')}`;

    const config: AxiosRequestConfig = {
        method,
        url,
        params: { access_token: token, ...params },
    };

    if (formData) {
        formData.append('access_token', token);
        config.data = formData;
    } else if (body) {
        config.data = { access_token: token, ...body };
    }

    try {
        const res = await axios.request<T>(config);
        return { data: res.data };
    } catch (e: any) {
        const msg = friendlyGraphError(e);
        console.error(`${LOG_PREFIX} graph(${method} ${path}) failed:`, msg);
        return { error: msg };
    }
}

// =================================================================
//  AD ACCOUNTS
// =================================================================
export async function getAdAccounts(): Promise<{ accounts: any[]; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { accounts: [], error: 'Authentication required.' };
    return { accounts: (session.user as any).metaAdAccounts || [] };
}

export async function getAdAccountDetails(adAccountId: string): Promise<ActionResult> {
    const { token, error } = await requireToken();
    if (error) return { error };
    return graph(withActPrefix(adAccountId), token!, {
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
        const { db } = await connectToDatabase();
        await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            { $pull: { metaAdAccounts: { id: accountId } } } as any,
        );
        revalidatePath('/dashboard/ad-manager/ad-accounts');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: 'Failed to disconnect ad account.' };
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
    const { token, error } = await requireToken();
    if (error) return { error };
    const params: any = { fields: CAMPAIGN_FIELDS, limit: opts?.limit ?? 100 };
    if (opts?.effective_status) params.effective_status = JSON.stringify(opts.effective_status);
    const res = await graph<{ data: any[] }>(`${withActPrefix(adAccountId)}/campaigns`, token!, { params });
    if (res.error) return { error: res.error };
    return { data: res.data?.data || [] };
}

export async function getCampaign(campaignId: string): Promise<ActionResult> {
    const { token, error } = await requireToken();
    if (error) return { error };
    return graph(campaignId, token!, { params: { fields: CAMPAIGN_FIELDS } });
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
    const acc = validate(AdAccountIdSchema, adAccountId);
    if ('error' in acc) return { error: acc.error };
    const v = validate(CreateCampaignInput, payload);
    if ('error' in v) return { error: v.error };

    const { token, error } = await requireToken();
    if (error) return { error };

    const body: Record<string, any> = {
        name: v.data.name,
        objective: v.data.objective,
        status: v.data.status || 'PAUSED',
        special_ad_categories: JSON.stringify(
            (v.data.special_ad_categories || []).filter((c) => c !== 'NONE'),
        ),
    };
    if (v.data.buying_type) body.buying_type = v.data.buying_type;
    if (v.data.bid_strategy) body.bid_strategy = v.data.bid_strategy;
    if (v.data.daily_budget) body.daily_budget = v.data.daily_budget;
    if (v.data.lifetime_budget) body.lifetime_budget = v.data.lifetime_budget;
    if (v.data.spend_cap) body.spend_cap = v.data.spend_cap;
    if (v.data.start_time) body.start_time = v.data.start_time;
    if (v.data.stop_time) body.stop_time = v.data.stop_time;

    const res = await graph<{ id: string }>(`${withActPrefix(acc.data)}/campaigns`, token!, {
        method: 'POST',
        body,
    });
    if (res.error) return { error: res.error };
    revalidatePath('/dashboard/ad-manager/campaigns');
    return { data: res.data };
}

export async function updateCampaign(campaignId: string, patch: Record<string, any>): Promise<ActionResult> {
    const { token, error } = await requireToken();
    if (error) return { error };
    const body: Record<string, any> = { ...patch };
    if (body.special_ad_categories && Array.isArray(body.special_ad_categories)) {
        body.special_ad_categories = JSON.stringify(body.special_ad_categories);
    }
    const res = await graph(campaignId, token!, { method: 'POST', body });
    if (!res.error) revalidatePath('/dashboard/ad-manager/campaigns');
    return res;
}

export async function deleteCampaign(campaignId: string): Promise<ActionResult> {
    const { token, error } = await requireToken();
    if (error) return { error };
    const res = await graph(campaignId, token!, { method: 'DELETE' });
    if (!res.error) {
        const { db } = await connectToDatabase();
        await db.collection('ad_campaigns').deleteMany({ metaCampaignId: campaignId });
        revalidatePath('/dashboard/ad-manager/campaigns');
    }
    return res;
}

export async function duplicateCampaign(
    campaignId: string,
    opts?: { deep_copy?: boolean; rename_options?: { rename_prefix?: string } },
): Promise<ActionResult> {
    const { token, error } = await requireToken();
    if (error) return { error };
    const body: Record<string, any> = {
        deep_copy: opts?.deep_copy ?? true,
    };
    if (opts?.rename_options) body.rename_options = JSON.stringify(opts.rename_options);
    return graph(`${campaignId}/copies`, token!, { method: 'POST', body });
}

// =================================================================
//  AD SETS
// =================================================================

const ADSET_FIELDS = [
    'id', 'name', 'campaign_id', 'status', 'effective_status', 'configured_status',
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
    const { token, error } = await requireToken();
    if (error) return { error };
    const prefix = level === 'account' ? withActPrefix(parentId) : parentId;
    const params: any = { fields: ADSET_FIELDS, limit: opts?.limit ?? 100 };
    if (opts?.effective_status) params.effective_status = JSON.stringify(opts.effective_status);
    const res = await graph<{ data: any[] }>(`${prefix}/adsets`, token!, { params });
    if (res.error) return { error: res.error };
    return { data: res.data?.data || [] };
}

export async function getAdSet(adSetId: string): Promise<ActionResult> {
    const { token, error } = await requireToken();
    if (error) return { error };
    return graph(adSetId, token!, { params: { fields: ADSET_FIELDS } });
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
    const acc = validate(AdAccountIdSchema, adAccountId);
    if ('error' in acc) return { error: acc.error };
    const v = validate(CreateAdSetInput, payload);
    if ('error' in v) return { error: v.error };
    if (!v.data.daily_budget && !v.data.lifetime_budget) {
        return { error: 'Either daily_budget or lifetime_budget is required' };
    }

    const { token, error } = await requireToken();
    if (error) return { error };

    const body: Record<string, any> = {
        name: v.data.name,
        campaign_id: v.data.campaign_id,
        status: v.data.status || 'PAUSED',
        billing_event: v.data.billing_event,
        optimization_goal: v.data.optimization_goal,
        targeting: JSON.stringify(v.data.targeting),
    };
    if (v.data.daily_budget) body.daily_budget = v.data.daily_budget;
    if (v.data.lifetime_budget) body.lifetime_budget = v.data.lifetime_budget;
    if (v.data.bid_amount) body.bid_amount = v.data.bid_amount;
    if (v.data.bid_strategy) body.bid_strategy = v.data.bid_strategy;
    if (v.data.start_time) body.start_time = v.data.start_time;
    if (v.data.end_time) body.end_time = v.data.end_time;
    if (v.data.promoted_object) body.promoted_object = JSON.stringify(v.data.promoted_object);
    if (v.data.destination_type) body.destination_type = v.data.destination_type;
    if (v.data.attribution_spec) body.attribution_spec = JSON.stringify(v.data.attribution_spec);
    if (v.data.pacing_type) body.pacing_type = JSON.stringify(v.data.pacing_type);

    const res = await graph<{ id: string }>(`${withActPrefix(acc.data)}/adsets`, token!, {
        method: 'POST',
        body,
    });
    if (!res.error) revalidatePath('/dashboard/ad-manager/campaigns');
    return res;
}

export async function updateAdSet(adSetId: string, patch: Record<string, any>): Promise<ActionResult> {
    const { token, error } = await requireToken();
    if (error) return { error };
    const body: Record<string, any> = { ...patch };
    if (body.targeting && typeof body.targeting !== 'string') body.targeting = JSON.stringify(body.targeting);
    if (body.promoted_object && typeof body.promoted_object !== 'string') body.promoted_object = JSON.stringify(body.promoted_object);
    const res = await graph(adSetId, token!, { method: 'POST', body });
    if (!res.error) revalidatePath('/dashboard/ad-manager/campaigns');
    return res;
}

export async function deleteAdSet(adSetId: string): Promise<ActionResult> {
    const { token, error } = await requireToken();
    if (error) return { error };
    return graph(adSetId, token!, { method: 'DELETE' });
}

export async function duplicateAdSet(adSetId: string, opts?: { deep_copy?: boolean }): Promise<ActionResult> {
    const { token, error } = await requireToken();
    if (error) return { error };
    return graph(`${adSetId}/copies`, token!, {
        method: 'POST',
        body: { deep_copy: opts?.deep_copy ?? true },
    });
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
    const { token, error } = await requireToken();
    if (error) return { error };
    const prefix = level === 'account' ? withActPrefix(parentId) : parentId;
    const params: any = { fields: AD_FIELDS, limit: opts?.limit ?? 100 };
    if (opts?.effective_status) params.effective_status = JSON.stringify(opts.effective_status);
    const res = await graph<{ data: any[] }>(`${prefix}/ads`, token!, { params });
    if (res.error) return { error: res.error };
    return { data: res.data?.data || [] };
}

export async function getAd(adId: string): Promise<ActionResult> {
    const { token, error } = await requireToken();
    if (error) return { error };
    return graph(adId, token!, { params: { fields: AD_FIELDS } });
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
    const acc = validate(AdAccountIdSchema, adAccountId);
    if ('error' in acc) return { error: acc.error };
    const v = validate(CreateAdInput, payload);
    if ('error' in v) return { error: v.error };

    const { token, error } = await requireToken();
    if (error) return { error };

    const body: Record<string, any> = {
        name: v.data.name,
        adset_id: v.data.adset_id,
        status: v.data.status || 'PAUSED',
    };
    if (v.data.creative_id) body.creative = JSON.stringify({ creative_id: v.data.creative_id });
    else if (v.data.creative) body.creative = JSON.stringify(v.data.creative);
    if (v.data.tracking_specs) body.tracking_specs = JSON.stringify(v.data.tracking_specs);

    return graph(`${withActPrefix(acc.data)}/ads`, token!, { method: 'POST', body });
}

export async function updateAd(adId: string, patch: Record<string, any>): Promise<ActionResult> {
    const { token, error } = await requireToken();
    if (error) return { error };
    return graph(adId, token!, { method: 'POST', body: patch });
}

export async function deleteAd(adId: string): Promise<ActionResult> {
    const { token, error } = await requireToken();
    if (error) return { error };
    return graph(adId, token!, { method: 'DELETE' });
}

export async function duplicateAd(adId: string): Promise<ActionResult> {
    const { token, error } = await requireToken();
    if (error) return { error };
    return graph(`${adId}/copies`, token!, { method: 'POST' });
}

export async function getAdPreview(adId: string, adFormat: string): Promise<ActionResult<{ body: string }>> {
    const { token, error } = await requireToken();
    if (error) return { error };
    const res = await graph<{ data: { body: string }[] }>(`${adId}/previews`, token!, {
        params: { ad_format: adFormat },
    });
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
    const { token, error } = await requireToken();
    if (error) return { error };
    const res = await graph<{ data: any[] }>(`${withActPrefix(adAccountId)}/adcreatives`, token!, {
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
    const acc = validate(AdAccountIdSchema, adAccountId);
    if ('error' in acc) return { error: acc.error };
    const v = validate(CreateCreativeInput, payload);
    if ('error' in v) return { error: v.error };

    const { token, error } = await requireToken();
    if (error) return { error };

    const body: Record<string, any> = { name: v.data.name };
    if (v.data.object_story_spec) body.object_story_spec = JSON.stringify(v.data.object_story_spec);
    if (v.data.asset_feed_spec) body.asset_feed_spec = JSON.stringify(v.data.asset_feed_spec);
    if (v.data.url_tags) body.url_tags = v.data.url_tags;
    if (v.data.degrees_of_freedom_spec) body.degrees_of_freedom_spec = JSON.stringify(v.data.degrees_of_freedom_spec);
    return graph(`${withActPrefix(acc.data)}/adcreatives`, token!, { method: 'POST', body });
}

export async function deleteCreative(creativeId: string): Promise<ActionResult> {
    const { token, error } = await requireToken();
    if (error) return { error };
    return graph(creativeId, token!, { method: 'DELETE' });
}

export async function generatePreviewFromCreative(
    adAccountId: string,
    creativePayload: Record<string, any>,
    adFormat: string,
): Promise<ActionResult<{ body: string }>> {
    const { token, error } = await requireToken();
    if (error) return { error };
    const res = await graph<{ data: { body: string }[] }>(
        `${withActPrefix(adAccountId)}/generatepreviews`,
        token!,
        {
            params: {
                ad_format: adFormat,
                creative: JSON.stringify(creativePayload),
            },
        },
    );
    if (res.error) return { error: res.error };
    return { data: { body: res.data?.data?.[0]?.body || '' } };
}

// =================================================================
//  ASSETS: IMAGES & VIDEOS
// =================================================================

export async function uploadAdImage(formData: FormData): Promise<{ imageHash?: string; imageUrl?: string; error?: string }> {
    const { token, error } = await requireToken();
    if (error) return { error };

    const adAccountIdRaw = formData.get('adAccountId') as string;
    const adAccountId = adAccountIdRaw ? withActPrefix(adAccountIdRaw) : null;
    if (!adAccountId) return { error: 'Ad Account ID required for upload' };

    const file = formData.get('file') as File;
    if (!file) return { error: 'No file provided' };

    try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const url = `${GRAPH}/${adAccountId}/adimages`;
        const uploadData = new FormData();
        uploadData.append('filename', new Blob([buffer as any]), file.name);
        uploadData.append('access_token', token!);

        const res = await fetch(url, { method: 'POST', body: uploadData });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);

        const imageInfo = Object.values(data.images)[0] as any;
        return { imageHash: imageInfo.hash, imageUrl: imageInfo.url };
    } catch (e: any) {
        return { error: e.message || 'Failed to upload image' };
    }
}

export async function listAdImages(adAccountId: string): Promise<ActionResult<any[]>> {
    const { token, error } = await requireToken();
    if (error) return { error };
    const res = await graph<{ data: any[] }>(`${withActPrefix(adAccountId)}/adimages`, token!, {
        params: { fields: 'hash,name,url,width,height,created_time', limit: 100 },
    });
    if (res.error) return { error: res.error };
    return { data: res.data?.data || [] };
}

export async function uploadAdVideo(formData: FormData): Promise<{ videoId?: string; error?: string }> {
    const { token, error } = await requireToken();
    if (error) return { error };
    const adAccountIdRaw = formData.get('adAccountId') as string;
    const adAccountId = adAccountIdRaw ? withActPrefix(adAccountIdRaw) : null;
    if (!adAccountId) return { error: 'Ad Account ID required' };

    const file = formData.get('file') as File;
    if (!file) return { error: 'No file provided' };

    try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const url = `${GRAPH}/${adAccountId}/advideos`;
        const uploadData = new FormData();
        uploadData.append('source', new Blob([buffer as any]), file.name);
        uploadData.append('access_token', token!);
        const res = await fetch(url, { method: 'POST', body: uploadData });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        return { videoId: data.id };
    } catch (e: any) {
        return { error: e.message || 'Failed to upload video' };
    }
}

export async function listAdVideos(adAccountId: string): Promise<ActionResult<any[]>> {
    const { token, error } = await requireToken();
    if (error) return { error };
    const res = await graph<{ data: any[] }>(`${withActPrefix(adAccountId)}/advideos`, token!, {
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
    const { token, error } = await requireToken();
    if (error) return { error };
    if (!adAccountId) return { audiences: [] };
    const res = await graph<{ data: any[] }>(`${withActPrefix(adAccountId)}/customaudiences`, token!, {
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
    const acc = validate(AdAccountIdSchema, adAccountId);
    if ('error' in acc) return { error: acc.error };
    const v = validate(CreateCustomAudienceInput, payload);
    if ('error' in v) return { error: v.error };

    const { token, error } = await requireToken();
    if (error) return { error };

    const body: Record<string, any> = {
        name: v.data.name,
        subtype: v.data.subtype,
    };
    if (v.data.description) body.description = v.data.description;
    if (v.data.customer_file_source) body.customer_file_source = v.data.customer_file_source;
    if (v.data.retention_days) body.retention_days = v.data.retention_days;
    if (v.data.rule) body.rule = JSON.stringify(v.data.rule);
    const res = await graph<{ id: string }>(`${withActPrefix(acc.data)}/customaudiences`, token!, {
        method: 'POST',
        body,
    });
    if (!res.error) revalidatePath('/dashboard/ad-manager/audiences');
    return res;
}

export async function createLookalikeAudience(
    adAccountId: string,
    payload: {
        name: string;
        origin_audience_id: string;
        country: string;
        ratio?: number; // 0.01 .. 0.20
    },
): Promise<ActionResult> {
    const acc = validate(AdAccountIdSchema, adAccountId);
    if ('error' in acc) return { error: acc.error };
    const v = validate(CreateLookalikeInput, payload);
    if ('error' in v) return { error: v.error };

    const { token, error } = await requireToken();
    if (error) return { error };

    const body = {
        name: v.data.name,
        subtype: 'LOOKALIKE',
        origin_audience_id: v.data.origin_audience_id,
        lookalike_spec: JSON.stringify({
            type: 'similarity',
            country: v.data.country,
            ratio: v.data.ratio ?? 0.01,
        }),
    };
    const res = await graph(`${withActPrefix(acc.data)}/customaudiences`, token!, { method: 'POST', body });
    if (!res.error) revalidatePath('/dashboard/ad-manager/audiences');
    return res;
}

export async function deleteCustomAudience(audienceId: string): Promise<ActionResult> {
    const { token, error } = await requireToken();
    if (error) return { error };
    const res = await graph(audienceId, token!, { method: 'DELETE' });
    if (!res.error) revalidatePath('/dashboard/ad-manager/audiences');
    return res;
}

export async function getSavedAudiences(adAccountId: string): Promise<ActionResult<any[]>> {
    const { token, error } = await requireToken();
    if (error) return { error };
    const res = await graph<{ data: any[] }>(`${withActPrefix(adAccountId)}/saved_audiences`, token!, {
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
    const { token, error } = await requireToken();
    if (error) return { error };
    const params: any = { type, q: query, limit: 25 };
    if (locationTypes && type === 'adgeolocation') params.location_types = JSON.stringify(locationTypes);
    const res = await graph<{ data: any[] }>('search', token!, { params });
    if (res.error) return { error: res.error };
    return { data: res.data?.data || [] };
}

export async function browseTargeting(
    type: 'adinterest_category' | 'behaviors' | 'demographics',
): Promise<ActionResult<any[]>> {
    const { token, error } = await requireToken();
    if (error) return { error };
    const res = await graph<{ data: any[] }>(`targetingbrowse`, token!, { params: { type } });
    if (res.error) return { error: res.error };
    return { data: res.data?.data || [] };
}

export async function getReachEstimate(
    adAccountId: string,
    targeting: Record<string, any>,
    opts?: { optimization_goal?: string; currency?: string },
): Promise<ActionResult> {
    const acc = validate(AdAccountIdSchema, adAccountId);
    if ('error' in acc) return { error: acc.error };
    const v = validate(ReachEstimateInput, { targeting, ...opts });
    if ('error' in v) return { error: v.error };

    const { token, error } = await requireToken();
    if (error) return { error };
    const params: any = { targeting_spec: JSON.stringify(v.data.targeting) };
    if (v.data.optimization_goal) params.optimization_goal = v.data.optimization_goal;
    return graph(`${withActPrefix(acc.data)}/reachestimate`, token!, { params });
}

export async function getDeliveryEstimate(
    adAccountId: string,
    payload: {
        targeting_spec: Record<string, any>;
        optimization_goal: string;
        daily_budget?: number;
    },
): Promise<ActionResult> {
    const acc = validate(AdAccountIdSchema, adAccountId);
    if ('error' in acc) return { error: acc.error };
    const v = validate(DeliveryEstimateInput, payload);
    if ('error' in v) return { error: v.error };

    const { token, error } = await requireToken();
    if (error) return { error };
    return graph(`${withActPrefix(acc.data)}/delivery_estimate`, token!, {
        params: {
            targeting_spec: JSON.stringify(v.data.targeting_spec),
            optimization_goal: v.data.optimization_goal,
            daily_budget: v.data.daily_budget,
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
        const v = validate(InsightsQueryInput, opts);
        if ('error' in v) return { error: v.error };
    }

    const { token, error } = await requireToken();
    if (error) return { error };

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

    const res = await graph<{ data: any[] }>(`${nodeId}/insights`, token!, { params });
    if (res.error) return { error: res.error };
    return { data: res.data?.data || [] };
}

export async function exportInsightsAsync(
    objectId: string,
    opts?: {
        level?: string;
        date_preset?: string;
        fields?: string[];
        breakdowns?: string[];
    },
): Promise<ActionResult<{ report_run_id: string }>> {
    const { token, error } = await requireToken();
    if (error) return { error };
    const params: any = {
        level: opts?.level || 'ad',
        fields: (opts?.fields || DEFAULT_INSIGHT_FIELDS.split(',')).join(','),
    };
    if (opts?.date_preset) params.date_preset = opts.date_preset;
    if (opts?.breakdowns?.length) params.breakdowns = opts.breakdowns.join(',');
    return graph(`${objectId}/insights`, token!, { method: 'POST', params });
}

// =================================================================
//  PIXELS / DATASETS
// =================================================================

export async function listPixels(adAccountId: string): Promise<ActionResult<any[]>> {
    const { token, error } = await requireToken();
    if (error) return { error };
    const res = await graph<{ data: any[] }>(`${withActPrefix(adAccountId)}/adspixels`, token!, {
        params: { fields: 'id,name,code,last_fired_time,is_created_by_business,creation_time,owner_business' },
    });
    if (res.error) return { error: res.error };
    return { data: res.data?.data || [] };
}

export async function createPixel(adAccountId: string, name: string): Promise<ActionResult> {
    const { token, error } = await requireToken();
    if (error) return { error };
    return graph(`${withActPrefix(adAccountId)}/adspixels`, token!, { method: 'POST', body: { name } });
}

export async function getPixelStats(pixelId: string, aggregation: 'event' | 'browser_type' | 'url' = 'event'): Promise<ActionResult> {
    const { token, error } = await requireToken();
    if (error) return { error };
    return graph(`${pixelId}/stats`, token!, { params: { aggregation } });
}

// =================================================================
//  BATCH STATUS UPDATE + GENERIC UPDATE ENTITY STATUS
// =================================================================

export async function updateEntityStatus(
    id: string,
    type: 'campaign' | 'adset' | 'ad',
    status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED',
): Promise<{ success: boolean; error?: string }> {
    const { token, error } = await requireToken();
    if (error) return { success: false, error };
    const res = await graph(id, token!, { method: 'POST', body: { status } });
    if (res.error) return { success: false, error: res.error };
    if (type === 'campaign') {
        try {
            const { db } = await connectToDatabase();
            await db.collection('ad_campaigns').updateOne(
                { metaCampaignId: id },
                { $set: { status } },
            );
        } catch {}
    }
    revalidatePath('/dashboard/ad-manager/campaigns');
    return { success: true };
}

export async function batchUpdateStatus(
    ids: string[],
    status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED',
): Promise<{ success: boolean; errors?: string[] }> {
    const { token, error } = await requireToken();
    if (error) return { success: false, errors: [error] };
    const batch = ids.map((id) => ({
        method: 'POST',
        relative_url: `${id}?status=${status}`,
    }));
    const res = await graph('', token!, { method: 'POST', body: { batch: JSON.stringify(batch) } });
    if (res.error) return { success: false, errors: [res.error] };
    revalidatePath('/dashboard/ad-manager/campaigns');
    return { success: true };
}

// =================================================================
//  FACEBOOK PAGES + INSTAGRAM ACCOUNTS (used in creative wizard)
// =================================================================

export async function getFacebookPagesForAdCreation(): Promise<{ pages?: FacebookPage[]; error?: string }> {
    const session = await getSession();
    const token = (session?.user as any)?.metaSuiteAccessToken;
    if (!token) return { error: 'Facebook account not connected.' };
    try {
        const res = await axios.get(`${GRAPH}/me/accounts`, {
            params: { fields: 'id,name,access_token,category,picture{url}', access_token: token },
        });
        if (res.data.error) throw new Error(res.data.error.message);
        return { pages: res.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function getInstagramAccountsForPage(pageId: string): Promise<ActionResult<any[]>> {
    const session = await getSession();
    const token = (session?.user as any)?.metaSuiteAccessToken;
    if (!token) return { error: 'Facebook account not connected.' };
    try {
        const res = await axios.get(`${GRAPH}/${pageId}`, {
            params: { fields: 'instagram_business_account{id,username,profile_picture_url}', access_token: token },
        });
        const ig = res.data?.instagram_business_account;
        return { data: ig ? [ig] : [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

// =================================================================
//  LEGACY: local DB backed "quick create" wizard
//  (kept for the one-click Click-to-WhatsApp ad create flow)
// =================================================================

export async function getAdCampaigns(adAccountId: string): Promise<{ campaigns?: WithId<AdCampaign>[]; error?: string }> {
    const { token, error } = await requireToken();
    if (error) return { campaigns: [], error };
    if (!adAccountId) return { campaigns: [] };

    try {
        const session = await getSession();
        const { db } = await connectToDatabase();
        const localCampaigns = await db
            .collection<AdCampaign>('ad_campaigns')
            .find({ adAccountId, userId: new ObjectId(session!.user._id) })
            .sort({ createdAt: -1 })
            .toArray();

        if (localCampaigns.length === 0) return { campaigns: [] };

        const adIds = localCampaigns.map((c) => c.metaAdId).filter(Boolean);
        if (adIds.length === 0) return { campaigns: JSON.parse(JSON.stringify(localCampaigns)) };

        const { data } = await graph<any>('', token!, {
            params: {
                ids: adIds.join(','),
                fields: 'status,insights{impressions, clicks, spend, ctr}',
            },
        });

        const combined = localCampaigns.map((c) => {
            const m = data?.[c.metaAdId];
            return m ? { ...c, status: m.status || c.status, insights: m.insights?.data?.[0] || {} } : c;
        });
        return { campaigns: JSON.parse(JSON.stringify(combined)) };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function handleCreateAdCampaign(
    _prevState: any,
    formData: FormData,
): Promise<{ message?: string; error?: string }> {
    const { token, error } = await requireToken();
    if (error) return { error };
    const session = await getSession();

    const adAccountId = withActPrefix(formData.get('adAccountId') as string);
    const facebookPageId = formData.get('facebookPageId') as string;
    const campaignName = formData.get('campaignName') as string;
    const dailyBudget = Number(formData.get('dailyBudget')) * 100;
    const adMessage = formData.get('adMessage') as string;
    const destinationUrl = formData.get('destinationUrl') as string;
    const objective = (formData.get('objective') as string) || 'OUTCOME_TRAFFIC';
    const status = (formData.get('status') as string) || 'PAUSED';
    const imageHash = formData.get('imageHash') as string;
    const targetCountry = (formData.get('targetCountry') as string) || 'IN';
    const minAge = Number(formData.get('minAge')) || 18;
    const maxAge = Number(formData.get('maxAge')) || 65;

    if (!adAccountId || !facebookPageId || !campaignName || isNaN(dailyBudget) || !adMessage || !destinationUrl) {
        return { error: 'All fields are required, including Name, Objective, Status, and Budget.' };
    }

    try {
        // 1. Campaign
        const camp = await graph<{ id: string }>(`${adAccountId}/campaigns`, token!, {
            method: 'POST',
            body: {
                name: campaignName,
                objective,
                status,
                special_ad_categories: JSON.stringify([]),
            },
        });
        if (camp.error || !camp.data?.id) throw new Error(camp.error || 'Failed to create campaign.');

        // 2. Ad set
        const adset = await graph<{ id: string }>(`${adAccountId}/adsets`, token!, {
            method: 'POST',
            body: {
                name: `${campaignName} Ad Set`,
                campaign_id: camp.data.id,
                daily_budget: dailyBudget,
                billing_event: 'IMPRESSIONS',
                optimization_goal: 'LINK_CLICKS',
                targeting: JSON.stringify({
                    geo_locations: { countries: [targetCountry] },
                    age_min: minAge,
                    age_max: maxAge,
                }),
                status,
            },
        });
        if (adset.error || !adset.data?.id) throw new Error(adset.error || 'Failed to create ad set.');

        // 3. Creative
        const creative = await graph<{ id: string }>(`${adAccountId}/adcreatives`, token!, {
            method: 'POST',
            body: {
                name: `${campaignName} Ad Creative`,
                object_story_spec: JSON.stringify({
                    page_id: facebookPageId,
                    link_data: {
                        message: adMessage,
                        link: destinationUrl,
                        ...(imageHash ? { image_hash: imageHash } : { image_url: 'https://placehold.co/1200x628.png' }),
                        call_to_action: { type: 'LEARN_MORE', value: { link: destinationUrl } },
                    },
                }),
            },
        });
        if (creative.error || !creative.data?.id) throw new Error(creative.error || 'Failed to create creative.');

        // 4. Ad
        const ad = await graph<{ id: string }>(`${adAccountId}/ads`, token!, {
            method: 'POST',
            body: {
                name: `${campaignName} Ad`,
                adset_id: adset.data.id,
                creative: JSON.stringify({ creative_id: creative.data.id }),
                status,
            },
        });
        if (ad.error || !ad.data?.id) throw new Error(ad.error || 'Failed to create ad.');

        const { db } = await connectToDatabase();
        await db.collection('ad_campaigns').insertOne({
            userId: new ObjectId(session!.user._id),
            adAccountId,
            name: campaignName,
            status,
            dailyBudget: dailyBudget / 100,
            metaCampaignId: camp.data.id,
            metaAdSetId: adset.data.id,
            metaAdCreativeId: creative.data.id,
            metaAdId: ad.data.id,
            createdAt: new Date(),
        } as any);

        revalidatePath('/dashboard/ad-manager/campaigns');
        return { message: `Ad campaign "${campaignName}" created successfully!` };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

// Back-compat shims used by the old page routes -------------------

export async function getAdSets(campaignId: string): Promise<{ adSets?: any[]; error?: string }> {
    const res = await listAdSets(campaignId, 'campaign');
    if (res.error) return { error: res.error };
    return { adSets: res.data || [] };
}

export async function getAds(adSetId: string): Promise<{ ads?: any[]; error?: string }> {
    const { token, error } = await requireToken();
    if (error) return { error };
    const res = await graph<{ data: any[] }>(`${adSetId}/ads`, token!, {
        params: {
            fields: 'id,name,status,creative{image_url,thumbnail_url,object_story_spec},insights{impressions,clicks,spend,ctr}',
        },
    });
    if (res.error) return { error: res.error };
    const ads = (res.data?.data || []).map((ad: any) => ({
        ...ad,
        insights: ad.insights?.data?.[0] || {},
        imageUrl:
            ad.creative?.image_url ||
            ad.creative?.thumbnail_url ||
            ad.creative?.object_story_spec?.link_data?.image_url,
    }));
    return { ads };
}

// =================================================================
//  EXTENDED META MARKETING API COVERAGE
// =================================================================

// ----- Ad Labels -------------------------------------------------

export async function listAdLabels(adAccountId: string): Promise<ActionResult<any[]>> {
    const { token, error } = await requireToken();
    if (error) return { error };
    const res = await graph<{ data: any[] }>(`${withActPrefix(adAccountId)}/adlabels`, token!, {
        params: { fields: 'id,name,created_time,updated_time' },
    });
    return res.error ? { error: res.error } : { data: res.data?.data || [] };
}

export async function createAdLabel(adAccountId: string, name: string): Promise<ActionResult> {
    const { token, error } = await requireToken();
    if (error) return { error };
    return graph(`${withActPrefix(adAccountId)}/adlabels`, token!, { method: 'POST', body: { name } });
}

export async function attachAdLabel(objectId: string, labelId: string): Promise<ActionResult> {
    const { token, error } = await requireToken();
    if (error) return { error };
    return graph(`${objectId}/adlabels`, token!, {
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
    const { token, error } = await requireToken();
    if (error) return { error };
    const res = await graph<{ data: any[] }>(`${withActPrefix(adAccountId)}/customconversions`, token!, {
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
    const acc = validate(AdAccountIdSchema, adAccountId);
    if ('error' in acc) return { error: acc.error };
    const v = validate(CustomConversionInput, payload);
    if ('error' in v) return { error: v.error };

    const { token, error } = await requireToken();
    if (error) return { error };
    return graph(`${withActPrefix(acc.data)}/customconversions`, token!, {
        method: 'POST',
        body: {
            name: v.data.name,
            description: v.data.description || '',
            custom_event_type: v.data.custom_event_type,
            rule: JSON.stringify(v.data.rule),
            default_conversion_value: v.data.default_conversion_value,
        },
    });
}

// ----- Offline / CAPI events -------------------------------------

export async function sendConversionApiEvent(
    pixelId: string,
    payload: { event_name: string; event_time: number; user_data: Record<string, any>; custom_data?: Record<string, any>; action_source?: string; event_source_url?: string },
): Promise<ActionResult> {
    const p = validate(FbIdSchema, pixelId);
    if ('error' in p) return { error: p.error };
    const v = validate(ConversionApiEventInput, payload);
    if ('error' in v) return { error: v.error };

    const { token, error } = await requireToken();
    if (error) return { error };
    return graph(`${p.data}/events`, token!, {
        method: 'POST',
        body: {
            data: JSON.stringify([
                {
                    event_name: v.data.event_name,
                    event_time: v.data.event_time,
                    action_source: v.data.action_source || 'website',
                    event_source_url: v.data.event_source_url,
                    user_data: v.data.user_data,
                    custom_data: v.data.custom_data,
                },
            ]),
        },
    });
}

export async function listOfflineEventSets(adAccountId: string): Promise<ActionResult<any[]>> {
    const { token, error } = await requireToken();
    if (error) return { error };
    const res = await graph<{ data: any[] }>(`${withActPrefix(adAccountId)}/offline_conversion_data_sets`, token!, {
        params: { fields: 'id,name,description,event_stats,valid_entries,matched_entries' },
    });
    return res.error ? { error: res.error } : { data: res.data?.data || [] };
}

export async function uploadOfflineEvents(
    dataSetId: string,
    events: Array<Record<string, any>>,
): Promise<ActionResult> {
    const { token, error } = await requireToken();
    if (error) return { error };
    return graph(`${dataSetId}/events`, token!, {
        method: 'POST',
        body: {
            upload_tag: `sabnode_${Date.now()}`,
            data: JSON.stringify(events),
        },
    });
}

// ----- Lead Forms / Lead Ads -------------------------------------

export async function listLeadGenForms(pageId: string): Promise<ActionResult<any[]>> {
    const { token, error } = await requireToken();
    if (error) return { error };
    const res = await graph<{ data: any[] }>(`${pageId}/leadgen_forms`, token!, {
        params: { fields: 'id,name,status,locale,leads_count,created_time,privacy_policy_url' },
    });
    return res.error ? { error: res.error } : { data: res.data?.data || [] };
}

export async function getLeadsFromForm(formId: string, since?: number): Promise<ActionResult<any[]>> {
    const { token, error } = await requireToken();
    if (error) return { error };
    const params: any = { fields: 'id,created_time,field_data,form_id,ad_id,adset_id,campaign_id' };
    if (since) params.filtering = JSON.stringify([{ field: 'time_created', operator: 'GREATER_THAN', value: since }]);
    const res = await graph<{ data: any[] }>(`${formId}/leads`, token!, { params });
    return res.error ? { error: res.error } : { data: res.data?.data || [] };
}

// ----- Catalogs / Product sets / DPA -----------------------------

export async function listCatalogs(businessId: string): Promise<ActionResult<any[]>> {
    const { token, error } = await requireToken();
    if (error) return { error };
    const res = await graph<{ data: any[] }>(`${businessId}/owned_product_catalogs`, token!, {
        params: { fields: 'id,name,product_count,vertical,feed_count' },
    });
    return res.error ? { error: res.error } : { data: res.data?.data || [] };
}

export async function listProductSets(catalogId: string): Promise<ActionResult<any[]>> {
    const { token, error } = await requireToken();
    if (error) return { error };
    const res = await graph<{ data: any[] }>(`${catalogId}/product_sets`, token!, {
        params: { fields: 'id,name,product_count,filter' },
    });
    return res.error ? { error: res.error } : { data: res.data?.data || [] };
}

export async function createProductSet(
    catalogId: string,
    payload: { name: string; filter?: Record<string, any> },
): Promise<ActionResult> {
    const { token, error } = await requireToken();
    if (error) return { error };
    return graph(`${catalogId}/product_sets`, token!, {
        method: 'POST',
        body: {
            name: payload.name,
            filter: payload.filter ? JSON.stringify(payload.filter) : undefined,
        },
    });
}

// ----- Customer file audience (SHA-256 hashed) -------------------

export async function addUsersToCustomAudience(
    audienceId: string,
    schema: string[], // e.g. ['EMAIL','PHONE','FN','LN','CT','ST','ZIP','COUNTRY']
    hashedUsers: string[][], // pre-hashed (SHA-256) rows matching `schema`
): Promise<ActionResult> {
    const { token, error } = await requireToken();
    if (error) return { error };
    return graph(`${audienceId}/users`, token!, {
        method: 'POST',
        body: {
            payload: JSON.stringify({ schema, data: hashedUsers }),
        },
    });
}

export async function removeUsersFromCustomAudience(
    audienceId: string,
    schema: string[],
    hashedUsers: string[][],
): Promise<ActionResult> {
    const { token, error } = await requireToken();
    if (error) return { error };
    return graph(`${audienceId}/users`, token!, {
        method: 'DELETE',
        body: { payload: JSON.stringify({ schema, data: hashedUsers }) },
    });
}

// ----- Saved audiences CRUD -------------------------------------

export async function createSavedAudience(
    adAccountId: string,
    payload: { name: string; description?: string; targeting: Record<string, any> },
): Promise<ActionResult> {
    const { token, error } = await requireToken();
    if (error) return { error };
    return graph(`${withActPrefix(adAccountId)}/saved_audiences`, token!, {
        method: 'POST',
        body: {
            name: payload.name,
            description: payload.description || '',
            targeting: JSON.stringify(payload.targeting),
        },
    });
}

export async function deleteSavedAudience(audienceId: string): Promise<ActionResult> {
    const { token, error } = await requireToken();
    if (error) return { error };
    return graph(audienceId, token!, { method: 'DELETE' });
}

// ----- Async report jobs -----------------------------------------

export async function getReportRunStatus(reportRunId: string): Promise<ActionResult> {
    const { token, error } = await requireToken();
    if (error) return { error };
    return graph(reportRunId, token!, {
        params: { fields: 'id,async_status,async_percent_completion,date_start,date_stop' },
    });
}

export async function getReportRunInsights(reportRunId: string): Promise<ActionResult<any[]>> {
    const { token, error } = await requireToken();
    if (error) return { error };
    const res = await graph<{ data: any[] }>(`${reportRunId}/insights`, token!, { params: { limit: 1000 } });
    return res.error ? { error: res.error } : { data: res.data?.data || [] };
}

// ----- Interest suggestions / validation -------------------------

export async function suggestTargeting(
    interestList: string[],
): Promise<ActionResult<any[]>> {
    const { token, error } = await requireToken();
    if (error) return { error };
    const res = await graph<{ data: any[] }>('search', token!, {
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
    const { token, error } = await requireToken();
    if (error) return { error };
    const res = await graph<{ data: any[] }>('search', token!, {
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
    const { token, error } = await requireToken();
    if (error) return { error };
    const res = await graph<{ data: any[] }>(`${withActPrefix(adAccountId)}/assigned_users`, token!, {
        params: { fields: 'id,name,email,role,permitted_tasks,business' },
    });
    return res.error ? { error: res.error } : { data: res.data?.data || [] };
}

export async function listAdAccountAgencies(adAccountId: string): Promise<ActionResult<any[]>> {
    const { token, error } = await requireToken();
    if (error) return { error };
    const res = await graph<{ data: any[] }>(`${withActPrefix(adAccountId)}/agencies`, token!, {
        params: { fields: 'id,name,verification_status,permitted_tasks' },
    });
    return res.error ? { error: res.error } : { data: res.data?.data || [] };
}

// ----- Payment methods / invoices --------------------------------

export async function getAdAccountSpend(adAccountId: string, since?: string, until?: string): Promise<ActionResult> {
    const { token, error } = await requireToken();
    if (error) return { error };
    return graph(`${withActPrefix(adAccountId)}`, token!, {
        params: {
            fields: 'amount_spent,balance,currency,funding_source_details,min_daily_budget,spend_cap',
        },
    });
}

export async function listBusinessInvoices(businessId: string): Promise<ActionResult<any[]>> {
    const { token, error } = await requireToken();
    if (error) return { error };
    const res = await graph<{ data: any[] }>(`${businessId}/business_invoices`, token!, {
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
    payload: {
        name: string;
        page_id: string;
        product_set_id: string;
        message: string;
        link: string;
    },
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
    const { token, error } = await requireToken();
    if (error) return { error };
    const res = await graph<{ data: any[] }>(`${withActPrefix(adAccountId)}/adrules_library`, token!, {
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
    const acc = validate(AdAccountIdSchema, adAccountId);
    if ('error' in acc) return { error: acc.error };
    const v = validate(AdRuleInput, payload);
    if ('error' in v) return { error: v.error };

    const { token, error } = await requireToken();
    if (error) return { error };
    return graph(`${withActPrefix(acc.data)}/adrules_library`, token!, {
        method: 'POST',
        body: {
            name: v.data.name,
            evaluation_spec: JSON.stringify(v.data.evaluation_spec),
            execution_spec: JSON.stringify(v.data.execution_spec),
            schedule_spec: v.data.schedule_spec ? JSON.stringify(v.data.schedule_spec) : undefined,
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

// =================================================================
//  DEEPEST META API SURFACE — things most wrappers don't expose
// =================================================================

// ----- Reach & Frequency prediction ------------------------------

export async function createReachFrequencyPrediction(
    adAccountId: string,
    payload: {
        campaign_group_id?: string;
        name: string;
        target_spec: Record<string, any>;
        budget: number; // minor units
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
    const { token, error } = await requireToken();
    if (error) return { error };
    return graph(`${withActPrefix(adAccountId)}/reachfrequencypredictions`, token!, {
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
    const { token, error } = await requireToken();
    if (error) return { error };
    const res = await graph<{ data: any[] }>(`${withActPrefix(adAccountId)}/reachfrequencypredictions`, token!, {
        params: {
            fields: 'id,name,status,budget,reservation_status,impression_curve,prediction_mode,start_time,end_time,target_audience_size,frequency_cap',
        },
    });
    return res.error ? { error: res.error } : { data: res.data?.data || [] };
}

// ----- Targeting sentence lines (human-readable targeting) -------

export async function getTargetingSentenceLines(
    adAccountId: string,
    targeting: Record<string, any>,
): Promise<ActionResult<any[]>> {
    const { token, error } = await requireToken();
    if (error) return { error };
    const res = await graph<{ data: any[] }>(
        `${withActPrefix(adAccountId)}/targetingsentencelines`,
        token!,
        { params: { targeting_spec: JSON.stringify(targeting) } },
    );
    return res.error ? { error: res.error } : { data: res.data?.data || [] };
}

// ----- Ad preview iframe (all positions) -------------------------
// AD_PREVIEW_FORMATS is declared in constants.ts (non-server file)
// so this file can stay pure server actions. It's imported at the top.

export async function getAllAdPreviews(adId: string): Promise<ActionResult<Record<string, string>>> {
    const { token, error } = await requireToken();
    if (error) return { error };

    const results: Record<string, string> = {};
    const tasks = AD_PREVIEW_FORMATS.map(async (fmt) => {
        const res = await graph<{ data: { body: string }[] }>(`${adId}/previews`, token!, {
            params: { ad_format: fmt },
        });
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
    const { token, error } = await requireToken();
    if (error) return { error };

    // 1) Kick off
    const params: any = {
        level: opts.level || 'ad',
        fields: (opts.fields || ['campaign_id', 'adset_id', 'ad_id', 'impressions', 'clicks', 'spend']).join(','),
    };
    if (opts.date_preset) params.date_preset = opts.date_preset;
    if (opts.time_range) params.time_range = JSON.stringify(opts.time_range);
    if (opts.breakdowns) params.breakdowns = opts.breakdowns.join(',');

    const kick = await graph<{ report_run_id: string }>(`${objectId}/insights`, token!, {
        method: 'POST',
        params,
    });
    if (kick.error || !kick.data?.report_run_id) return { error: kick.error || 'Failed to start report' };
    const runId = kick.data.report_run_id;

    // 2) Poll until done or timeout (~2 min)
    const started = Date.now();
    while (Date.now() - started < 120_000) {
        const status = await graph<{ async_status: string; async_percent_completion: number }>(
            runId,
            token!,
            { params: { fields: 'async_status,async_percent_completion' } },
        );
        if (status.error) return { error: status.error };
        onProgress?.(status.data?.async_percent_completion || 0);
        if (status.data?.async_status === 'Job Completed') break;
        if (status.data?.async_status === 'Job Failed' || status.data?.async_status === 'Job Skipped') {
            return { error: `Async report ${status.data.async_status}` };
        }
        await new Promise((r) => setTimeout(r, 1_500));
    }

    // 3) Fetch results
    const results = await graph<{ data: any[] }>(`${runId}/insights`, token!, { params: { limit: 5000 } });
    return results.error ? { error: results.error } : { data: results.data?.data || [] };
}

// ----- Extended credit / business-level billing ------------------

export async function listExtendedCredits(businessId: string): Promise<ActionResult<any[]>> {
    const { token, error } = await requireToken();
    if (error) return { error };
    const res = await graph<{ data: any[] }>(`${businessId}/extendedcredits`, token!, {
        params: {
            fields: 'id,credit_type,credit_available,credit_used,legal_entity_name,max_balance,owner_business',
        },
    });
    return res.error ? { error: res.error } : { data: res.data?.data || [] };
}

// ----- Business users / partners / agencies ---------------------

export async function listBusinessUsers(businessId: string): Promise<ActionResult<any[]>> {
    const { token, error } = await requireToken();
    if (error) return { error };
    const res = await graph<{ data: any[] }>(`${businessId}/business_users`, token!, {
        params: { fields: 'id,name,email,role,title,two_fac_status' },
    });
    return res.error ? { error: res.error } : { data: res.data?.data || [] };
}

export async function listBusinessPartners(businessId: string): Promise<ActionResult<any[]>> {
    const { token, error } = await requireToken();
    if (error) return { error };
    const res = await graph<{ data: any[] }>(`${businessId}/business_partners`, token!, {
        params: { fields: 'id,name,verification_status,two_factor_type' },
    });
    return res.error ? { error: res.error } : { data: res.data?.data || [] };
}

// ----- Page posts (for promoting existing posts) -----------------

export async function listPagePromotablePosts(pageId: string): Promise<ActionResult<any[]>> {
    const session = await getSession();
    const token = (session?.user as any)?.metaSuiteAccessToken;
    if (!token) return { error: 'Facebook account not connected.' };
    try {
        const res = await axios.get(`${GRAPH}/${pageId}/promotable_posts`, {
            params: {
                fields: 'id,message,created_time,picture,type,status_type,insights{name,values}',
                is_published: true,
                access_token: token,
            },
        });
        return { data: res.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

// ----- Instant Experience (canvas) ------------------------------

export async function listInstantExperiences(pageId: string): Promise<ActionResult<any[]>> {
    const session = await getSession();
    const token = (session?.user as any)?.metaSuiteAccessToken;
    if (!token) return { error: 'Facebook account not connected.' };
    try {
        const res = await axios.get(`${GRAPH}/${pageId}/canvases`, {
            params: {
                fields: 'id,name,canvas_link,body_elements,is_published,update_time',
                access_token: token,
            },
        });
        return { data: res.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

// ----- Branded Content handle ------------------------------------

export async function listBrandedContentHandles(pageId: string): Promise<ActionResult<any[]>> {
    const session = await getSession();
    const token = (session?.user as any)?.metaSuiteAccessToken;
    if (!token) return { error: 'Facebook account not connected.' };
    try {
        const res = await axios.get(`${GRAPH}/${pageId}/branded_content_ad_handlers`, {
            params: { access_token: token },
        });
        return { data: res.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

// ----- Instagram Business Account discovery ----------------------

export async function getInstagramBusinessAccount(pageId: string): Promise<ActionResult> {
    const session = await getSession();
    const token = (session?.user as any)?.metaSuiteAccessToken;
    if (!token) return { error: 'Facebook account not connected.' };
    try {
        const res = await axios.get(`${GRAPH}/${pageId}`, {
            params: {
                fields: 'instagram_business_account{id,username,name,profile_picture_url,followers_count,media_count,biography}',
                access_token: token,
            },
        });
        return { data: res.data?.instagram_business_account || null };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

// ----- Audience sharing -----------------------------------------

export async function shareCustomAudience(
    audienceId: string,
    accountIds: string[],
): Promise<ActionResult> {
    const { token, error } = await requireToken();
    if (error) return { error };
    return graph(`${audienceId}/adaccounts`, token!, {
        method: 'POST',
        body: {
            adaccounts: JSON.stringify(accountIds.map((a) => withActPrefix(a))),
        },
    });
}

export async function listSharedAudienceAccounts(audienceId: string): Promise<ActionResult<any[]>> {
    const { token, error } = await requireToken();
    if (error) return { error };
    const res = await graph<{ data: any[] }>(`${audienceId}/adaccounts`, token!, {
        params: { fields: 'id,account_id,name' },
    });
    return res.error ? { error: res.error } : { data: res.data?.data || [] };
}

// ----- Custom audience prefill (app install, web retargeting) ----

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

// ----- Pixel share / page permissions ---------------------------

export async function sharePixelWithAdAccount(
    pixelId: string,
    adAccountId: string,
): Promise<ActionResult> {
    const { token, error } = await requireToken();
    if (error) return { error };
    return graph(`${pixelId}/shared_accounts`, token!, {
        method: 'POST',
        body: { account_id: adAccountId.replace(/^act_/, '') },
    });
}

// ----- Video copyright / rights manager -------------------------

export async function listVideoCopyrights(pageId: string): Promise<ActionResult<any[]>> {
    const session = await getSession();
    const token = (session?.user as any)?.metaSuiteAccessToken;
    if (!token) return { error: 'Facebook account not connected.' };
    try {
        const res = await axios.get(`${GRAPH}/${pageId}/video_copyrights`, {
            params: {
                fields: 'id,copyright_content_id,creation_time,ownership_countries,reference_file,monitoring_status',
                access_token: token,
            },
        });
        return { data: res.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

// ----- Tracking / conversion spec introspection -----------------

export async function getSupportedActionTypes(): Promise<ActionResult<string[]>> {
    // Static list from Marketing API docs; useful for the UI when
    // building conversion rules without hitting Graph.
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

// ----- Promo codes / offers --------------------------------------

export async function listOffers(pageId: string): Promise<ActionResult<any[]>> {
    const session = await getSession();
    const token = (session?.user as any)?.metaSuiteAccessToken;
    if (!token) return { error: 'Facebook account not connected.' };
    try {
        const res = await axios.get(`${GRAPH}/${pageId}/offers`, {
            params: {
                fields: 'id,title,details,terms,expiration_time,online_code,barcode_type,barcode',
                access_token: token,
            },
        });
        return { data: res.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

// ----- Activities log (audit trail) ------------------------------

export async function getAdAccountActivities(
    adAccountId: string,
    opts?: { since?: string; until?: string; limit?: number },
): Promise<ActionResult<any[]>> {
    const { token, error } = await requireToken();
    if (error) return { error };
    const params: any = {
        fields: 'actor_name,application_id,event_type,event_time,object_id,object_name,object_type,translated_event_type,extra_data',
        limit: opts?.limit ?? 100,
    };
    if (opts?.since) params.since = opts.since;
    if (opts?.until) params.until = opts.until;
    const res = await graph<{ data: any[] }>(`${withActPrefix(adAccountId)}/activities`, token!, { params });
    return res.error ? { error: res.error } : { data: res.data?.data || [] };
}

// ----- Ad study (Brand Lift / Conversion Lift) -------------------

export async function listAdStudies(adAccountId: string): Promise<ActionResult<any[]>> {
    const { token, error } = await requireToken();
    if (error) return { error };
    const res = await graph<{ data: any[] }>(`${withActPrefix(adAccountId)}/ads_reporting_mmm_reports`, token!, {
        params: { fields: 'id,name,description,start_time,end_time,status,results' },
    });
    return res.error ? { error: res.error } : { data: res.data?.data || [] };
}

// ----- Search for targeting by category --------------------------

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

// ----- Mobile app install tracking (MMP) -------------------------

export async function listApplications(): Promise<ActionResult<any[]>> {
    const session = await getSession();
    const token = (session?.user as any)?.metaSuiteAccessToken;
    if (!token) return { error: 'Facebook account not connected.' };
    try {
        const res = await axios.get(`${GRAPH}/me/applications`, {
            params: {
                fields: 'id,name,namespace,link,icon_url,category,object_store_urls',
                access_token: token,
            },
        });
        return { data: res.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

// ----- Account limits / features --------------------------------

export async function getAdAccountCapabilities(adAccountId: string): Promise<ActionResult> {
    const { token, error } = await requireToken();
    if (error) return { error };
    return graph(withActPrefix(adAccountId), token!, {
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

