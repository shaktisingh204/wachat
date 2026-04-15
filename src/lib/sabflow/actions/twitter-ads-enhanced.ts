'use server';

import crypto from 'crypto';

export async function executeTwitterAdsEnhancedAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const consumerKey: string = inputs.consumerKey;
        const consumerSecret: string = inputs.consumerSecret;
        const accessToken: string = inputs.accessToken;
        const accessSecret: string = inputs.accessSecret;
        const accountId: string = inputs.accountId;

        if (!consumerKey) return { error: 'consumerKey is required.' };
        if (!consumerSecret) return { error: 'consumerSecret is required.' };
        if (!accessToken) return { error: 'accessToken is required.' };
        if (!accessSecret) return { error: 'accessSecret is required.' };
        if (!accountId) return { error: 'accountId is required.' };

        const BASE = `https://ads-api.twitter.com/12/accounts/${accountId}`;

        const buildOAuthHeader = (method: string, url: string, params: Record<string, string> = {}): string => {
            const oauthParams: Record<string, string> = {
                oauth_consumer_key: consumerKey,
                oauth_nonce: Buffer.from(crypto.randomBytes(16)).toString('base64').replace(/[^a-zA-Z0-9]/g, ''),
                oauth_signature_method: 'HMAC-SHA1',
                oauth_timestamp: String(Math.floor(Date.now() / 1000)),
                oauth_token: accessToken,
                oauth_version: '1.0',
            };

            const allParams = { ...params, ...oauthParams };
            const sortedKeys = Object.keys(allParams).sort();
            const paramString = sortedKeys
                .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(allParams[k])}`)
                .join('&');

            const baseString = [
                method.toUpperCase(),
                encodeURIComponent(url.split('?')[0]),
                encodeURIComponent(paramString),
            ].join('&');

            const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(accessSecret)}`;
            const signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');

            const headerParams = { ...oauthParams, oauth_signature: signature };
            const headerStr = Object.keys(headerParams)
                .sort()
                .map((k) => `${encodeURIComponent(k)}="${encodeURIComponent(headerParams[k])}"`)
                .join(', ');

            return `OAuth ${headerStr}`;
        };

        const apiGet = async (path: string, query: Record<string, string> = {}) => {
            const qs = new URLSearchParams(query).toString();
            const fullUrl = qs ? `${BASE}/${path}?${qs}` : `${BASE}/${path}`;
            const res = await fetch(fullUrl, {
                method: 'GET',
                headers: {
                    Authorization: buildOAuthHeader('GET', fullUrl, query),
                    'Content-Type': 'application/json',
                },
            });
            const data = await res.json();
            if (!res.ok) return { error: data?.errors?.[0]?.message || data?.request || 'Twitter Ads GET failed.' };
            return { output: data };
        };

        const apiPost = async (path: string, body: Record<string, string>) => {
            const fullUrl = `${BASE}/${path}`;
            const res = await fetch(fullUrl, {
                method: 'POST',
                headers: {
                    Authorization: buildOAuthHeader('POST', fullUrl, body),
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams(body).toString(),
            });
            const data = await res.json();
            if (!res.ok) return { error: data?.errors?.[0]?.message || 'Twitter Ads POST failed.' };
            return { output: data };
        };

        const apiDelete = async (path: string) => {
            const fullUrl = `${BASE}/${path}`;
            const res = await fetch(fullUrl, {
                method: 'DELETE',
                headers: {
                    Authorization: buildOAuthHeader('DELETE', fullUrl),
                    'Content-Type': 'application/json',
                },
            });
            const data = await res.json();
            if (!res.ok) return { error: data?.errors?.[0]?.message || 'Twitter Ads DELETE failed.' };
            return { output: data };
        };

        switch (actionName) {
            case 'listCampaigns': {
                const q: Record<string, string> = {};
                if (inputs.count) q.count = String(inputs.count);
                if (inputs.cursor) q.cursor = inputs.cursor;
                return apiGet('campaigns', q);
            }

            case 'getCampaign': {
                if (!inputs.campaignId) return { error: 'campaignId is required.' };
                return apiGet(`campaigns/${inputs.campaignId}`);
            }

            case 'createCampaign': {
                if (!inputs.name) return { error: 'name is required.' };
                if (!inputs.fundingInstrumentId) return { error: 'fundingInstrumentId is required.' };
                const body: Record<string, string> = {
                    name: inputs.name,
                    funding_instrument_id: inputs.fundingInstrumentId,
                    entity_status: inputs.entityStatus || 'PAUSED',
                };
                if (inputs.dailyBudgetAmountLocalMicro) body.daily_budget_amount_local_micro = String(inputs.dailyBudgetAmountLocalMicro);
                if (inputs.totalBudgetAmountLocalMicro) body.total_budget_amount_local_micro = String(inputs.totalBudgetAmountLocalMicro);
                if (inputs.startTime) body.start_time = inputs.startTime;
                if (inputs.endTime) body.end_time = inputs.endTime;
                return apiPost('campaigns', body);
            }

            case 'updateCampaign': {
                if (!inputs.campaignId) return { error: 'campaignId is required.' };
                const fullUrl = `${BASE}/campaigns/${inputs.campaignId}`;
                const body: Record<string, string> = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.entityStatus) body.entity_status = inputs.entityStatus;
                if (inputs.dailyBudgetAmountLocalMicro) body.daily_budget_amount_local_micro = String(inputs.dailyBudgetAmountLocalMicro);
                const res = await fetch(fullUrl, {
                    method: 'PUT',
                    headers: {
                        Authorization: buildOAuthHeader('PUT', fullUrl, body),
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams(body).toString(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.errors?.[0]?.message || 'Update campaign failed.' };
                return { output: data };
            }

            case 'deleteCampaign': {
                if (!inputs.campaignId) return { error: 'campaignId is required.' };
                return apiDelete(`campaigns/${inputs.campaignId}`);
            }

            case 'listLineItems': {
                const q: Record<string, string> = {};
                if (inputs.campaignId) q.campaign_id = inputs.campaignId;
                if (inputs.count) q.count = String(inputs.count);
                return apiGet('line_items', q);
            }

            case 'getLineItem': {
                if (!inputs.lineItemId) return { error: 'lineItemId is required.' };
                return apiGet(`line_items/${inputs.lineItemId}`);
            }

            case 'createLineItem': {
                if (!inputs.campaignId) return { error: 'campaignId is required.' };
                if (!inputs.name) return { error: 'name is required.' };
                if (!inputs.productType) return { error: 'productType is required (e.g. PROMOTED_TWEETS).' };
                if (!inputs.placements) return { error: 'placements is required (e.g. ALL_ON_TWITTER).' };
                if (!inputs.objective) return { error: 'objective is required.' };
                const body: Record<string, string> = {
                    campaign_id: inputs.campaignId,
                    name: inputs.name,
                    product_type: inputs.productType,
                    placements: inputs.placements,
                    objective: inputs.objective,
                    entity_status: inputs.entityStatus || 'PAUSED',
                };
                if (inputs.bidAmountLocalMicro) body.bid_amount_local_micro = String(inputs.bidAmountLocalMicro);
                return apiPost('line_items', body);
            }

            case 'listPromotedTweets': {
                const q: Record<string, string> = {};
                if (inputs.lineItemId) q.line_item_id = inputs.lineItemId;
                if (inputs.count) q.count = String(inputs.count);
                return apiGet('promoted_tweets', q);
            }

            case 'createPromotedTweet': {
                if (!inputs.lineItemId) return { error: 'lineItemId is required.' };
                if (!inputs.tweetId) return { error: 'tweetId is required.' };
                return apiPost('promoted_tweets', {
                    line_item_id: inputs.lineItemId,
                    tweet_id: inputs.tweetId,
                });
            }

            case 'listAudienceSegments': {
                const q: Record<string, string> = {};
                if (inputs.segmentType) q.segment_type = inputs.segmentType;
                if (inputs.count) q.count = String(inputs.count);
                return apiGet('custom_audiences', q);
            }

            case 'getAudienceSegment': {
                if (!inputs.audienceId) return { error: 'audienceId is required.' };
                return apiGet(`custom_audiences/${inputs.audienceId}`);
            }

            case 'getStats': {
                if (!inputs.entity) return { error: 'entity is required (e.g. CAMPAIGN).' };
                if (!inputs.entityIds) return { error: 'entityIds (comma-separated) is required.' };
                if (!inputs.startTime) return { error: 'startTime is required.' };
                if (!inputs.endTime) return { error: 'endTime is required.' };
                const q: Record<string, string> = {
                    entity: inputs.entity,
                    entity_ids: Array.isArray(inputs.entityIds) ? inputs.entityIds.join(',') : inputs.entityIds,
                    start_time: inputs.startTime,
                    end_time: inputs.endTime,
                    metric_groups: inputs.metricGroups || 'ENGAGEMENT',
                    granularity: inputs.granularity || 'DAY',
                };
                const statsUrl = `https://ads-api.twitter.com/12/stats/accounts/${accountId}`;
                const qs = new URLSearchParams(q).toString();
                const fullUrl = `${statsUrl}?${qs}`;
                const res = await fetch(fullUrl, {
                    method: 'GET',
                    headers: {
                        Authorization: buildOAuthHeader('GET', fullUrl, q),
                        'Content-Type': 'application/json',
                    },
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.errors?.[0]?.message || 'getStats failed.' };
                return { output: data };
            }

            case 'getReach': {
                if (!inputs.campaignId) return { error: 'campaignId is required.' };
                return apiGet(`reach/campaigns/${inputs.campaignId}`);
            }

            case 'listFundingInstruments': {
                const q: Record<string, string> = {};
                if (inputs.count) q.count = String(inputs.count);
                return apiGet('funding_instruments', q);
            }

            default:
                return { error: `Unknown actionName: ${actionName}` };
        }
    } catch (e: any) {
        return { error: e.message || 'Unexpected error in twitter-ads-enhanced.' };
    }
}
