'use server';

export async function executeSnapchatMarketingAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = inputs.accessToken;
        const baseUrl = 'https://adsapi.snapchat.com/v1';

        const headers: Record<string, string> = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listAdAccounts': {
                const organizationId = inputs.organizationId;
                const params = new URLSearchParams();
                if (inputs.limit) params.append('limit', String(inputs.limit));
                if (inputs.offset) params.append('offset', String(inputs.offset));
                const res = await fetch(`${baseUrl}/organizations/${organizationId}/adaccounts?${params.toString()}`, { headers });
                if (!res.ok) return { error: await res.text() };
                return { output: await res.json() };
            }

            case 'getAdAccount': {
                const adAccountId = inputs.adAccountId;
                const res = await fetch(`${baseUrl}/adaccounts/${adAccountId}`, { headers });
                if (!res.ok) return { error: await res.text() };
                return { output: await res.json() };
            }

            case 'listCampaigns': {
                const adAccountId = inputs.adAccountId;
                const params = new URLSearchParams();
                if (inputs.limit) params.append('limit', String(inputs.limit));
                if (inputs.offset) params.append('offset', String(inputs.offset));
                const res = await fetch(`${baseUrl}/adaccounts/${adAccountId}/campaigns?${params.toString()}`, { headers });
                if (!res.ok) return { error: await res.text() };
                return { output: await res.json() };
            }

            case 'getCampaign': {
                const campaignId = inputs.campaignId;
                const res = await fetch(`${baseUrl}/campaigns/${campaignId}`, { headers });
                if (!res.ok) return { error: await res.text() };
                return { output: await res.json() };
            }

            case 'createCampaign': {
                const adAccountId = inputs.adAccountId;
                const body: any = {
                    campaigns: [
                        {
                            ad_account_id: adAccountId,
                            name: inputs.name,
                            status: inputs.status || 'PAUSED',
                            objective: inputs.objective || 'AWARENESS',
                        },
                    ],
                };
                if (inputs.startTime) body.campaigns[0].start_time = inputs.startTime;
                if (inputs.endTime) body.campaigns[0].end_time = inputs.endTime;
                if (inputs.dailyBudgetMicro) body.campaigns[0].daily_budget_micro = inputs.dailyBudgetMicro;
                if (inputs.lifetimeSpendCapMicro) body.campaigns[0].lifetime_spend_cap_micro = inputs.lifetimeSpendCapMicro;
                const res = await fetch(`${baseUrl}/adaccounts/${adAccountId}/campaigns`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: await res.text() };
                return { output: await res.json() };
            }

            case 'updateCampaign': {
                const campaignId = inputs.campaignId;
                const adAccountId = inputs.adAccountId;
                const body: any = {
                    campaigns: [
                        {
                            id: campaignId,
                            ad_account_id: adAccountId,
                        },
                    ],
                };
                if (inputs.name) body.campaigns[0].name = inputs.name;
                if (inputs.status) body.campaigns[0].status = inputs.status;
                if (inputs.dailyBudgetMicro) body.campaigns[0].daily_budget_micro = inputs.dailyBudgetMicro;
                const res = await fetch(`${baseUrl}/adaccounts/${adAccountId}/campaigns`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: await res.text() };
                return { output: await res.json() };
            }

            case 'listAdSquads': {
                const adAccountId = inputs.adAccountId;
                const params = new URLSearchParams();
                if (inputs.limit) params.append('limit', String(inputs.limit));
                if (inputs.offset) params.append('offset', String(inputs.offset));
                const endpoint = inputs.campaignId
                    ? `${baseUrl}/campaigns/${inputs.campaignId}/adsquads`
                    : `${baseUrl}/adaccounts/${adAccountId}/adsquads`;
                const res = await fetch(`${endpoint}?${params.toString()}`, { headers });
                if (!res.ok) return { error: await res.text() };
                return { output: await res.json() };
            }

            case 'getAdSquad': {
                const adSquadId = inputs.adSquadId;
                const res = await fetch(`${baseUrl}/adsquads/${adSquadId}`, { headers });
                if (!res.ok) return { error: await res.text() };
                return { output: await res.json() };
            }

            case 'createAdSquad': {
                const campaignId = inputs.campaignId;
                const adAccountId = inputs.adAccountId;
                const body: any = {
                    adsquads: [
                        {
                            campaign_id: campaignId,
                            name: inputs.name,
                            status: inputs.status || 'PAUSED',
                            type: inputs.type || 'SNAP_ADS',
                            placement_v2: inputs.placement || { config: 'AUTOMATIC' },
                            optimization_goal: inputs.optimizationGoal || 'IMPRESSIONS',
                            bid_micro: inputs.bidMicro || 1000000,
                            daily_budget_micro: inputs.dailyBudgetMicro || 50000000,
                        },
                    ],
                };
                if (inputs.targeting) body.adsquads[0].targeting = inputs.targeting;
                const res = await fetch(`${baseUrl}/campaigns/${campaignId}/adsquads`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: await res.text() };
                return { output: await res.json() };
            }

            case 'listAds': {
                const adAccountId = inputs.adAccountId;
                const params = new URLSearchParams();
                if (inputs.limit) params.append('limit', String(inputs.limit));
                if (inputs.offset) params.append('offset', String(inputs.offset));
                const endpoint = inputs.adSquadId
                    ? `${baseUrl}/adsquads/${inputs.adSquadId}/ads`
                    : `${baseUrl}/adaccounts/${adAccountId}/ads`;
                const res = await fetch(`${endpoint}?${params.toString()}`, { headers });
                if (!res.ok) return { error: await res.text() };
                return { output: await res.json() };
            }

            case 'getAd': {
                const adId = inputs.adId;
                const res = await fetch(`${baseUrl}/ads/${adId}`, { headers });
                if (!res.ok) return { error: await res.text() };
                return { output: await res.json() };
            }

            case 'createAd': {
                const adSquadId = inputs.adSquadId;
                const body: any = {
                    ads: [
                        {
                            ad_squad_id: adSquadId,
                            name: inputs.name,
                            type: inputs.type || 'SNAP_AD',
                            status: inputs.status || 'PAUSED',
                        },
                    ],
                };
                if (inputs.creativeId) body.ads[0].creative_id = inputs.creativeId;
                const res = await fetch(`${baseUrl}/adsquads/${adSquadId}/ads`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: await res.text() };
                return { output: await res.json() };
            }

            case 'getStats': {
                const adAccountId = inputs.adAccountId;
                const entityType = inputs.entityType || 'ad_account';
                const entityId = inputs.entityId || adAccountId;
                const startTime = inputs.startTime || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
                const endTime = inputs.endTime || new Date().toISOString();
                const params = new URLSearchParams({
                    start_time: startTime,
                    end_time: endTime,
                    granularity: inputs.granularity || 'DAY',
                });
                if (inputs.fields) params.append('fields', Array.isArray(inputs.fields) ? inputs.fields.join(',') : inputs.fields);
                const res = await fetch(`${baseUrl}/${entityType}s/${entityId}/stats?${params.toString()}`, { headers });
                if (!res.ok) return { error: await res.text() };
                return { output: await res.json() };
            }

            case 'listAudiences': {
                const adAccountId = inputs.adAccountId;
                const params = new URLSearchParams();
                if (inputs.limit) params.append('limit', String(inputs.limit));
                if (inputs.offset) params.append('offset', String(inputs.offset));
                const res = await fetch(`${baseUrl}/adaccounts/${adAccountId}/segments?${params.toString()}`, { headers });
                if (!res.ok) return { error: await res.text() };
                return { output: await res.json() };
            }

            case 'createAudience': {
                const adAccountId = inputs.adAccountId;
                const body: any = {
                    segments: [
                        {
                            name: inputs.name,
                            description: inputs.description || '',
                            source_type: inputs.sourceType || 'FIRST_PARTY',
                            ad_account_id: adAccountId,
                            retention_in_days: inputs.retentionInDays || 30,
                        },
                    ],
                };
                const res = await fetch(`${baseUrl}/adaccounts/${adAccountId}/segments`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: await res.text() };
                return { output: await res.json() };
            }

            default:
                return { error: `Unknown Snapchat Marketing action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Snapchat Marketing action error: ${err.message}`);
        return { error: err.message || 'Snapchat Marketing action failed' };
    }
}
