'use server';

export async function executePinterestAnalyticsAction(actionName: string, inputs: any, user: any, logger: any) {
    const baseUrl = 'https://api.pinterest.com/v5';
    const accessToken = inputs.accessToken;

    try {
        switch (actionName) {
            case 'getUserAccount': {
                const res = await fetch(`${baseUrl}/user_account`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get user account' };
                return { output: data };
            }

            case 'getAdAccounts': {
                const params = new URLSearchParams();
                if (inputs.bookmark) params.set('bookmark', inputs.bookmark);
                if (inputs.pageSize) params.set('page_size', String(inputs.pageSize));
                const res = await fetch(`${baseUrl}/ad_accounts?${params}`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get ad accounts' };
                return { output: data };
            }

            case 'getCampaigns': {
                const adAccountId = inputs.adAccountId;
                if (!adAccountId) return { error: 'adAccountId is required' };
                const params = new URLSearchParams();
                if (inputs.campaignIds) params.set('campaign_ids', inputs.campaignIds);
                if (inputs.entityStatuses) params.set('entity_statuses', inputs.entityStatuses);
                if (inputs.pageSize) params.set('page_size', String(inputs.pageSize));
                if (inputs.bookmark) params.set('bookmark', inputs.bookmark);
                const res = await fetch(`${baseUrl}/ad_accounts/${adAccountId}/campaigns?${params}`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get campaigns' };
                return { output: data };
            }

            case 'getCampaign': {
                const { adAccountId, campaignId } = inputs;
                if (!adAccountId || !campaignId) return { error: 'adAccountId and campaignId are required' };
                const res = await fetch(`${baseUrl}/ad_accounts/${adAccountId}/campaigns/${campaignId}`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get campaign' };
                return { output: data };
            }

            case 'createCampaign': {
                const { adAccountId, name, objective_type, status, lifetime_spend_cap, daily_spend_cap } = inputs;
                if (!adAccountId || !name || !objective_type) return { error: 'adAccountId, name and objective_type are required' };
                const body: any = { name, objective_type };
                if (status) body.status = status;
                if (lifetime_spend_cap) body.lifetime_spend_cap = lifetime_spend_cap;
                if (daily_spend_cap) body.daily_spend_cap = daily_spend_cap;
                const res = await fetch(`${baseUrl}/ad_accounts/${adAccountId}/campaigns`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify([body]),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create campaign' };
                return { output: data };
            }

            case 'getAdGroups': {
                const { adAccountId } = inputs;
                if (!adAccountId) return { error: 'adAccountId is required' };
                const params = new URLSearchParams();
                if (inputs.campaignIds) params.set('campaign_ids', inputs.campaignIds);
                if (inputs.adGroupIds) params.set('ad_group_ids', inputs.adGroupIds);
                if (inputs.entityStatuses) params.set('entity_statuses', inputs.entityStatuses);
                if (inputs.pageSize) params.set('page_size', String(inputs.pageSize));
                if (inputs.bookmark) params.set('bookmark', inputs.bookmark);
                const res = await fetch(`${baseUrl}/ad_accounts/${adAccountId}/ad_groups?${params}`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get ad groups' };
                return { output: data };
            }

            case 'getAds': {
                const { adAccountId } = inputs;
                if (!adAccountId) return { error: 'adAccountId is required' };
                const params = new URLSearchParams();
                if (inputs.campaignIds) params.set('campaign_ids', inputs.campaignIds);
                if (inputs.adGroupIds) params.set('ad_group_ids', inputs.adGroupIds);
                if (inputs.adIds) params.set('ad_ids', inputs.adIds);
                if (inputs.entityStatuses) params.set('entity_statuses', inputs.entityStatuses);
                if (inputs.pageSize) params.set('page_size', String(inputs.pageSize));
                if (inputs.bookmark) params.set('bookmark', inputs.bookmark);
                const res = await fetch(`${baseUrl}/ad_accounts/${adAccountId}/ads?${params}`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get ads' };
                return { output: data };
            }

            case 'getCampaignAnalytics': {
                const { adAccountId, campaignId, startDate, endDate } = inputs;
                if (!adAccountId || !campaignId || !startDate || !endDate) return { error: 'adAccountId, campaignId, startDate and endDate are required' };
                const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
                if (inputs.columns) params.set('columns', inputs.columns);
                if (inputs.granularity) params.set('granularity', inputs.granularity);
                const res = await fetch(`${baseUrl}/ad_accounts/${adAccountId}/campaigns/${campaignId}/analytics?${params}`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get campaign analytics' };
                return { output: data };
            }

            case 'getAdGroupAnalytics': {
                const { adAccountId, adGroupId, startDate, endDate } = inputs;
                if (!adAccountId || !adGroupId || !startDate || !endDate) return { error: 'adAccountId, adGroupId, startDate and endDate are required' };
                const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
                if (inputs.columns) params.set('columns', inputs.columns);
                if (inputs.granularity) params.set('granularity', inputs.granularity);
                const res = await fetch(`${baseUrl}/ad_accounts/${adAccountId}/ad_groups/${adGroupId}/analytics?${params}`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get ad group analytics' };
                return { output: data };
            }

            case 'getAdAnalytics': {
                const { adAccountId, adId, startDate, endDate } = inputs;
                if (!adAccountId || !adId || !startDate || !endDate) return { error: 'adAccountId, adId, startDate and endDate are required' };
                const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
                if (inputs.columns) params.set('columns', inputs.columns);
                if (inputs.granularity) params.set('granularity', inputs.granularity);
                const res = await fetch(`${baseUrl}/ad_accounts/${adAccountId}/ads/${adId}/analytics?${params}`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get ad analytics' };
                return { output: data };
            }

            case 'getPins': {
                const params = new URLSearchParams();
                if (inputs.bookmark) params.set('bookmark', inputs.bookmark);
                if (inputs.pageSize) params.set('page_size', String(inputs.pageSize));
                if (inputs.adAccountId) params.set('ad_account_id', inputs.adAccountId);
                const res = await fetch(`${baseUrl}/pins?${params}`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get pins' };
                return { output: data };
            }

            case 'getPin': {
                const { pinId } = inputs;
                if (!pinId) return { error: 'pinId is required' };
                const params = new URLSearchParams();
                if (inputs.adAccountId) params.set('ad_account_id', inputs.adAccountId);
                const res = await fetch(`${baseUrl}/pins/${pinId}?${params}`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get pin' };
                return { output: data };
            }

            case 'createPin': {
                const { boardId, mediaSource, title, description, link } = inputs;
                if (!boardId || !mediaSource) return { error: 'boardId and mediaSource are required' };
                const body: any = { board_id: boardId, media_source: mediaSource };
                if (title) body.title = title;
                if (description) body.description = description;
                if (link) body.link = link;
                const res = await fetch(`${baseUrl}/pins`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create pin' };
                return { output: data };
            }

            case 'createBoard': {
                const { name, description, privacy } = inputs;
                if (!name) return { error: 'name is required' };
                const body: any = { name };
                if (description) body.description = description;
                if (privacy) body.privacy = privacy;
                const res = await fetch(`${baseUrl}/boards`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create board' };
                return { output: data };
            }

            case 'getBoards': {
                const params = new URLSearchParams();
                if (inputs.bookmark) params.set('bookmark', inputs.bookmark);
                if (inputs.pageSize) params.set('page_size', String(inputs.pageSize));
                if (inputs.privacy) params.set('privacy', inputs.privacy);
                const res = await fetch(`${baseUrl}/boards?${params}`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get boards' };
                return { output: data };
            }

            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Pinterest Analytics action error: ${err.message}`);
        return { error: err.message || 'Unknown error in Pinterest Analytics action' };
    }
}
