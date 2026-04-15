
'use server';

const TIKTOK_BASE = 'https://business-api.tiktok.com/open_api/v1.3';

async function tiktokFetch(
    accessToken: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
): Promise<any> {
    logger?.log(`[TikTok] ${method} ${path}`);
    const url = path.startsWith('http') ? path : `${TIKTOK_BASE}${path}`;
    const options: RequestInit = {
        method,
        headers: {
            'Access-Token': accessToken,
            'Content-Type': 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    const data = await res.json();
    if (!res.ok || data?.code !== 0) {
        throw new Error(
            data?.message || data?.msg || `TikTok API error: ${res.status}`
        );
    }
    return data?.data ?? data;
}

export async function executeTiktokAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');

        const tt = (method: string, path: string, body?: any) =>
            tiktokFetch(accessToken, method, path, body, logger);

        switch (actionName) {
            case 'getAccountInfo': {
                const advertiserId = String(inputs.advertiserId ?? '').trim();
                if (!advertiserId) throw new Error('advertiserId is required.');
                const qs = `/advertiser/info/?advertiser_ids=${encodeURIComponent(JSON.stringify([advertiserId]))}&fields=${encodeURIComponent(JSON.stringify(['name', 'status', 'balance']))}`;
                const data = await tt('GET', qs);
                return { output: { advertiserInfo: data?.list?.[0] ?? data } };
            }

            case 'listCampaigns': {
                const advertiserId = String(inputs.advertiserId ?? '').trim();
                if (!advertiserId) throw new Error('advertiserId is required.');
                const page = Number(inputs.page ?? 1);
                const pageSize = Number(inputs.pageSize ?? 10);
                const data = await tt(
                    'GET',
                    `/campaign/get/?advertiser_id=${advertiserId}&page=${page}&page_size=${pageSize}`
                );
                return {
                    output: {
                        campaigns: data?.list ?? [],
                        pageInfo: data?.page_info ?? {},
                    },
                };
            }

            case 'createCampaign': {
                const advertiserId = String(inputs.advertiserId ?? '').trim();
                const campaignName = String(inputs.campaignName ?? '').trim();
                const objective = String(inputs.objective ?? '').trim();
                const budget = Number(inputs.budget ?? 0);
                const budgetMode = String(inputs.budgetMode ?? '').trim();
                if (!advertiserId) throw new Error('advertiserId is required.');
                if (!campaignName) throw new Error('campaignName is required.');
                if (!objective) throw new Error('objective is required.');
                if (!budgetMode) throw new Error('budgetMode is required.');
                const data = await tt('POST', '/campaign/create/', {
                    advertiser_id: advertiserId,
                    campaign_name: campaignName,
                    objective_type: objective,
                    budget,
                    budget_mode: budgetMode,
                });
                logger.log(`[TikTok] Campaign created: ${data?.campaign_id}`);
                return { output: { campaignId: data?.campaign_id ?? '' } };
            }

            case 'listAdGroups': {
                const advertiserId = String(inputs.advertiserId ?? '').trim();
                if (!advertiserId) throw new Error('advertiserId is required.');
                const page = Number(inputs.page ?? 1);
                const pageSize = Number(inputs.pageSize ?? 10);
                let qs = `/adgroup/get/?advertiser_id=${advertiserId}&page=${page}&page_size=${pageSize}`;
                if (inputs.campaignId) qs += `&campaign_id=${encodeURIComponent(String(inputs.campaignId))}`;
                const data = await tt('GET', qs);
                return {
                    output: {
                        adgroups: data?.list ?? [],
                        pageInfo: data?.page_info ?? {},
                    },
                };
            }

            case 'createAdGroup': {
                const advertiserId = String(inputs.advertiserId ?? '').trim();
                const campaignId = String(inputs.campaignId ?? '').trim();
                const adgroupName = String(inputs.adgroupName ?? '').trim();
                const placements = inputs.placements;
                const budget = Number(inputs.budget ?? 0);
                const scheduleType = String(inputs.scheduleType ?? '').trim();
                const startTime = String(inputs.startTime ?? '').trim();
                if (!advertiserId) throw new Error('advertiserId is required.');
                if (!campaignId) throw new Error('campaignId is required.');
                if (!adgroupName) throw new Error('adgroupName is required.');
                if (!placements) throw new Error('placements is required.');
                if (!scheduleType) throw new Error('scheduleType is required.');
                if (!startTime) throw new Error('startTime is required.');
                const data = await tt('POST', '/adgroup/create/', {
                    advertiser_id: advertiserId,
                    campaign_id: campaignId,
                    adgroup_name: adgroupName,
                    placements,
                    budget,
                    schedule_type: scheduleType,
                    schedule_start_time: startTime,
                });
                logger.log(`[TikTok] AdGroup created: ${data?.adgroup_id}`);
                return { output: { adgroupId: data?.adgroup_id ?? '' } };
            }

            case 'listAds': {
                const advertiserId = String(inputs.advertiserId ?? '').trim();
                if (!advertiserId) throw new Error('advertiserId is required.');
                const page = Number(inputs.page ?? 1);
                let qs = `/ad/get/?advertiser_id=${advertiserId}&page=${page}`;
                if (inputs.adgroupId) qs += `&adgroup_id=${encodeURIComponent(String(inputs.adgroupId))}`;
                const data = await tt('GET', qs);
                return {
                    output: {
                        ads: data?.list ?? [],
                        pageInfo: data?.page_info ?? {},
                    },
                };
            }

            case 'createAd': {
                const advertiserId = String(inputs.advertiserId ?? '').trim();
                const adgroupId = String(inputs.adgroupId ?? '').trim();
                const adName = String(inputs.adName ?? '').trim();
                const videoId = String(inputs.videoId ?? '').trim();
                const thumbnailId = String(inputs.thumbnailId ?? '').trim();
                const adText = String(inputs.adText ?? '').trim();
                const callToAction = String(inputs.callToAction ?? '').trim();
                if (!advertiserId) throw new Error('advertiserId is required.');
                if (!adgroupId) throw new Error('adgroupId is required.');
                if (!adName) throw new Error('adName is required.');
                if (!videoId) throw new Error('videoId is required.');
                if (!adText) throw new Error('adText is required.');
                const data = await tt('POST', '/ad/create/', {
                    advertiser_id: advertiserId,
                    adgroup_id: adgroupId,
                    creatives: [
                        {
                            ad_name: adName,
                            video_id: videoId,
                            image_ids: thumbnailId ? [thumbnailId] : undefined,
                            ad_text: adText,
                            call_to_action: callToAction || undefined,
                        },
                    ],
                });
                logger.log(`[TikTok] Ad created`);
                return { output: { adId: data?.ad_ids?.[0] ?? '' } };
            }

            case 'uploadVideo': {
                const advertiserId = String(inputs.advertiserId ?? '').trim();
                const videoUrl = String(inputs.videoUrl ?? '').trim();
                const videoFileName = String(inputs.videoFileName ?? '').trim();
                if (!advertiserId) throw new Error('advertiserId is required.');
                if (!videoUrl) throw new Error('videoUrl is required.');
                if (!videoFileName) throw new Error('videoFileName is required.');
                const data = await tt('POST', '/file/video/ad/upload/', {
                    advertiser_id: advertiserId,
                    video_url: videoUrl,
                    file_name: videoFileName,
                });
                return { output: { videoId: data?.video_id ?? '' } };
            }

            case 'uploadImage': {
                const advertiserId = String(inputs.advertiserId ?? '').trim();
                const imageUrl = String(inputs.imageUrl ?? '').trim();
                if (!advertiserId) throw new Error('advertiserId is required.');
                if (!imageUrl) throw new Error('imageUrl is required.');
                const data = await tt('POST', '/file/image/ad/upload/', {
                    advertiser_id: advertiserId,
                    upload_type: 'UPLOAD_BY_URL',
                    image_url: imageUrl,
                });
                return { output: { imageId: data?.image_id ?? '' } };
            }

            case 'getReports': {
                const advertiserId = String(inputs.advertiserId ?? '').trim();
                const reportType = String(inputs.reportType ?? '').trim();
                const dimensions = inputs.dimensions;
                const metrics = inputs.metrics;
                const startDate = String(inputs.startDate ?? '').trim();
                const endDate = String(inputs.endDate ?? '').trim();
                if (!advertiserId) throw new Error('advertiserId is required.');
                if (!reportType) throw new Error('reportType is required.');
                if (!dimensions) throw new Error('dimensions is required.');
                if (!metrics) throw new Error('metrics is required.');
                if (!startDate) throw new Error('startDate is required.');
                if (!endDate) throw new Error('endDate is required.');
                const data = await tt('POST', '/report/integrated/get/', {
                    advertiser_id: advertiserId,
                    report_type: reportType,
                    data_level: 'AUCTION_AD',
                    dimensions,
                    metrics,
                    start_date: startDate,
                    end_date: endDate,
                });
                return { output: { data: data?.list ?? [] } };
            }

            case 'pauseCampaign': {
                const advertiserId = String(inputs.advertiserId ?? '').trim();
                const campaignIds = inputs.campaignIds;
                if (!advertiserId) throw new Error('advertiserId is required.');
                if (!campaignIds || !Array.isArray(campaignIds) || campaignIds.length === 0) {
                    throw new Error('campaignIds must be a non-empty array.');
                }
                await tt('POST', '/campaign/status/update/', {
                    advertiser_id: advertiserId,
                    campaign_ids: campaignIds,
                    opt_status: 'DISABLE',
                });
                return { output: { updated: true } };
            }

            case 'resumeCampaign': {
                const advertiserId = String(inputs.advertiserId ?? '').trim();
                const campaignIds = inputs.campaignIds;
                if (!advertiserId) throw new Error('advertiserId is required.');
                if (!campaignIds || !Array.isArray(campaignIds) || campaignIds.length === 0) {
                    throw new Error('campaignIds must be a non-empty array.');
                }
                await tt('POST', '/campaign/status/update/', {
                    advertiser_id: advertiserId,
                    campaign_ids: campaignIds,
                    opt_status: 'ENABLE',
                });
                return { output: { updated: true } };
            }

            default:
                return { error: `TikTok action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'TikTok action failed.' };
    }
}
