
'use server';

const GONG_DEFAULT_BASE = 'https://us-66461.api.gong.io/v2';

async function gongFetch(accessKey: string, accessSecret: string, method: string, url: string, body?: any, logger?: any) {
    logger?.log(`[Gong] ${method} ${url}`);
    const token = Buffer.from(`${accessKey}:${accessSecret}`).toString('base64');
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Basic ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.errors?.[0] || data?.message || `Gong API error: ${res.status}`);
    }
    return data;
}

export async function executeGongAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const accessKey = String(inputs.accessKey ?? '').trim();
        const accessSecret = String(inputs.accessSecret ?? '').trim();
        if (!accessKey || !accessSecret) throw new Error('accessKey and accessSecret are required.');
        const baseUrl = String(inputs.baseUrl ?? GONG_DEFAULT_BASE).replace(/\/$/, '');
        const gong = (method: string, path: string, body?: any) => gongFetch(accessKey, accessSecret, method, `${baseUrl}${path}`, body, logger);

        switch (actionName) {
            case 'listCalls': {
                const fromDateTime = inputs.fromDateTime ? String(inputs.fromDateTime) : undefined;
                const toDateTime = inputs.toDateTime ? String(inputs.toDateTime) : undefined;
                const params = new URLSearchParams();
                if (fromDateTime) params.set('fromDateTime', fromDateTime);
                if (toDateTime) params.set('toDateTime', toDateTime);
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await gong('GET', `/calls${query}`);
                return { output: { calls: data.calls ?? [], totalRecords: data.records?.totalRecords ?? 0 } };
            }

            case 'getCall': {
                const callId = String(inputs.callId ?? '').trim();
                if (!callId) throw new Error('callId is required.');
                const data = await gong('GET', `/calls/${callId}`);
                return { output: data };
            }

            case 'listTranscripts': {
                const callIds = inputs.callIds;
                const ids = Array.isArray(callIds) ? callIds : (callIds ? [callIds] : []);
                const data = await gong('POST', `/calls/transcript`, { filter: { callIds: ids } });
                return { output: { transcripts: data.callTranscripts ?? [] } };
            }

            case 'getTranscript': {
                const callId = String(inputs.callId ?? '').trim();
                if (!callId) throw new Error('callId is required.');
                const data = await gong('POST', `/calls/transcript`, { filter: { callIds: [callId] } });
                const transcript = (data.callTranscripts ?? [])[0] ?? null;
                return { output: { transcript } };
            }

            case 'listUsers': {
                const data = await gong('GET', `/users`);
                return { output: { users: data.users ?? [], totalRecords: data.records?.totalRecords ?? 0 } };
            }

            case 'getUser': {
                const userId = String(inputs.userId ?? '').trim();
                if (!userId) throw new Error('userId is required.');
                const data = await gong('GET', `/users/${userId}`);
                return { output: data };
            }

            case 'listDeals': {
                const data = await gong('GET', `/crm/object-list/deals`);
                return { output: { deals: data.deals ?? [] } };
            }

            case 'getDeal': {
                const dealId = String(inputs.dealId ?? '').trim();
                if (!dealId) throw new Error('dealId is required.');
                const data = await gong('GET', `/crm/deals/${dealId}`);
                return { output: data };
            }

            case 'getCallStats': {
                const fromDateTime = inputs.fromDateTime ? String(inputs.fromDateTime) : undefined;
                const toDateTime = inputs.toDateTime ? String(inputs.toDateTime) : undefined;
                const params = new URLSearchParams();
                if (fromDateTime) params.set('fromDateTime', fromDateTime);
                if (toDateTime) params.set('toDateTime', toDateTime);
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await gong('GET', `/stats/activity/calls${query}`);
                return { output: data };
            }

            case 'listLibraryFolders': {
                const data = await gong('GET', `/library/folders`);
                return { output: { folders: data.folders ?? [] } };
            }

            case 'searchCalls': {
                const query = String(inputs.query ?? '').trim();
                if (!query) throw new Error('query is required.');
                const data = await gong('POST', `/calls/search`, { filter: { contentView: { query } } });
                return { output: { calls: data.calls ?? [], totalRecords: data.records?.totalRecords ?? 0 } };
            }

            default:
                return { error: `Gong action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Gong action failed.' };
    }
}
