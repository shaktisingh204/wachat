'use server';

const CRITEO_BASE = 'https://api.criteo.com/preview';

export async function executeCriteoAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        if (!inputs.clientId) return { error: 'clientId is required.' };
        if (!inputs.clientSecret) return { error: 'clientSecret is required.' };

        // Obtain OAuth2 access token via client credentials
        const tokenRes = await fetch('https://api.criteo.com/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: inputs.clientId,
                client_secret: inputs.clientSecret,
                grant_type: 'client_credentials',
            }).toString(),
        });
        const tokenData = await tokenRes.json();
        if (!tokenRes.ok) return { error: tokenData.error_description || 'Failed to obtain Criteo access token.' };
        const accessToken: string = tokenData.access_token;

        const buildHeaders = (): Record<string, string> => ({
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        });

        const apiGet = async (path: string, query: Record<string, string> = {}) => {
            const qs = new URLSearchParams(query).toString();
            const url = qs ? `${CRITEO_BASE}/${path}?${qs}` : `${CRITEO_BASE}/${path}`;
            const res = await fetch(url, { method: 'GET', headers: buildHeaders() });
            const data = await res.json();
            if (!res.ok) return { error: data?.errors?.[0]?.detail || data?.message || 'Criteo GET failed.' };
            return { output: data };
        };

        const apiPost = async (path: string, body: any) => {
            const res = await fetch(`${CRITEO_BASE}/${path}`, {
                method: 'POST',
                headers: buildHeaders(),
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) return { error: data?.errors?.[0]?.detail || data?.message || 'Criteo POST failed.' };
            return { output: data };
        };

        const apiPatch = async (path: string, body: any) => {
            const res = await fetch(`${CRITEO_BASE}/${path}`, {
                method: 'PATCH',
                headers: buildHeaders(),
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) return { error: data?.errors?.[0]?.detail || data?.message || 'Criteo PATCH failed.' };
            return { output: data };
        };

        switch (actionName) {
            case 'listAdvertisers': {
                const q: Record<string, string> = {};
                if (inputs.limit) q.limit = String(inputs.limit);
                if (inputs.offset) q.offset = String(inputs.offset);
                return apiGet('advertisers', q);
            }

            case 'getAdvertiser': {
                if (!inputs.advertiserId) return { error: 'advertiserId is required.' };
                return apiGet(`advertisers/${inputs.advertiserId}`);
            }

            case 'listCampaigns': {
                if (!inputs.advertiserId) return { error: 'advertiserId is required.' };
                const q: Record<string, string> = { advertiserId: inputs.advertiserId };
                if (inputs.limit) q.limit = String(inputs.limit);
                if (inputs.offset) q.offset = String(inputs.offset);
                return apiGet('campaigns', q);
            }

            case 'getCampaign': {
                if (!inputs.campaignId) return { error: 'campaignId is required.' };
                return apiGet(`campaigns/${inputs.campaignId}`);
            }

            case 'createCampaign': {
                if (!inputs.advertiserId) return { error: 'advertiserId is required.' };
                if (!inputs.name) return { error: 'name is required.' };
                const body = {
                    data: {
                        type: 'Campaign',
                        attributes: {
                            advertiserId: inputs.advertiserId,
                            name: inputs.name,
                            budget: inputs.budget,
                            budgetSpendingLimit: inputs.budgetSpendingLimit,
                            startDate: inputs.startDate,
                            endDate: inputs.endDate,
                        },
                    },
                };
                return apiPost('campaigns', body);
            }

            case 'updateCampaign': {
                if (!inputs.campaignId) return { error: 'campaignId is required.' };
                const body = {
                    data: {
                        type: 'Campaign',
                        id: inputs.campaignId,
                        attributes: {
                            ...(inputs.name && { name: inputs.name }),
                            ...(inputs.budget !== undefined && { budget: inputs.budget }),
                            ...(inputs.startDate && { startDate: inputs.startDate }),
                            ...(inputs.endDate && { endDate: inputs.endDate }),
                        },
                    },
                };
                return apiPatch(`campaigns/${inputs.campaignId}`, body);
            }

            case 'listAdSets': {
                if (!inputs.advertiserId) return { error: 'advertiserId is required.' };
                const q: Record<string, string> = { advertiserId: inputs.advertiserId };
                if (inputs.campaignId) q.campaignId = inputs.campaignId;
                if (inputs.limit) q.limit = String(inputs.limit);
                return apiGet('ad-sets', q);
            }

            case 'getAdSet': {
                if (!inputs.adSetId) return { error: 'adSetId is required.' };
                return apiGet(`ad-sets/${inputs.adSetId}`);
            }

            case 'createAdSet': {
                if (!inputs.campaignId) return { error: 'campaignId is required.' };
                if (!inputs.name) return { error: 'name is required.' };
                const body = {
                    data: {
                        type: 'AdSet',
                        attributes: {
                            campaignId: inputs.campaignId,
                            name: inputs.name,
                            bidAmount: inputs.bidAmount,
                            bidStrategy: inputs.bidStrategy || 'automatic',
                            budget: inputs.budget,
                            startDate: inputs.startDate,
                            endDate: inputs.endDate,
                        },
                    },
                };
                return apiPost('ad-sets', body);
            }

            case 'updateAdSet': {
                if (!inputs.adSetId) return { error: 'adSetId is required.' };
                const body = {
                    data: {
                        type: 'AdSet',
                        id: inputs.adSetId,
                        attributes: {
                            ...(inputs.name && { name: inputs.name }),
                            ...(inputs.bidAmount !== undefined && { bidAmount: inputs.bidAmount }),
                            ...(inputs.budget !== undefined && { budget: inputs.budget }),
                        },
                    },
                };
                return apiPatch(`ad-sets/${inputs.adSetId}`, body);
            }

            case 'getStatistics': {
                if (!inputs.advertiserIds) return { error: 'advertiserIds (array) is required.' };
                if (!inputs.startDate) return { error: 'startDate (YYYY-MM-DD) is required.' };
                if (!inputs.endDate) return { error: 'endDate (YYYY-MM-DD) is required.' };
                const body = {
                    data: {
                        type: 'StatisticsReportQueryMessage',
                        attributes: {
                            reportType: inputs.reportType || 'Campaign',
                            dimensions: inputs.dimensions || ['AdvertiserId', 'CampaignId'],
                            metrics: inputs.metrics || ['Displays', 'Clicks', 'Cost'],
                            currency: inputs.currency || 'USD',
                            format: inputs.format || 'JSON',
                            timezone: inputs.timezone || 'UTC',
                            startDate: inputs.startDate,
                            endDate: inputs.endDate,
                            advertiserIds: Array.isArray(inputs.advertiserIds)
                                ? inputs.advertiserIds.join(',')
                                : inputs.advertiserIds,
                        },
                    },
                };
                return apiPost('statistics/report', body);
            }

            case 'listAudiences': {
                if (!inputs.advertiserId) return { error: 'advertiserId is required.' };
                const q: Record<string, string> = { advertiserId: inputs.advertiserId };
                if (inputs.limit) q.limit = String(inputs.limit);
                return apiGet('audiences', q);
            }

            case 'getAudience': {
                if (!inputs.audienceId) return { error: 'audienceId is required.' };
                return apiGet(`audiences/${inputs.audienceId}`);
            }

            case 'createAudience': {
                if (!inputs.advertiserId) return { error: 'advertiserId is required.' };
                if (!inputs.name) return { error: 'name is required.' };
                const body = {
                    data: {
                        type: 'Audience',
                        attributes: {
                            advertiserId: inputs.advertiserId,
                            name: inputs.name,
                            description: inputs.description || '',
                        },
                    },
                };
                return apiPost('audiences', body);
            }

            case 'getTransactions': {
                if (!inputs.advertiserId) return { error: 'advertiserId is required.' };
                const q: Record<string, string> = { advertiserId: inputs.advertiserId };
                if (inputs.startDate) q.startDate = inputs.startDate;
                if (inputs.endDate) q.endDate = inputs.endDate;
                if (inputs.limit) q.limit = String(inputs.limit);
                return apiGet('transactions', q);
            }

            default:
                return { error: `Unknown actionName: ${actionName}` };
        }
    } catch (e: any) {
        return { error: e.message || 'Unexpected error in criteo.' };
    }
}
