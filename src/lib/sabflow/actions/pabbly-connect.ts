'use server';

export async function executePabblyConnectAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const baseUrl = 'https://connect.pabbly.com/api/v1';
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${inputs.accessToken}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listWorkflows': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                const res = await fetch(`${baseUrl}/workflows?${params.toString()}`, { headers });
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
            case 'pauseWorkflow': {
                const res = await fetch(`${baseUrl}/workflows/${inputs.workflowId}/pause`, {
                    method: 'POST',
                    headers,
                });
                if (!res.ok) return { error: `pauseWorkflow failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'resumeWorkflow': {
                const res = await fetch(`${baseUrl}/workflows/${inputs.workflowId}/resume`, {
                    method: 'POST',
                    headers,
                });
                if (!res.ok) return { error: `resumeWorkflow failed: ${res.status} ${await res.text()}` };
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
            case 'listTriggers': {
                const res = await fetch(`${baseUrl}/workflows/${inputs.workflowId}/triggers`, { headers });
                if (!res.ok) return { error: `listTriggers failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getTrigger': {
                const res = await fetch(`${baseUrl}/workflows/${inputs.workflowId}/triggers/${inputs.triggerId}`, { headers });
                if (!res.ok) return { error: `getTrigger failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'listActions': {
                const res = await fetch(`${baseUrl}/workflows/${inputs.workflowId}/actions`, { headers });
                if (!res.ok) return { error: `listActions failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getAction': {
                const res = await fetch(`${baseUrl}/workflows/${inputs.workflowId}/actions/${inputs.actionId}`, { headers });
                if (!res.ok) return { error: `getAction failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'runWorkflow': {
                const res = await fetch(`${baseUrl}/workflows/${inputs.workflowId}/run`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.data || {}),
                });
                if (!res.ok) return { error: `runWorkflow failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'listConnections': {
                const res = await fetch(`${baseUrl}/connections`, { headers });
                if (!res.ok) return { error: `listConnections failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getConnection': {
                const res = await fetch(`${baseUrl}/connections/${inputs.connectionId}`, { headers });
                if (!res.ok) return { error: `getConnection failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'listHistory': {
                const params = new URLSearchParams();
                if (inputs.workflowId) params.set('workflow_id', inputs.workflowId);
                if (inputs.status) params.set('status', inputs.status);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const res = await fetch(`${baseUrl}/history?${params.toString()}`, { headers });
                if (!res.ok) return { error: `listHistory failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getHistoryItem': {
                const res = await fetch(`${baseUrl}/history/${inputs.historyId}`, { headers });
                if (!res.ok) return { error: `getHistoryItem failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            default:
                return { error: `Unknown Pabbly Connect action: ${actionName}` };
        }
    } catch (err: any) {
        return { error: err.message || 'Unknown error in executePabblyConnectAction' };
    }
}
