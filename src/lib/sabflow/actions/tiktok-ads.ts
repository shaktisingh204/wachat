'use server';

const BASE_URL = 'https://business-api.tiktok.com/open_api/v1.3';

export async function executeTikTokAdsAction(actionName: string, inputs: any, user: any, logger: any) {
    const accessToken = inputs.accessToken;
    const headers = {
        'Access-Token': accessToken,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'listCampaigns': {
                const advertiserId = inputs.advertiserId;
                const body: Record<string, any> = { advertiser_id: advertiserId };
                if (inputs.page) body.page = inputs.page;
                if (inputs.pageSize) body.page_size = inputs.pageSize;
                if (inputs.filters) body.filtering = typeof inputs.filters === 'string' ? JSON.parse(inputs.filters) : inputs.filters;
                const res = await fetch(`${BASE_URL}/campaign/get/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (data.code !== 0) return { error: data.message || 'Failed to list campaigns' };
                return { output: data.data };
            }
            case 'getCampaign': {
                const body = {
                    advertiser_id: inputs.advertiserId,
                    filtering: { campaign_ids: [inputs.campaignId] },
                };
                const res = await fetch(`${BASE_URL}/campaign/get/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (data.code !== 0) return { error: data.message || 'Failed to get campaign' };
                const list = data.data?.list || [];
                return { output: list[0] || null };
            }
            case 'createCampaign': {
                const body: Record<string, any> = {
                    advertiser_id: inputs.advertiserId,
                    campaign_name: inputs.campaignName,
                    objective_type: inputs.objectiveType,
                    budget_mode: inputs.budgetMode || 'BUDGET_MODE_INFINITE',
                    operation_status: inputs.operationStatus || 'DISABLE',
                };
                if (inputs.budget) body.budget = Number(inputs.budget);
                const res = await fetch(`${BASE_URL}/campaign/create/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (data.code !== 0) return { error: data.message || 'Failed to create campaign' };
                return { output: data.data };
            }
            case 'updateCampaign': {
                const body: Record<string, any> = {
                    advertiser_id: inputs.advertiserId,
                    campaign_id: inputs.campaignId,
                };
                if (inputs.campaignName) body.campaign_name = inputs.campaignName;
                if (inputs.budget) body.budget = Number(inputs.budget);
                if (inputs.budgetMode) body.budget_mode = inputs.budgetMode;
                if (inputs.operationStatus) body.operation_status = inputs.operationStatus;
                const res = await fetch(`${BASE_URL}/campaign/update/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (data.code !== 0) return { error: data.message || 'Failed to update campaign' };
                return { output: data.data };
            }
            case 'deleteCampaign': {
                const body = {
                    advertiser_id: inputs.advertiserId,
                    campaign_ids: Array.isArray(inputs.campaignIds) ? inputs.campaignIds : [inputs.campaignId],
                };
                const res = await fetch(`${BASE_URL}/campaign/delete/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (data.code !== 0) return { error: data.message || 'Failed to delete campaign' };
                return { output: data.data };
            }
            case 'listAdGroups': {
                const body: Record<string, any> = { advertiser_id: inputs.advertiserId };
                if (inputs.campaignId) body.filtering = { campaign_ids: [inputs.campaignId] };
                if (inputs.page) body.page = inputs.page;
                if (inputs.pageSize) body.page_size = inputs.pageSize;
                const res = await fetch(`${BASE_URL}/adgroup/get/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (data.code !== 0) return { error: data.message || 'Failed to list ad groups' };
                return { output: data.data };
            }
            case 'getAdGroup': {
                const body = {
                    advertiser_id: inputs.advertiserId,
                    filtering: { adgroup_ids: [inputs.adGroupId] },
                };
                const res = await fetch(`${BASE_URL}/adgroup/get/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (data.code !== 0) return { error: data.message || 'Failed to get ad group' };
                const list = data.data?.list || [];
                return { output: list[0] || null };
            }
            case 'createAdGroup': {
                const body: Record<string, any> = {
                    advertiser_id: inputs.advertiserId,
                    campaign_id: inputs.campaignId,
                    adgroup_name: inputs.adGroupName,
                    placement_type: inputs.placementType || 'PLACEMENT_TYPE_AUTOMATIC',
                    budget_mode: inputs.budgetMode || 'BUDGET_MODE_INFINITE',
                    schedule_type: inputs.scheduleType || 'SCHEDULE_FROM_NOW',
                    optimization_goal: inputs.optimizationGoal,
                    bid_type: inputs.bidType || 'BID_TYPE_NO_BID',
                    operation_status: inputs.operationStatus || 'DISABLE',
                };
                if (inputs.budget) body.budget = Number(inputs.budget);
                if (inputs.targeting) body.targeting = typeof inputs.targeting === 'string' ? JSON.parse(inputs.targeting) : inputs.targeting;
                const res = await fetch(`${BASE_URL}/adgroup/create/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (data.code !== 0) return { error: data.message || 'Failed to create ad group' };
                return { output: data.data };
            }
            case 'updateAdGroup': {
                const body: Record<string, any> = {
                    advertiser_id: inputs.advertiserId,
                    adgroup_id: inputs.adGroupId,
                };
                if (inputs.adGroupName) body.adgroup_name = inputs.adGroupName;
                if (inputs.budget) body.budget = Number(inputs.budget);
                if (inputs.operationStatus) body.operation_status = inputs.operationStatus;
                if (inputs.targeting) body.targeting = typeof inputs.targeting === 'string' ? JSON.parse(inputs.targeting) : inputs.targeting;
                const res = await fetch(`${BASE_URL}/adgroup/update/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (data.code !== 0) return { error: data.message || 'Failed to update ad group' };
                return { output: data.data };
            }
            case 'listAds': {
                const body: Record<string, any> = { advertiser_id: inputs.advertiserId };
                if (inputs.adGroupId) body.filtering = { adgroup_ids: [inputs.adGroupId] };
                if (inputs.page) body.page = inputs.page;
                if (inputs.pageSize) body.page_size = inputs.pageSize;
                const res = await fetch(`${BASE_URL}/ad/get/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (data.code !== 0) return { error: data.message || 'Failed to list ads' };
                return { output: data.data };
            }
            case 'getAd': {
                const body = {
                    advertiser_id: inputs.advertiserId,
                    filtering: { ad_ids: [inputs.adId] },
                };
                const res = await fetch(`${BASE_URL}/ad/get/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (data.code !== 0) return { error: data.message || 'Failed to get ad' };
                const list = data.data?.list || [];
                return { output: list[0] || null };
            }
            case 'createAd': {
                const body: Record<string, any> = {
                    advertiser_id: inputs.advertiserId,
                    adgroup_id: inputs.adGroupId,
                    ad_name: inputs.adName,
                    ad_format: inputs.adFormat || 'SINGLE_VIDEO',
                    ad_text: inputs.adText,
                    call_to_action: inputs.callToAction || 'LEARN_MORE',
                    operation_status: inputs.operationStatus || 'DISABLE',
                };
                if (inputs.creativeId) body.creative_id = inputs.creativeId;
                if (inputs.landingPageUrl) body.landing_page_url = inputs.landingPageUrl;
                const res = await fetch(`${BASE_URL}/ad/create/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (data.code !== 0) return { error: data.message || 'Failed to create ad' };
                return { output: data.data };
            }
            case 'updateAd': {
                const body: Record<string, any> = {
                    advertiser_id: inputs.advertiserId,
                    ad_id: inputs.adId,
                };
                if (inputs.adName) body.ad_name = inputs.adName;
                if (inputs.operationStatus) body.operation_status = inputs.operationStatus;
                if (inputs.adText) body.ad_text = inputs.adText;
                const res = await fetch(`${BASE_URL}/ad/update/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (data.code !== 0) return { error: data.message || 'Failed to update ad' };
                return { output: data.data };
            }
            case 'getReports': {
                const body: Record<string, any> = {
                    advertiser_id: inputs.advertiserId,
                    report_type: inputs.reportType || 'BASIC',
                    dimensions: inputs.dimensions ? (typeof inputs.dimensions === 'string' ? JSON.parse(inputs.dimensions) : inputs.dimensions) : ['campaign_id'],
                    metrics: inputs.metrics ? (typeof inputs.metrics === 'string' ? JSON.parse(inputs.metrics) : inputs.metrics) : ['spend', 'impressions', 'clicks'],
                    data_level: inputs.dataLevel || 'AUCTION_CAMPAIGN',
                    start_date: inputs.startDate,
                    end_date: inputs.endDate,
                };
                if (inputs.page) body.page = inputs.page;
                if (inputs.pageSize) body.page_size = inputs.pageSize;
                const res = await fetch(`${BASE_URL}/report/integrated/get/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (data.code !== 0) return { error: data.message || 'Failed to get reports' };
                return { output: data.data };
            }
            case 'getInsights': {
                const body: Record<string, any> = {
                    advertiser_id: inputs.advertiserId,
                    report_type: 'BASIC',
                    dimensions: inputs.dimensions ? (typeof inputs.dimensions === 'string' ? JSON.parse(inputs.dimensions) : inputs.dimensions) : ['campaign_id', 'stat_time_day'],
                    metrics: inputs.metrics ? (typeof inputs.metrics === 'string' ? JSON.parse(inputs.metrics) : inputs.metrics) : ['spend', 'impressions', 'clicks', 'ctr', 'cpc', 'cpm'],
                    data_level: inputs.dataLevel || 'AUCTION_CAMPAIGN',
                    start_date: inputs.startDate,
                    end_date: inputs.endDate,
                    granularity: inputs.granularity || 'DAY',
                };
                const res = await fetch(`${BASE_URL}/report/integrated/get/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (data.code !== 0) return { error: data.message || 'Failed to get insights' };
                return { output: data.data };
            }
            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`TikTokAds action error [${actionName}]:`, err);
        return { error: err?.message || 'Unexpected error in TikTok Ads action' };
    }
}
