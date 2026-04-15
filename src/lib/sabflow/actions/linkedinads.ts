'use server';

const LINKEDIN_BASE = 'https://api.linkedin.com/v2';

export async function executeLinkedInAdsAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const accessToken: string = inputs.accessToken;

        if (!accessToken) return { error: 'accessToken is required.' };

        const authHeader = { Authorization: `Bearer ${accessToken}` };
        const jsonHeaders = {
            ...authHeader,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0',
        };

        switch (actionName) {
            case 'listAdAccounts': {
                const res = await fetch(
                    `${LINKEDIN_BASE}/adAccountsV2?q=search`,
                    { headers: jsonHeaders }
                );
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list ad accounts.' };
                return { output: data };
            }

            case 'getAdAccount': {
                const accountId: string = inputs.accountId;
                if (!accountId) return { error: 'accountId is required.' };
                const res = await fetch(
                    `${LINKEDIN_BASE}/adAccountsV2/${accountId}`,
                    { headers: jsonHeaders }
                );
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get ad account.' };
                return { output: data };
            }

            case 'listCampaignGroups': {
                const accountId: string = inputs.accountId;
                if (!accountId) return { error: 'accountId is required.' };
                const res = await fetch(
                    `${LINKEDIN_BASE}/adCampaignGroupsV2?q=search&account=urn:li:sponsoredAccount:${accountId}`,
                    { headers: jsonHeaders }
                );
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list campaign groups.' };
                return { output: data };
            }

            case 'createCampaignGroup': {
                const accountId: string = inputs.accountId;
                if (!accountId) return { error: 'accountId is required.' };
                const body: Record<string, any> = {
                    account: `urn:li:sponsoredAccount:${accountId}`,
                    name: inputs.name,
                    status: inputs.status || 'ACTIVE',
                    runSchedule: inputs.runSchedule || {},
                };
                const res = await fetch(`${LINKEDIN_BASE}/adCampaignGroupsV2`, {
                    method: 'POST',
                    headers: jsonHeaders,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create campaign group.' };
                return { output: data };
            }

            case 'listCampaigns': {
                const accountId: string = inputs.accountId;
                if (!accountId) return { error: 'accountId is required.' };
                const res = await fetch(
                    `${LINKEDIN_BASE}/adCampaignsV2?q=search&account=urn:li:sponsoredAccount:${accountId}`,
                    { headers: jsonHeaders }
                );
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list campaigns.' };
                return { output: data };
            }

            case 'createCampaign': {
                const accountId: string = inputs.accountId;
                if (!accountId) return { error: 'accountId is required.' };
                const body: Record<string, any> = {
                    account: `urn:li:sponsoredAccount:${accountId}`,
                    name: inputs.name,
                    type: inputs.type || 'SPONSORED_UPDATES',
                    status: inputs.status || 'PAUSED',
                    objectiveType: inputs.objectiveType || 'BRAND_AWARENESS',
                    dailyBudget: inputs.dailyBudget
                        ? { amount: String(inputs.dailyBudget), currencyCode: inputs.currency || 'USD' }
                        : undefined,
                    unitCost: inputs.unitCost
                        ? { amount: String(inputs.unitCost), currencyCode: inputs.currency || 'USD' }
                        : undefined,
                    campaignGroup: inputs.campaignGroupId
                        ? `urn:li:sponsoredCampaignGroup:${inputs.campaignGroupId}`
                        : undefined,
                    targetingCriteria: inputs.targetingCriteria || {},
                };
                const res = await fetch(`${LINKEDIN_BASE}/adCampaignsV2`, {
                    method: 'POST',
                    headers: jsonHeaders,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create campaign.' };
                return { output: data };
            }

            case 'listCreatives': {
                const campaignId: string = inputs.campaignId;
                if (!campaignId) return { error: 'campaignId is required.' };
                const res = await fetch(
                    `${LINKEDIN_BASE}/adCreativesV2?q=search&campaign=urn:li:sponsoredCampaign:${campaignId}`,
                    { headers: jsonHeaders }
                );
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list creatives.' };
                return { output: data };
            }

            case 'createCreative': {
                const campaignId: string = inputs.campaignId;
                if (!campaignId) return { error: 'campaignId is required.' };
                const body: Record<string, any> = {
                    campaign: `urn:li:sponsoredCampaign:${campaignId}`,
                    status: inputs.status || 'PAUSED',
                    variables: inputs.variables || {},
                    type: inputs.type || 'SPONSORED_STATUS_UPDATE',
                };
                const res = await fetch(`${LINKEDIN_BASE}/adCreativesV2`, {
                    method: 'POST',
                    headers: jsonHeaders,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create creative.' };
                return { output: data };
            }

            case 'getAnalytics': {
                const accountId: string = inputs.accountId;
                if (!accountId) return { error: 'accountId is required.' };
                const pivot = inputs.pivot || 'CAMPAIGN';
                const startDate = inputs.startDate || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
                const endDate = inputs.endDate || new Date().toISOString().split('T')[0];
                const metrics = inputs.metrics || 'clicks,impressions,costInLocalCurrency';
                const params = new URLSearchParams({
                    q: 'analytics',
                    pivot,
                    timeGranularity: 'DAILY',
                    'accounts[0]': `urn:li:sponsoredAccount:${accountId}`,
                    'dateRange.start.day': startDate.split('-')[2],
                    'dateRange.start.month': startDate.split('-')[1],
                    'dateRange.start.year': startDate.split('-')[0],
                    'dateRange.end.day': endDate.split('-')[2],
                    'dateRange.end.month': endDate.split('-')[1],
                    'dateRange.end.year': endDate.split('-')[0],
                    fields: metrics,
                });
                const res = await fetch(
                    `${LINKEDIN_BASE}/adAnalyticsV2?${params.toString()}`,
                    { headers: jsonHeaders }
                );
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get analytics.' };
                return { output: data };
            }

            case 'listAudiences': {
                const res = await fetch(
                    `${LINKEDIN_BASE}/adTargetingFacets`,
                    { headers: jsonHeaders }
                );
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list audiences.' };
                return { output: data };
            }

            case 'getDemographics': {
                const accountId: string = inputs.accountId;
                if (!accountId) return { error: 'accountId is required.' };
                const startDate = inputs.startDate || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
                const endDate = inputs.endDate || new Date().toISOString().split('T')[0];
                const params = new URLSearchParams({
                    q: 'analytics',
                    pivot: 'MEMBER_COMPANY',
                    timeGranularity: 'DAILY',
                    'accounts[0]': `urn:li:sponsoredAccount:${accountId}`,
                    'dateRange.start.day': startDate.split('-')[2],
                    'dateRange.start.month': startDate.split('-')[1],
                    'dateRange.start.year': startDate.split('-')[0],
                    'dateRange.end.day': endDate.split('-')[2],
                    'dateRange.end.month': endDate.split('-')[1],
                    'dateRange.end.year': endDate.split('-')[0],
                    fields: 'clicks,impressions,costInLocalCurrency',
                });
                const res = await fetch(
                    `${LINKEDIN_BASE}/adAnalyticsV2?${params.toString()}`,
                    { headers: jsonHeaders }
                );
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get demographics.' };
                return { output: data };
            }

            default:
                return { error: `LinkedIn Ads action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        logger.log(`executeLinkedInAdsAction error: ${err.message}`);
        return { error: err.message || 'An unexpected error occurred in LinkedIn Ads action.' };
    }
}
