'use server';

const BASE_URL = 'https://adsapi.snapchat.com/v1';

export async function executeSnapchatAdsAction(actionName: string, inputs: any, user: any, logger: any) {
    const accessToken = inputs.accessToken;
    const headers = {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'listAdAccounts': {
                const organizationId = inputs.organizationId;
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const url = `${BASE_URL}/organizations/${organizationId}/adaccounts${params.toString() ? '?' + params : ''}`;
                const res = await fetch(url, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.request_status || data.debug_message || 'Failed to list ad accounts' };
                return { output: data };
            }
            case 'getAdAccount': {
                const res = await fetch(`${BASE_URL}/adaccounts/${inputs.adAccountId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.request_status || data.debug_message || 'Failed to get ad account' };
                return { output: data?.adaccounts?.[0] || data };
            }
            case 'listCampaigns': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const url = `${BASE_URL}/adaccounts/${inputs.adAccountId}/campaigns${params.toString() ? '?' + params : ''}`;
                const res = await fetch(url, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.request_status || data.debug_message || 'Failed to list campaigns' };
                return { output: data };
            }
            case 'getCampaign': {
                const res = await fetch(`${BASE_URL}/campaigns/${inputs.campaignId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.request_status || data.debug_message || 'Failed to get campaign' };
                return { output: data?.campaigns?.[0] || data };
            }
            case 'createCampaign': {
                const body = {
                    campaigns: [{
                        ad_account_id: inputs.adAccountId,
                        name: inputs.name,
                        status: inputs.status || 'PAUSED',
                        objective: inputs.objective || 'BRAND_AWARENESS',
                        budget_micro: inputs.budgetMicro ? Number(inputs.budgetMicro) : undefined,
                        budget_type: inputs.budgetType || 'DAILY',
                        start_time: inputs.startTime,
                        end_time: inputs.endTime,
                    }],
                };
                const res = await fetch(`${BASE_URL}/adaccounts/${inputs.adAccountId}/campaigns`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.request_status || data.debug_message || 'Failed to create campaign' };
                return { output: data };
            }
            case 'updateCampaign': {
                const body = {
                    campaigns: [{
                        id: inputs.campaignId,
                        name: inputs.name,
                        status: inputs.status,
                        budget_micro: inputs.budgetMicro ? Number(inputs.budgetMicro) : undefined,
                    }],
                };
                const res = await fetch(`${BASE_URL}/campaigns`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.request_status || data.debug_message || 'Failed to update campaign' };
                return { output: data };
            }
            case 'deleteCampaign': {
                const res = await fetch(`${BASE_URL}/campaigns/${inputs.campaignId}`, {
                    method: 'DELETE',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.request_status || data.debug_message || 'Failed to delete campaign' };
                return { output: data };
            }
            case 'listAdSquads': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.campaignId) {
                    const url = `${BASE_URL}/campaigns/${inputs.campaignId}/adsquads${params.toString() ? '?' + params : ''}`;
                    const res = await fetch(url, { headers });
                    const data = await res.json();
                    if (!res.ok) return { error: data.request_status || data.debug_message || 'Failed to list ad squads' };
                    return { output: data };
                }
                const url = `${BASE_URL}/adaccounts/${inputs.adAccountId}/adsquads${params.toString() ? '?' + params : ''}`;
                const res = await fetch(url, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.request_status || data.debug_message || 'Failed to list ad squads' };
                return { output: data };
            }
            case 'getAdSquad': {
                const res = await fetch(`${BASE_URL}/adsquads/${inputs.adSquadId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.request_status || data.debug_message || 'Failed to get ad squad' };
                return { output: data?.adsquads?.[0] || data };
            }
            case 'createAdSquad': {
                const body = {
                    adsquads: [{
                        campaign_id: inputs.campaignId,
                        name: inputs.name,
                        status: inputs.status || 'PAUSED',
                        type: inputs.type || 'SNAP_ADS',
                        targeting: inputs.targeting ? (typeof inputs.targeting === 'string' ? JSON.parse(inputs.targeting) : inputs.targeting) : {},
                        placement_v2: inputs.placementV2 ? (typeof inputs.placementV2 === 'string' ? JSON.parse(inputs.placementV2) : inputs.placementV2) : { config: 'AUTOMATIC' },
                        optimization_goal: inputs.optimizationGoal || 'IMPRESSIONS',
                        bid_micro: inputs.bidMicro ? Number(inputs.bidMicro) : undefined,
                        budget_micro: inputs.budgetMicro ? Number(inputs.budgetMicro) : undefined,
                        budget_type: inputs.budgetType || 'DAILY',
                        start_time: inputs.startTime,
                    }],
                };
                const res = await fetch(`${BASE_URL}/campaigns/${inputs.campaignId}/adsquads`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.request_status || data.debug_message || 'Failed to create ad squad' };
                return { output: data };
            }
            case 'listAds': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const endpoint = inputs.adSquadId
                    ? `${BASE_URL}/adsquads/${inputs.adSquadId}/ads`
                    : `${BASE_URL}/adaccounts/${inputs.adAccountId}/ads`;
                const url = `${endpoint}${params.toString() ? '?' + params : ''}`;
                const res = await fetch(url, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.request_status || data.debug_message || 'Failed to list ads' };
                return { output: data };
            }
            case 'getAd': {
                const res = await fetch(`${BASE_URL}/ads/${inputs.adId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.request_status || data.debug_message || 'Failed to get ad' };
                return { output: data?.ads?.[0] || data };
            }
            case 'createAd': {
                const body = {
                    ads: [{
                        ad_squad_id: inputs.adSquadId,
                        name: inputs.name,
                        status: inputs.status || 'PAUSED',
                        creative_id: inputs.creativeId,
                        type: inputs.type || 'SNAP_AD',
                    }],
                };
                const res = await fetch(`${BASE_URL}/adsquads/${inputs.adSquadId}/ads`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.request_status || data.debug_message || 'Failed to create ad' };
                return { output: data };
            }
            case 'getStats': {
                const granularity = inputs.granularity || 'DAY';
                const startTime = inputs.startTime;
                const endTime = inputs.endTime;
                const fields = inputs.fields || 'impressions,swipes,spend,video_views';
                const level = inputs.level || 'campaign';
                const objectId = inputs.objectId || inputs.campaignId || inputs.adSquadId || inputs.adId;
                const params = new URLSearchParams({
                    granularity,
                    start_time: startTime,
                    end_time: endTime,
                    fields,
                });
                const res = await fetch(`${BASE_URL}/${level}s/${objectId}/stats?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.request_status || data.debug_message || 'Failed to get stats' };
                return { output: data };
            }
            case 'getAudienceSize': {
                const body = {
                    targeting_spec: inputs.targetingSpec ? (typeof inputs.targetingSpec === 'string' ? JSON.parse(inputs.targetingSpec) : inputs.targetingSpec) : {},
                };
                const res = await fetch(`${BASE_URL}/adaccounts/${inputs.adAccountId}/audiencesize`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.request_status || data.debug_message || 'Failed to get audience size' };
                return { output: data };
            }
            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`SnapchatAds action error [${actionName}]:`, err);
        return { error: err?.message || 'Unexpected error in Snapchat Ads action' };
    }
}
