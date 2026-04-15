
'use server';

const PHANTOMBUSTER_BASE = 'https://api.phantombuster.com/api/v2';

async function pbFetch(apiKey: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[PhantomBuster] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            'X-Phantombuster-Key': apiKey,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${PHANTOMBUSTER_BASE}${path}`, options);
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.error || data?.message || `PhantomBuster API error: ${res.status}`);
    }
    return data;
}

export async function executePhantomBusterAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');
        const pb = (method: string, path: string, body?: any) => pbFetch(apiKey, method, path, body, logger);

        switch (actionName) {
            case 'listPhantoms': {
                const data = await pb('GET', `/phantoms`);
                return { output: { phantoms: data.phantoms ?? data ?? [] } };
            }

            case 'getPhantom': {
                const phantomId = String(inputs.phantomId ?? inputs.id ?? '').trim();
                if (!phantomId) throw new Error('phantomId is required.');
                const data = await pb('GET', `/phantoms/${phantomId}`);
                return { output: data };
            }

            case 'launchPhantom': {
                const phantomId = String(inputs.phantomId ?? inputs.id ?? '').trim();
                if (!phantomId) throw new Error('phantomId is required.');
                const body: Record<string, any> = { id: phantomId };
                if (inputs.args) body.args = typeof inputs.args === 'string' ? JSON.parse(inputs.args) : inputs.args;
                if (inputs.saveArguments !== undefined) body.saveArguments = inputs.saveArguments;
                const data = await pb('POST', `/phantoms/launch`, body);
                return { output: { containerId: data.containerId, status: data.status ?? 'launched' } };
            }

            case 'stopPhantom': {
                const phantomId = String(inputs.phantomId ?? inputs.id ?? '').trim();
                if (!phantomId) throw new Error('phantomId is required.');
                const data = await pb('POST', `/phantoms/abort`, { id: phantomId });
                return { output: { status: data.status ?? 'stopped' } };
            }

            case 'getOutput': {
                const phantomId = String(inputs.phantomId ?? inputs.id ?? '').trim();
                if (!phantomId) throw new Error('phantomId is required.');
                const params = new URLSearchParams({ id: phantomId });
                if (inputs.withOutput !== undefined) params.set('withOutput', String(inputs.withOutput));
                if (inputs.mode) params.set('mode', String(inputs.mode));
                const data = await pb('GET', `/phantoms/output?${params.toString()}`);
                return { output: data };
            }

            case 'deleteOutput': {
                const phantomId = String(inputs.phantomId ?? inputs.id ?? '').trim();
                if (!phantomId) throw new Error('phantomId is required.');
                const data = await pb('DELETE', `/phantoms/output`, { id: phantomId });
                return { output: { success: true, message: data?.message ?? 'Output deleted.' } };
            }

            case 'getAgent': {
                const agentId = String(inputs.agentId ?? inputs.id ?? '').trim();
                if (!agentId) throw new Error('agentId is required.');
                const data = await pb('GET', `/agents/${agentId}`);
                return { output: data };
            }

            case 'listAgents': {
                const data = await pb('GET', `/agents`);
                return { output: { agents: data.agents ?? data ?? [] } };
            }

            case 'launchAgent': {
                const agentId = String(inputs.agentId ?? inputs.id ?? '').trim();
                if (!agentId) throw new Error('agentId is required.');
                const body: Record<string, any> = { id: agentId };
                if (inputs.args) body.args = typeof inputs.args === 'string' ? JSON.parse(inputs.args) : inputs.args;
                const data = await pb('POST', `/agents/launch`, body);
                return { output: { containerId: data.containerId, status: data.status ?? 'launched' } };
            }

            case 'stopAgent': {
                const agentId = String(inputs.agentId ?? inputs.id ?? '').trim();
                if (!agentId) throw new Error('agentId is required.');
                const data = await pb('POST', `/agents/abort`, { id: agentId });
                return { output: { status: data.status ?? 'stopped' } };
            }

            default:
                return { error: `PhantomBuster action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'PhantomBuster action failed.' };
    }
}
