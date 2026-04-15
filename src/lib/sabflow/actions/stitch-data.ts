'use server';

export async function executeStitchDataAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = inputs.accessToken;
        const baseUrl = 'https://api.stitchdata.com/v4';
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listSources': {
                const res = await fetch(`${baseUrl}/sources`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || data?.message || `API error: ${res.status}`);
                return { output: { sources: data } };
            }
            case 'getSource': {
                const res = await fetch(`${baseUrl}/sources/${inputs.sourceId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || data?.message || `API error: ${res.status}`);
                return { output: { source: data } };
            }
            case 'createSource': {
                const res = await fetch(`${baseUrl}/sources`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        display_name: inputs.displayName,
                        type: inputs.type,
                        properties: inputs.properties || {},
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || data?.message || `API error: ${res.status}`);
                return { output: { source: data } };
            }
            case 'updateSource': {
                const res = await fetch(`${baseUrl}/sources/${inputs.sourceId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({
                        display_name: inputs.displayName,
                        properties: inputs.properties || {},
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || data?.message || `API error: ${res.status}`);
                return { output: { source: data } };
            }
            case 'deleteSource': {
                const res = await fetch(`${baseUrl}/sources/${inputs.sourceId}`, { method: 'DELETE', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || data?.message || `API error: ${res.status}`);
                return { output: { deleted: true, sourceId: inputs.sourceId } };
            }
            case 'pauseSource': {
                const res = await fetch(`${baseUrl}/sources/${inputs.sourceId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({ paused: true }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || data?.message || `API error: ${res.status}`);
                return { output: { source: data } };
            }
            case 'resumeSource': {
                const res = await fetch(`${baseUrl}/sources/${inputs.sourceId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({ paused: false }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || data?.message || `API error: ${res.status}`);
                return { output: { source: data } };
            }
            case 'triggerSync': {
                const res = await fetch(`${baseUrl}/sources/${inputs.sourceId}/sync`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({}),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || data?.message || `API error: ${res.status}`);
                return { output: { jobName: data.job_name, notes: data.notes } };
            }
            case 'getSourceLastSync': {
                const res = await fetch(`${baseUrl}/sources/${inputs.sourceId}/last-sync`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || data?.message || `API error: ${res.status}`);
                return { output: { lastSync: data } };
            }
            case 'listStreams': {
                const res = await fetch(`${baseUrl}/sources/${inputs.sourceId}/streams`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || data?.message || `API error: ${res.status}`);
                return { output: { streams: data } };
            }
            case 'getStream': {
                const res = await fetch(`${baseUrl}/sources/${inputs.sourceId}/streams/${inputs.streamId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || data?.message || `API error: ${res.status}`);
                return { output: { stream: data } };
            }
            case 'updateStream': {
                const res = await fetch(`${baseUrl}/sources/${inputs.sourceId}/streams/${inputs.streamId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({
                        selected: inputs.selected ?? true,
                        replication_method: inputs.replicationMethod,
                        replication_key: inputs.replicationKey,
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || data?.message || `API error: ${res.status}`);
                return { output: { stream: data } };
            }
            case 'listConnections': {
                const res = await fetch(`${baseUrl}/destinations`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || data?.message || `API error: ${res.status}`);
                return { output: { connections: data } };
            }
            case 'getConnection': {
                const res = await fetch(`${baseUrl}/destinations/${inputs.connectionId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || data?.message || `API error: ${res.status}`);
                return { output: { connection: data } };
            }
            case 'listReports': {
                const params = new URLSearchParams();
                if (inputs.sourceId) params.set('source_id', inputs.sourceId);
                if (inputs.startTime) params.set('start_time', inputs.startTime);
                if (inputs.endTime) params.set('end_time', inputs.endTime);
                const res = await fetch(`${baseUrl}/reports?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || data?.message || `API error: ${res.status}`);
                return { output: { reports: data } };
            }
            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
