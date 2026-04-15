'use server';

const CRISP_BASE = 'https://api.crisp.chat/v1';

async function crispFetch(identifier: string, key: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Crisp] ${method} ${path}`);
    const token = Buffer.from(identifier + ':' + key).toString('base64');
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Basic ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-Crisp-Tier': 'plugin',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${CRISP_BASE}${path}`, options);
    if (res.status === 204) return {};
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = text; }
    if (!res.ok) {
        throw new Error(data?.reason || data?.message || `Crisp API error: ${res.status}`);
    }
    return data?.data ?? data;
}

export async function executeCrispAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const identifier = String(inputs.identifier ?? '').trim();
        const key = String(inputs.key ?? '').trim();
        if (!identifier) throw new Error('identifier is required.');
        if (!key) throw new Error('key is required.');
        const cf = (method: string, path: string, body?: any) => crispFetch(identifier, key, method, path, body, logger);

        switch (actionName) {
            case 'listWebsites': {
                const page = Number(inputs.page ?? 1);
                const data = await cf('GET', `/website?page_number=${page}`);
                return { output: { websites: Array.isArray(data) ? data : [] } };
            }

            case 'getWebsite': {
                const websiteId = String(inputs.websiteId ?? '').trim();
                if (!websiteId) throw new Error('websiteId is required.');
                const data = await cf('GET', `/website/${websiteId}`);
                return { output: data };
            }

            case 'listConversations': {
                const websiteId = String(inputs.websiteId ?? '').trim();
                if (!websiteId) throw new Error('websiteId is required.');
                const page = Number(inputs.page ?? 1);
                const data = await cf('GET', `/website/${websiteId}/conversations/${page}`);
                return { output: { conversations: Array.isArray(data) ? data : [] } };
            }

            case 'getConversation': {
                const websiteId = String(inputs.websiteId ?? '').trim();
                const sessionId = String(inputs.sessionId ?? '').trim();
                if (!websiteId) throw new Error('websiteId is required.');
                if (!sessionId) throw new Error('sessionId is required.');
                const data = await cf('GET', `/website/${websiteId}/conversation/${sessionId}`);
                return { output: data };
            }

            case 'createConversation': {
                const websiteId = String(inputs.websiteId ?? '').trim();
                if (!websiteId) throw new Error('websiteId is required.');
                const data = await cf('POST', `/website/${websiteId}/conversation`, {});
                return { output: data };
            }

            case 'sendMessage': {
                const websiteId = String(inputs.websiteId ?? '').trim();
                const sessionId = String(inputs.sessionId ?? '').trim();
                const content = String(inputs.content ?? '').trim();
                const type = String(inputs.type ?? 'text').trim();
                const from = String(inputs.from ?? 'operator').trim();
                if (!websiteId) throw new Error('websiteId is required.');
                if (!sessionId) throw new Error('sessionId is required.');
                if (!content) throw new Error('content is required.');
                const body: any = { type, from, content };
                if (inputs.origin) body.origin = String(inputs.origin);
                const data = await cf('POST', `/website/${websiteId}/conversation/${sessionId}/message`, body);
                return { output: data };
            }

            case 'listMessages': {
                const websiteId = String(inputs.websiteId ?? '').trim();
                const sessionId = String(inputs.sessionId ?? '').trim();
                if (!websiteId) throw new Error('websiteId is required.');
                if (!sessionId) throw new Error('sessionId is required.');
                const before = inputs.before ? `?timestamp_before=${inputs.before}` : '';
                const data = await cf('GET', `/website/${websiteId}/conversation/${sessionId}/messages${before}`);
                return { output: { messages: Array.isArray(data) ? data : [] } };
            }

            case 'updateConversationState': {
                const websiteId = String(inputs.websiteId ?? '').trim();
                const sessionId = String(inputs.sessionId ?? '').trim();
                const state = String(inputs.state ?? 'resolved').trim();
                if (!websiteId) throw new Error('websiteId is required.');
                if (!sessionId) throw new Error('sessionId is required.');
                await cf('PATCH', `/website/${websiteId}/conversation/${sessionId}/state`, { state });
                return { output: { websiteId, sessionId, state, updated: true } };
            }

            case 'assignConversation': {
                const websiteId = String(inputs.websiteId ?? '').trim();
                const sessionId = String(inputs.sessionId ?? '').trim();
                const operatorId = String(inputs.operatorId ?? '').trim();
                if (!websiteId) throw new Error('websiteId is required.');
                if (!sessionId) throw new Error('sessionId is required.');
                const body: any = {};
                if (operatorId) body.assigned = { operator_id: operatorId };
                await cf('PATCH', `/website/${websiteId}/conversation/${sessionId}/routing`, body);
                return { output: { websiteId, sessionId, operatorId, assigned: true } };
            }

            case 'listContacts': {
                const websiteId = String(inputs.websiteId ?? '').trim();
                if (!websiteId) throw new Error('websiteId is required.');
                const page = Number(inputs.page ?? 1);
                const data = await cf('GET', `/website/${websiteId}/visitors/list/${page}`);
                return { output: { contacts: Array.isArray(data) ? data : [] } };
            }

            case 'getContact': {
                const websiteId = String(inputs.websiteId ?? '').trim();
                const peopleId = String(inputs.peopleId ?? '').trim();
                if (!websiteId) throw new Error('websiteId is required.');
                if (!peopleId) throw new Error('peopleId is required.');
                const data = await cf('GET', `/website/${websiteId}/people/profile/${peopleId}`);
                return { output: data };
            }

            case 'createContact': {
                const websiteId = String(inputs.websiteId ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                if (!websiteId) throw new Error('websiteId is required.');
                if (!email) throw new Error('email is required.');
                const body: any = { person: { email } };
                if (inputs.name) body.person.nickname = String(inputs.name);
                if (inputs.phone) body.person.phone = String(inputs.phone);
                const data = await cf('POST', `/website/${websiteId}/people/profile`, body);
                return { output: data };
            }

            case 'updateContact': {
                const websiteId = String(inputs.websiteId ?? '').trim();
                const peopleId = String(inputs.peopleId ?? '').trim();
                if (!websiteId) throw new Error('websiteId is required.');
                if (!peopleId) throw new Error('peopleId is required.');
                const body: any = { person: {} };
                if (inputs.email) body.person.email = String(inputs.email);
                if (inputs.name) body.person.nickname = String(inputs.name);
                if (inputs.phone) body.person.phone = String(inputs.phone);
                await cf('PATCH', `/website/${websiteId}/people/profile/${peopleId}`, body);
                return { output: { websiteId, peopleId, updated: true } };
            }

            case 'searchContacts': {
                const websiteId = String(inputs.websiteId ?? '').trim();
                const query = String(inputs.query ?? '').trim();
                if (!websiteId) throw new Error('websiteId is required.');
                if (!query) throw new Error('query is required.');
                const data = await cf('GET', `/website/${websiteId}/people/search?search_query=${encodeURIComponent(query)}&search_operator=email&include_total=1`);
                return { output: { contacts: Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [], total: data?.total ?? 0 } };
            }

            case 'getAnalytics': {
                const websiteId = String(inputs.websiteId ?? '').trim();
                if (!websiteId) throw new Error('websiteId is required.');
                const dateFrom = String(inputs.dateFrom ?? '').trim();
                const dateTo = String(inputs.dateTo ?? '').trim();
                const type = String(inputs.type ?? 'total_conversations').trim();
                let q = `/website/${websiteId}/analytics/account/statistics?type=${encodeURIComponent(type)}`;
                if (dateFrom) q += `&date_from=${encodeURIComponent(dateFrom)}`;
                if (dateTo) q += `&date_to=${encodeURIComponent(dateTo)}`;
                const data = await cf('GET', q);
                return { output: { analytics: data } };
            }

            default:
                return { error: `Unknown Crisp action: ${actionName}` };
        }
    } catch (err: any) {
        return { error: err?.message ?? String(err) };
    }
}
