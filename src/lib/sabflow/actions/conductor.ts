'use server';

export async function executeConductorAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const baseUrl = inputs.serverUrl || 'http://conductor:8080/api';
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };
        if (inputs.token) {
            headers['X-Authorization'] = inputs.token;
        }

        switch (actionName) {
            case 'listWorkflowDefs': {
                const res = await fetch(`${baseUrl}/metadata/workflow`, { method: 'GET', headers });
                if (!res.ok) return { error: `Conductor listWorkflowDefs failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getWorkflowDef': {
                const version = inputs.version ? `?version=${inputs.version}` : '';
                const res = await fetch(`${baseUrl}/metadata/workflow/${inputs.name}${version}`, { method: 'GET', headers });
                if (!res.ok) return { error: `Conductor getWorkflowDef failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'registerWorkflow': {
                const body = Array.isArray(inputs.definition) ? inputs.definition : [inputs.definition];
                const res = await fetch(`${baseUrl}/metadata/workflow`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `Conductor registerWorkflow failed: ${res.status} ${await res.text()}` };
                return { output: { success: true, status: res.status } };
            }
            case 'startWorkflow': {
                const body: any = {
                    name: inputs.name,
                    version: inputs.version,
                    input: inputs.input || {},
                };
                if (inputs.correlationId) body.correlationId = inputs.correlationId;
                if (inputs.priority) body.priority = inputs.priority;
                const res = await fetch(`${baseUrl}/workflow`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `Conductor startWorkflow failed: ${res.status} ${await res.text()}` };
                const workflowId = await res.text();
                return { output: { workflowId } };
            }
            case 'getWorkflow': {
                const includeTasks = inputs.includeTasks !== false;
                const res = await fetch(`${baseUrl}/workflow/${inputs.workflowId}?includeTasks=${includeTasks}`, { method: 'GET', headers });
                if (!res.ok) return { error: `Conductor getWorkflow failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'terminateWorkflow': {
                const params = new URLSearchParams();
                if (inputs.reason) params.set('reason', inputs.reason);
                const qs = params.toString() ? `?${params.toString()}` : '';
                const res = await fetch(`${baseUrl}/workflow/${inputs.workflowId}${qs}`, { method: 'DELETE', headers });
                if (!res.ok) return { error: `Conductor terminateWorkflow failed: ${res.status} ${await res.text()}` };
                return { output: { success: true, workflowId: inputs.workflowId } };
            }
            case 'pauseWorkflow': {
                const res = await fetch(`${baseUrl}/workflow/${inputs.workflowId}/pause`, { method: 'PUT', headers });
                if (!res.ok) return { error: `Conductor pauseWorkflow failed: ${res.status} ${await res.text()}` };
                return { output: { success: true, workflowId: inputs.workflowId } };
            }
            case 'resumeWorkflow': {
                const res = await fetch(`${baseUrl}/workflow/${inputs.workflowId}/resume`, { method: 'PUT', headers });
                if (!res.ok) return { error: `Conductor resumeWorkflow failed: ${res.status} ${await res.text()}` };
                return { output: { success: true, workflowId: inputs.workflowId } };
            }
            case 'searchWorkflows': {
                const params = new URLSearchParams();
                if (inputs.start) params.set('start', String(inputs.start));
                if (inputs.size) params.set('size', String(inputs.size));
                if (inputs.query) params.set('query', inputs.query);
                if (inputs.freeText) params.set('freeText', inputs.freeText);
                if (inputs.sort) params.set('sort', inputs.sort);
                const qs = params.toString() ? `?${params.toString()}` : '';
                const res = await fetch(`${baseUrl}/workflow/search${qs}`, { method: 'GET', headers });
                if (!res.ok) return { error: `Conductor searchWorkflows failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'listTaskDefs': {
                const res = await fetch(`${baseUrl}/metadata/taskdefs`, { method: 'GET', headers });
                if (!res.ok) return { error: `Conductor listTaskDefs failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getTaskDef': {
                const res = await fetch(`${baseUrl}/metadata/taskdefs/${inputs.taskType}`, { method: 'GET', headers });
                if (!res.ok) return { error: `Conductor getTaskDef failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'registerTask': {
                const body = Array.isArray(inputs.taskDefs) ? inputs.taskDefs : [inputs.taskDefs];
                const res = await fetch(`${baseUrl}/metadata/taskdefs`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `Conductor registerTask failed: ${res.status} ${await res.text()}` };
                return { output: { success: true, status: res.status } };
            }
            case 'pollTask': {
                const params = new URLSearchParams({ workerid: inputs.workerId || 'sabflow-worker' });
                if (inputs.domain) params.set('domain', inputs.domain);
                const res = await fetch(`${baseUrl}/tasks/poll/${inputs.taskType}?${params.toString()}`, { method: 'GET', headers });
                if (!res.ok) return { error: `Conductor pollTask failed: ${res.status} ${await res.text()}` };
                const text = await res.text();
                return { output: text ? JSON.parse(text) : null };
            }
            case 'updateTask': {
                const body: any = {
                    taskId: inputs.taskId,
                    workflowInstanceId: inputs.workflowInstanceId,
                    status: inputs.status || 'COMPLETED',
                    outputData: inputs.outputData || {},
                    workerId: inputs.workerId || 'sabflow-worker',
                };
                const res = await fetch(`${baseUrl}/tasks`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `Conductor updateTask failed: ${res.status} ${await res.text()}` };
                const text = await res.text();
                return { output: text ? JSON.parse(text) : { success: true } };
            }
            case 'listRunningWorkflows': {
                const version = inputs.version ? `/${inputs.version}` : '';
                const params = new URLSearchParams();
                if (inputs.startTime) params.set('startTime', String(inputs.startTime));
                if (inputs.endTime) params.set('endTime', String(inputs.endTime));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const res = await fetch(`${baseUrl}/workflow/running/${inputs.name}${version}${qs}`, { method: 'GET', headers });
                if (!res.ok) return { error: `Conductor listRunningWorkflows failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            default:
                return { error: `Conductor: unknown action "${actionName}"` };
        }
    } catch (err: any) {
        return { error: err?.message || 'Conductor action failed' };
    }
}
