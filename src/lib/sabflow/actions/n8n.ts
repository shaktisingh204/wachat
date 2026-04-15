'use server';

export async function executeN8nAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const { serverUrl, apiKey, workflowId, executionId, credentialId, limit } = inputs;

        const baseUrl = `${serverUrl}/api/v1`;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'X-N8N-API-KEY': apiKey,
        };

        switch (actionName) {
            case 'listWorkflows': {
                const res = await fetch(`${baseUrl}/workflows`, { method: 'GET', headers });
                if (!res.ok) return { error: `n8n listWorkflows failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'getWorkflow': {
                const id = inputs.id || workflowId;
                const res = await fetch(`${baseUrl}/workflows/${id}`, { method: 'GET', headers });
                if (!res.ok) return { error: `n8n getWorkflow failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'createWorkflow': {
                const body = inputs.workflowData || {};
                const res = await fetch(`${baseUrl}/workflows`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `n8n createWorkflow failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'updateWorkflow': {
                const id = inputs.id || workflowId;
                const body = inputs.workflowData || {};
                const res = await fetch(`${baseUrl}/workflows/${id}`, { method: 'PUT', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `n8n updateWorkflow failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'deleteWorkflow': {
                const id = inputs.id || workflowId;
                const res = await fetch(`${baseUrl}/workflows/${id}`, { method: 'DELETE', headers });
                if (!res.ok) return { error: `n8n deleteWorkflow failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'activateWorkflow': {
                const id = inputs.id || workflowId;
                const res = await fetch(`${baseUrl}/workflows/${id}/activate`, { method: 'PATCH', headers, body: JSON.stringify({}) });
                if (!res.ok) return { error: `n8n activateWorkflow failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'deactivateWorkflow': {
                const id = inputs.id || workflowId;
                const res = await fetch(`${baseUrl}/workflows/${id}/deactivate`, { method: 'PATCH', headers, body: JSON.stringify({}) });
                if (!res.ok) return { error: `n8n deactivateWorkflow failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'executeWorkflow': {
                const id = inputs.id || workflowId;
                const body: any = {};
                if (inputs.runData) body.runData = inputs.runData;
                const res = await fetch(`${baseUrl}/workflows/${id}/run`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `n8n executeWorkflow failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'getExecution': {
                const id = inputs.id || executionId;
                const res = await fetch(`${baseUrl}/executions/${id}`, { method: 'GET', headers });
                if (!res.ok) return { error: `n8n getExecution failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'listExecutions': {
                const wfId = inputs.filterWorkflowId || workflowId || '';
                const lim = limit || 20;
                let url = `${baseUrl}/executions?limit=${lim}`;
                if (wfId) url += `&workflowId=${wfId}`;
                const res = await fetch(url, { method: 'GET', headers });
                if (!res.ok) return { error: `n8n listExecutions failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'deleteExecution': {
                const id = inputs.id || executionId;
                const res = await fetch(`${baseUrl}/executions/${id}`, { method: 'DELETE', headers });
                if (!res.ok) return { error: `n8n deleteExecution failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'listCredentials': {
                const res = await fetch(`${baseUrl}/credentials`, { method: 'GET', headers });
                if (!res.ok) return { error: `n8n listCredentials failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'createCredential': {
                const body = {
                    name: inputs.credentialName || inputs.name,
                    type: inputs.credentialType || inputs.type,
                    data: inputs.credentialData || inputs.data || {},
                };
                const res = await fetch(`${baseUrl}/credentials`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `n8n createCredential failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'deleteCredential': {
                const id = inputs.id || credentialId;
                const res = await fetch(`${baseUrl}/credentials/${id}`, { method: 'DELETE', headers });
                if (!res.ok) return { error: `n8n deleteCredential failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'getHealth': {
                const res = await fetch(`${baseUrl}/health`, { method: 'GET', headers });
                if (!res.ok) return { error: `n8n getHealth failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            default:
                return { error: `n8n: unknown action "${actionName}"` };
        }
    } catch (err: any) {
        return { error: err?.message || 'n8n action failed' };
    }
}
