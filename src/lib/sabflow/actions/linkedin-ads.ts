'use server';

const BASE_URL = 'https://api.linkedin.com/rest';

export async function executeLinkedInAdsAction(actionName: string, inputs: any, user: any, logger: any) {
    const accessToken = inputs.accessToken;
    const headers: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'LinkedIn-Version': inputs.apiVersion || '202401',
        'X-Restli-Protocol-Version': '2.0.0',
    };

    try {
        switch (actionName) {
            case 'listAdAccounts': {
                const params = new URLSearchParams({ q: 'search' });
                if (inputs.status) params.set('search.status.values[0]', inputs.status);
                if (inputs.count) params.set('count', String(inputs.count));
                if (inputs.start) params.set('start', String(inputs.start));
                const res = await fetch(`${BASE_URL}/adAccounts?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list ad accounts' };
                return { output: data };
            }
            case 'getAdAccount': {
                const res = await fetch(`${BASE_URL}/adAccounts/${inputs.adAccountId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get ad account' };
                return { output: data };
            }
            case 'listCampaignGroups': {
                const params = new URLSearchParams({ q: 'search', 'search.account.values[0]': `urn:li:sponsoredAccount:${inputs.adAccountId}` });
                if (inputs.count) params.set('count', String(inputs.count));
                if (inputs.start) params.set('start', String(inputs.start));
                const res = await fetch(`${BASE_URL}/adCampaignGroups?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list campaign groups' };
                return { output: data };
            }
            case 'getCampaignGroup': {
                const res = await fetch(`${BASE_URL}/adCampaignGroups/${inputs.campaignGroupId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get campaign group' };
                return { output: data };
            }
            case 'createCampaignGroup': {
                const body: Record<string, any> = {
                    account: `urn:li:sponsoredAccount:${inputs.adAccountId}`,
                    name: inputs.name,
                    status: inputs.status || 'DRAFT',
                    runSchedule: inputs.runSchedule ? (typeof inputs.runSchedule === 'string' ? JSON.parse(inputs.runSchedule) : inputs.runSchedule) : { start: Date.now() },
                };
                if (inputs.totalBudget) body.totalBudget = inputs.totalBudget;
                const res = await fetch(`${BASE_URL}/adCampaignGroups`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create campaign group' };
                return { output: data };
            }
            case 'listCampaigns': {
                const params = new URLSearchParams({ q: 'search', 'search.account.values[0]': `urn:li:sponsoredAccount:${inputs.adAccountId}` });
                if (inputs.campaignGroupId) params.set('search.campaignGroup.values[0]', `urn:li:adCampaignGroup:${inputs.campaignGroupId}`);
                if (inputs.count) params.set('count', String(inputs.count));
                if (inputs.start) params.set('start', String(inputs.start));
                const res = await fetch(`${BASE_URL}/adCampaigns?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list campaigns' };
                return { output: data };
            }
            case 'getCampaign': {
                const res = await fetch(`${BASE_URL}/adCampaigns/${inputs.campaignId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get campaign' };
                return { output: data };
            }
            case 'createCampaign': {
                const body: Record<string, any> = {
                    account: `urn:li:sponsoredAccount:${inputs.adAccountId}`,
                    campaignGroup: `urn:li:adCampaignGroup:${inputs.campaignGroupId}`,
                    name: inputs.name,
                    type: inputs.type || 'SPONSORED_UPDATES',
                    status: inputs.status || 'DRAFT',
                    objectiveType: inputs.objectiveType || 'BRAND_AWARENESS',
                    costType: inputs.costType || 'CPM',
                    unitCost: inputs.unitCost ? (typeof inputs.unitCost === 'string' ? JSON.parse(inputs.unitCost) : inputs.unitCost) : { amount: '10', currencyCode: 'USD' },
                    targeting: inputs.targeting ? (typeof inputs.targeting === 'string' ? JSON.parse(inputs.targeting) : inputs.targeting) : { targetingCriteria: { include: {} } },
                };
                if (inputs.runSchedule) body.runSchedule = typeof inputs.runSchedule === 'string' ? JSON.parse(inputs.runSchedule) : inputs.runSchedule;
                const res = await fetch(`${BASE_URL}/adCampaigns`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create campaign' };
                return { output: data };
            }
            case 'updateCampaign': {
                const body: Record<string, any> = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.status) body.status = inputs.status;
                if (inputs.dailyBudget) body.dailyBudget = inputs.dailyBudget;
                if (inputs.unitCost) body.unitCost = typeof inputs.unitCost === 'string' ? JSON.parse(inputs.unitCost) : inputs.unitCost;
                const res = await fetch(`${BASE_URL}/adCampaigns/${inputs.campaignId}`, {
                    method: 'POST',
                    headers: { ...headers, 'X-Restli-Method': 'PARTIAL_UPDATE' },
                    body: JSON.stringify({ patch: { $set: body } }),
                });
                const data = res.status === 204 ? { success: true } : await res.json();
                if (!res.ok) return { error: data.message || 'Failed to update campaign' };
                return { output: data };
            }
            case 'listCreatives': {
                const params = new URLSearchParams({ q: 'criteria', 'criteria.campaignIds[0]': `urn:li:adCampaign:${inputs.campaignId}` });
                if (inputs.count) params.set('count', String(inputs.count));
                if (inputs.start) params.set('start', String(inputs.start));
                const res = await fetch(`${BASE_URL}/adCreatives?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list creatives' };
                return { output: data };
            }
            case 'getCreative': {
                const res = await fetch(`${BASE_URL}/adCreatives/${inputs.creativeId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get creative' };
                return { output: data };
            }
            case 'createCreative': {
                const body: Record<string, any> = {
                    campaign: `urn:li:adCampaign:${inputs.campaignId}`,
                    status: inputs.status || 'DRAFT',
                };
                if (inputs.reference) body.reference = inputs.reference;
                if (inputs.variables) body.variables = typeof inputs.variables === 'string' ? JSON.parse(inputs.variables) : inputs.variables;
                const res = await fetch(`${BASE_URL}/adCreatives`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create creative' };
                return { output: data };
            }
            case 'getAnalytics': {
                const params = new URLSearchParams({
                    q: 'analytics',
                    pivot: inputs.pivot || 'CAMPAIGN',
                    dateRange: JSON.stringify(inputs.dateRange || { start: { year: new Date().getFullYear(), month: new Date().getMonth() + 1, day: 1 }, end: { year: new Date().getFullYear(), month: new Date().getMonth() + 1, day: new Date().getDate() } }),
                    fields: inputs.fields || 'impressions,clicks,costInLocalCurrency,totalEngagements',
                    accounts: `List(urn:li:sponsoredAccount:${inputs.adAccountId})`,
                });
                if (inputs.campaigns) params.set('campaigns', inputs.campaigns);
                const res = await fetch(`${BASE_URL}/adAnalytics?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get analytics' };
                return { output: data };
            }
            case 'getConversions': {
                const params = new URLSearchParams({ q: 'account', account: `urn:li:sponsoredAccount:${inputs.adAccountId}` });
                if (inputs.count) params.set('count', String(inputs.count));
                const res = await fetch(`${BASE_URL}/conversions?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get conversions' };
                return { output: data };
            }
            case 'listLeadForms': {
                const params = new URLSearchParams({ q: 'account', account: `urn:li:sponsoredAccount:${inputs.adAccountId}` });
                if (inputs.count) params.set('count', String(inputs.count));
                if (inputs.start) params.set('start', String(inputs.start));
                const res = await fetch(`${BASE_URL}/leadGenerationForms?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list lead forms' };
                return { output: data };
            }
            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`LinkedInAds action error [${actionName}]:`, err);
        return { error: err?.message || 'Unexpected error in LinkedIn Ads action' };
    }
}
