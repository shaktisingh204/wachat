'use server';

const GOOGLE_ADS_BASE = 'https://googleads.googleapis.com/v17';

export async function executeGoogleAdsAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const accessToken: string = inputs.accessToken;
        const developerToken: string = inputs.developerToken;
        const customerId: string = inputs.customerId;

        if (!accessToken) return { error: 'accessToken is required.' };
        if (!developerToken) return { error: 'developerToken is required.' };

        const buildHeaders = () => {
            const h: Record<string, string> = {
                Authorization: `Bearer ${accessToken}`,
                'developer-token': developerToken,
                'Content-Type': 'application/json',
            };
            if (inputs.managerId) h['login-customer-id'] = inputs.managerId;
            return h;
        };

        const customerBase = `${GOOGLE_ADS_BASE}/customers/${customerId}`;

        const gaqlSearch = async (query: string) => {
            const res = await fetch(`${customerBase}/googleAds:search`, {
                method: 'POST',
                headers: buildHeaders(),
                body: JSON.stringify({ query }),
            });
            const data = await res.json();
            if (!res.ok) return { error: data.error?.message || 'Google Ads search failed.' };
            return { output: data };
        };

        switch (actionName) {
            case 'listCustomers': {
                const res = await fetch(
                    `${GOOGLE_ADS_BASE}/customers:listAccessibleCustomers`,
                    { headers: buildHeaders() }
                );
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'Failed to list customers.' };
                return { output: data };
            }

            case 'searchCampaigns': {
                if (!customerId) return { error: 'customerId is required.' };
                const query = inputs.query ||
                    `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type
                     FROM campaign
                     WHERE campaign.status != 'REMOVED'`;
                return await gaqlSearch(query);
            }

            case 'getCampaign': {
                if (!customerId) return { error: 'customerId is required.' };
                const campaignId: string = inputs.campaignId;
                if (!campaignId) return { error: 'campaignId is required.' };
                const query = `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, campaign.start_date, campaign.end_date
                               FROM campaign
                               WHERE campaign.id = ${campaignId}`;
                return await gaqlSearch(query);
            }

            case 'createCampaign': {
                if (!customerId) return { error: 'customerId is required.' };
                const operation = {
                    operations: [
                        {
                            create: {
                                name: inputs.name,
                                status: inputs.status || 'PAUSED',
                                advertisingChannelType: inputs.advertisingChannelType || 'SEARCH',
                                campaignBudget: inputs.campaignBudget,
                                biddingStrategyType: inputs.biddingStrategyType || 'MANUAL_CPC',
                                startDate: inputs.startDate,
                                endDate: inputs.endDate,
                            },
                        },
                    ],
                };
                const res = await fetch(`${customerBase}/campaigns:mutate`, {
                    method: 'POST',
                    headers: buildHeaders(),
                    body: JSON.stringify(operation),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'Failed to create campaign.' };
                return { output: data };
            }

            case 'updateCampaign': {
                if (!customerId) return { error: 'customerId is required.' };
                const campaignId: string = inputs.campaignId;
                if (!campaignId) return { error: 'campaignId is required.' };
                const updateFields: Record<string, any> = {
                    resourceName: `customers/${customerId}/campaigns/${campaignId}`,
                };
                const updateMask: string[] = [];
                if (inputs.name) { updateFields.name = inputs.name; updateMask.push('name'); }
                if (inputs.status) { updateFields.status = inputs.status; updateMask.push('status'); }
                if (inputs.endDate) { updateFields.endDate = inputs.endDate; updateMask.push('end_date'); }
                const operation = {
                    operations: [{ update: updateFields, updateMask: updateMask.join(',') }],
                };
                const res = await fetch(`${customerBase}/campaigns:mutate`, {
                    method: 'POST',
                    headers: buildHeaders(),
                    body: JSON.stringify(operation),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'Failed to update campaign.' };
                return { output: data };
            }

            case 'getAdGroups': {
                if (!customerId) return { error: 'customerId is required.' };
                const query = inputs.campaignId
                    ? `SELECT ad_group.id, ad_group.name, ad_group.status, ad_group.campaign FROM ad_group WHERE ad_group.campaign = 'customers/${customerId}/campaigns/${inputs.campaignId}'`
                    : `SELECT ad_group.id, ad_group.name, ad_group.status, ad_group.campaign FROM ad_group WHERE ad_group.status != 'REMOVED'`;
                return await gaqlSearch(query);
            }

            case 'createAdGroup': {
                if (!customerId) return { error: 'customerId is required.' };
                const operation = {
                    operations: [
                        {
                            create: {
                                name: inputs.name,
                                campaign: `customers/${customerId}/campaigns/${inputs.campaignId}`,
                                status: inputs.status || 'PAUSED',
                                type: inputs.type || 'SEARCH_STANDARD',
                                cpcBidMicros: inputs.cpcBidMicros || '1000000',
                            },
                        },
                    ],
                };
                const res = await fetch(`${customerBase}/adGroups:mutate`, {
                    method: 'POST',
                    headers: buildHeaders(),
                    body: JSON.stringify(operation),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'Failed to create ad group.' };
                return { output: data };
            }

            case 'getKeywords': {
                if (!customerId) return { error: 'customerId is required.' };
                const query = inputs.adGroupId
                    ? `SELECT ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ad_group_criterion.status, ad_group_criterion.ad_group FROM ad_group_criterion WHERE ad_group_criterion.ad_group = 'customers/${customerId}/adGroups/${inputs.adGroupId}' AND ad_group_criterion.type = 'KEYWORD'`
                    : `SELECT ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ad_group_criterion.status, ad_group_criterion.ad_group FROM ad_group_criterion WHERE ad_group_criterion.type = 'KEYWORD' AND ad_group_criterion.status != 'REMOVED'`;
                return await gaqlSearch(query);
            }

            case 'addKeyword': {
                if (!customerId) return { error: 'customerId is required.' };
                const operation = {
                    operations: [
                        {
                            create: {
                                adGroup: `customers/${customerId}/adGroups/${inputs.adGroupId}`,
                                status: inputs.status || 'PAUSED',
                                keyword: {
                                    text: inputs.keywordText,
                                    matchType: inputs.matchType || 'BROAD',
                                },
                            },
                        },
                    ],
                };
                const res = await fetch(`${customerBase}/adGroupCriteria:mutate`, {
                    method: 'POST',
                    headers: buildHeaders(),
                    body: JSON.stringify(operation),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'Failed to add keyword.' };
                return { output: data };
            }

            case 'getBidding': {
                if (!customerId) return { error: 'customerId is required.' };
                const query = `SELECT bidding_strategy.id, bidding_strategy.name, bidding_strategy.type, bidding_strategy.status FROM bidding_strategy`;
                return await gaqlSearch(query);
            }

            case 'getMetrics': {
                if (!customerId) return { error: 'customerId is required.' };
                const query = inputs.query ||
                    `SELECT campaign.id, campaign.name, metrics.clicks, metrics.impressions, metrics.ctr, metrics.average_cpc, metrics.cost_micros
                     FROM campaign
                     WHERE segments.date DURING LAST_30_DAYS`;
                return await gaqlSearch(query);
            }

            case 'getBudgets': {
                if (!customerId) return { error: 'customerId is required.' };
                const query = `SELECT campaign_budget.id, campaign_budget.name, campaign_budget.amount_micros, campaign_budget.status FROM campaign_budget`;
                return await gaqlSearch(query);
            }

            case 'createBudget': {
                if (!customerId) return { error: 'customerId is required.' };
                const operation = {
                    operations: [
                        {
                            create: {
                                name: inputs.name,
                                amountMicros: inputs.amountMicros || String(Number(inputs.amount || 10) * 1000000),
                                deliveryMethod: inputs.deliveryMethod || 'STANDARD',
                            },
                        },
                    ],
                };
                const res = await fetch(`${customerBase}/campaignBudgets:mutate`, {
                    method: 'POST',
                    headers: buildHeaders(),
                    body: JSON.stringify(operation),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'Failed to create budget.' };
                return { output: data };
            }

            default:
                return { error: `Google Ads action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        logger.log(`executeGoogleAdsAction error: ${err.message}`);
        return { error: err.message || 'An unexpected error occurred in Google Ads action.' };
    }
}
