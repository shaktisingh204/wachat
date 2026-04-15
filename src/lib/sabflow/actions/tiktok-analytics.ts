'use server';

export async function executeTikTokAnalyticsAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = inputs.accessToken;
        const baseUrl = 'https://business-api.tiktok.com/open_api/v1.3';

        const headers: Record<string, string> = {
            'Access-Token': accessToken,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'getAdAccounts': {
                const params = new URLSearchParams({
                    page: String(inputs.page || 1),
                    page_size: String(inputs.pageSize || 20),
                });
                if (inputs.accountIds) params.append('account_ids', JSON.stringify(inputs.accountIds));
                const res = await fetch(`${baseUrl}/oauth2/advertiser/get/?${params.toString()}`, { headers });
                if (!res.ok) return { error: await res.text() };
                return { output: await res.json() };
            }

            case 'getCampaigns': {
                const advertiserId = inputs.advertiserId;
                const body: any = {
                    advertiser_id: advertiserId,
                    page: inputs.page || 1,
                    page_size: inputs.pageSize || 20,
                };
                if (inputs.campaignIds) body.filtering = { campaign_ids: inputs.campaignIds };
                if (inputs.status) body.filtering = { ...(body.filtering || {}), primary_status: inputs.status };
                const res = await fetch(`${baseUrl}/campaign/get/`, {
                    method: 'GET',
                    headers: { ...headers, 'Content-Type': 'application/json' },
                });
                // TikTok uses query params for GET requests
                const qParams = new URLSearchParams({
                    advertiser_id: advertiserId,
                    page: String(inputs.page || 1),
                    page_size: String(inputs.pageSize || 20),
                });
                const res2 = await fetch(`${baseUrl}/campaign/get/?${qParams.toString()}`, { headers });
                if (!res2.ok) return { error: await res2.text() };
                return { output: await res2.json() };
            }

            case 'getAdGroups': {
                const advertiserId = inputs.advertiserId;
                const params = new URLSearchParams({
                    advertiser_id: advertiserId,
                    page: String(inputs.page || 1),
                    page_size: String(inputs.pageSize || 20),
                });
                if (inputs.campaignIds) params.append('filtering', JSON.stringify({ campaign_ids: inputs.campaignIds }));
                const res = await fetch(`${baseUrl}/adgroup/get/?${params.toString()}`, { headers });
                if (!res.ok) return { error: await res.text() };
                return { output: await res.json() };
            }

            case 'getAds': {
                const advertiserId = inputs.advertiserId;
                const params = new URLSearchParams({
                    advertiser_id: advertiserId,
                    page: String(inputs.page || 1),
                    page_size: String(inputs.pageSize || 20),
                });
                if (inputs.adgroupIds) params.append('filtering', JSON.stringify({ adgroup_ids: inputs.adgroupIds }));
                const res = await fetch(`${baseUrl}/ad/get/?${params.toString()}`, { headers });
                if (!res.ok) return { error: await res.text() };
                return { output: await res.json() };
            }

            case 'getCampaignAnalytics': {
                const advertiserId = inputs.advertiserId;
                const startDate = inputs.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                const endDate = inputs.endDate || new Date().toISOString().split('T')[0];
                const body: any = {
                    advertiser_id: advertiserId,
                    service_type: 'AUCTION',
                    report_type: 'BASIC',
                    data_level: 'AUCTION_CAMPAIGN',
                    dimensions: inputs.dimensions || ['campaign_id', 'stat_time_day'],
                    metrics: inputs.metrics || ['campaign_name', 'spend', 'impressions', 'clicks', 'ctr', 'cpm', 'reach'],
                    start_date: startDate,
                    end_date: endDate,
                    page: inputs.page || 1,
                    page_size: inputs.pageSize || 20,
                };
                if (inputs.campaignIds) body.filtering = [{ filter_field: 'campaign_ids', filter_type: 'IN', filter_value: JSON.stringify(inputs.campaignIds) }];
                const res = await fetch(`${baseUrl}/report/integrated/get/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: await res.text() };
                return { output: await res.json() };
            }

            case 'getAdAnalytics': {
                const advertiserId = inputs.advertiserId;
                const startDate = inputs.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                const endDate = inputs.endDate || new Date().toISOString().split('T')[0];
                const body: any = {
                    advertiser_id: advertiserId,
                    service_type: 'AUCTION',
                    report_type: 'BASIC',
                    data_level: 'AUCTION_AD',
                    dimensions: inputs.dimensions || ['ad_id', 'stat_time_day'],
                    metrics: inputs.metrics || ['ad_name', 'spend', 'impressions', 'clicks', 'ctr', 'cpm'],
                    start_date: startDate,
                    end_date: endDate,
                    page: inputs.page || 1,
                    page_size: inputs.pageSize || 20,
                };
                const res = await fetch(`${baseUrl}/report/integrated/get/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: await res.text() };
                return { output: await res.json() };
            }

            case 'getAdGroupAnalytics': {
                const advertiserId = inputs.advertiserId;
                const startDate = inputs.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                const endDate = inputs.endDate || new Date().toISOString().split('T')[0];
                const body: any = {
                    advertiser_id: advertiserId,
                    service_type: 'AUCTION',
                    report_type: 'BASIC',
                    data_level: 'AUCTION_ADGROUP',
                    dimensions: inputs.dimensions || ['adgroup_id', 'stat_time_day'],
                    metrics: inputs.metrics || ['adgroup_name', 'spend', 'impressions', 'clicks', 'ctr', 'cpm'],
                    start_date: startDate,
                    end_date: endDate,
                    page: inputs.page || 1,
                    page_size: inputs.pageSize || 20,
                };
                const res = await fetch(`${baseUrl}/report/integrated/get/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: await res.text() };
                return { output: await res.json() };
            }

            case 'listCreatives': {
                const advertiserId = inputs.advertiserId;
                const params = new URLSearchParams({
                    advertiser_id: advertiserId,
                    page: String(inputs.page || 1),
                    page_size: String(inputs.pageSize || 20),
                });
                const res = await fetch(`${baseUrl}/file/ad_image/get/?${params.toString()}`, { headers });
                if (!res.ok) return { error: await res.text() };
                return { output: await res.json() };
            }

            case 'getAudiences': {
                const advertiserId = inputs.advertiserId;
                const params = new URLSearchParams({
                    advertiser_id: advertiserId,
                    page: String(inputs.page || 1),
                    page_size: String(inputs.pageSize || 20),
                });
                const res = await fetch(`${baseUrl}/dmp/custom_audience/list/?${params.toString()}`, { headers });
                if (!res.ok) return { error: await res.text() };
                return { output: await res.json() };
            }

            case 'createCampaign': {
                const advertiserId = inputs.advertiserId;
                const body: any = {
                    advertiser_id: advertiserId,
                    campaign_name: inputs.campaignName,
                    objective_type: inputs.objectiveType || 'TRAFFIC',
                    budget_mode: inputs.budgetMode || 'BUDGET_MODE_INFINITE',
                };
                if (inputs.budget) body.budget = inputs.budget;
                if (inputs.operationStatus) body.operation_status = inputs.operationStatus;
                const res = await fetch(`${baseUrl}/campaign/create/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: await res.text() };
                return { output: await res.json() };
            }

            case 'updateCampaign': {
                const advertiserId = inputs.advertiserId;
                const body: any = {
                    advertiser_id: advertiserId,
                    campaign_id: inputs.campaignId,
                };
                if (inputs.campaignName) body.campaign_name = inputs.campaignName;
                if (inputs.budget) body.budget = inputs.budget;
                if (inputs.operationStatus) body.operation_status = inputs.operationStatus;
                const res = await fetch(`${baseUrl}/campaign/update/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: await res.text() };
                return { output: await res.json() };
            }

            case 'pauseCampaign': {
                const advertiserId = inputs.advertiserId;
                const body: any = {
                    advertiser_id: advertiserId,
                    campaign_ids: Array.isArray(inputs.campaignIds) ? inputs.campaignIds : [inputs.campaignId],
                    opt_status: 'DISABLE',
                };
                const res = await fetch(`${baseUrl}/campaign/status/update/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: await res.text() };
                return { output: await res.json() };
            }

            case 'resumeCampaign': {
                const advertiserId = inputs.advertiserId;
                const body: any = {
                    advertiser_id: advertiserId,
                    campaign_ids: Array.isArray(inputs.campaignIds) ? inputs.campaignIds : [inputs.campaignId],
                    opt_status: 'ENABLE',
                };
                const res = await fetch(`${baseUrl}/campaign/status/update/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: await res.text() };
                return { output: await res.json() };
            }

            case 'createAdGroup': {
                const advertiserId = inputs.advertiserId;
                const body: any = {
                    advertiser_id: advertiserId,
                    campaign_id: inputs.campaignId,
                    adgroup_name: inputs.adgroupName,
                    placement_type: inputs.placementType || 'PLACEMENT_TYPE_AUTOMATIC',
                    budget_mode: inputs.budgetMode || 'BUDGET_MODE_INFINITE',
                    schedule_type: inputs.scheduleType || 'SCHEDULE_FROM_NOW',
                    optimization_goal: inputs.optimizationGoal || 'CLICK',
                    bid_type: inputs.bidType || 'BID_TYPE_NO_BID',
                };
                if (inputs.budget) body.budget = inputs.budget;
                if (inputs.scheduleStartTime) body.schedule_start_time = inputs.scheduleStartTime;
                if (inputs.targeting) body.targeting = inputs.targeting;
                const res = await fetch(`${baseUrl}/adgroup/create/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: await res.text() };
                return { output: await res.json() };
            }

            case 'getReport': {
                const advertiserId = inputs.advertiserId;
                const startDate = inputs.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                const endDate = inputs.endDate || new Date().toISOString().split('T')[0];
                const body: any = {
                    advertiser_id: advertiserId,
                    service_type: inputs.serviceType || 'AUCTION',
                    report_type: inputs.reportType || 'BASIC',
                    data_level: inputs.dataLevel || 'AUCTION_CAMPAIGN',
                    dimensions: inputs.dimensions || ['campaign_id'],
                    metrics: inputs.metrics || ['spend', 'impressions', 'clicks', 'ctr', 'reach', 'frequency', 'cpm', 'cpc'],
                    start_date: startDate,
                    end_date: endDate,
                    page: inputs.page || 1,
                    page_size: inputs.pageSize || 20,
                };
                const res = await fetch(`${baseUrl}/report/integrated/get/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: await res.text() };
                return { output: await res.json() };
            }

            default:
                return { error: `Unknown TikTok Analytics action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`TikTok Analytics action error: ${err.message}`);
        return { error: err.message || 'TikTok Analytics action failed' };
    }
}
