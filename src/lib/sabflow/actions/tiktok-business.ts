'use server';

export async function executeTiktokBusinessAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const accessToken: string = inputs.accessToken || inputs.access_token;
        if (!accessToken) throw new Error('Missing TikTok accessToken in inputs');

        const BASE = 'https://business-api.tiktok.com/open_api/v1.3';

        async function tikReq(
            method: 'GET' | 'POST',
            path: string,
            body?: Record<string, any>,
            queryParams?: Record<string, string>
        ): Promise<any> {
            let url = `${BASE}${path}/`;
            if (queryParams && Object.keys(queryParams).length > 0) {
                url += `?${new URLSearchParams(queryParams).toString()}`;
            }
            const headers: Record<string, string> = {
                'Access-Token': accessToken,
                'Content-Type': 'application/json',
            };
            const options: RequestInit = { method, headers };
            if (body && method !== 'GET') {
                options.body = JSON.stringify(body);
            }
            const res = await fetch(url, options);
            const json = await res.json();
            if (!res.ok || (json?.code !== undefined && json.code !== 0)) {
                throw new Error(json?.message || json?.msg || `TikTok Business API error ${res.status}`);
            }
            return json?.data ?? json;
        }

        switch (actionName) {
            case 'getAdAccount': {
                const advertiserId: string = inputs.advertiserId || inputs.advertiser_id;
                if (!advertiserId) throw new Error('Missing advertiserId');
                const result = await tikReq('GET', '/advertiser/info', undefined, {
                    advertiser_ids: JSON.stringify([advertiserId]),
                });
                return { output: result };
            }

            case 'listCampaigns': {
                const advertiserId: string = inputs.advertiserId || inputs.advertiser_id;
                if (!advertiserId) throw new Error('Missing advertiserId');
                const params: Record<string, string> = { advertiser_id: advertiserId };
                if (inputs.page) params.page = String(inputs.page);
                if (inputs.pageSize) params.page_size = String(inputs.pageSize);
                const result = await tikReq('GET', '/campaign/get', undefined, params);
                return { output: result };
            }

            case 'getCampaign': {
                const advertiserId: string = inputs.advertiserId || inputs.advertiser_id;
                const campaignId: string = inputs.campaignId || inputs.campaign_id;
                if (!advertiserId || !campaignId) throw new Error('Missing advertiserId or campaignId');
                const result = await tikReq('GET', '/campaign/get', undefined, {
                    advertiser_id: advertiserId,
                    campaign_ids: JSON.stringify([campaignId]),
                });
                return { output: result };
            }

            case 'createCampaign': {
                const advertiserId: string = inputs.advertiserId || inputs.advertiser_id;
                if (!advertiserId) throw new Error('Missing advertiserId');
                const body: Record<string, any> = {
                    advertiser_id: advertiserId,
                    campaign_name: inputs.campaignName || inputs.name,
                    objective_type: inputs.objectiveType || 'TRAFFIC',
                    budget_mode: inputs.budgetMode || 'BUDGET_MODE_INFINITE',
                };
                if (inputs.budget) body.budget = inputs.budget;
                if (inputs.campaignType) body.campaign_type = inputs.campaignType;
                const result = await tikReq('POST', '/campaign/create', body);
                return { output: result };
            }

            case 'updateCampaign': {
                const advertiserId: string = inputs.advertiserId || inputs.advertiser_id;
                const campaignId: string = inputs.campaignId || inputs.campaign_id;
                if (!advertiserId || !campaignId) throw new Error('Missing advertiserId or campaignId');
                const body: Record<string, any> = {
                    advertiser_id: advertiserId,
                    campaign_id: campaignId,
                };
                if (inputs.campaignName) body.campaign_name = inputs.campaignName;
                if (inputs.budget) body.budget = inputs.budget;
                if (inputs.operationStatus) body.operation_status = inputs.operationStatus;
                const result = await tikReq('POST', '/campaign/update', body);
                return { output: result };
            }

            case 'listAdGroups': {
                const advertiserId: string = inputs.advertiserId || inputs.advertiser_id;
                if (!advertiserId) throw new Error('Missing advertiserId');
                const params: Record<string, string> = { advertiser_id: advertiserId };
                if (inputs.campaignId) params.campaign_ids = JSON.stringify([inputs.campaignId]);
                if (inputs.page) params.page = String(inputs.page);
                if (inputs.pageSize) params.page_size = String(inputs.pageSize);
                const result = await tikReq('GET', '/adgroup/get', undefined, params);
                return { output: result };
            }

            case 'createAdGroup': {
                const advertiserId: string = inputs.advertiserId || inputs.advertiser_id;
                const campaignId: string = inputs.campaignId || inputs.campaign_id;
                if (!advertiserId || !campaignId) throw new Error('Missing advertiserId or campaignId');
                const body: Record<string, any> = {
                    advertiser_id: advertiserId,
                    campaign_id: campaignId,
                    adgroup_name: inputs.adgroupName || inputs.name,
                    placement_type: inputs.placementType || 'PLACEMENT_TYPE_AUTOMATIC',
                    budget_mode: inputs.budgetMode || 'BUDGET_MODE_DAY',
                    budget: inputs.budget || 50,
                    schedule_type: inputs.scheduleType || 'SCHEDULE_START_END',
                    schedule_start_time: inputs.startTime,
                    schedule_end_time: inputs.endTime,
                    optimization_goal: inputs.optimizationGoal || 'CLICK',
                    bid_type: inputs.bidType || 'BID_TYPE_NO_BID',
                    billing_event: inputs.billingEvent || 'CPC',
                };
                if (inputs.targeting) body.targeting = inputs.targeting;
                const result = await tikReq('POST', '/adgroup/create', body);
                return { output: result };
            }

            case 'listAds': {
                const advertiserId: string = inputs.advertiserId || inputs.advertiser_id;
                if (!advertiserId) throw new Error('Missing advertiserId');
                const params: Record<string, string> = { advertiser_id: advertiserId };
                if (inputs.adgroupId) params.adgroup_ids = JSON.stringify([inputs.adgroupId]);
                if (inputs.campaignId) params.campaign_ids = JSON.stringify([inputs.campaignId]);
                if (inputs.page) params.page = String(inputs.page);
                if (inputs.pageSize) params.page_size = String(inputs.pageSize);
                const result = await tikReq('GET', '/ad/get', undefined, params);
                return { output: result };
            }

            case 'createAd': {
                const advertiserId: string = inputs.advertiserId || inputs.advertiser_id;
                const adgroupId: string = inputs.adgroupId || inputs.adgroup_id;
                if (!advertiserId || !adgroupId) throw new Error('Missing advertiserId or adgroupId');
                const body: Record<string, any> = {
                    advertiser_id: advertiserId,
                    adgroup_id: adgroupId,
                    creatives: inputs.creatives || [],
                };
                const result = await tikReq('POST', '/ad/create', body);
                return { output: result };
            }

            case 'getAdInsights': {
                const advertiserId: string = inputs.advertiserId || inputs.advertiser_id;
                if (!advertiserId) throw new Error('Missing advertiserId');
                const body: Record<string, any> = {
                    advertiser_id: advertiserId,
                    report_type: inputs.reportType || 'BASIC',
                    dimensions: inputs.dimensions || ['ad_id'],
                    metrics: inputs.metrics || ['impressions', 'clicks', 'spend', 'ctr'],
                    start_date: inputs.startDate,
                    end_date: inputs.endDate,
                    data_level: inputs.dataLevel || 'AUCTION_AD',
                };
                if (inputs.adIds) body.filters = [{ field_name: 'ad_id', filter_type: 'IN', filter_value: JSON.stringify(inputs.adIds) }];
                const result = await tikReq('POST', '/report/integrated/get', body);
                return { output: result };
            }

            case 'getCampaignInsights': {
                const advertiserId: string = inputs.advertiserId || inputs.advertiser_id;
                if (!advertiserId) throw new Error('Missing advertiserId');
                const body: Record<string, any> = {
                    advertiser_id: advertiserId,
                    report_type: inputs.reportType || 'BASIC',
                    dimensions: inputs.dimensions || ['campaign_id'],
                    metrics: inputs.metrics || ['impressions', 'clicks', 'spend', 'ctr', 'cpc'],
                    start_date: inputs.startDate,
                    end_date: inputs.endDate,
                    data_level: inputs.dataLevel || 'AUCTION_CAMPAIGN',
                };
                const result = await tikReq('POST', '/report/integrated/get', body);
                return { output: result };
            }

            case 'uploadImage': {
                const advertiserId: string = inputs.advertiserId || inputs.advertiser_id;
                const imageUrl: string = inputs.imageUrl || inputs.image_url;
                if (!advertiserId || !imageUrl) throw new Error('Missing advertiserId or imageUrl');
                const result = await tikReq('POST', '/file/image/ad/upload', {
                    advertiser_id: advertiserId,
                    upload_type: 'UPLOAD_BY_URL',
                    image_url: imageUrl,
                    image_signature: inputs.imageSignature || '',
                });
                return { output: result };
            }

            case 'uploadVideo': {
                const advertiserId: string = inputs.advertiserId || inputs.advertiser_id;
                const videoUrl: string = inputs.videoUrl || inputs.video_url;
                if (!advertiserId || !videoUrl) throw new Error('Missing advertiserId or videoUrl');
                const result = await tikReq('POST', '/file/video/ad/upload', {
                    advertiser_id: advertiserId,
                    upload_type: 'UPLOAD_BY_URL',
                    video_url: videoUrl,
                    video_signature: inputs.videoSignature || '',
                });
                return { output: result };
            }

            case 'getAudiences': {
                const advertiserId: string = inputs.advertiserId || inputs.advertiser_id;
                if (!advertiserId) throw new Error('Missing advertiserId');
                const params: Record<string, string> = { advertiser_id: advertiserId };
                if (inputs.page) params.page = String(inputs.page);
                if (inputs.pageSize) params.page_size = String(inputs.pageSize);
                const result = await tikReq('GET', '/dmp/custom_audience/list', undefined, params);
                return { output: result };
            }

            case 'createCustomAudience': {
                const advertiserId: string = inputs.advertiserId || inputs.advertiser_id;
                if (!advertiserId) throw new Error('Missing advertiserId');
                const body: Record<string, any> = {
                    advertiser_id: advertiserId,
                    custom_audience_name: inputs.audienceName || inputs.name,
                    audience_type: inputs.audienceType || 'ENGAGEMENT',
                    retention_days: inputs.retentionDays || 30,
                };
                if (inputs.ruleSpec) body.rule_spec = inputs.ruleSpec;
                const result = await tikReq('POST', '/dmp/custom_audience/create', body);
                return { output: result };
            }

            default:
                return { error: `TikTok Business: unknown action "${actionName}"` };
        }
    } catch (err: any) {
        logger.log(`TikTok Business action error [${actionName}]: ${err.message}`);
        return { error: err.message || 'TikTok Business action failed' };
    }
}
