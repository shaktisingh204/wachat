'use server';

const BASE_URL = 'https://api.pinterest.com/v5';

export async function executePinterestAdsAction(actionName: string, inputs: any, user: any, logger: any) {
    const accessToken = inputs.accessToken;
    const headers = {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'listAdAccounts': {
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('page_size', String(inputs.pageSize));
                if (inputs.bookmark) params.set('bookmark', inputs.bookmark);
                const url = `${BASE_URL}/ad_accounts${params.toString() ? '?' + params : ''}`;
                const res = await fetch(url, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list ad accounts' };
                return { output: data };
            }
            case 'getAdAccount': {
                const res = await fetch(`${BASE_URL}/ad_accounts/${inputs.adAccountId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get ad account' };
                return { output: data };
            }
            case 'listCampaigns': {
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('page_size', String(inputs.pageSize));
                if (inputs.bookmark) params.set('bookmark', inputs.bookmark);
                if (inputs.entityStatuses) {
                    const statuses = Array.isArray(inputs.entityStatuses) ? inputs.entityStatuses : [inputs.entityStatuses];
                    statuses.forEach((s: string, i: number) => params.append('entity_statuses', s));
                }
                const res = await fetch(`${BASE_URL}/ad_accounts/${inputs.adAccountId}/campaigns?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list campaigns' };
                return { output: data };
            }
            case 'getCampaign': {
                const res = await fetch(`${BASE_URL}/ad_accounts/${inputs.adAccountId}/campaigns/${inputs.campaignId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get campaign' };
                return { output: data };
            }
            case 'createCampaign': {
                const body = [{
                    name: inputs.name,
                    objective_type: inputs.objectiveType || 'AWARENESS',
                    status: inputs.status || 'ACTIVE',
                    lifetime_spend_cap: inputs.lifetimeSpendCap ? Number(inputs.lifetimeSpendCap) : undefined,
                    daily_spend_cap: inputs.dailySpendCap ? Number(inputs.dailySpendCap) : undefined,
                    order_line_id: inputs.orderLineId,
                    tracking_urls: inputs.trackingUrls ? (typeof inputs.trackingUrls === 'string' ? JSON.parse(inputs.trackingUrls) : inputs.trackingUrls) : undefined,
                }];
                const res = await fetch(`${BASE_URL}/ad_accounts/${inputs.adAccountId}/campaigns`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create campaign' };
                return { output: data };
            }
            case 'updateCampaign': {
                const body = [{
                    id: inputs.campaignId,
                    name: inputs.name,
                    status: inputs.status,
                    daily_spend_cap: inputs.dailySpendCap ? Number(inputs.dailySpendCap) : undefined,
                    lifetime_spend_cap: inputs.lifetimeSpendCap ? Number(inputs.lifetimeSpendCap) : undefined,
                }];
                const res = await fetch(`${BASE_URL}/ad_accounts/${inputs.adAccountId}/campaigns`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to update campaign' };
                return { output: data };
            }
            case 'listAdGroups': {
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('page_size', String(inputs.pageSize));
                if (inputs.bookmark) params.set('bookmark', inputs.bookmark);
                if (inputs.campaignId) params.set('campaign_id', inputs.campaignId);
                if (inputs.entityStatuses) {
                    const statuses = Array.isArray(inputs.entityStatuses) ? inputs.entityStatuses : [inputs.entityStatuses];
                    statuses.forEach((s: string) => params.append('entity_statuses', s));
                }
                const res = await fetch(`${BASE_URL}/ad_accounts/${inputs.adAccountId}/ad_groups?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list ad groups' };
                return { output: data };
            }
            case 'getAdGroup': {
                const res = await fetch(`${BASE_URL}/ad_accounts/${inputs.adAccountId}/ad_groups/${inputs.adGroupId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get ad group' };
                return { output: data };
            }
            case 'createAdGroup': {
                const body = [{
                    name: inputs.name,
                    campaign_id: inputs.campaignId,
                    status: inputs.status || 'ACTIVE',
                    budget_in_micro_currency: inputs.budgetInMicroCurrency ? Number(inputs.budgetInMicroCurrency) : undefined,
                    budget_type: inputs.budgetType || 'DAILY',
                    start_time: inputs.startTime ? Number(inputs.startTime) : undefined,
                    end_time: inputs.endTime ? Number(inputs.endTime) : undefined,
                    targeting_spec: inputs.targetingSpec ? (typeof inputs.targetingSpec === 'string' ? JSON.parse(inputs.targetingSpec) : inputs.targetingSpec) : {},
                    placement_group: inputs.placementGroup || 'ALL_BROWSERS',
                    pacing_delivery_type: inputs.pacingDeliveryType || 'STANDARD',
                    bid_in_micro_currency: inputs.bidInMicroCurrency ? Number(inputs.bidInMicroCurrency) : undefined,
                    optimization_goal_metadata: inputs.optimizationGoalMetadata ? (typeof inputs.optimizationGoalMetadata === 'string' ? JSON.parse(inputs.optimizationGoalMetadata) : inputs.optimizationGoalMetadata) : undefined,
                }];
                const res = await fetch(`${BASE_URL}/ad_accounts/${inputs.adAccountId}/ad_groups`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create ad group' };
                return { output: data };
            }
            case 'listAds': {
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('page_size', String(inputs.pageSize));
                if (inputs.bookmark) params.set('bookmark', inputs.bookmark);
                if (inputs.adGroupId) params.set('ad_group_id', inputs.adGroupId);
                if (inputs.campaignId) params.set('campaign_id', inputs.campaignId);
                const res = await fetch(`${BASE_URL}/ad_accounts/${inputs.adAccountId}/ads?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list ads' };
                return { output: data };
            }
            case 'getAd': {
                const res = await fetch(`${BASE_URL}/ad_accounts/${inputs.adAccountId}/ads/${inputs.adId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get ad' };
                return { output: data };
            }
            case 'createAd': {
                const body = [{
                    name: inputs.name,
                    ad_group_id: inputs.adGroupId,
                    pin_id: inputs.pinId,
                    status: inputs.status || 'ACTIVE',
                    creative_type: inputs.creativeType || 'REGULAR',
                    tracking_urls: inputs.trackingUrls ? (typeof inputs.trackingUrls === 'string' ? JSON.parse(inputs.trackingUrls) : inputs.trackingUrls) : undefined,
                }];
                const res = await fetch(`${BASE_URL}/ad_accounts/${inputs.adAccountId}/ads`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create ad' };
                return { output: data };
            }
            case 'getAnalytics': {
                const params = new URLSearchParams({
                    start_date: inputs.startDate,
                    end_date: inputs.endDate,
                    columns: inputs.columns || 'IMPRESSION_1,CLICKTHROUGH_1,SPEND_IN_MICRO_DOLLAR',
                    granularity: inputs.granularity || 'DAY',
                });
                if (inputs.campaignIds) {
                    const ids = Array.isArray(inputs.campaignIds) ? inputs.campaignIds : [inputs.campaignIds];
                    ids.forEach((id: string) => params.append('campaign_ids', id));
                }
                const res = await fetch(`${BASE_URL}/ad_accounts/${inputs.adAccountId}/campaigns/analytics?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get analytics' };
                return { output: data };
            }
            case 'listAudiences': {
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('page_size', String(inputs.pageSize));
                if (inputs.bookmark) params.set('bookmark', inputs.bookmark);
                if (inputs.order) params.set('order', inputs.order);
                const res = await fetch(`${BASE_URL}/ad_accounts/${inputs.adAccountId}/audiences?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list audiences' };
                return { output: data };
            }
            case 'createAudience': {
                const body = {
                    name: inputs.name,
                    rule: inputs.rule ? (typeof inputs.rule === 'string' ? JSON.parse(inputs.rule) : inputs.rule) : {},
                    description: inputs.description,
                };
                const res = await fetch(`${BASE_URL}/ad_accounts/${inputs.adAccountId}/audiences`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create audience' };
                return { output: data };
            }
            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`PinterestAds action error [${actionName}]:`, err);
        return { error: err?.message || 'Unexpected error in Pinterest Ads action' };
    }
}
