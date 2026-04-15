
'use server';

const ZAPIER_NLA_BASE = 'https://nla.zapier.com/api/v1';

async function zapierFetch(apiKey: string, method: string, path: string, body?: any, logger?: any): Promise<any> {
    logger?.log(`[Zapier] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            'x-api-key': apiKey,
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${ZAPIER_NLA_BASE}${path}`, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.detail || data?.message || `Zapier API error: ${res.status}`);
    }
    return data;
}

export async function executeZapierAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        switch (actionName) {
            case 'listActions': {
                const apiKey = String(inputs.apiKey ?? '').trim();
                if (!apiKey) throw new Error('apiKey is required.');
                const data = await zapierFetch(apiKey, 'GET', '/dynamic/exposed', undefined, logger);
                return { output: { actions: data.results ?? [], count: (data.results ?? []).length } };
            }

            case 'runAction': {
                const apiKey = String(inputs.apiKey ?? '').trim();
                const actionId = String(inputs.actionId ?? '').trim();
                const instructions = String(inputs.instructions ?? '').trim();
                if (!apiKey) throw new Error('apiKey is required.');
                if (!actionId) throw new Error('actionId is required.');
                if (!instructions) throw new Error('instructions are required.');
                const body: any = { instructions };
                if (inputs.params && typeof inputs.params === 'object') body.params = inputs.params;
                const data = await zapierFetch(apiKey, 'POST', `/dynamic/exposed/${actionId}/execute/`, body, logger);
                return { output: { id: data.id ?? '', status: data.status ?? '', result: data.result ?? {} } };
            }

            case 'checkAction': {
                const apiKey = String(inputs.apiKey ?? '').trim();
                const actionId = String(inputs.actionId ?? '').trim();
                if (!apiKey) throw new Error('apiKey is required.');
                if (!actionId) throw new Error('actionId is required.');
                const params = inputs.params ? `?${new URLSearchParams(inputs.params).toString()}` : '';
                const data = await zapierFetch(apiKey, 'GET', `/dynamic/exposed/${actionId}/execute/check/${params}`, undefined, logger);
                return { output: { inputSchema: data.input_schema ?? {}, description: data.description ?? '' } };
            }

            case 'getActionSchema': {
                const apiKey = String(inputs.apiKey ?? '').trim();
                const actionId = String(inputs.actionId ?? '').trim();
                if (!apiKey) throw new Error('apiKey is required.');
                if (!actionId) throw new Error('actionId is required.');
                const data = await zapierFetch(apiKey, 'GET', `/dynamic/exposed/${actionId}/`, undefined, logger);
                return { output: { id: data.id ?? '', description: data.description ?? '', inputSchema: data.input_schema ?? {} } };
            }

            case 'searchActions': {
                const apiKey = String(inputs.apiKey ?? '').trim();
                const query = String(inputs.query ?? '').trim();
                if (!apiKey) throw new Error('apiKey is required.');
                if (!query) throw new Error('query is required.');
                const data = await zapierFetch(apiKey, 'GET', `/dynamic/exposed/?search=${encodeURIComponent(query)}`, undefined, logger);
                return { output: { actions: data.results ?? [], count: (data.results ?? []).length } };
            }

            case 'triggerZap': {
                const webhookUrl = String(inputs.webhookUrl ?? '').trim();
                if (!webhookUrl) throw new Error('webhookUrl is required.');
                const payload = inputs.payload && typeof inputs.payload === 'object' ? inputs.payload : { data: inputs.payload ?? {} };
                logger?.log(`[Zapier] POST ${webhookUrl}`);
                const res = await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                const text = await res.text();
                let result: any = { raw: text };
                try { result = JSON.parse(text); } catch {}
                if (!res.ok) throw new Error(`Zapier webhook error: ${res.status} - ${text}`);
                return { output: { triggered: 'true', status: String(res.status), result } };
            }

            case 'getZapStatus': {
                const zapStatusUrl = String(inputs.zapStatusUrl ?? '').trim();
                if (!zapStatusUrl) throw new Error('zapStatusUrl is required.');
                logger?.log(`[Zapier] GET ${zapStatusUrl}`);
                const res = await fetch(zapStatusUrl, {
                    method: 'GET',
                    headers: { Accept: 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(`Zapier status error: ${res.status}`);
                return { output: data };
            }

            default:
                return { error: `Zapier action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Zapier action failed.' };
    }
}
