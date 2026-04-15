'use server';

export async function executeReplyIOAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE_URL = 'https://api.reply.io/v1';
    const apiKey = inputs.apiKey;

    const authHeaders = {
        'x-api-key': apiKey,
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
            case 'pauseCampaign': {
                const res = await fetch(`${BASE_URL}/campaigns/${inputs.campaignId}/pause`, {
                    method: 'PUT',
                    headers: authHeaders,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to pause campaign' };
                return { output: { result: data } };
            }
            case 'resumeCampaign': {
                const res = await fetch(`${BASE_URL}/campaigns/${inputs.campaignId}/resume`, {
                    method: 'PUT',
                    headers: authHeaders,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to resume campaign' };
                return { output: { result: data } };
            }
            case 'listPeople': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const qs = params.toString();
                const res = await fetch(`${BASE_URL}/people${qs ? '?' + qs : ''}`, { headers: authHeaders });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list people' };
                return { output: { people: data } };
            }
            case 'getPerson': {
                const res = await fetch(`${BASE_URL}/people/${inputs.personId}`, { headers: authHeaders });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get person' };
                return { output: { person: data } };
            }
            case 'createPerson': {
                const res = await fetch(`${BASE_URL}/people`, {
                    method: 'POST',
                    headers: authHeaders,
                    body: JSON.stringify({ email: inputs.email, firstName: inputs.firstName, lastName: inputs.lastName, ...inputs.body }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create person' };
                return { output: { person: data } };
            }
            case 'updatePerson': {
                const res = await fetch(`${BASE_URL}/people/${inputs.personId}`, {
                    method: 'PUT',
                    headers: authHeaders,
                    body: JSON.stringify(inputs.body || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to update person' };
                return { output: { person: data } };
            }
            case 'deletePerson': {
                const res = await fetch(`${BASE_URL}/people/${inputs.personId}`, {
                    method: 'DELETE',
                    headers: authHeaders,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to delete person' };
                return { output: { success: true, result: data } };
            }
            case 'addPersonToCampaign': {
                const res = await fetch(`${BASE_URL}/campaigns/${inputs.campaignId}/people`, {
                    method: 'POST',
                    headers: authHeaders,
                    body: JSON.stringify({ email: inputs.email, ...inputs.body }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to add person to campaign' };
                return { output: { result: data } };
            }
            case 'removePersonFromCampaign': {
                const res = await fetch(`${BASE_URL}/campaigns/${inputs.campaignId}/people/${inputs.personId}`, {
                    method: 'DELETE',
                    headers: authHeaders,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to remove person from campaign' };
                return { output: { success: true, result: data } };
            }
            case 'getSentEmails': {
                const params = new URLSearchParams();
                if (inputs.campaignId) params.set('campaignId', inputs.campaignId);
                if (inputs.page) params.set('page', String(inputs.page));
                const qs = params.toString();
                const res = await fetch(`${BASE_URL}/emailsdata${qs ? '?' + qs : ''}`, { headers: authHeaders });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get sent emails' };
                return { output: { emails: data } };
            }
            case 'getStats': {
                const params = new URLSearchParams();
                if (inputs.campaignId) params.set('id', inputs.campaignId);
                const qs = params.toString();
                const res = await fetch(`${BASE_URL}/campaigns/stats${qs ? '?' + qs : ''}`, { headers: authHeaders });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get stats' };
                return { output: { stats: data } };
            }
            case 'listEmailAccounts': {
                const res = await fetch(`${BASE_URL}/emailaccounts`, { headers: authHeaders });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list email accounts' };
                return { output: { emailAccounts: data } };
            }
            default:
                return { error: `Unknown Reply.io action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Reply.io action error: ${err.message}`);
        return { error: err.message || 'Reply.io action failed' };
    }
}
