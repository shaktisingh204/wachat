'use server';

export async function executeSmartleadAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE_URL = 'https://server.smartlead.ai/api/v1';
    const apiKey = inputs.apiKey;

    try {
        switch (actionName) {
            case 'listCampaigns': {
                const res = await fetch(`${BASE_URL}/campaigns?api_key=${apiKey}`);
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list campaigns' };
                return { output: { campaigns: data } };
            }
            case 'getCampaign': {
                const res = await fetch(`${BASE_URL}/campaigns/${inputs.campaignId}?api_key=${apiKey}`);
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get campaign' };
                return { output: { campaign: data } };
            }
            case 'createCampaign': {
                const res = await fetch(`${BASE_URL}/campaigns?api_key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: inputs.name, ...inputs.body }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create campaign' };
                return { output: { campaign: data } };
            }
            case 'updateCampaign': {
                const res = await fetch(`${BASE_URL}/campaigns/${inputs.campaignId}?api_key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(inputs.body || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to update campaign' };
                return { output: { campaign: data } };
            }
            case 'deleteCampaign': {
                const res = await fetch(`${BASE_URL}/campaigns/${inputs.campaignId}?api_key=${apiKey}`, {
                    method: 'DELETE',
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to delete campaign' };
                return { output: { success: true, result: data } };
            }
            case 'listLeads': {
                const params = new URLSearchParams({ api_key: apiKey });
                if (inputs.campaignId) params.set('campaign_id', inputs.campaignId);
                const res = await fetch(`${BASE_URL}/leads?${params.toString()}`);
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list leads' };
                return { output: { leads: data } };
            }
            case 'getLead': {
                const res = await fetch(`${BASE_URL}/leads/${inputs.leadId}?api_key=${apiKey}`);
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get lead' };
                return { output: { lead: data } };
            }
            case 'addLead': {
                const res = await fetch(`${BASE_URL}/leads?api_key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: inputs.email, ...inputs.body }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to add lead' };
                return { output: { lead: data } };
            }
            case 'updateLead': {
                const res = await fetch(`${BASE_URL}/leads/${inputs.leadId}?api_key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(inputs.body || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to update lead' };
                return { output: { lead: data } };
            }
            case 'removeLead': {
                const res = await fetch(`${BASE_URL}/leads/${inputs.leadId}?api_key=${apiKey}`, {
                    method: 'DELETE',
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to remove lead' };
                return { output: { success: true, result: data } };
            }
            case 'getCampaignStats': {
                const res = await fetch(`${BASE_URL}/campaigns/${inputs.campaignId}/stats?api_key=${apiKey}`);
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get campaign stats' };
                return { output: { stats: data } };
            }
            case 'listEmailAccounts': {
                const res = await fetch(`${BASE_URL}/email-accounts?api_key=${apiKey}`);
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list email accounts' };
                return { output: { emailAccounts: data } };
            }
            case 'addEmailAccount': {
                const res = await fetch(`${BASE_URL}/email-accounts?api_key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(inputs.body || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to add email account' };
                return { output: { emailAccount: data } };
            }
            case 'listSequences': {
                const res = await fetch(`${BASE_URL}/campaigns/${inputs.campaignId}/sequences?api_key=${apiKey}`);
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list sequences' };
                return { output: { sequences: data } };
            }
            case 'updateSequence': {
                const res = await fetch(`${BASE_URL}/campaigns/${inputs.campaignId}/sequences/${inputs.sequenceId}?api_key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(inputs.body || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to update sequence' };
                return { output: { sequence: data } };
            }
            default:
                return { error: `Unknown Smartlead action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Smartlead action error: ${err.message}`);
        return { error: err.message || 'Smartlead action failed' };
    }
}
