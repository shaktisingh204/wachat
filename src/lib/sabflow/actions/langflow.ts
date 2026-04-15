'use server';

export async function executeLangFlowAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const { serverUrl, apiKey, flowId, sessionId, message, tweaks } = inputs;

        const baseUrl = `${serverUrl}/api/v1`;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }

        switch (actionName) {
            case 'runFlow': {
                const body: any = { inputs: { input_value: message } };
                if (tweaks) body.tweaks = tweaks;
                const res = await fetch(`${baseUrl}/run/${flowId}`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `LangFlow runFlow failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'runFlowById': {
                const body: any = { inputs: { input_value: message } };
                if (tweaks) body.tweaks = tweaks;
                if (inputs.sessionId) body.session_id = inputs.sessionId;
                const res = await fetch(`${baseUrl}/run/${flowId}`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `LangFlow runFlowById failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'getFlow': {
                const res = await fetch(`${baseUrl}/flows/${flowId}`, { method: 'GET', headers });
                if (!res.ok) return { error: `LangFlow getFlow failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'listFlows': {
                const res = await fetch(`${baseUrl}/flows/`, { method: 'GET', headers });
                if (!res.ok) return { error: `LangFlow listFlows failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'createFlow': {
                const body = inputs.flowData || {};
                const res = await fetch(`${baseUrl}/flows/`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `LangFlow createFlow failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'updateFlow': {
                const body = inputs.flowData || {};
                const res = await fetch(`${baseUrl}/flows/${flowId}`, { method: 'PATCH', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `LangFlow updateFlow failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'deleteFlow': {
                const res = await fetch(`${baseUrl}/flows/${flowId}`, { method: 'DELETE', headers });
                if (!res.ok) return { error: `LangFlow deleteFlow failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'buildFlow': {
                const res = await fetch(`${baseUrl}/build/${flowId}/flow`, { method: 'POST', headers, body: JSON.stringify({}) });
                if (!res.ok) return { error: `LangFlow buildFlow failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'checkBuildStatus': {
                const sid = sessionId || inputs.buildSessionId;
                const res = await fetch(`${baseUrl}/build/${sid}/status`, { method: 'GET', headers });
                if (!res.ok) return { error: `LangFlow checkBuildStatus failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'sendMessage': {
                const body: any = { inputs: { input_value: message } };
                if (tweaks) body.tweaks = tweaks;
                const res = await fetch(`${baseUrl}/run/${flowId}`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `LangFlow sendMessage failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'streamMessage': {
                const body: any = { inputs: { input_value: message } };
                if (tweaks) body.tweaks = tweaks;
                const res = await fetch(`${baseUrl}/run/${flowId}?stream=true`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `LangFlow streamMessage failed: ${res.status} ${await res.text()}` };
                const text = await res.text();
                const firstChunk = text.split('\n')[0] || text;
                return { output: { chunk: firstChunk } };
            }
            case 'listComponents': {
                const res = await fetch(`${baseUrl}/all`, { method: 'GET', headers });
                if (!res.ok) return { error: `LangFlow listComponents failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'getComponent': {
                const filterName = inputs.componentName || inputs.name;
                const res = await fetch(`${baseUrl}/all?filter=${encodeURIComponent(filterName)}`, { method: 'GET', headers });
                if (!res.ok) return { error: `LangFlow getComponent failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'getHealth': {
                const res = await fetch(`${baseUrl}/health`, { method: 'GET', headers });
                if (!res.ok) return { error: `LangFlow getHealth failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            default:
                return { error: `LangFlow: unknown action "${actionName}"` };
        }
    } catch (err: any) {
        return { error: err?.message || 'LangFlow action failed' };
    }
}
