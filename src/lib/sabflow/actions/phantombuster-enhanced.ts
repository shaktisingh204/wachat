'use server';

export async function executePhantombusterEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE = 'https://api.phantombuster.com/api/v2';
    const apiKey = inputs.apiKey;

    try {
        let url = '';
        let method = 'GET';
        let body: any = undefined;

        switch (actionName) {
            case 'listPhantoms':
                url = `${BASE}/phantoms?limit=${inputs.limit || 20}&offset=${inputs.offset || 0}`;
                break;
            case 'getPhantom':
                url = `${BASE}/phantoms/${inputs.phantomId}`;
                break;
            case 'launchPhantom': {
                url = `${BASE}/agents/launch`;
                method = 'POST';
                body = JSON.stringify({ id: inputs.phantomId, arguments: inputs.arguments || {} });
                break;
            }
            case 'stopPhantom': {
                url = `${BASE}/agents/abort`;
                method = 'POST';
                body = JSON.stringify({ id: inputs.phantomId });
                break;
            }
            case 'deletePhantom': {
                url = `${BASE}/phantoms/${inputs.phantomId}`;
                method = 'DELETE';
                break;
            }
            case 'getOutput':
                url = `${BASE}/agents/${inputs.agentId}/output?limit=${inputs.limit || 1}`;
                break;
            case 'listContainers':
                url = `${BASE}/containers?limit=${inputs.limit || 20}&offset=${inputs.offset || 0}`;
                break;
            case 'getContainer':
                url = `${BASE}/containers/${inputs.containerId}`;
                break;
            case 'fetchOutput':
                url = `${BASE}/containers/${inputs.containerId}/output`;
                break;
            case 'listOrgs':
                url = `${BASE}/orgs`;
                break;
            case 'getOrg':
                url = `${BASE}/orgs/${inputs.orgId}`;
                break;
            case 'listAgents':
                url = `${BASE}/agents?limit=${inputs.limit || 20}&offset=${inputs.offset || 0}`;
                break;
            case 'getAgent':
                url = `${BASE}/agents/${inputs.agentId}`;
                break;
            case 'launchAgent': {
                url = `${BASE}/agents/launch`;
                method = 'POST';
                body = JSON.stringify({ id: inputs.agentId, arguments: inputs.arguments || {}, saveArguments: inputs.saveArguments || false });
                break;
            }
            case 'fetchAgentOutput':
                url = `${BASE}/agents/${inputs.agentId}/output?limit=${inputs.limit || 1}&fromContainer=${inputs.fromContainer || ''}`;
                break;
            default:
                return { error: `Unknown PhantomBuster Enhanced action: ${actionName}` };
        }

        const headers: Record<string, string> = {
            'X-Phantombuster-Key': apiKey,
            'Content-Type': 'application/json',
        };

        const fetchOptions: RequestInit = { method, headers };
        if (body) fetchOptions.body = body;

        const res = await fetch(url, fetchOptions);
        const text = await res.text();
        let data: any = {};
        try { data = JSON.parse(text); } catch { data = { raw: text }; }
        if (!res.ok) return { error: data?.error || data?.message || `HTTP ${res.status}` };
        return { output: data };
    } catch (err: any) {
        return { error: err?.message || 'Unknown error in executePhantombusterEnhancedAction' };
    }
}
