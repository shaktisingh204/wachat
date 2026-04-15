
'use server';

const LEMLIST_BASE = 'https://api.lemlist.com/api';

async function lemlistFetch(
    apiKey: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
): Promise<any> {
    logger?.log(`[Lemlist] ${method} ${path}`);
    const authHeader = `Basic ${Buffer.from(`:${apiKey}`).toString('base64')}`;
    const options: RequestInit = {
        method,
        headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${LEMLIST_BASE}${path}`, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        const msg = data?.error || data?.message || `Lemlist API error: ${res.status}`;
        throw new Error(msg);
    }
    return data;
}

export async function executeLemlistAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        const lemlist = (method: string, path: string, body?: any) =>
            lemlistFetch(apiKey, method, path, body, logger);

        switch (actionName) {
            case 'getCampaigns': {
                const data = await lemlist('GET', '/campaigns');
                return { output: { campaigns: Array.isArray(data) ? data : [] } };
            }

            case 'getCampaign': {
                const campaignId = String(inputs.campaignId ?? '').trim();
                if (!campaignId) throw new Error('campaignId is required.');
                const data = await lemlist('GET', `/campaigns/${campaignId}`);
                return { output: { _id: data._id, name: data.name, status: data.status, statistics: data.statistics ?? {} } };
            }

            case 'addLeadToCampaign': {
                const campaignId = String(inputs.campaignId ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                if (!campaignId || !email) throw new Error('campaignId and email are required.');
                const body: any = {};
                if (inputs.firstName) body.firstName = String(inputs.firstName);
                if (inputs.lastName) body.lastName = String(inputs.lastName);
                if (inputs.phone) body.phone = String(inputs.phone);
                if (inputs.companyName) body.companyName = String(inputs.companyName);
                if (inputs.icebreaker) body.icebreaker = String(inputs.icebreaker);
                if (inputs.customFields && typeof inputs.customFields === 'object') {
                    Object.assign(body, inputs.customFields);
                }
                const data = await lemlist('POST', `/campaigns/${campaignId}/leads/${encodeURIComponent(email)}`, body);
                return { output: { _id: data._id, email: data.email } };
            }

            case 'deleteLeadFromCampaign': {
                const campaignId = String(inputs.campaignId ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                if (!campaignId || !email) throw new Error('campaignId and email are required.');
                const data = await lemlist('DELETE', `/campaigns/${campaignId}/leads/${encodeURIComponent(email)}`);
                return { output: { _id: data._id } };
            }

            case 'pauseLeadInCampaign': {
                const campaignId = String(inputs.campaignId ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                if (!campaignId || !email) throw new Error('campaignId and email are required.');
                const data = await lemlist('POST', `/campaigns/${campaignId}/leads/${encodeURIComponent(email)}/pause`);
                return { output: { _id: data._id } };
            }

            case 'resumeLeadInCampaign': {
                const campaignId = String(inputs.campaignId ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                if (!campaignId || !email) throw new Error('campaignId and email are required.');
                const data = await lemlist('POST', `/campaigns/${campaignId}/leads/${encodeURIComponent(email)}/resume`);
                return { output: { _id: data._id } };
            }

            case 'markLeadAsInterested': {
                const campaignId = String(inputs.campaignId ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                if (!campaignId || !email) throw new Error('campaignId and email are required.');
                const data = await lemlist('POST', `/campaigns/${campaignId}/leads/${encodeURIComponent(email)}/interested`);
                return { output: { _id: data._id } };
            }

            case 'markLeadAsNotInterested': {
                const campaignId = String(inputs.campaignId ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                if (!campaignId || !email) throw new Error('campaignId and email are required.');
                const data = await lemlist('POST', `/campaigns/${campaignId}/leads/${encodeURIComponent(email)}/notInterested`);
                return { output: { _id: data._id } };
            }

            case 'getLeadByEmail': {
                const email = String(inputs.email ?? '').trim();
                if (!email) throw new Error('email is required.');
                const data = await lemlist('GET', `/leads/${encodeURIComponent(email)}`);
                return {
                    output: {
                        _id: data._id,
                        email: data.email,
                        firstName: data.firstName ?? '',
                        lastName: data.lastName ?? '',
                        companyName: data.companyName ?? '',
                    },
                };
            }

            case 'updateLead': {
                const email = String(inputs.email ?? '').trim();
                if (!email) throw new Error('email is required.');
                if (!inputs.data || typeof inputs.data !== 'object') throw new Error('data object is required.');
                const data = await lemlist('PATCH', `/leads/${encodeURIComponent(email)}`, inputs.data);
                return { output: { _id: data._id } };
            }

            case 'deleteLead': {
                const email = String(inputs.email ?? '').trim();
                if (!email) throw new Error('email is required.');
                const data = await lemlist('DELETE', `/leads/${encodeURIComponent(email)}`);
                return { output: { _id: data._id } };
            }

            case 'listUnsubscribes': {
                const data = await lemlist('GET', '/unsubscribes');
                return { output: { unsubscribes: Array.isArray(data) ? data : [] } };
            }

            case 'getTeamStats': {
                const data = await lemlist('GET', '/team/stats');
                return { output: { stats: data ?? {} } };
            }

            case 'listActivities': {
                const campaignId = String(inputs.campaignId ?? '').trim();
                if (!campaignId) throw new Error('campaignId is required.');
                let path = `/activities?campaignId=${encodeURIComponent(campaignId)}`;
                if (inputs.type) path += `&type=${encodeURIComponent(String(inputs.type))}`;
                const data = await lemlist('GET', path);
                return { output: { activities: Array.isArray(data) ? data : [] } };
            }

            default:
                return { error: `Lemlist action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Lemlist action failed.' };
    }
}
