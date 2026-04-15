'use server';

export async function executeInstantlyAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE_URL = 'https://api.instantly.ai/api/v1';
    const apiKey = inputs.apiKey;

    try {
        switch (actionName) {
            case 'listCampaigns': {
                const res = await fetch(`${BASE_URL}/campaign/list?api_key=${apiKey}`);
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list campaigns' };
                return { output: { campaigns: data } };
            }
            case 'getCampaign': {
                const res = await fetch(`${BASE_URL}/campaign?api_key=${apiKey}&id=${inputs.campaignId}`);
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get campaign' };
                return { output: { campaign: data } };
            }
            case 'createCampaign': {
                const res = await fetch(`${BASE_URL}/campaign/create?api_key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: inputs.name, ...inputs.body }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create campaign' };
                return { output: { campaign: data } };
            }
            case 'updateCampaign': {
                const res = await fetch(`${BASE_URL}/campaign/update?api_key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: inputs.campaignId, ...inputs.body }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to update campaign' };
                return { output: { campaign: data } };
            }
            case 'deleteCampaign': {
                const res = await fetch(`${BASE_URL}/campaign/delete?api_key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ campaign_id: inputs.campaignId }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to delete campaign' };
                return { output: { success: true, result: data } };
            }
            case 'launchCampaign': {
                const res = await fetch(`${BASE_URL}/campaign/launch?api_key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: inputs.campaignId }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to launch campaign' };
                return { output: { result: data } };
            }
            case 'pauseCampaign': {
                const res = await fetch(`${BASE_URL}/campaign/pause?api_key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: inputs.campaignId }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to pause campaign' };
                return { output: { result: data } };
            }
            case 'listLeads': {
                const params = new URLSearchParams({ api_key: apiKey });
                if (inputs.campaignId) params.set('campaign_id', inputs.campaignId);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const res = await fetch(`${BASE_URL}/lead/list?${params.toString()}`);
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list leads' };
                return { output: { leads: data } };
            }
            case 'addLeadsToCampaign': {
                const res = await fetch(`${BASE_URL}/lead/add?api_key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        campaign_id: inputs.campaignId,
                        leads: inputs.leads || [{ email: inputs.email, ...inputs.leadData }],
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to add leads to campaign' };
                return { output: { result: data } };
            }
            case 'updateLead': {
                const res = await fetch(`${BASE_URL}/lead/update?api_key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: inputs.leadId, ...inputs.body }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to update lead' };
                return { output: { lead: data } };
            }
            case 'deleteLead': {
                const res = await fetch(`${BASE_URL}/lead/delete?api_key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ delete_all_from_company: false, campaign_id: inputs.campaignId, id: inputs.leadId }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to delete lead' };
                return { output: { success: true, result: data } };
            }
            case 'getEmailVerification': {
                const res = await fetch(`${BASE_URL}/email-verification/verify?api_key=${apiKey}&email=${encodeURIComponent(inputs.email)}`);
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to verify email' };
                return { output: { verification: data } };
            }
            case 'listEmailAccounts': {
                const res = await fetch(`${BASE_URL}/account/list?api_key=${apiKey}`);
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list email accounts' };
                return { output: { emailAccounts: data } };
            }
            case 'addEmailAccount': {
                const res = await fetch(`${BASE_URL}/account/add?api_key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(inputs.body || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to add email account' };
                return { output: { emailAccount: data } };
            }
            case 'getCampaignAnalytics': {
                const params = new URLSearchParams({ api_key: apiKey });
                if (inputs.campaignId) params.set('campaign_id', inputs.campaignId);
                if (inputs.startDate) params.set('start_date', inputs.startDate);
                if (inputs.endDate) params.set('end_date', inputs.endDate);
                const res = await fetch(`${BASE_URL}/analytics/campaign/overview?${params.toString()}`);
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get campaign analytics' };
                return { output: { analytics: data } };
            }
            default:
                return { error: `Unknown Instantly action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Instantly action error: ${err.message}`);
        return { error: err.message || 'Instantly action failed' };
    }
}
