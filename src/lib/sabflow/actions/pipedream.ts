'use server';

export async function executePipedreamAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const baseUrl = 'https://api.pipedream.com/v1';
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${inputs.apiKey}`,
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
            case 'listEventSources': {
                const res = await fetch(`${baseUrl}/sources`, { headers });
                if (!res.ok) return { error: `listEventSources failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getEventSource': {
                const res = await fetch(`${baseUrl}/sources/${inputs.sourceId}`, { headers });
                if (!res.ok) return { error: `getEventSource failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'createEventSource': {
                const res = await fetch(`${baseUrl}/sources`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.source || {}),
                });
                if (!res.ok) return { error: `createEventSource failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'listSubscriptions': {
                const res = await fetch(`${baseUrl}/subscriptions`, { headers });
                if (!res.ok) return { error: `listSubscriptions failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'subscribe': {
                const res = await fetch(`${baseUrl}/subscriptions`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        emitter_id: inputs.emitterId,
                        listener_id: inputs.listenerId,
                        event_name: inputs.eventName,
                    }),
                });
                if (!res.ok) return { error: `subscribe failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'unsubscribe': {
                const res = await fetch(`${baseUrl}/subscriptions?emitter_id=${inputs.emitterId}&listener_id=${inputs.listenerId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) return { error: `unsubscribe failed: ${res.status} ${await res.text()}` };
                return { output: { unsubscribed: true } };
            }
            case 'listEventHistory': {
                const params = new URLSearchParams();
                if (inputs.sourceId) params.set('source_id', inputs.sourceId);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const res = await fetch(`${baseUrl}/sources/${inputs.sourceId}/event_summaries?${params.toString()}`, { headers });
                if (!res.ok) return { error: `listEventHistory failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getEventHistory': {
                const res = await fetch(`${baseUrl}/sources/${inputs.sourceId}/events/${inputs.eventId}`, { headers });
                if (!res.ok) return { error: `getEventHistory failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'replayEvent': {
                const res = await fetch(`${baseUrl}/sources/${inputs.sourceId}/events/${inputs.eventId}/replay`, {
                    method: 'POST',
                    headers,
                });
                if (!res.ok) return { error: `replayEvent failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'listComponents': {
                const params = new URLSearchParams();
                if (inputs.query) params.set('q', inputs.query);
                const res = await fetch(`${baseUrl}/components?${params.toString()}`, { headers });
                if (!res.ok) return { error: `listComponents failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            default:
                return { error: `Unknown Pipedream action: ${actionName}` };
        }
    } catch (err: any) {
        return { error: err.message || 'Unknown error in executePipedreamAction' };
    }
}
