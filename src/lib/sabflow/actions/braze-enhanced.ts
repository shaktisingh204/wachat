'use server';

export async function executeBrazeEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    const instance = inputs.instance || 'rest.iad-01';
    const BASE = `https://${instance}.braze.com`;
    const headers: Record<string, string> = {
        'Authorization': `Bearer ${inputs.apiKey}`,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'trackUser': {
                const res = await fetch(`${BASE}/users/track`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        attributes: inputs.attributes || [],
                        events: inputs.events || [],
                        purchases: inputs.purchases || [],
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'trackUser failed' };
                return { output: data };
            }
            case 'identifyUsers': {
                const res = await fetch(`${BASE}/users/identify`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ aliases_to_identify: inputs.aliasesToIdentify || [] }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'identifyUsers failed' };
                return { output: data };
            }
            case 'deleteUser': {
                const res = await fetch(`${BASE}/users/delete`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        external_ids: inputs.externalIds || [],
                        braze_ids: inputs.brazeIds || [],
                        user_aliases: inputs.userAliases || [],
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'deleteUser failed' };
                return { output: data };
            }
            case 'exportUsers': {
                const res = await fetch(`${BASE}/users/export/ids`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        external_ids: inputs.externalIds || [],
                        braze_ids: inputs.brazeIds || [],
                        fields_to_export: inputs.fieldsToExport || ['email', 'external_id'],
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'exportUsers failed' };
                return { output: data };
            }
            case 'sendMessages': {
                const res = await fetch(`${BASE}/messages/send`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        external_user_ids: inputs.externalUserIds || [],
                        segment_id: inputs.segmentId,
                        messages: inputs.messages || {},
                        campaign_id: inputs.campaignId,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'sendMessages failed' };
                return { output: data };
            }
            case 'scheduleMessages': {
                const res = await fetch(`${BASE}/messages/schedule/create`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        external_user_ids: inputs.externalUserIds || [],
                        segment_id: inputs.segmentId,
                        messages: inputs.messages || {},
                        schedule: inputs.schedule || { time: new Date().toISOString() },
                        campaign_id: inputs.campaignId,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'scheduleMessages failed' };
                return { output: data };
            }
            case 'updateSubscriptions': {
                const res = await fetch(`${BASE}/subscription/status/set`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        subscription_group_id: inputs.subscriptionGroupId,
                        subscription_state: inputs.subscriptionState,
                        external_id: inputs.externalId,
                        email: inputs.email,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'updateSubscriptions failed' };
                return { output: data };
            }
            case 'listSegments': {
                const params = new URLSearchParams({ page: String(inputs.page || 0) });
                const res = await fetch(`${BASE}/segments/list?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'listSegments failed' };
                return { output: data };
            }
            case 'getSegment': {
                const params = new URLSearchParams({ segment_id: inputs.segmentId });
                const res = await fetch(`${BASE}/segments/details?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'getSegment failed' };
                return { output: data };
            }
            case 'listCampaigns': {
                const params = new URLSearchParams({ page: String(inputs.page || 0) });
                const res = await fetch(`${BASE}/campaigns/list?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'listCampaigns failed' };
                return { output: data };
            }
            case 'getCampaign': {
                const params = new URLSearchParams({ campaign_id: inputs.campaignId });
                const res = await fetch(`${BASE}/campaigns/details?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'getCampaign failed' };
                return { output: data };
            }
            case 'getCampaignAnalytics': {
                const params = new URLSearchParams({
                    campaign_id: inputs.campaignId,
                    length: String(inputs.length || 7),
                });
                const res = await fetch(`${BASE}/campaigns/data_series?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'getCampaignAnalytics failed' };
                return { output: data };
            }
            case 'createCanvas': {
                const res = await fetch(`${BASE}/canvas/trigger/send`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        canvas_id: inputs.canvasId,
                        recipients: inputs.recipients || [],
                        canvas_entry_properties: inputs.canvasEntryProperties || {},
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'createCanvas failed' };
                return { output: data };
            }
            case 'listCanvases': {
                const params = new URLSearchParams({ page: String(inputs.page || 0) });
                const res = await fetch(`${BASE}/canvas/list?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'listCanvases failed' };
                return { output: data };
            }
            case 'getCanvasAnalytics': {
                const params = new URLSearchParams({
                    canvas_id: inputs.canvasId,
                    length: String(inputs.length || 7),
                });
                const res = await fetch(`${BASE}/canvas/data_series?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'getCanvasAnalytics failed' };
                return { output: data };
            }
            default:
                return { error: `Unknown Braze Enhanced action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Braze Enhanced action error: ${err.message}`);
        return { error: err.message || 'Braze Enhanced action failed' };
    }
}
