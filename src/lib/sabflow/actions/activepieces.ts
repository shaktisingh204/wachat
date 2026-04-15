'use server';

export async function executeActivePiecesAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const baseUrl = `${inputs.baseUrl || 'https://cloud.activepieces.com'}/api/v1`;
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${inputs.apiKey}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listFlows': {
                const params = new URLSearchParams();
                if (inputs.projectId) params.set('projectId', inputs.projectId);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const res = await fetch(`${baseUrl}/flows?${params.toString()}`, { headers });
                if (!res.ok) return { error: `listFlows failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getFlow': {
                const res = await fetch(`${baseUrl}/flows/${inputs.flowId}`, { headers });
                if (!res.ok) return { error: `getFlow failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'createFlow': {
                const res = await fetch(`${baseUrl}/flows`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.flow || {}),
                });
                if (!res.ok) return { error: `createFlow failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'updateFlow': {
                const res = await fetch(`${baseUrl}/flows/${inputs.flowId}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.flow || {}),
                });
                if (!res.ok) return { error: `updateFlow failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'deleteFlow': {
                const res = await fetch(`${baseUrl}/flows/${inputs.flowId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) return { error: `deleteFlow failed: ${res.status} ${await res.text()}` };
                return { output: { deleted: true, flowId: inputs.flowId } };
            }
            case 'runFlow': {
                const res = await fetch(`${baseUrl}/flow-runs`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        flowId: inputs.flowId,
                        payload: inputs.payload || {},
                    }),
                });
                if (!res.ok) return { error: `runFlow failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'listFlowRuns': {
                const params = new URLSearchParams();
                if (inputs.flowId) params.set('flowId', inputs.flowId);
                if (inputs.status) params.set('status', inputs.status);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const res = await fetch(`${baseUrl}/flow-runs?${params.toString()}`, { headers });
                if (!res.ok) return { error: `listFlowRuns failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getFlowRun': {
                const res = await fetch(`${baseUrl}/flow-runs/${inputs.flowRunId}`, { headers });
                if (!res.ok) return { error: `getFlowRun failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'cancelFlowRun': {
                const res = await fetch(`${baseUrl}/flow-runs/${inputs.flowRunId}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ status: 'CANCELLED' }),
                });
                if (!res.ok) return { error: `cancelFlowRun failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'listConnections': {
                const params = new URLSearchParams();
                if (inputs.projectId) params.set('projectId', inputs.projectId);
                const res = await fetch(`${baseUrl}/app-connections?${params.toString()}`, { headers });
                if (!res.ok) return { error: `listConnections failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getConnection': {
                const res = await fetch(`${baseUrl}/app-connections/${inputs.connectionId}`, { headers });
                if (!res.ok) return { error: `getConnection failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'createConnection': {
                const res = await fetch(`${baseUrl}/app-connections`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.connection || {}),
                });
                if (!res.ok) return { error: `createConnection failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'deleteConnection': {
                const res = await fetch(`${baseUrl}/app-connections/${inputs.connectionId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) return { error: `deleteConnection failed: ${res.status} ${await res.text()}` };
                return { output: { deleted: true, connectionId: inputs.connectionId } };
            }
            case 'listProjects': {
                const res = await fetch(`${baseUrl}/projects`, { headers });
                if (!res.ok) return { error: `listProjects failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getProject': {
                const res = await fetch(`${baseUrl}/projects/${inputs.projectId}`, { headers });
                if (!res.ok) return { error: `getProject failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            default:
                return { error: `Unknown ActivePieces action: ${actionName}` };
        }
    } catch (err: any) {
        return { error: err.message || 'Unknown error in executeActivePiecesAction' };
    }
}
