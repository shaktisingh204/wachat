'use server';

const BASE = 'https://api.gainsightcloud.com/v1';

export async function executeGainsightAction(actionName: string, inputs: any, user: any, logger: any) {
    const headers: Record<string, string> = {
        'accessKey': inputs.accessKey,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'listAccounts': {
                const res = await fetch(`${BASE}/data/objects/query/Company`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ select: inputs.select || [], limit: inputs.limit || 50 }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'listAccounts failed' };
                return { output: data };
            }
            case 'getAccount': {
                const res = await fetch(`${BASE}/data/objects/Company/${inputs.accountId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'getAccount failed' };
                return { output: data };
            }
            case 'createAccount': {
                const res = await fetch(`${BASE}/data/objects/Company`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.account),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'createAccount failed' };
                return { output: data };
            }
            case 'updateAccount': {
                const res = await fetch(`${BASE}/data/objects/Company/${inputs.accountId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(inputs.account),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'updateAccount failed' };
                return { output: data };
            }
            case 'upsertAccount': {
                const res = await fetch(`${BASE}/data/objects/Company`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify(inputs.account),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'upsertAccount failed' };
                return { output: data };
            }
            case 'listContacts': {
                const res = await fetch(`${BASE}/data/objects/query/Person`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ select: inputs.select || [], limit: inputs.limit || 50 }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'listContacts failed' };
                return { output: data };
            }
            case 'getContact': {
                const res = await fetch(`${BASE}/data/objects/Person/${inputs.contactId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'getContact failed' };
                return { output: data };
            }
            case 'createContact': {
                const res = await fetch(`${BASE}/data/objects/Person`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.contact),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'createContact failed' };
                return { output: data };
            }
            case 'updateContact': {
                const res = await fetch(`${BASE}/data/objects/Person/${inputs.contactId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(inputs.contact),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'updateContact failed' };
                return { output: data };
            }
            case 'deleteContact': {
                const res = await fetch(`${BASE}/data/objects/Person/${inputs.contactId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    return { error: data.message || 'deleteContact failed' };
                }
                return { output: { success: true } };
            }
            case 'createTimeline': {
                const res = await fetch(`${BASE}/v1/activities`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.activity),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'createTimeline failed' };
                return { output: data };
            }
            case 'listTimelines': {
                const params = new URLSearchParams();
                if (inputs.companyId) params.set('companyId', inputs.companyId);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const res = await fetch(`${BASE}/v1/activities?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'listTimelines failed' };
                return { output: data };
            }
            case 'createTask': {
                const res = await fetch(`${BASE}/v1/tasks`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.task),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'createTask failed' };
                return { output: data };
            }
            case 'listTasks': {
                const params = new URLSearchParams();
                if (inputs.assigneeId) params.set('assigneeId', inputs.assigneeId);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const res = await fetch(`${BASE}/v1/tasks?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'listTasks failed' };
                return { output: data };
            }
            case 'getHealthScore': {
                const res = await fetch(`${BASE}/v1/healthscore/${inputs.companyId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'getHealthScore failed' };
                return { output: data };
            }
            default:
                return { error: `Unknown Gainsight action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Gainsight action error: ${err.message}`);
        return { error: err.message || 'Gainsight action failed' };
    }
}
