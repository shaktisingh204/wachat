'use server';

export async function executeLemlistEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE_URL = 'https://api.lemlist.com/api';
    const auth = Buffer.from(':' + inputs.apiKey).toString('base64');

    const authHeaders = {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'listCampaigns': {
                const res = await fetch(`${BASE_URL}/campaigns`, { headers: authHeaders });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list campaigns' };
                return { output: { campaigns: data } };
            }
            case 'getCampaign': {
                const res = await fetch(`${BASE_URL}/campaigns/${inputs.campaignId}`, { headers: authHeaders });
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
            case 'deleteCampaign': {
                const res = await fetch(`${BASE_URL}/campaigns/${inputs.campaignId}`, {
                    method: 'DELETE',
                    headers: authHeaders,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to delete campaign' };
                return { output: { success: true, result: data } };
            }
            case 'listLeads': {
                const res = await fetch(`${BASE_URL}/campaigns/${inputs.campaignId}/leads`, { headers: authHeaders });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list leads' };
                return { output: { leads: data } };
            }
            case 'getLead': {
                const res = await fetch(`${BASE_URL}/campaigns/${inputs.campaignId}/leads/${encodeURIComponent(inputs.email)}`, { headers: authHeaders });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get lead' };
                return { output: { lead: data } };
            }
            case 'addLead': {
                const res = await fetch(`${BASE_URL}/campaigns/${inputs.campaignId}/leads/${encodeURIComponent(inputs.email)}`, {
                    method: 'POST',
                    headers: authHeaders,
                    body: JSON.stringify(inputs.body || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to add lead' };
                return { output: { lead: data } };
            }
            case 'updateLead': {
                const res = await fetch(`${BASE_URL}/campaigns/${inputs.campaignId}/leads/${encodeURIComponent(inputs.email)}`, {
                    method: 'PATCH',
                    headers: authHeaders,
                    body: JSON.stringify(inputs.body || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to update lead' };
                return { output: { lead: data } };
            }
            case 'deleteLead': {
                const res = await fetch(`${BASE_URL}/campaigns/${inputs.campaignId}/leads/${encodeURIComponent(inputs.email)}`, {
                    method: 'DELETE',
                    headers: authHeaders,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to delete lead' };
                return { output: { success: true, result: data } };
            }
            case 'unsubscribeLead': {
                const res = await fetch(`${BASE_URL}/leads/${encodeURIComponent(inputs.email)}/unsubscribe`, {
                    method: 'POST',
                    headers: authHeaders,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to unsubscribe lead' };
                return { output: { result: data } };
            }
            case 'listActivities': {
                const params = new URLSearchParams();
                if (inputs.campaignId) params.set('campaignId', inputs.campaignId);
                if (inputs.type) params.set('type', inputs.type);
                const qs = params.toString();
                const res = await fetch(`${BASE_URL}/activities${qs ? '?' + qs : ''}`, { headers: authHeaders });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list activities' };
                return { output: { activities: data } };
            }
            case 'markAsInterested': {
                const res = await fetch(`${BASE_URL}/campaigns/${inputs.campaignId}/leads/${encodeURIComponent(inputs.email)}/interested`, {
                    method: 'POST',
                    headers: authHeaders,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to mark as interested' };
                return { output: { result: data } };
            }
            case 'markAsNotInterested': {
                const res = await fetch(`${BASE_URL}/campaigns/${inputs.campaignId}/leads/${encodeURIComponent(inputs.email)}/notInterested`, {
                    method: 'POST',
                    headers: authHeaders,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to mark as not interested' };
                return { output: { result: data } };
            }
            case 'getStats': {
                const res = await fetch(`${BASE_URL}/campaigns/${inputs.campaignId}/stats`, { headers: authHeaders });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get stats' };
                return { output: { stats: data } };
            }
            case 'exportLeads': {
                const res = await fetch(`${BASE_URL}/campaigns/${inputs.campaignId}/export`, { headers: authHeaders });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to export leads' };
                return { output: { leads: data } };
            }
            default:
                return { error: `Unknown Lemlist Enhanced action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Lemlist Enhanced action error: ${err.message}`);
        return { error: err.message || 'Lemlist Enhanced action failed' };
    }
}
