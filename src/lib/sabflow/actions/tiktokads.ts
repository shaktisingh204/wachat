'use server';

const TIKTOK_BASE = 'https://business-api.tiktok.com/open_api/v1.3';

export async function executeTikTokAdsAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const accessToken: string = inputs.accessToken;
        const advertiserId: string = inputs.advertiserId;

        if (!accessToken) return { error: 'accessToken is required.' };

        const headers = {
            'Access-Token': accessToken,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'getAdvertiser': {
                const res = await fetch(
                    `${TIKTOK_BASE}/advertiser/info/?advertiser_ids=["${advertiserId}"]`,
                    { headers }
                );
                const data = await res.json();
                if (data.code !== 0) return { error: data.message || 'Failed to get advertiser.' };
                return { output: data.data };
            }

            case 'listCampaigns': {
                if (!advertiserId) return { error: 'advertiserId is required.' };
                const res = await fetch(
                    `${TIKTOK_BASE}/campaign/get/?advertiser_id=${advertiserId}&fields=["campaign_id","campaign_name","status","objective_type","budget"]`,
                    { headers }
                );
                const data = await res.json();
                if (data.code !== 0) return { error: data.message || 'Failed to list campaigns.' };
                return { output: data.data };
            }

            case 'createCampaign': {
                if (!advertiserId) return { error: 'advertiserId is required.' };
                const body = {
                    advertiser_id: advertiserId,
                    objective_type: inputs.objectiveType || 'TRAFFIC',
                    campaign_name: inputs.campaignName || inputs.name,
                    budget_mode: inputs.budgetMode || 'BUDGET_MODE_INFINITE',
                    budget: inputs.budget,
                };
                const res = await fetch(`${TIKTOK_BASE}/campaign/create/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (data.code !== 0) return { error: data.message || 'Failed to create campaign.' };
                return { output: data.data };
            }

            case 'updateCampaign': {
                if (!advertiserId) return { error: 'advertiserId is required.' };
                const body: Record<string, any> = {
                    advertiser_id: advertiserId,
                    campaign_id: inputs.campaignId,
                };
                if (inputs.campaignName) body.campaign_name = inputs.campaignName;
                if (inputs.status) body.operation_status = inputs.status;
                if (inputs.budget) body.budget = inputs.budget;
                const res = await fetch(`${TIKTOK_BASE}/campaign/update/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (data.code !== 0) return { error: data.message || 'Failed to update campaign.' };
                return { output: data.data };
            }

            case 'listAdGroups': {
                if (!advertiserId) return { error: 'advertiserId is required.' };
                const res = await fetch(
                    `${TIKTOK_BASE}/adgroup/get/?advertiser_id=${advertiserId}&fields=["adgroup_id","adgroup_name","campaign_id","status","budget"]`,
                    { headers }
                );
                const data = await res.json();
                if (data.code !== 0) return { error: data.message || 'Failed to list ad groups.' };
                return { output: data.data };
            }

            case 'createAdGroup': {
                if (!advertiserId) return { error: 'advertiserId is required.' };
                const body = {
                    advertiser_id: advertiserId,
                    campaign_id: inputs.campaignId,
                    adgroup_name: inputs.adGroupName || inputs.name,
                    placement_type: inputs.placementType || 'PLACEMENT_TYPE_AUTOMATIC',
                    budget_mode: inputs.budgetMode || 'BUDGET_MODE_INFINITE',
                    budget: inputs.budget,
                    schedule_type: inputs.scheduleType || 'SCHEDULE_FROM_NOW',
                    optimization_goal: inputs.optimizationGoal || 'CLICK',
                    bid_type: inputs.bidType || 'BID_TYPE_NO_BID',
                    billing_event: inputs.billingEvent || 'CPC',
                };
                const res = await fetch(`${TIKTOK_BASE}/adgroup/create/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (data.code !== 0) return { error: data.message || 'Failed to create ad group.' };
                return { output: data.data };
            }

            case 'listAds': {
                if (!advertiserId) return { error: 'advertiserId is required.' };
                const res = await fetch(
                    `${TIKTOK_BASE}/ad/get/?advertiser_id=${advertiserId}&fields=["ad_id","ad_name","adgroup_id","status"]`,
                    { headers }
                );
                const data = await res.json();
                if (data.code !== 0) return { error: data.message || 'Failed to list ads.' };
                return { output: data.data };
            }

            case 'createAd': {
                if (!advertiserId) return { error: 'advertiserId is required.' };
                const body = {
                    advertiser_id: advertiserId,
                    adgroup_id: inputs.adGroupId,
                    creatives: inputs.creatives || [],
                };
                const res = await fetch(`${TIKTOK_BASE}/ad/create/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (data.code !== 0) return { error: data.message || 'Failed to create ad.' };
                return { output: data.data };
            }

            case 'getReportData': {
                if (!advertiserId) return { error: 'advertiserId is required.' };
                const metrics = inputs.metrics || ['spend', 'impressions', 'clicks', 'ctr', 'reach'];
                const params = new URLSearchParams({
                    advertiser_id: advertiserId,
                    report_type: inputs.reportType || 'BASIC',
                    data_level: inputs.dataLevel || 'AUCTION_CAMPAIGN',
                    dimensions: JSON.stringify(inputs.dimensions || ['campaign_id']),
                    metrics: JSON.stringify(metrics),
                    start_date: inputs.startDate || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
                    end_date: inputs.endDate || new Date().toISOString().split('T')[0],
                });
                const res = await fetch(
                    `${TIKTOK_BASE}/report/integrated/get/?${params.toString()}`,
                    { headers }
                );
                const data = await res.json();
                if (data.code !== 0) return { error: data.message || 'Failed to get report data.' };
                return { output: data.data };
            }

            case 'listAudiences': {
                if (!advertiserId) return { error: 'advertiserId is required.' };
                const res = await fetch(
                    `${TIKTOK_BASE}/dmp/custom_audience/list/?advertiser_id=${advertiserId}`,
                    { headers }
                );
                const data = await res.json();
                if (data.code !== 0) return { error: data.message || 'Failed to list audiences.' };
                return { output: data.data };
            }

            case 'createAudience': {
                if (!advertiserId) return { error: 'advertiserId is required.' };
                const body = {
                    advertiser_id: advertiserId,
                    custom_audience_name: inputs.audienceName || inputs.name,
                    file_paths: inputs.filePaths || [],
                    calculate_type: inputs.calculateType || 'HASHED_PHONE_NUMBER',
                };
                const res = await fetch(`${TIKTOK_BASE}/dmp/custom_audience/file/create/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (data.code !== 0) return { error: data.message || 'Failed to create audience.' };
                return { output: data.data };
            }

            case 'getCreatives': {
                if (!advertiserId) return { error: 'advertiserId is required.' };
                const res = await fetch(
                    `${TIKTOK_BASE}/creative/material/list/?advertiser_id=${advertiserId}`,
                    { headers }
                );
                const data = await res.json();
                if (data.code !== 0) return { error: data.message || 'Failed to get creatives.' };
                return { output: data.data };
            }

            default:
                return { error: `TikTok Ads action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        logger.log(`executeTikTokAdsAction error: ${err.message}`);
        return { error: err.message || 'An unexpected error occurred in TikTok Ads action.' };
    }
}
