'use server';

const META_BASE = 'https://graph.facebook.com/v20.0';

export async function executeMetaAdsAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const accessToken: string = inputs.accessToken;
        const adAccountId: string = inputs.adAccountId;

        if (!accessToken) return { error: 'accessToken is required.' };

        const authHeader = { Authorization: `Bearer ${accessToken}` };

        switch (actionName) {
            case 'getAdAccount': {
                const res = await fetch(
                    `${META_BASE}/${adAccountId}?fields=name,spend_cap,balance,account_status`,
                    { headers: authHeader }
                );
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'Failed to get ad account.' };
                return { output: data };
            }

            case 'listCampaigns': {
                const res = await fetch(
                    `${META_BASE}/${adAccountId}/campaigns?fields=name,status,objective,daily_budget`,
                    { headers: authHeader }
                );
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'Failed to list campaigns.' };
                return { output: data };
            }

            case 'getCampaign': {
                const campaignId: string = inputs.campaignId;
                if (!campaignId) return { error: 'campaignId is required.' };
                const res = await fetch(
                    `${META_BASE}/${campaignId}?fields=name,status,objective,daily_budget,start_time,stop_time`,
                    { headers: authHeader }
                );
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'Failed to get campaign.' };
                return { output: data };
            }

            case 'createCampaign': {
                const body: Record<string, any> = {
                    name: inputs.name,
                    objective: inputs.objective,
                    status: inputs.status || 'PAUSED',
                    special_ad_categories: inputs.specialAdCategories || [],
                };
                const res = await fetch(`${META_BASE}/${adAccountId}/campaigns`, {
                    method: 'POST',
                    headers: { ...authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'Failed to create campaign.' };
                return { output: data };
            }

            case 'updateCampaign': {
                const campaignId: string = inputs.campaignId;
                if (!campaignId) return { error: 'campaignId is required.' };
                const updates: Record<string, any> = {};
                if (inputs.name) updates.name = inputs.name;
                if (inputs.status) updates.status = inputs.status;
                if (inputs.dailyBudget) updates.daily_budget = inputs.dailyBudget;
                const res = await fetch(`${META_BASE}/${campaignId}`, {
                    method: 'POST',
                    headers: { ...authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify(updates),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'Failed to update campaign.' };
                return { output: data };
            }

            case 'deleteCampaign': {
                const campaignId: string = inputs.campaignId;
                if (!campaignId) return { error: 'campaignId is required.' };
                const res = await fetch(`${META_BASE}/${campaignId}`, {
                    method: 'DELETE',
                    headers: authHeader,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'Failed to delete campaign.' };
                return { output: data };
            }

            case 'listAdSets': {
                const res = await fetch(
                    `${META_BASE}/${adAccountId}/adsets?fields=name,status,campaign_id,daily_budget,targeting`,
                    { headers: authHeader }
                );
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'Failed to list ad sets.' };
                return { output: data };
            }

            case 'createAdSet': {
                const body: Record<string, any> = {
                    name: inputs.name,
                    campaign_id: inputs.campaignId,
                    daily_budget: inputs.dailyBudget,
                    billing_event: inputs.billingEvent || 'IMPRESSIONS',
                    optimization_goal: inputs.optimizationGoal || 'REACH',
                    bid_amount: inputs.bidAmount,
                    targeting: inputs.targeting || {},
                    status: inputs.status || 'PAUSED',
                };
                const res = await fetch(`${META_BASE}/${adAccountId}/adsets`, {
                    method: 'POST',
                    headers: { ...authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'Failed to create ad set.' };
                return { output: data };
            }

            case 'listAds': {
                const res = await fetch(
                    `${META_BASE}/${adAccountId}/ads?fields=name,status,adset_id,campaign_id,creative`,
                    { headers: authHeader }
                );
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'Failed to list ads.' };
                return { output: data };
            }

            case 'createAd': {
                const body: Record<string, any> = {
                    name: inputs.name,
                    adset_id: inputs.adSetId,
                    creative: inputs.creative || {},
                    status: inputs.status || 'PAUSED',
                };
                const res = await fetch(`${META_BASE}/${adAccountId}/ads`, {
                    method: 'POST',
                    headers: { ...authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'Failed to create ad.' };
                return { output: data };
            }

            case 'getInsights': {
                const datePreset = inputs.datePreset || 'last_30d';
                const res = await fetch(
                    `${META_BASE}/${adAccountId}/insights?fields=spend,impressions,clicks,ctr,reach,actions&date_preset=${datePreset}`,
                    { headers: authHeader }
                );
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'Failed to get insights.' };
                return { output: data };
            }

            case 'createAudience': {
                const body: Record<string, any> = {
                    name: inputs.name,
                    subtype: inputs.subtype || 'CUSTOM',
                    description: inputs.description || '',
                    customer_file_source: inputs.customerFileSource || 'USER_PROVIDED_ONLY',
                };
                const res = await fetch(`${META_BASE}/${adAccountId}/customaudiences`, {
                    method: 'POST',
                    headers: { ...authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'Failed to create audience.' };
                return { output: data };
            }

            case 'listAudiences': {
                const res = await fetch(
                    `${META_BASE}/${adAccountId}/customaudiences?fields=name,subtype,approximate_count,delivery_status`,
                    { headers: authHeader }
                );
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'Failed to list audiences.' };
                return { output: data };
            }

            case 'publishAd': {
                const adId: string = inputs.adId;
                if (!adId) return { error: 'adId is required.' };
                const res = await fetch(`${META_BASE}/${adId}`, {
                    method: 'POST',
                    headers: { ...authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'ACTIVE' }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'Failed to publish ad.' };
                return { output: data };
            }

            default:
                return { error: `Meta Ads action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        logger.log(`executeMetaAdsAction error: ${err.message}`);
        return { error: err.message || 'An unexpected error occurred in Meta Ads action.' };
    }
}
