'use server';

export async function executeGoogleFormsAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const accessToken = inputs.accessToken;
        const baseUrl = 'https://forms.googleapis.com/v1';
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'getForm': {
                const formId = inputs.formId;
                const res = await fetch(`${baseUrl}/forms/${formId}`, { headers });
                if (!res.ok) return { error: `getForm failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'createForm': {
                const res = await fetch(`${baseUrl}/forms`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ info: { title: inputs.title } }),
                });
                if (!res.ok) return { error: `createForm failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'updateForm': {
                const formId = inputs.formId;
                const url = `${baseUrl}/forms/${formId}?includeFormInResponse=true`;
                const res = await fetch(url, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify({ requests: inputs.requests || [] }),
                });
                if (!res.ok) return { error: `updateForm failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'deleteForm': {
                const formId = inputs.formId;
                const res = await fetch(`${baseUrl}/forms/${formId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) return { error: `deleteForm failed: ${res.status} ${await res.text()}` };
                return { output: { success: true } };
            }
            case 'listResponses': {
                const formId = inputs.formId;
                const res = await fetch(`${baseUrl}/forms/${formId}/responses`, { headers });
                if (!res.ok) return { error: `listResponses failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getResponse': {
                const formId = inputs.formId;
                const responseId = inputs.responseId;
                const res = await fetch(`${baseUrl}/forms/${formId}/responses/${responseId}`, { headers });
                if (!res.ok) return { error: `getResponse failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'listWatches': {
                const formId = inputs.formId;
                const res = await fetch(`${baseUrl}/forms/${formId}/watches`, { headers });
                if (!res.ok) return { error: `listWatches failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'createWatch': {
                const formId = inputs.formId;
                const res = await fetch(`${baseUrl}/forms/${formId}/watches`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ watch: { target: inputs.target, eventType: inputs.eventType } }),
                });
                if (!res.ok) return { error: `createWatch failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'deleteWatch': {
                const formId = inputs.formId;
                const watchId = inputs.watchId;
                const res = await fetch(`${baseUrl}/forms/${formId}/watches/${watchId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) return { error: `deleteWatch failed: ${res.status} ${await res.text()}` };
                return { output: { success: true } };
            }
            case 'renewWatch': {
                const formId = inputs.formId;
                const watchId = inputs.watchId;
                const res = await fetch(`${baseUrl}/forms/${formId}/watches/${watchId}:renew`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({}),
                });
                if (!res.ok) return { error: `renewWatch failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'addQuestion': {
                const formId = inputs.formId;
                const res = await fetch(`${baseUrl}/forms/${formId}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        requests: [{ createItem: { item: inputs.item, location: inputs.location || { index: 0 } } }],
                    }),
                });
                if (!res.ok) return { error: `addQuestion failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'updateQuestion': {
                const formId = inputs.formId;
                const res = await fetch(`${baseUrl}/forms/${formId}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        requests: [{ updateItem: { item: inputs.item, location: inputs.location, updateMask: inputs.updateMask } }],
                    }),
                });
                if (!res.ok) return { error: `updateQuestion failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'deleteQuestion': {
                const formId = inputs.formId;
                const res = await fetch(`${baseUrl}/forms/${formId}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        requests: [{ deleteItem: { location: inputs.location } }],
                    }),
                });
                if (!res.ok) return { error: `deleteQuestion failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            default:
                return { error: `Unknown Google Forms action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`executeGoogleFormsAction error: ${err.message}`);
        return { error: err.message || 'Google Forms action failed' };
    }
}
