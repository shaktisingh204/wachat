'use server';

export async function executeN8NApiAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = inputs.apiKey;
        const baseUrl = `${inputs.baseUrl}/api/v1`;
        const headers: Record<string, string> = {
            'X-N8N-API-KEY': apiKey,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listWorkflows': {
                const res = await fetch(`${baseUrl}/workflows`, { headers });
                if (!res.ok) return { error: `listWorkflows failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getWorkflow': {
                const res = await fetch(`${baseUrl}/workflows/${inputs.workflowId}`, { headers });
                if (!res.ok) return { error: `getWorkflow failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'createWorkflow': {
                const res = await fetch(`${baseUrl}/workflows`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.workflow || {}),
                });
                if (!res.ok) return { error: `createWorkflow failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'updateWorkflow': {
                const res = await fetch(`${baseUrl}/workflows/${inputs.workflowId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(inputs.workflow || {}),
                });
                if (!res.ok) return { error: `updateWorkflow failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'deleteWorkflow': {
                const res = await fetch(`${baseUrl}/workflows/${inputs.workflowId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) return { error: `deleteWorkflow failed: ${res.status} ${await res.text()}` };
                return { output: { deleted: true, workflowId: inputs.workflowId } };
            }
            case 'activateWorkflow': {
                const res = await fetch(`${baseUrl}/workflows/${inputs.workflowId}/activate`, {
                    method: 'POST',
                    headers,
                });
                if (!res.ok) return { error: `activateWorkflow failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'deactivateWorkflow': {
                const res = await fetch(`${baseUrl}/workflows/${inputs.workflowId}/deactivate`, {
                    method: 'POST',
                    headers,
                });
                if (!res.ok) return { error: `deactivateWorkflow failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'executeWorkflow': {
                const res = await fetch(`${baseUrl}/workflows/${inputs.workflowId}/execute`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.data || {}),
                });
                if (!res.ok) return { error: `executeWorkflow failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'listExecutions': {
                const params = new URLSearchParams();
                if (inputs.workflowId) params.set('workflowId', inputs.workflowId);
                if (inputs.status) params.set('status', inputs.status);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const res = await fetch(`${baseUrl}/executions?${params.toString()}`, { headers });
                if (!res.ok) return { error: `listExecutions failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getExecution': {
                const res = await fetch(`${baseUrl}/executions/${inputs.executionId}`, { headers });
                if (!res.ok) return { error: `getExecution failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'deleteExecution': {
                const res = await fetch(`${baseUrl}/executions/${inputs.executionId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) return { error: `deleteExecution failed: ${res.status} ${await res.text()}` };
                return { output: { deleted: true, executionId: inputs.executionId } };
            }
            case 'listCredentials': {
                const res = await fetch(`${baseUrl}/credentials`, { headers });
                if (!res.ok) return { error: `listCredentials failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getCredential': {
                const res = await fetch(`${baseUrl}/credentials/${inputs.credentialId}`, { headers });
                if (!res.ok) return { error: `getCredential failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'createCredential': {
                const res = await fetch(`${baseUrl}/credentials`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.credential || {}),
                });
                if (!res.ok) return { error: `createCredential failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'listNodes': {
                const res = await fetch(`${baseUrl}/nodes`, { headers });
                if (!res.ok) return { error: `listNodes failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            default:
                return { error: `Unknown n8n API action: ${actionName}` };
        }
    } catch (err: any) {
        return { error: err.message || 'Unknown error in executeN8NApiAction' };
    }
}
