'use server';

const BASE_URL = 'https://graph.facebook.com/v18.0';

export async function executeFacebookAdsAction(actionName: string, inputs: any, user: any, logger: any) {
    const accessToken = inputs.accessToken;
    const adAccountId = inputs.adAccountId;

    try {
        switch (actionName) {
            case 'listCampaigns': {
                const params = new URLSearchParams({ access_token: accessToken, fields: inputs.fields || 'id,name,status,objective,budget_remaining' });
                const res = await fetch(`${BASE_URL}/act_${adAccountId}/campaigns?${params}`);
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'Failed to list campaigns' };
                return { output: data };
            }
            case 'getCampaign': {
                const params = new URLSearchParams({ access_token: accessToken, fields: inputs.fields || 'id,name,status,objective,budget_remaining,start_time,stop_time' });
                const res = await fetch(`${BASE_URL}/${inputs.campaignId}?${params}`);
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'Failed to get campaign' };
                return { output: data };
            }
            case 'createCampaign': {
                const params = new URLSearchParams({ access_token: accessToken });
                const body: Record<string, any> = {
                    name: inputs.name,
                    objective: inputs.objective,
                    status: inputs.status || 'PAUSED',
                    special_ad_categories: inputs.specialAdCategories || [],
                };
                if (inputs.dailyBudget) body.daily_budget = inputs.dailyBudget;
                if (inputs.lifetimeBudget) body.lifetime_budget = inputs.lifetimeBudget;
                const res = await fetch(`${BASE_URL}/act_${adAccountId}/campaigns?${params}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'Failed to create campaign' };
                return { output: data };
            }
            case 'updateCampaign': {
                const params = new URLSearchParams({ access_token: accessToken });
                const body: Record<string, any> = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.status) body.status = inputs.status;
                if (inputs.dailyBudget) body.daily_budget = inputs.dailyBudget;
                if (inputs.lifetimeBudget) body.lifetime_budget = inputs.lifetimeBudget;
                const res = await fetch(`${BASE_URL}/${inputs.campaignId}?${params}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'Failed to update campaign' };
                return { output: data };
            }
            case 'deleteCampaign': {
                const params = new URLSearchParams({ access_token: accessToken });
                const res = await fetch(`${BASE_URL}/${inputs.campaignId}?${params}`, { method: 'DELETE' });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'Failed to delete campaign' };
                return { output: data };
            }
            case 'listAdSets': {
                const params = new URLSearchParams({ access_token: accessToken, fields: inputs.fields || 'id,name,status,campaign_id,daily_budget,targeting' });
                if (inputs.campaignId) params.set('campaign_id', inputs.campaignId);
                const res = await fetch(`${BASE_URL}/act_${adAccountId}/adsets?${params}`);
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'Failed to list ad sets' };
                return { output: data };
            }
            case 'getAdSet': {
                const params = new URLSearchParams({ access_token: accessToken, fields: inputs.fields || 'id,name,status,campaign_id,daily_budget,targeting,optimization_goal,billing_event' });
                const res = await fetch(`${BASE_URL}/${inputs.adSetId}?${params}`);
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'Failed to get ad set' };
                return { output: data };
            }
            case 'createAdSet': {
                const params = new URLSearchParams({ access_token: accessToken });
                const body: Record<string, any> = {
                    name: inputs.name,
                    campaign_id: inputs.campaignId,
                    status: inputs.status || 'PAUSED',
                    optimization_goal: inputs.optimizationGoal,
                    billing_event: inputs.billingEvent,
                    bid_amount: inputs.bidAmount,
                    daily_budget: inputs.dailyBudget,
                    targeting: inputs.targeting ? (typeof inputs.targeting === 'string' ? JSON.parse(inputs.targeting) : inputs.targeting) : {},
                };
                const res = await fetch(`${BASE_URL}/act_${adAccountId}/adsets?${params}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'Failed to create ad set' };
                return { output: data };
            }
            case 'updateAdSet': {
                const params = new URLSearchParams({ access_token: accessToken });
                const body: Record<string, any> = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.status) body.status = inputs.status;
                if (inputs.dailyBudget) body.daily_budget = inputs.dailyBudget;
                if (inputs.bidAmount) body.bid_amount = inputs.bidAmount;
                if (inputs.targeting) body.targeting = typeof inputs.targeting === 'string' ? JSON.parse(inputs.targeting) : inputs.targeting;
                const res = await fetch(`${BASE_URL}/${inputs.adSetId}?${params}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'Failed to update ad set' };
                return { output: data };
            }
            case 'listAds': {
                const params = new URLSearchParams({ access_token: accessToken, fields: inputs.fields || 'id,name,status,adset_id,creative' });
                if (inputs.adSetId) params.set('adset_id', inputs.adSetId);
                const res = await fetch(`${BASE_URL}/act_${adAccountId}/ads?${params}`);
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'Failed to list ads' };
                return { output: data };
            }
            case 'getAd': {
                const params = new URLSearchParams({ access_token: accessToken, fields: inputs.fields || 'id,name,status,adset_id,creative,tracking_specs' });
                const res = await fetch(`${BASE_URL}/${inputs.adId}?${params}`);
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'Failed to get ad' };
                return { output: data };
            }
            case 'createAd': {
                const params = new URLSearchParams({ access_token: accessToken });
                const body: Record<string, any> = {
                    name: inputs.name,
                    adset_id: inputs.adSetId,
                    creative: inputs.creative ? (typeof inputs.creative === 'string' ? JSON.parse(inputs.creative) : inputs.creative) : {},
                    status: inputs.status || 'PAUSED',
                };
                const res = await fetch(`${BASE_URL}/act_${adAccountId}/ads?${params}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'Failed to create ad' };
                return { output: data };
            }
            case 'updateAd': {
                const params = new URLSearchParams({ access_token: accessToken });
                const body: Record<string, any> = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.status) body.status = inputs.status;
                if (inputs.creative) body.creative = typeof inputs.creative === 'string' ? JSON.parse(inputs.creative) : inputs.creative;
                const res = await fetch(`${BASE_URL}/${inputs.adId}?${params}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'Failed to update ad' };
                return { output: data };
            }
            case 'getInsights': {
                const level = inputs.level || 'campaign';
                const objectId = inputs.objectId || `act_${adAccountId}`;
                const params = new URLSearchParams({
                    access_token: accessToken,
                    fields: inputs.fields || 'impressions,clicks,spend,reach,ctr,cpc,actions',
                    level,
                    date_preset: inputs.datePreset || 'last_30d',
                });
                if (inputs.timeRange) params.set('time_range', typeof inputs.timeRange === 'string' ? inputs.timeRange : JSON.stringify(inputs.timeRange));
                const res = await fetch(`${BASE_URL}/${objectId}/insights?${params}`);
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'Failed to get insights' };
                return { output: data };
            }
            case 'getAudienceEstimate': {
                const params = new URLSearchParams({ access_token: accessToken });
                const body = {
                    targeting_spec: inputs.targetingSpec ? (typeof inputs.targetingSpec === 'string' ? JSON.parse(inputs.targetingSpec) : inputs.targetingSpec) : {},
                    currency: inputs.currency || 'USD',
                    optimize_for: inputs.optimizeFor || 'NONE',
                    bid_amount: inputs.bidAmount || 0,
                };
                const res = await fetch(`${BASE_URL}/act_${adAccountId}/reachestimate?${params}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'Failed to get audience estimate' };
                return { output: data };
            }
            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`FacebookAds action error [${actionName}]:`, err);
        return { error: err?.message || 'Unexpected error in Facebook Ads action' };
    }
}
