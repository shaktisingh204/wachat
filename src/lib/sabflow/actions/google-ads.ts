'use server';

export async function executeGoogleAdsAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const baseUrl = `https://googleads.googleapis.com/v14/customers/${inputs.customerId}`;
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${inputs.accessToken}`,
            'developer-token': inputs.developerToken,
            'Content-Type': 'application/json',
        };
        if (inputs.loginCustomerId) {
            headers['login-customer-id'] = inputs.loginCustomerId;
        }

        switch (actionName) {
            case 'getCampaigns': {
                const query = `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, campaign.start_date, campaign.end_date FROM campaign ORDER BY campaign.id`;
                const res = await fetch(`${baseUrl}/googleAds:searchStream`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ query }),
                });
                if (!res.ok) throw new Error(await res.text());
                return { output: await res.json() };
            }

            case 'createCampaign': {
                const res = await fetch(`${baseUrl}/campaigns:mutate`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        operations: [{
                            create: {
                                name: inputs.name,
                                status: inputs.status || 'PAUSED',
                                advertisingChannelType: inputs.advertisingChannelType || 'SEARCH',
                                campaignBudget: inputs.campaignBudget,
                                startDate: inputs.startDate,
                                endDate: inputs.endDate,
                            },
                        }],
                    }),
                });
                if (!res.ok) throw new Error(await res.text());
                return { output: await res.json() };
            }

            case 'updateCampaign': {
                const res = await fetch(`${baseUrl}/campaigns:mutate`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        operations: [{
                            update: {
                                resourceName: `customers/${inputs.customerId}/campaigns/${inputs.campaignId}`,
                                name: inputs.name,
                                status: inputs.status,
                            },
                            updateMask: inputs.updateMask || 'name,status',
                        }],
                    }),
                });
                if (!res.ok) throw new Error(await res.text());
                return { output: await res.json() };
            }

            case 'removeCampaign': {
                const res = await fetch(`${baseUrl}/campaigns:mutate`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        operations: [{
                            remove: `customers/${inputs.customerId}/campaigns/${inputs.campaignId}`,
                        }],
                    }),
                });
                if (!res.ok) throw new Error(await res.text());
                return { output: await res.json() };
            }

            case 'getAdGroups': {
                const query = `SELECT ad_group.id, ad_group.name, ad_group.status, ad_group.campaign FROM ad_group WHERE campaign.id = ${inputs.campaignId} ORDER BY ad_group.id`;
                const res = await fetch(`${baseUrl}/googleAds:searchStream`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ query }),
                });
                if (!res.ok) throw new Error(await res.text());
                return { output: await res.json() };
            }

            case 'createAdGroup': {
                const res = await fetch(`${baseUrl}/adGroups:mutate`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        operations: [{
                            create: {
                                name: inputs.name,
                                campaign: `customers/${inputs.customerId}/campaigns/${inputs.campaignId}`,
                                status: inputs.status || 'ENABLED',
                                cpcBidMicros: inputs.cpcBidMicros,
                            },
                        }],
                    }),
                });
                if (!res.ok) throw new Error(await res.text());
                return { output: await res.json() };
            }

            case 'updateAdGroup': {
                const res = await fetch(`${baseUrl}/adGroups:mutate`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        operations: [{
                            update: {
                                resourceName: `customers/${inputs.customerId}/adGroups/${inputs.adGroupId}`,
                                name: inputs.name,
                                status: inputs.status,
                                cpcBidMicros: inputs.cpcBidMicros,
                            },
                            updateMask: inputs.updateMask || 'name,status,cpc_bid_micros',
                        }],
                    }),
                });
                if (!res.ok) throw new Error(await res.text());
                return { output: await res.json() };
            }

            case 'getAds': {
                const query = `SELECT ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.status, ad_group_ad.ad_group FROM ad_group_ad WHERE ad_group.id = ${inputs.adGroupId}`;
                const res = await fetch(`${baseUrl}/googleAds:searchStream`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ query }),
                });
                if (!res.ok) throw new Error(await res.text());
                return { output: await res.json() };
            }

            case 'createAd': {
                const res = await fetch(`${baseUrl}/adGroupAds:mutate`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        operations: [{
                            create: {
                                adGroup: `customers/${inputs.customerId}/adGroups/${inputs.adGroupId}`,
                                status: inputs.status || 'PAUSED',
                                ad: inputs.ad,
                            },
                        }],
                    }),
                });
                if (!res.ok) throw new Error(await res.text());
                return { output: await res.json() };
            }

            case 'updateAd': {
                const res = await fetch(`${baseUrl}/adGroupAds:mutate`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        operations: [{
                            update: {
                                resourceName: `customers/${inputs.customerId}/adGroupAds/${inputs.adGroupId}~${inputs.adId}`,
                                status: inputs.status,
                            },
                            updateMask: inputs.updateMask || 'status',
                        }],
                    }),
                });
                if (!res.ok) throw new Error(await res.text());
                return { output: await res.json() };
            }

            case 'getKeywords': {
                const query = `SELECT ad_group_criterion.criterion_id, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ad_group_criterion.status FROM ad_group_criterion WHERE ad_group.id = ${inputs.adGroupId} AND ad_group_criterion.type = 'KEYWORD'`;
                const res = await fetch(`${baseUrl}/googleAds:searchStream`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ query }),
                });
                if (!res.ok) throw new Error(await res.text());
                return { output: await res.json() };
            }

            case 'addKeyword': {
                const res = await fetch(`${baseUrl}/adGroupCriteria:mutate`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        operations: [{
                            create: {
                                adGroup: `customers/${inputs.customerId}/adGroups/${inputs.adGroupId}`,
                                status: inputs.status || 'ENABLED',
                                keyword: {
                                    text: inputs.keywordText,
                                    matchType: inputs.matchType || 'BROAD',
                                },
                            },
                        }],
                    }),
                });
                if (!res.ok) throw new Error(await res.text());
                return { output: await res.json() };
            }

            case 'removeKeyword': {
                const res = await fetch(`${baseUrl}/adGroupCriteria:mutate`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        operations: [{
                            remove: `customers/${inputs.customerId}/adGroupCriteria/${inputs.adGroupId}~${inputs.criterionId}`,
                        }],
                    }),
                });
                if (!res.ok) throw new Error(await res.text());
                return { output: await res.json() };
            }

            case 'getMetrics': {
                const query = inputs.query || `SELECT campaign.id, campaign.name, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions FROM campaign WHERE segments.date DURING ${inputs.dateDuring || 'LAST_30_DAYS'}`;
                const res = await fetch(`${baseUrl}/googleAds:searchStream`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ query }),
                });
                if (!res.ok) throw new Error(await res.text());
                return { output: await res.json() };
            }

            case 'runReport': {
                const res = await fetch(`${baseUrl}/googleAds:searchStream`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ query: inputs.query }),
                });
                if (!res.ok) throw new Error(await res.text());
                return { output: await res.json() };
            }

            default:
                return { error: `Unknown Google Ads action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Google Ads action error: ${err.message}`);
        return { error: err.message };
    }
}
