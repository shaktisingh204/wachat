'use server';

const BASE = 'https://app.totango.com/api/v1';

export async function executeTotangoAction(actionName: string, inputs: any, user: any, logger: any) {
    const headers: Record<string, string> = {
        'app-token': inputs.appToken,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'listAccounts': {
                const res = await fetch(`${BASE}/accounts`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ query: inputs.query || { terms: [] }, count: inputs.count || 25, offset: inputs.offset || 0 }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'listAccounts failed' };
                return { output: data };
            }
            case 'getAccount': {
                const res = await fetch(`${BASE}/accounts/${encodeURIComponent(inputs.accountId)}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'getAccount failed' };
                return { output: data };
            }
            case 'createAccount': {
                const attributes = Object.entries(inputs.attributes || {}).map(([name, value]) => ({ name, value }));
                const res = await fetch(`${BASE}/accounts`, {
                    method: 'POST',
                    headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        service_id: inputs.accountId,
                        attributes: JSON.stringify(attributes),
                    }).toString(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'createAccount failed' };
                return { output: data };
            }
            case 'updateAccount': {
                const attributes = Object.entries(inputs.attributes || {}).map(([name, value]) => ({ name, value }));
                const res = await fetch(`${BASE}/accounts`, {
                    method: 'POST',
                    headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        service_id: inputs.accountId,
                        attributes: JSON.stringify(attributes),
                    }).toString(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'updateAccount failed' };
                return { output: data };
            }
            case 'listUsers': {
                const res = await fetch(`${BASE}/users`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ query: inputs.query || { terms: [] }, count: inputs.count || 25, offset: inputs.offset || 0 }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'listUsers failed' };
                return { output: data };
            }
            case 'getUser': {
                const res = await fetch(`${BASE}/users/${encodeURIComponent(inputs.accountId)}/${encodeURIComponent(inputs.userId)}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'getUser failed' };
                return { output: data };
            }
            case 'createUser': {
                const attributes = Object.entries(inputs.attributes || {}).map(([name, value]) => ({ name, value }));
                const res = await fetch(`${BASE}/users`, {
                    method: 'POST',
                    headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        service_id: inputs.accountId,
                        user_id: inputs.userId,
                        attributes: JSON.stringify(attributes),
                    }).toString(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'createUser failed' };
                return { output: data };
            }
            case 'updateUser': {
                const attributes = Object.entries(inputs.attributes || {}).map(([name, value]) => ({ name, value }));
                const res = await fetch(`${BASE}/users`, {
                    method: 'POST',
                    headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        service_id: inputs.accountId,
                        user_id: inputs.userId,
                        attributes: JSON.stringify(attributes),
                    }).toString(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'updateUser failed' };
                return { output: data };
            }
            case 'createEvent': {
                const res = await fetch(`${BASE}/accounts/activities`, {
                    method: 'POST',
                    headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        service_id: inputs.accountId,
                        user_id: inputs.userId || '',
                        module: inputs.module || '',
                        activity: inputs.activity || '',
                    }).toString(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'createEvent failed' };
                return { output: data };
            }
            case 'listEvents': {
                const params = new URLSearchParams({ service_id: inputs.accountId });
                if (inputs.limit) params.set('count', String(inputs.limit));
                const res = await fetch(`${BASE}/accounts/activities?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'listEvents failed' };
                return { output: data };
            }
            case 'listSegments': {
                const res = await fetch(`${BASE}/segments`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'listSegments failed' };
                return { output: data };
            }
            case 'getSegment': {
                const res = await fetch(`${BASE}/segments/${inputs.segmentId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'getSegment failed' };
                return { output: data };
            }
            case 'createTask': {
                const res = await fetch(`${BASE}/tasks`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        account_id: inputs.accountId,
                        title: inputs.title,
                        due_date: inputs.dueDate,
                        assignee: inputs.assignee,
                        description: inputs.description,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'createTask failed' };
                return { output: data };
            }
            case 'listTasks': {
                const params = new URLSearchParams();
                if (inputs.accountId) params.set('service_id', inputs.accountId);
                const res = await fetch(`${BASE}/tasks?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'listTasks failed' };
                return { output: data };
            }
            case 'createNote': {
                const res = await fetch(`${BASE}/touchpoints`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        account_id: inputs.accountId,
                        contact_id: inputs.contactId,
                        note: inputs.note,
                        type: inputs.type || 'note',
                        date: inputs.date || new Date().toISOString(),
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'createNote failed' };
                return { output: data };
            }
            default:
                return { error: `Unknown Totango action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Totango action error: ${err.message}`);
        return { error: err.message || 'Totango action failed' };
    }
}
