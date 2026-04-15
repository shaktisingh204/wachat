'use server';

export async function executeFlowiseAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const { serverUrl, apiKey, chatflowId, question, overrideConfig, history, storeId, keyName } = inputs;

        const baseUrl = `${serverUrl}/api/v1`;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }

        switch (actionName) {
            case 'askQuestion': {
                const body: any = { question };
                if (overrideConfig) body.overrideConfig = overrideConfig;
                if (history) body.history = history;
                const res = await fetch(`${baseUrl}/prediction/${chatflowId}`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `Flowise askQuestion failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'streamQuestion': {
                const body: any = { question };
                if (overrideConfig) body.overrideConfig = overrideConfig;
                if (history) body.history = history;
                const res = await fetch(`${baseUrl}/prediction/${chatflowId}`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `Flowise streamQuestion failed: ${res.status} ${await res.text()}` };
                const text = await res.text();
                return { output: { response: text } };
            }
            case 'listChatflows': {
                const res = await fetch(`${baseUrl}/chatflows`, { method: 'GET', headers });
                if (!res.ok) return { error: `Flowise listChatflows failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'getChatflow': {
                const id = inputs.id || chatflowId;
                const res = await fetch(`${baseUrl}/chatflows/${id}`, { method: 'GET', headers });
                if (!res.ok) return { error: `Flowise getChatflow failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'createChatflow': {
                const body = inputs.chatflowData || {};
                const res = await fetch(`${baseUrl}/chatflows`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `Flowise createChatflow failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'updateChatflow': {
                const id = inputs.id || chatflowId;
                const body = inputs.chatflowData || {};
                const res = await fetch(`${baseUrl}/chatflows/${id}`, { method: 'PUT', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `Flowise updateChatflow failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'deleteChatflow': {
                const id = inputs.id || chatflowId;
                const res = await fetch(`${baseUrl}/chatflows/${id}`, { method: 'DELETE', headers });
                if (!res.ok) return { error: `Flowise deleteChatflow failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'listDocumentStores': {
                const res = await fetch(`${baseUrl}/document-store/store`, { method: 'GET', headers });
                if (!res.ok) return { error: `Flowise listDocumentStores failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'getDocumentStore': {
                const id = inputs.id || storeId;
                const res = await fetch(`${baseUrl}/document-store/store/${id}`, { method: 'GET', headers });
                if (!res.ok) return { error: `Flowise getDocumentStore failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'upsertDocumentStore': {
                const sid = storeId || inputs.id;
                const body = inputs.content || {};
                const res = await fetch(`${baseUrl}/document-store/upsert/${sid}`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `Flowise upsertDocumentStore failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'getChatHistory': {
                const res = await fetch(`${baseUrl}/chatmessage/${chatflowId}`, { method: 'GET', headers });
                if (!res.ok) return { error: `Flowise getChatHistory failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'clearChatHistory': {
                const res = await fetch(`${baseUrl}/chatmessage/${chatflowId}`, { method: 'DELETE', headers });
                if (!res.ok) return { error: `Flowise clearChatHistory failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'getApiKeys': {
                const res = await fetch(`${baseUrl}/apikey`, { method: 'GET', headers });
                if (!res.ok) return { error: `Flowise getApiKeys failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'createApiKey': {
                const body = { keyName: keyName || inputs.name };
                const res = await fetch(`${baseUrl}/apikey`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `Flowise createApiKey failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            default:
                return { error: `Flowise: unknown action "${actionName}"` };
        }
    } catch (err: any) {
        return { error: err?.message || 'Flowise action failed' };
    }
}
