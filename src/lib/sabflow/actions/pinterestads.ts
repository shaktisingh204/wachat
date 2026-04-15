'use server';

const PINTEREST_BASE = 'https://api.pinterest.com/v5';

export async function executePinterestAdsAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const accessToken: string = inputs.accessToken;
        const adAccountId: string = inputs.adAccountId;

        if (!accessToken) return { error: 'accessToken is required.' };

        const authHeader = { Authorization: `Bearer ${accessToken}` };
        const jsonHeaders = { ...authHeader, 'Content-Type': 'application/json' };

        switch (actionName) {
            case 'listAdAccounts': {
                const res = await fetch(`${PINTEREST_BASE}/ad_accounts`, { headers: authHeader });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list ad accounts.' };
                return { output: data };
            }

            case 'getAdAccount': {
                if (!adAccountId) return { error: 'adAccountId is required.' };
                const res = await fetch(`${PINTEREST_BASE}/ad_accounts/${adAccountId}`, { headers: authHeader });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get ad account.' };
                return { output: data };
            }

            case 'listCampaigns': {
                if (!adAccountId) return { error: 'adAccountId is required.' };
                const res = await fetch(`${PINTEREST_BASE}/ad_accounts/${adAccountId}/campaigns`, { headers: authHeader });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list campaigns.' };
                return { output: data };
            }

            case 'createCampaign': {
                if (!adAccountId) return { error: 'adAccountId is required.' };
                const body = {
                    name: inputs.name,
                    objective_type: inputs.objectiveType || 'AWARENESS',
                    status: inputs.status || 'PAUSED',
                    daily_spend_cap: inputs.dailySpendCap,
                };
                const res = await fetch(`${PINTEREST_BASE}/ad_accounts/${adAccountId}/campaigns`, {
                    method: 'POST',
                    headers: jsonHeaders,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create campaign.' };
                return { output: data };
            }

            case 'updateCampaign': {
                if (!adAccountId) return { error: 'adAccountId is required.' };
                const campaignId: string = inputs.campaignId;
                if (!campaignId) return { error: 'campaignId is required.' };
                const updates: Record<string, any> = {};
                if (inputs.name) updates.name = inputs.name;
                if (inputs.status) updates.status = inputs.status;
                if (inputs.dailySpendCap !== undefined) updates.daily_spend_cap = inputs.dailySpendCap;
                const res = await fetch(`${PINTEREST_BASE}/ad_accounts/${adAccountId}/campaigns/${campaignId}`, {
                    method: 'PATCH',
                    headers: jsonHeaders,
                    body: JSON.stringify(updates),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to update campaign.' };
                return { output: data };
            }

            case 'listAdGroups': {
                if (!adAccountId) return { error: 'adAccountId is required.' };
                const res = await fetch(`${PINTEREST_BASE}/ad_accounts/${adAccountId}/ad_groups`, { headers: authHeader });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list ad groups.' };
                return { output: data };
            }

            case 'createAdGroup': {
                if (!adAccountId) return { error: 'adAccountId is required.' };
                const body: Record<string, any> = {
                    name: inputs.name,
                    campaign_id: inputs.campaignId,
                    budget_in_micro_currency: inputs.budgetInMicroCurrency,
                    budget_type: inputs.budgetType || 'DAILY',
                    status: inputs.status || 'PAUSED',
                    targeting_spec: inputs.targetingSpec || {},
                };
                const res = await fetch(`${PINTEREST_BASE}/ad_accounts/${adAccountId}/ad_groups`, {
                    method: 'POST',
                    headers: jsonHeaders,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create ad group.' };
                return { output: data };
            }

            case 'listAds': {
                if (!adAccountId) return { error: 'adAccountId is required.' };
                const res = await fetch(`${PINTEREST_BASE}/ad_accounts/${adAccountId}/ads`, { headers: authHeader });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list ads.' };
                return { output: data };
            }

            case 'createAd': {
                if (!adAccountId) return { error: 'adAccountId is required.' };
                const body: Record<string, any> = {
                    ad_group_id: inputs.adGroupId,
                    creative_type: inputs.creativeType || 'REGULAR',
                    pin_id: inputs.pinId,
                    status: inputs.status || 'PAUSED',
                    name: inputs.name,
                };
                const res = await fetch(`${PINTEREST_BASE}/ad_accounts/${adAccountId}/ads`, {
                    method: 'POST',
                    headers: jsonHeaders,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create ad.' };
                return { output: data };
            }

            case 'getReport': {
                if (!adAccountId) return { error: 'adAccountId is required.' };
                const body = {
                    report_type: inputs.reportType || 'CAMPAIGN',
                    date_range: inputs.dateRange || {
                        relative_date_range: 'LAST_30_DAYS',
                    },
                    granularity: inputs.granularity || 'DAY',
                    metrics: inputs.metrics || ['IMPRESSION_1', 'CLICKTHROUGH_1', 'SPEND_IN_DOLLAR'],
                    columns: inputs.columns || [],
                };
                const res = await fetch(`${PINTEREST_BASE}/ad_accounts/${adAccountId}/reports`, {
                    method: 'POST',
                    headers: jsonHeaders,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get report.' };
                return { output: data };
            }

            case 'listAudiences': {
                if (!adAccountId) return { error: 'adAccountId is required.' };
                const res = await fetch(`${PINTEREST_BASE}/ad_accounts/${adAccountId}/audiences`, { headers: authHeader });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list audiences.' };
                return { output: data };
            }

            case 'createAudience': {
                if (!adAccountId) return { error: 'adAccountId is required.' };
                const body: Record<string, any> = {
                    name: inputs.name,
                    rule: inputs.rule || {},
                    description: inputs.description || '',
                    audience_type: inputs.audienceType || 'CUSTOMER_LIST',
                };
                const res = await fetch(`${PINTEREST_BASE}/ad_accounts/${adAccountId}/audiences`, {
                    method: 'POST',
                    headers: jsonHeaders,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create audience.' };
                return { output: data };
            }

            case 'getCatalog': {
                const res = await fetch(`${PINTEREST_BASE}/catalogs`, { headers: authHeader });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get catalog.' };
                return { output: data };
            }

            default:
                return { error: `Pinterest Ads action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        logger.log(`executePinterestAdsAction error: ${err.message}`);
        return { error: err.message || 'An unexpected error occurred in Pinterest Ads action.' };
    }
}
