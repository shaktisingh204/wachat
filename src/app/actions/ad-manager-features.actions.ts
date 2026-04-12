'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import axios from 'axios';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { getErrorMessage } from '@/lib/utils';

const API_VERSION = 'v23.0';
const GRAPH = `https://graph.facebook.com/${API_VERSION}`;

async function requireToken(): Promise<{ token?: string; error?: string }> {
    const session = await getSession();
    const token = (session?.user as any)?.adManagerAccessToken;
    if (!token) return { error: 'Ad Manager account not connected.' };
    return { token };
}

function withAct(id: string): string {
    return id.startsWith('act_') ? id : `act_${id}`;
}


// =================================================================
//  AUTOMATED RULES
// =================================================================

export async function getAutomatedRules(adAccountId: string) {
    const { token, error } = await requireToken();
    if (error) return { error };
    try {
        const res = await axios.get(`${GRAPH}/${withAct(adAccountId)}/adrules_library`, {
            params: { fields: 'id,name,status,evaluation_spec,execution_spec,schedule_spec,created_time,updated_time', access_token: token, limit: 50 }
        });
        return { rules: res.data?.data || [] };
    } catch (e: any) { return { error: getErrorMessage(e) }; }
}

export async function createAutomatedRule(prevState: any, formData: FormData) {
    const adAccountId = formData.get('adAccountId') as string;
    const name = formData.get('name') as string;
    const entityType = formData.get('entityType') as string || 'CAMPAIGN';
    const actionType = formData.get('actionType') as string || 'PAUSE';
    const metricField = formData.get('metricField') as string || 'spend';
    const operator = formData.get('operator') as string || 'GREATER_THAN';
    const value = formData.get('value') as string;

    if (!adAccountId || !name || !value) return { error: 'Name, entity type, and threshold are required.' };
    const { token, error } = await requireToken();
    if (error) return { error };

    try {
        await axios.post(`${GRAPH}/${withAct(adAccountId)}/adrules_library`, {
            name,
            evaluation_spec: JSON.stringify({
                evaluation_type: 'SCHEDULE',
                filters: [{ field: metricField, operator, value: Number(value) }],
            }),
            execution_spec: JSON.stringify({
                execution_type: actionType,
            }),
            schedule_spec: JSON.stringify({
                schedule_type: 'SEMI_HOURLY',
            }),
            access_token: token,
        });
        revalidatePath('/dashboard/ad-manager/automated-rules');
        return { message: `Rule "${name}" created.` };
    } catch (e: any) { return { error: getErrorMessage(e) }; }
}

export async function deleteAutomatedRule(ruleId: string) {
    const { token, error } = await requireToken();
    if (error) return { error };
    try {
        await axios.delete(`${GRAPH}/${ruleId}`, { params: { access_token: token } });
        revalidatePath('/dashboard/ad-manager/automated-rules');
        return { success: true };
    } catch (e: any) { return { success: false, error: getErrorMessage(e) }; }
}


// =================================================================
//  CUSTOM CONVERSIONS
// =================================================================

export async function createCustomConversion(prevState: any, formData: FormData) {
    const adAccountId = formData.get('adAccountId') as string;
    const name = formData.get('name') as string;
    const pixelId = formData.get('pixelId') as string;
    const eventName = formData.get('eventName') as string || 'PURCHASE';
    const urlRule = formData.get('urlRule') as string;
    const defaultValue = formData.get('defaultValue') as string;

    if (!adAccountId || !name || !pixelId) return { error: 'Name and pixel are required.' };
    const { token, error } = await requireToken();
    if (error) return { error };

    try {
        const body: any = {
            name,
            pixel_id: pixelId,
            custom_event_type: eventName,
            access_token: token,
        };
        if (urlRule) body.rule = JSON.stringify({ url: { i_contains: urlRule } });
        if (defaultValue) body.default_conversion_value = Number(defaultValue);

        await axios.post(`${GRAPH}/${withAct(adAccountId)}/customconversions`, body);
        revalidatePath('/dashboard/ad-manager/custom-conversions');
        return { message: `Custom conversion "${name}" created.` };
    } catch (e: any) { return { error: getErrorMessage(e) }; }
}

export async function deleteCustomConversion(conversionId: string) {
    const { token, error } = await requireToken();
    if (error) return { error };
    try {
        await axios.delete(`${GRAPH}/${conversionId}`, { params: { access_token: token } });
        revalidatePath('/dashboard/ad-manager/custom-conversions');
        return { success: true };
    } catch (e: any) { return { success: false, error: getErrorMessage(e) }; }
}


// =================================================================
//  CATALOGS (Product Catalogs for Ads)
// =================================================================

export async function getAdCatalogs(adAccountId: string) {
    const { token, error } = await requireToken();
    if (error) return { error };
    try {
        const res = await axios.get(`${GRAPH}/${withAct(adAccountId)}/owned_product_catalogs`, {
            params: { fields: 'id,name,product_count,vertical', access_token: token, limit: 50 }
        });
        return { catalogs: res.data?.data || [] };
    } catch (e: any) { return { error: getErrorMessage(e) }; }
}

export async function createAdCatalog(adAccountId: string, name: string) {
    const { token, error } = await requireToken();
    if (error) return { error };
    try {
        const session = await getSession();
        // Catalogs are created at business level, try via ad account's business
        const accRes = await axios.get(`${GRAPH}/${withAct(adAccountId)}`, {
            params: { fields: 'business{id}', access_token: token }
        });
        const businessId = accRes.data?.business?.id;
        if (!businessId) return { error: 'No business found for this ad account.' };

        await axios.post(`${GRAPH}/${businessId}/owned_product_catalogs`, {
            name, access_token: token,
        });
        revalidatePath('/dashboard/ad-manager/catalogs');
        return { message: `Catalog "${name}" created.` };
    } catch (e: any) { return { error: getErrorMessage(e) }; }
}


// =================================================================
//  CAMPAIGN COMPARISON
// =================================================================

export async function compareCampaigns(campaignIds: string[]) {
    const { token, error } = await requireToken();
    if (error) return { error };
    try {
        const results = await Promise.all(campaignIds.map(async (id) => {
            const res = await axios.get(`${GRAPH}/${id}/insights`, {
                params: {
                    fields: 'campaign_name,impressions,reach,clicks,spend,cpc,cpm,ctr,actions',
                    date_preset: 'last_30d',
                    access_token: token,
                }
            });
            return { campaignId: id, ...(res.data?.data?.[0] || {}) };
        }));
        return { comparisons: results };
    } catch (e: any) { return { error: getErrorMessage(e) }; }
}


// =================================================================
//  BUDGET RECOMMENDATIONS
// =================================================================

export async function getBudgetRecommendations(adAccountId: string) {
    const { token, error } = await requireToken();
    if (error) return { error };
    try {
        const campaignsRes = await axios.get(`${GRAPH}/${withAct(adAccountId)}/campaigns`, {
            params: { fields: 'id,name,status,daily_budget,lifetime_budget', effective_status: '["ACTIVE"]', access_token: token, limit: 20 }
        });
        const campaigns = campaignsRes.data?.data || [];
        if (campaigns.length === 0) return { recommendations: [] };

        const insightsRes = await axios.get(`${GRAPH}/${withAct(adAccountId)}/insights`, {
            params: {
                fields: 'campaign_id,campaign_name,spend,impressions,clicks,cpc,ctr,actions',
                level: 'campaign',
                date_preset: 'last_7d',
                access_token: token,
                limit: 20,
            }
        });
        const insights = insightsRes.data?.data || [];

        const recommendations = insights.map((ins: any) => {
            const spend = Number(ins.spend) || 0;
            const clicks = Number(ins.clicks) || 0;
            const cpc = Number(ins.cpc) || 0;
            const ctr = Number(ins.ctr) || 0;
            const campaign = campaigns.find((c: any) => c.id === ins.campaign_id);
            const dailyBudget = campaign?.daily_budget ? Number(campaign.daily_budget) / 100 : 0;

            let recommendation = 'maintain';
            let reason = 'Performance is within expected range.';
            if (ctr > 2 && cpc < 0.5) { recommendation = 'increase'; reason = `High CTR (${ctr}%) and low CPC ($${cpc.toFixed(2)}) — increase budget to scale.`; }
            else if (ctr < 0.5 && spend > 10) { recommendation = 'decrease'; reason = `Low CTR (${ctr}%) with significant spend — reduce budget or optimize creative.`; }
            else if (clicks === 0 && spend > 5) { recommendation = 'pause'; reason = `No clicks after $${spend.toFixed(2)} spend — consider pausing.`; }

            return { campaignId: ins.campaign_id, campaignName: ins.campaign_name, spend, clicks, cpc, ctr, dailyBudget, recommendation, reason };
        });

        return { recommendations };
    } catch (e: any) { return { error: getErrorMessage(e) }; }
}


// =================================================================
//  AD PREVIEW
// =================================================================

export async function getAdPreviews(adAccountId: string) {
    const { token, error } = await requireToken();
    if (error) return { error };
    try {
        const adsRes = await axios.get(`${GRAPH}/${withAct(adAccountId)}/ads`, {
            params: {
                fields: 'id,name,status,creative{id,name,thumbnail_url,image_url,title,body,object_story_spec}',
                effective_status: '["ACTIVE","PAUSED"]',
                access_token: token,
                limit: 20,
            }
        });
        return { ads: adsRes.data?.data || [] };
    } catch (e: any) { return { error: getErrorMessage(e) }; }
}


// =================================================================
//  CONVERSION FUNNEL
// =================================================================

export async function getConversionFunnel(adAccountId: string) {
    const { token, error } = await requireToken();
    if (error) return { error };
    try {
        const res = await axios.get(`${GRAPH}/${withAct(adAccountId)}/insights`, {
            params: {
                fields: 'impressions,reach,clicks,actions,action_values,spend',
                date_preset: 'last_30d',
                access_token: token,
            }
        });
        const data = res.data?.data?.[0] || {};
        const impressions = Number(data.impressions) || 0;
        const reach = Number(data.reach) || 0;
        const clicks = Number(data.clicks) || 0;
        const actions = data.actions || [];
        const leads = actions.find((a: any) => a.action_type === 'lead')?.value || 0;
        const purchases = actions.find((a: any) => a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase')?.value || 0;
        const addToCart = actions.find((a: any) => a.action_type === 'offsite_conversion.fb_pixel_add_to_cart')?.value || 0;

        return {
            funnel: {
                impressions, reach, clicks,
                addToCart: Number(addToCart),
                leads: Number(leads),
                purchases: Number(purchases),
                spend: Number(data.spend) || 0,
            }
        };
    } catch (e: any) { return { error: getErrorMessage(e) }; }
}


// =================================================================
//  CAMPAIGN CALENDAR DATA
// =================================================================

export async function getCampaignCalendarData(adAccountId: string) {
    const { token, error } = await requireToken();
    if (error) return { error };
    try {
        const res = await axios.get(`${GRAPH}/${withAct(adAccountId)}/campaigns`, {
            params: {
                fields: 'id,name,status,effective_status,start_time,stop_time,daily_budget,objective',
                access_token: token,
                limit: 100,
            }
        });
        return { campaigns: res.data?.data || [] };
    } catch (e: any) { return { error: getErrorMessage(e) }; }
}


// =================================================================
//  EXPORT CAMPAIGNS CSV
// =================================================================

export async function exportCampaignsData(adAccountId: string) {
    const { token, error } = await requireToken();
    if (error) return { error };
    try {
        const res = await axios.get(`${GRAPH}/${withAct(adAccountId)}/insights`, {
            params: {
                fields: 'campaign_id,campaign_name,impressions,reach,clicks,spend,cpc,cpm,ctr',
                level: 'campaign',
                date_preset: 'last_30d',
                access_token: token,
                limit: 100,
            }
        });
        return { data: res.data?.data || [] };
    } catch (e: any) { return { error: getErrorMessage(e) }; }
}


// =================================================================
//  PIXEL EVENT STATS
// =================================================================

export async function getPixelEventStats(pixelId: string) {
    const { token, error } = await requireToken();
    if (error) return { error };
    try {
        const res = await axios.get(`${GRAPH}/${pixelId}/stats`, {
            params: { aggregation: 'event', access_token: token }
        });
        return { stats: res.data?.data || [] };
    } catch (e: any) { return { error: getErrorMessage(e) }; }
}


// =================================================================
//  SEND TEST CONVERSION EVENT
// =================================================================

export async function sendTestConversionEvent(pixelId: string, eventName: string) {
    const { token, error } = await requireToken();
    if (error) return { error };
    try {
        await axios.post(`${GRAPH}/${pixelId}/events`, {
            data: JSON.stringify([{
                event_name: eventName,
                event_time: Math.floor(Date.now() / 1000),
                action_source: 'website',
                user_data: { em: ['test@example.com'] },
            }]),
            test_event_code: 'TEST_' + Date.now(),
            access_token: token,
        });
        return { message: `Test "${eventName}" event sent to pixel ${pixelId}.` };
    } catch (e: any) { return { error: getErrorMessage(e) }; }
}
