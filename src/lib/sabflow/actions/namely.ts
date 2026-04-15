'use server';

export async function executeNamelyAction(actionName: string, inputs: any, user: any, logger: any) {
    const company = inputs.company;
    if (!company) return { error: 'Namely: inputs.company (subdomain) is required.' };
    const BASE_URL = `https://${company}.namely.com/api/v1`;

    try {
        const accessToken = inputs.accessToken;
        if (!accessToken) return { error: 'Namely: inputs.accessToken is required.' };

        const headers: Record<string, string> = {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listProfiles': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', inputs.page);
                if (inputs.per) params.set('per', inputs.per);
                const res = await fetch(`${BASE_URL}/profiles?${params.toString()}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getProfile': {
                const res = await fetch(`${BASE_URL}/profiles/${inputs.profileId}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'createProfile': {
                const res = await fetch(`${BASE_URL}/profiles`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ profiles: [inputs.profile || {}] }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'updateProfile': {
                const res = await fetch(`${BASE_URL}/profiles/${inputs.profileId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({ profiles: [inputs.updates || {}] }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'listGroups': {
                const params = new URLSearchParams();
                if (inputs.type) params.set('filter[group_type_id]', inputs.type);
                const res = await fetch(`${BASE_URL}/groups?${params.toString()}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getGroup': {
                const res = await fetch(`${BASE_URL}/groups/${inputs.groupId}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'createGroup': {
                const res = await fetch(`${BASE_URL}/groups`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ groups: [inputs.group || {}] }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'listFields': {
                const res = await fetch(`${BASE_URL}/fields`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'listTimeLogs': {
                const params = new URLSearchParams();
                if (inputs.profileId) params.set('filter[profile_id]', inputs.profileId);
                if (inputs.startDate) params.set('filter[start_date]', inputs.startDate);
                if (inputs.endDate) params.set('filter[end_date]', inputs.endDate);
                const res = await fetch(`${BASE_URL}/time_logs?${params.toString()}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'createTimeLog': {
                const res = await fetch(`${BASE_URL}/time_logs`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ time_logs: [inputs.timeLog || {}] }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'updateTimeLog': {
                const res = await fetch(`${BASE_URL}/time_logs/${inputs.timeLogId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({ time_logs: [inputs.updates || {}] }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'listEvents': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', inputs.page);
                const res = await fetch(`${BASE_URL}/events?${params.toString()}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'createEvent': {
                const res = await fetch(`${BASE_URL}/events`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ events: [inputs.event || {}] }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'getCompanyInfo': {
                const res = await fetch(`${BASE_URL}/company`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'listAnnouncements': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', inputs.page);
                const res = await fetch(`${BASE_URL}/announcements?${params.toString()}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            default:
                return { error: `Namely: unknown action "${actionName}"` };
        }
    } catch (err: any) {
        logger.log(`Namely action error: ${err.message}`);
        return { error: err.message };
    }
}
