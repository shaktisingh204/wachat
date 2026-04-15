'use server';

export async function executeFlowdashAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const baseUrl = 'https://app.flowdash.com/api/v1';
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${inputs.apiKey}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listApps': {
                const res = await fetch(`${baseUrl}/apps`, { headers });
                if (!res.ok) return { error: `listApps failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getApp': {
                const res = await fetch(`${baseUrl}/apps/${inputs.appId}`, { headers });
                if (!res.ok) return { error: `getApp failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'listTasks': {
                const params = new URLSearchParams();
                if (inputs.appId) params.set('app_id', inputs.appId);
                if (inputs.status) params.set('status', inputs.status);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const res = await fetch(`${baseUrl}/tasks?${params.toString()}`, { headers });
                if (!res.ok) return { error: `listTasks failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getTask': {
                const res = await fetch(`${baseUrl}/tasks/${inputs.taskId}`, { headers });
                if (!res.ok) return { error: `getTask failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'createTask': {
                const res = await fetch(`${baseUrl}/tasks`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.task || {}),
                });
                if (!res.ok) return { error: `createTask failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'updateTask': {
                const res = await fetch(`${baseUrl}/tasks/${inputs.taskId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify(inputs.task || {}),
                });
                if (!res.ok) return { error: `updateTask failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'completeTask': {
                const res = await fetch(`${baseUrl}/tasks/${inputs.taskId}/complete`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.data || {}),
                });
                if (!res.ok) return { error: `completeTask failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
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
            case 'triggerWorkflow': {
                const res = await fetch(`${baseUrl}/workflows/${inputs.workflowId}/trigger`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.data || {}),
                });
                if (!res.ok) return { error: `triggerWorkflow failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'listForms': {
                const res = await fetch(`${baseUrl}/forms`, { headers });
                if (!res.ok) return { error: `listForms failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getForm': {
                const res = await fetch(`${baseUrl}/forms/${inputs.formId}`, { headers });
                if (!res.ok) return { error: `getForm failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'submitForm': {
                const res = await fetch(`${baseUrl}/forms/${inputs.formId}/submit`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.submission || {}),
                });
                if (!res.ok) return { error: `submitForm failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'listUsers': {
                const res = await fetch(`${baseUrl}/users`, { headers });
                if (!res.ok) return { error: `listUsers failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getUser': {
                const res = await fetch(`${baseUrl}/users/${inputs.userId}`, { headers });
                if (!res.ok) return { error: `getUser failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            default:
                return { error: `Unknown Flowdash action: ${actionName}` };
        }
    } catch (err: any) {
        return { error: err.message || 'Unknown error in executeFlowdashAction' };
    }
}
