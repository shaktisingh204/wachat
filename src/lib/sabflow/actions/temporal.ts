'use server';

export async function executeTemporalAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const { apiKey, namespace, workflowId, runId, scheduleId, taskQueue, query } = inputs;

        const baseUrl = inputs.serverUrl || 'https://cloud.temporal.io/api/v1';
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }

        switch (actionName) {
            case 'startWorkflow': {
                const body: any = {
                    workflowId: inputs.workflowId,
                    workflowType: { name: inputs.workflowType || inputs.workflowTypeName },
                    taskQueue: { name: inputs.taskQueue || inputs.taskQueueName },
                };
                if (inputs.input) body.input = inputs.input;
                const res = await fetch(`${baseUrl}/namespaces/${namespace}/workflows`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `Temporal startWorkflow failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'getWorkflow': {
                const res = await fetch(`${baseUrl}/namespaces/${namespace}/workflows/${workflowId}/${runId}`, { method: 'GET', headers });
                if (!res.ok) return { error: `Temporal getWorkflow failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'terminateWorkflow': {
                const res = await fetch(`${baseUrl}/namespaces/${namespace}/workflows/${workflowId}/${runId}`, { method: 'DELETE', headers });
                if (!res.ok) return { error: `Temporal terminateWorkflow failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'signalWorkflow': {
                const body: any = { signalName: inputs.signalName };
                if (inputs.signalInput) body.input = inputs.signalInput;
                const res = await fetch(`${baseUrl}/namespaces/${namespace}/workflows/${workflowId}/${runId}/signal`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `Temporal signalWorkflow failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'queryWorkflow': {
                const body = { query: { queryType: inputs.queryType } };
                const res = await fetch(`${baseUrl}/namespaces/${namespace}/workflows/${workflowId}/${runId}/query`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `Temporal queryWorkflow failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'listWorkflows': {
                const q = query || inputs.workflowQuery || '';
                const res = await fetch(`${baseUrl}/namespaces/${namespace}/workflows?query=${encodeURIComponent(q)}`, { method: 'GET', headers });
                if (!res.ok) return { error: `Temporal listWorkflows failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'listNamespaces': {
                const res = await fetch(`${baseUrl}/namespaces`, { method: 'GET', headers });
                if (!res.ok) return { error: `Temporal listNamespaces failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'getNamespace': {
                const res = await fetch(`${baseUrl}/namespaces/${namespace}`, { method: 'GET', headers });
                if (!res.ok) return { error: `Temporal getNamespace failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'listTaskQueues': {
                const tq = taskQueue || inputs.taskQueueName;
                const res = await fetch(`${baseUrl}/namespaces/${namespace}/task-queues/${encodeURIComponent(tq)}`, { method: 'GET', headers });
                if (!res.ok) return { error: `Temporal listTaskQueues failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'listSchedules': {
                const res = await fetch(`${baseUrl}/namespaces/${namespace}/schedules`, { method: 'GET', headers });
                if (!res.ok) return { error: `Temporal listSchedules failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'getSchedule': {
                const sid = scheduleId || inputs.id;
                const res = await fetch(`${baseUrl}/namespaces/${namespace}/schedules/${sid}`, { method: 'GET', headers });
                if (!res.ok) return { error: `Temporal getSchedule failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            default:
                return { error: `Temporal: unknown action "${actionName}"` };
        }
    } catch (err: any) {
        return { error: err?.message || 'Temporal action failed' };
    }
}
