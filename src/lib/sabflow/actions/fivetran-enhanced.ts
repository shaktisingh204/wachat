'use server';

export async function executeFivetranEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = inputs.apiKey;
        const apiSecret = inputs.apiSecret;
        const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
        const baseUrl = 'https://api.fivetran.com/v1';
        const headers: Record<string, string> = {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json;version=2',
        };

        switch (actionName) {
            case 'listConnectors': {
                const params = new URLSearchParams();
                if (inputs.groupId) params.set('group_id', inputs.groupId);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.cursor) params.set('cursor', inputs.cursor);
                const res = await fetch(`${baseUrl}/connectors?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { connectors: data.data?.items, nextCursor: data.data?.next_cursor } };
            }
            case 'getConnector': {
                const res = await fetch(`${baseUrl}/connectors/${inputs.connectorId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { connector: data.data } };
            }
            case 'createConnector': {
                const res = await fetch(`${baseUrl}/connectors`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        service: inputs.service,
                        group_id: inputs.groupId,
                        paused: inputs.paused ?? false,
                        pause_after_trial: inputs.pauseAfterTrial ?? false,
                        sync_frequency: inputs.syncFrequency || 360,
                        config: inputs.config || {},
                        auth: inputs.auth || {},
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { connector: data.data } };
            }
            case 'updateConnector': {
                const res = await fetch(`${baseUrl}/connectors/${inputs.connectorId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify(inputs.updateBody || {}),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { connector: data.data } };
            }
            case 'deleteConnector': {
                const res = await fetch(`${baseUrl}/connectors/${inputs.connectorId}`, { method: 'DELETE', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { deleted: true, connectorId: inputs.connectorId } };
            }
            case 'syncConnector': {
                const res = await fetch(`${baseUrl}/connectors/${inputs.connectorId}/sync`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ force: inputs.force ?? false }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { synced: true, code: data.code, message: data.message } };
            }
            case 'pauseConnector': {
                const res = await fetch(`${baseUrl}/connectors/${inputs.connectorId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify({ paused: true }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { connector: data.data } };
            }
            case 'resumeConnector': {
                const res = await fetch(`${baseUrl}/connectors/${inputs.connectorId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify({ paused: false }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { connector: data.data } };
            }
            case 'listConnectorSchemas': {
                const res = await fetch(`${baseUrl}/connectors/${inputs.connectorId}/schemas`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { schemas: data.data } };
            }
            case 'updateConnectorSchema': {
                const res = await fetch(`${baseUrl}/connectors/${inputs.connectorId}/schemas`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify(inputs.schemaBody || {}),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { schemas: data.data } };
            }
            case 'listDestinations': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.cursor) params.set('cursor', inputs.cursor);
                const res = await fetch(`${baseUrl}/destinations?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { destinations: data.data?.items, nextCursor: data.data?.next_cursor } };
            }
            case 'getDestination': {
                const res = await fetch(`${baseUrl}/destinations/${inputs.destinationId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { destination: data.data } };
            }
            case 'createDestination': {
                const res = await fetch(`${baseUrl}/destinations`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        group_id: inputs.groupId,
                        service: inputs.service,
                        region: inputs.region || 'GCP_US_EAST4',
                        time_zone_offset: inputs.timeZoneOffset || '0',
                        config: inputs.config || {},
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { destination: data.data } };
            }
            case 'listGroups': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.cursor) params.set('cursor', inputs.cursor);
                const res = await fetch(`${baseUrl}/groups?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { groups: data.data?.items, nextCursor: data.data?.next_cursor } };
            }
            case 'createGroup': {
                const res = await fetch(`${baseUrl}/groups`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ name: inputs.name }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { group: data.data } };
            }
            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
