'use server';

const OLARK_BASE = 'https://www.olark.com/api/v1';

async function olarkFetch(apiKey: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Olark] ${method} ${path}`);
    const separator = path.includes('?') ? '&' : '?';
    const url = `${OLARK_BASE}${path}${separator}api_key=${encodeURIComponent(apiKey)}`;
    const options: RequestInit = {
        method,
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = text; }
    if (!res.ok) {
        throw new Error(data?.error || data?.message || `Olark API error: ${res.status}`);
    }
    return data;
}

export async function executeOlarkAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');
        const of = (method: string, path: string, body?: any) => olarkFetch(apiKey, method, path, body, logger);

        switch (actionName) {
            case 'listTranscripts': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(Number(inputs.limit)));
                if (inputs.offset) params.set('offset', String(Number(inputs.offset)));
                if (inputs.beginTime) params.set('begin_time', String(inputs.beginTime));
                if (inputs.endTime) params.set('end_time', String(inputs.endTime));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await of('GET', `/transcripts${qs}`);
                return { output: { transcripts: data?.data ?? data ?? [] } };
            }

            case 'getTranscript': {
                const transcriptId = String(inputs.transcriptId ?? '').trim();
                if (!transcriptId) throw new Error('transcriptId is required.');
                const data = await of('GET', `/transcripts/${transcriptId}`);
                return { output: data?.data ?? data };
            }

            case 'searchTranscripts': {
                const query = String(inputs.query ?? '').trim();
                if (!query) throw new Error('query is required.');
                const params = new URLSearchParams({ q: query });
                if (inputs.limit) params.set('limit', String(Number(inputs.limit)));
                if (inputs.offset) params.set('offset', String(Number(inputs.offset)));
                const data = await of('GET', `/transcripts?${params.toString()}`);
                return { output: { transcripts: data?.data ?? [] } };
            }

            case 'createTag': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const data = await of('POST', '/tags', { name });
                return { output: data?.data ?? data };
            }

            case 'deleteTag': {
                const tagId = String(inputs.tagId ?? '').trim();
                if (!tagId) throw new Error('tagId is required.');
                await of('DELETE', `/tags/${tagId}`);
                return { output: { tagId, deleted: true } };
            }

            case 'updateConversation': {
                const conversationId = String(inputs.conversationId ?? '').trim();
                if (!conversationId) throw new Error('conversationId is required.');
                const body: any = {};
                if (inputs.tags) body.tags = inputs.tags;
                if (inputs.status) body.status = String(inputs.status);
                if (inputs.customFields) body.custom_fields = inputs.customFields;
                const data = await of('PATCH', `/conversations/${conversationId}`, body);
                return { output: { conversationId, updated: true, ...data } };
            }

            case 'listOperators': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(Number(inputs.limit)));
                if (inputs.offset) params.set('offset', String(Number(inputs.offset)));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await of('GET', `/operators${qs}`);
                return { output: { operators: data?.data ?? [] } };
            }

            case 'getOperator': {
                const operatorId = String(inputs.operatorId ?? '').trim();
                if (!operatorId) throw new Error('operatorId is required.');
                const data = await of('GET', `/operators/${operatorId}`);
                return { output: data?.data ?? data };
            }

            case 'createOperator': {
                const email = String(inputs.email ?? '').trim();
                const fullName = String(inputs.fullName ?? '').trim();
                if (!email) throw new Error('email is required.');
                if (!fullName) throw new Error('fullName is required.');
                const body: any = { email, full_name: fullName };
                if (inputs.nickname) body.nickname = String(inputs.nickname);
                if (inputs.role) body.role = String(inputs.role);
                if (inputs.password) body.password = String(inputs.password);
                const data = await of('POST', '/operators', body);
                return { output: data?.data ?? data };
            }

            case 'updateOperator': {
                const operatorId = String(inputs.operatorId ?? '').trim();
                if (!operatorId) throw new Error('operatorId is required.');
                const body: any = {};
                if (inputs.fullName) body.full_name = String(inputs.fullName);
                if (inputs.nickname) body.nickname = String(inputs.nickname);
                if (inputs.role) body.role = String(inputs.role);
                if (inputs.available !== undefined) body.available = Boolean(inputs.available);
                const data = await of('PATCH', `/operators/${operatorId}`, body);
                return { output: { operatorId, updated: true, ...data } };
            }

            case 'deleteOperator': {
                const operatorId = String(inputs.operatorId ?? '').trim();
                if (!operatorId) throw new Error('operatorId is required.');
                await of('DELETE', `/operators/${operatorId}`);
                return { output: { operatorId, deleted: true } };
            }

            case 'getReport': {
                const reportType = String(inputs.reportType ?? 'chat_counts').trim();
                const params = new URLSearchParams({ report: reportType });
                if (inputs.beginTime) params.set('begin_time', String(inputs.beginTime));
                if (inputs.endTime) params.set('end_time', String(inputs.endTime));
                if (inputs.operatorId) params.set('operator_id', String(inputs.operatorId));
                const data = await of('GET', `/reports?${params.toString()}`);
                return { output: { reportType, data: data?.data ?? data } };
            }

            case 'listChatboxes': {
                const data = await of('GET', '/chatboxes');
                return { output: { chatboxes: data?.data ?? [] } };
            }

            case 'updateChatbox': {
                const chatboxId = String(inputs.chatboxId ?? '').trim();
                if (!chatboxId) throw new Error('chatboxId is required.');
                const body: any = {};
                if (inputs.enabled !== undefined) body.enabled = Boolean(inputs.enabled);
                if (inputs.title) body.configuration = { title: { text: String(inputs.title) } };
                if (inputs.theme) body.themes = { current_theme: String(inputs.theme) };
                const data = await of('PUT', `/chatboxes/${chatboxId}`, body);
                return { output: { chatboxId, updated: true, ...data } };
            }

            case 'getVisitor': {
                const visitorId = String(inputs.visitorId ?? '').trim();
                if (!visitorId) throw new Error('visitorId is required.');
                const data = await of('GET', `/visitors/${visitorId}`);
                return { output: data?.data ?? data };
            }

            default:
                return { error: `Unknown Olark action: ${actionName}` };
        }
    } catch (err: any) {
        return { error: err?.message ?? String(err) };
    }
}
