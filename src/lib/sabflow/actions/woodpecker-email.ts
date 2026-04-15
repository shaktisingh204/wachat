'use server';

export async function executeWoodpeckerEmailAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE_URL = 'https://api.woodpecker.co/rest/v1';
    const apiKey = inputs.apiKey;

    const authHeaders = {
        'api_key': apiKey,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'listCampaigns': {
                const res = await fetch(`${BASE_URL}/campaign_list`, { headers: authHeaders });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list campaigns' };
                return { output: { campaigns: data } };
            }
            case 'getCampaign': {
                const res = await fetch(`${BASE_URL}/campaign_list?id=${inputs.campaignId}`, { headers: authHeaders });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get campaign' };
                return { output: { campaign: data } };
            }
            case 'createCampaign': {
                const res = await fetch(`${BASE_URL}/campaigns`, {
                    method: 'POST',
                    headers: authHeaders,
                    body: JSON.stringify({ name: inputs.name, ...inputs.body }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create campaign' };
                return { output: { campaign: data } };
            }
            case 'updateCampaign': {
                const res = await fetch(`${BASE_URL}/campaigns/${inputs.campaignId}`, {
                    method: 'PUT',
                    headers: authHeaders,
                    body: JSON.stringify(inputs.body || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to update campaign' };
                return { output: { campaign: data } };
            }
            case 'deleteCampaign': {
                const res = await fetch(`${BASE_URL}/campaigns/${inputs.campaignId}`, {
                    method: 'DELETE',
                    headers: authHeaders,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to delete campaign' };
                return { output: { success: true, result: data } };
            }
            case 'listProspects': {
                const params = new URLSearchParams();
                if (inputs.campaignId) params.set('campaign_id', inputs.campaignId);
                if (inputs.page) params.set('page', String(inputs.page));
                const qs = params.toString();
                const res = await fetch(`${BASE_URL}/prospects${qs ? '?' + qs : ''}`, { headers: authHeaders });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list prospects' };
                return { output: { prospects: data } };
            }
            case 'getProspect': {
                const res = await fetch(`${BASE_URL}/prospects?id=${inputs.prospectId}`, { headers: authHeaders });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get prospect' };
                return { output: { prospect: data } };
            }
            case 'createProspect': {
                const res = await fetch(`${BASE_URL}/prospects`, {
                    method: 'POST',
                    headers: authHeaders,
                    body: JSON.stringify({ prospects: [{ email: inputs.email, ...inputs.body }] }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create prospect' };
                return { output: { prospect: data } };
            }
            case 'updateProspect': {
                const res = await fetch(`${BASE_URL}/prospects`, {
                    method: 'PUT',
                    headers: authHeaders,
                    body: JSON.stringify({ id: inputs.prospectId, ...inputs.body }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to update prospect' };
                return { output: { prospect: data } };
            }
            case 'deleteProspect': {
                const res = await fetch(`${BASE_URL}/prospects?id=${inputs.prospectId}`, {
                    method: 'DELETE',
                    headers: authHeaders,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to delete prospect' };
                return { output: { success: true, result: data } };
            }
            case 'addProspectToCampaign': {
                const res = await fetch(`${BASE_URL}/prospects`, {
                    method: 'POST',
                    headers: authHeaders,
                    body: JSON.stringify({
                        prospects: [{ email: inputs.email, ...inputs.body }],
                        campaign: { id: inputs.campaignId },
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to add prospect to campaign' };
                return { output: { result: data } };
            }
            case 'removeProspect': {
                const res = await fetch(`${BASE_URL}/prospects?id=${inputs.prospectId}&campaign_id=${inputs.campaignId}`, {
                    method: 'DELETE',
                    headers: authHeaders,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to remove prospect' };
                return { output: { success: true, result: data } };
            }
            case 'pauseProspect': {
                const res = await fetch(`${BASE_URL}/prospects`, {
                    method: 'PUT',
                    headers: authHeaders,
                    body: JSON.stringify({ id: inputs.prospectId, status: 'PAUSED' }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to pause prospect' };
                return { output: { prospect: data } };
            }
            case 'getStats': {
                const params = new URLSearchParams();
                if (inputs.campaignId) params.set('campaign_id', inputs.campaignId);
                const qs = params.toString();
                const res = await fetch(`${BASE_URL}/stats${qs ? '?' + qs : ''}`, { headers: authHeaders });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get stats' };
                return { output: { stats: data } };
            }
            case 'listWebhooks': {
                const res = await fetch(`${BASE_URL}/webhooks`, { headers: authHeaders });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list webhooks' };
                return { output: { webhooks: data } };
            }
            default:
                return { error: `Unknown Woodpecker Email action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Woodpecker Email action error: ${err.message}`);
        return { error: err.message || 'Woodpecker Email action failed' };
    }
}
