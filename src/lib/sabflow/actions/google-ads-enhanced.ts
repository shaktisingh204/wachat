'use server';

export async function executeGoogleAdsEnhancedAction(
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
        if (!customerId) return { error: 'customerId is required.' };

        const BASE = `https://googleads.googleapis.com/v17/customers/${customerId}`;

        const buildHeaders = (): Record<string, string> => {
            const h: Record<string, string> = {
                Authorization: `Bearer ${accessToken}`,
                'developer-token': developerToken,
                'Content-Type': 'application/json',
            };
            if (inputs.managerId) h['login-customer-id'] = inputs.managerId;
            return h;
        };

        const gaqlSearch = async (query: string) => {
            const res = await fetch(`${BASE}/googleAds:search`, {
                method: 'POST',
                headers: buildHeaders(),
                body: JSON.stringify({ query }),
            });
            const data = await res.json();
            if (!res.ok) return { error: data.error?.message || 'Google Ads search failed.' };
            return { output: data };
        };

        const mutate = async (operations: any[]) => {
            const res = await fetch(`${BASE}/googleAds:mutate`, {
                method: 'POST',
                headers: buildHeaders(),
                body: JSON.stringify({ mutateOperations: operations }),
            });
            const data = await res.json();
            if (!res.ok) return { error: data.error?.message || 'Mutate operation failed.' };
            return { output: data };
        };

        switch (actionName) {
            case 'searchCampaigns': {
                const query = inputs.query || `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type FROM campaign ORDER BY campaign.id`;
                return gaqlSearch(query);
            }

            case 'getCampaign': {
                if (!inputs.campaignId) return { error: 'campaignId is required.' };
                const query = `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, campaign.start_date, campaign.end_date FROM campaign WHERE campaign.id = ${inputs.campaignId}`;
                return gaqlSearch(query);
            }

            case 'createCampaign': {
                if (!inputs.campaignBudgetId) return { error: 'campaignBudgetId is required.' };
                if (!inputs.name) return { error: 'name is required.' };
                const op = {
                    campaignOperation: {
                        create: {
                            name: inputs.name,
                            status: inputs.status || 'PAUSED',
                            advertisingChannelType: inputs.channelType || 'SEARCH',
                            campaignBudget: `customers/${customerId}/campaignBudgets/${inputs.campaignBudgetId}`,
                            manualCpc: {},
                        },
                    },
                };
                return mutate([op]);
            }

            case 'updateCampaign': {
                if (!inputs.campaignResourceName) return { error: 'campaignResourceName is required.' };
                const updateFields: any = { resourceName: inputs.campaignResourceName };
                if (inputs.name) updateFields.name = inputs.name;
                if (inputs.status) updateFields.status = inputs.status;
                const op = {
                    campaignOperation: {
                        update: updateFields,
                        updateMask: inputs.updateMask || 'name,status',
                    },
                };
                return mutate([op]);
            }

            case 'removeCampaign': {
                if (!inputs.campaignResourceName) return { error: 'campaignResourceName is required.' };
                const op = {
                    campaignOperation: {
                        remove: inputs.campaignResourceName,
                    },
                };
                return mutate([op]);
            }

            case 'searchAdGroups': {
                const campaignFilter = inputs.campaignId ? ` WHERE campaign.id = ${inputs.campaignId}` : '';
                const query = `SELECT ad_group.id, ad_group.name, ad_group.status, campaign.id FROM ad_group${campaignFilter} ORDER BY ad_group.id`;
                return gaqlSearch(query);
            }

            case 'getAdGroup': {
                if (!inputs.adGroupId) return { error: 'adGroupId is required.' };
                const query = `SELECT ad_group.id, ad_group.name, ad_group.status, ad_group.type, campaign.id FROM ad_group WHERE ad_group.id = ${inputs.adGroupId}`;
                return gaqlSearch(query);
            }

            case 'createAdGroup': {
                if (!inputs.campaignResourceName) return { error: 'campaignResourceName is required.' };
                if (!inputs.name) return { error: 'name is required.' };
                const op = {
                    adGroupOperation: {
                        create: {
                            name: inputs.name,
                            campaign: inputs.campaignResourceName,
                            status: inputs.status || 'ENABLED',
                            type: inputs.type || 'SEARCH_STANDARD',
                            cpcBidMicros: inputs.cpcBidMicros || '1000000',
                        },
                    },
                };
                return mutate([op]);
            }

            case 'searchAds': {
                const adGroupFilter = inputs.adGroupId ? ` WHERE ad_group.id = ${inputs.adGroupId}` : '';
                const query = `SELECT ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.status, ad_group.id FROM ad_group_ad${adGroupFilter} ORDER BY ad_group_ad.ad.id`;
                return gaqlSearch(query);
            }

            case 'createAd': {
                if (!inputs.adGroupResourceName) return { error: 'adGroupResourceName is required.' };
                if (!inputs.headlines) return { error: 'headlines (array) is required.' };
                if (!inputs.descriptions) return { error: 'descriptions (array) is required.' };
                const finalUrls = inputs.finalUrls || [];
                const op = {
                    adGroupAdOperation: {
                        create: {
                            adGroup: inputs.adGroupResourceName,
                            status: inputs.status || 'PAUSED',
                            ad: {
                                responsiveSearchAd: {
                                    headlines: inputs.headlines.map((h: string) => ({ text: h })),
                                    descriptions: inputs.descriptions.map((d: string) => ({ text: d })),
                                },
                                finalUrls,
                            },
                        },
                    },
                };
                return mutate([op]);
            }

            case 'searchKeywords': {
                const adGroupFilter = inputs.adGroupId ? ` WHERE ad_group.id = ${inputs.adGroupId}` : '';
                const query = `SELECT ad_group_criterion.criterion_id, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ad_group_criterion.status FROM ad_group_criterion WHERE ad_group_criterion.type = 'KEYWORD'${inputs.adGroupId ? ` AND ad_group.id = ${inputs.adGroupId}` : ''} ORDER BY ad_group_criterion.criterion_id`;
                return gaqlSearch(query);
            }

            case 'addKeyword': {
                if (!inputs.adGroupResourceName) return { error: 'adGroupResourceName is required.' };
                if (!inputs.keyword) return { error: 'keyword is required.' };
                const op = {
                    adGroupCriterionOperation: {
                        create: {
                            adGroup: inputs.adGroupResourceName,
                            status: inputs.status || 'ENABLED',
                            keyword: {
                                text: inputs.keyword,
                                matchType: inputs.matchType || 'BROAD',
                            },
                        },
                    },
                };
                return mutate([op]);
            }

            case 'pauseKeyword': {
                if (!inputs.keywordResourceName) return { error: 'keywordResourceName is required.' };
                const op = {
                    adGroupCriterionOperation: {
                        update: {
                            resourceName: inputs.keywordResourceName,
                            status: 'PAUSED',
                        },
                        updateMask: 'status',
                    },
                };
                return mutate([op]);
            }

            case 'getMetrics': {
                if (!inputs.dateRange) return { error: 'dateRange (e.g. LAST_30_DAYS) is required.' };
                const resource = inputs.resource || 'campaign';
                const query = `SELECT ${resource}.id, ${resource}.name, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions FROM ${resource} WHERE segments.date DURING ${inputs.dateRange}`;
                return gaqlSearch(query);
            }

            case 'generateKeywordIdeas': {
                if (!inputs.keywords && !inputs.url) return { error: 'At least one of keywords or url is required.' };
                const body: any = {
                    language: inputs.language || 'languageConstants/1000',
                    geoTargetConstants: inputs.geoTargets || [],
                    keywordPlanNetwork: inputs.network || 'GOOGLE_SEARCH_AND_PARTNERS',
                };
                if (inputs.keywords) body.keywordSeed = { keywords: Array.isArray(inputs.keywords) ? inputs.keywords : [inputs.keywords] };
                if (inputs.url) body.urlSeed = { url: inputs.url };
                const res = await fetch(`https://googleads.googleapis.com/v17/customers/${customerId}:generateKeywordIdeas`, {
                    method: 'POST',
                    headers: buildHeaders(),
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'generateKeywordIdeas failed.' };
                return { output: data };
            }

            default:
                return { error: `Unknown actionName: ${actionName}` };
        }
    } catch (e: any) {
        return { error: e.message || 'Unexpected error in google-ads-enhanced.' };
    }
}
