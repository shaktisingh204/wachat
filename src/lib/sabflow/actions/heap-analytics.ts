'use server';

export async function executeHeapAnalyticsAction(actionName: string, inputs: any, user: any, logger: any) {
    const apiBase = 'https://heapanalytics.com/api';

    try {
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${inputs.apiKey || ''}`,
        };

        switch (actionName) {
            case 'trackEvent': {
                const body = {
                    app_id: inputs.appId,
                    identity: inputs.identity,
                    event: inputs.event,
                    properties: inputs.properties || {},
                    timestamp: inputs.timestamp,
                };
                const res = await fetch(`${apiBase}/track`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json().catch(() => ({ status: res.status }));
                return { output: data };
            }
            case 'addUserProperties': {
                const body = {
                    app_id: inputs.appId,
                    identity: inputs.identity,
                    properties: inputs.properties || {},
                };
                const res = await fetch(`${apiBase}/add_user_properties`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json().catch(() => ({ status: res.status }));
                return { output: data };
            }
            case 'addEventProperties': {
                const body = {
                    app_id: inputs.appId,
                    event: inputs.event,
                    properties: inputs.properties || {},
                };
                const res = await fetch(`${apiBase}/add_event_properties`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json().catch(() => ({ status: res.status }));
                return { output: data };
            }
            case 'deleteUser': {
                const body = {
                    app_id: inputs.appId,
                    identity: inputs.identity,
                };
                const res = await fetch(`${apiBase}/delete_user`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json().catch(() => ({ status: res.status }));
                return { output: data };
            }
            case 'deleteUserProperties': {
                const body = {
                    app_id: inputs.appId,
                    identity: inputs.identity,
                    properties: inputs.properties || [],
                };
                const res = await fetch(`${apiBase}/delete_user_properties`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json().catch(() => ({ status: res.status }));
                return { output: data };
            }
            case 'deleteEventProperties': {
                const body = {
                    app_id: inputs.appId,
                    event: inputs.event,
                    properties: inputs.properties || [],
                };
                const res = await fetch(`${apiBase}/delete_event_properties`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json().catch(() => ({ status: res.status }));
                return { output: data };
            }
            case 'getUserProperties': {
                const params = new URLSearchParams({ app_id: inputs.appId, identity: inputs.identity });
                const res = await fetch(`${apiBase}/v1/users?${params.toString()}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                return { output: data };
            }
            case 'listEvents': {
                const params = new URLSearchParams({ app_id: inputs.appId });
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const res = await fetch(`${apiBase}/v1/events?${params.toString()}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                return { output: data };
            }
            case 'getEventStats': {
                const params = new URLSearchParams({
                    app_id: inputs.appId,
                    event: inputs.event,
                    start_date: inputs.startDate,
                    end_date: inputs.endDate,
                });
                if (inputs.granularity) params.set('granularity', inputs.granularity);
                const res = await fetch(`${apiBase}/v1/events/stats?${params.toString()}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                return { output: data };
            }
            case 'listPropertyMappings': {
                const params = new URLSearchParams({ app_id: inputs.appId });
                const res = await fetch(`${apiBase}/v1/property_mappings?${params.toString()}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                return { output: data };
            }
            case 'createPropertyMapping': {
                const body = {
                    app_id: inputs.appId,
                    event: inputs.event,
                    property: inputs.property,
                    target_property: inputs.targetProperty,
                };
                const res = await fetch(`${apiBase}/v1/property_mappings`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'deletePropertyMapping': {
                const body = {
                    app_id: inputs.appId,
                    mapping_id: inputs.mappingId,
                };
                const res = await fetch(`${apiBase}/v1/property_mappings/${inputs.mappingId}`, {
                    method: 'DELETE',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json().catch(() => ({ status: res.status }));
                return { output: data };
            }
            case 'getBulkExportStatus': {
                const params = new URLSearchParams({ app_id: inputs.appId, export_id: inputs.exportId });
                const res = await fetch(`${apiBase}/v1/bulk_export/${inputs.exportId}?${params.toString()}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                return { output: data };
            }
            case 'listSegments': {
                const params = new URLSearchParams({ app_id: inputs.appId });
                const res = await fetch(`${apiBase}/v1/segments?${params.toString()}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                return { output: data };
            }
            case 'getSegment': {
                const params = new URLSearchParams({ app_id: inputs.appId });
                const res = await fetch(`${apiBase}/v1/segments/${inputs.segmentId}?${params.toString()}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                return { output: data };
            }
            default:
                return { error: `Unknown Heap Analytics action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Heap Analytics action error: ${err.message}`);
        return { error: err.message || 'Heap Analytics action failed' };
    }
}
