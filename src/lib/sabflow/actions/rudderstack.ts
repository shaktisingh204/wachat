'use server';

export async function executeRudderstackAction(actionName: string, inputs: any, user: any, logger: any) {
    const trackingApiBase = inputs.dataPlaneUrl || 'https://hosted.rudderlabs.com/v1';
    const configApiBase = 'https://api.rudderlabs.com/v1';

    try {
        const writeKeyBase64 = Buffer.from((inputs.writeKey || '') + ':').toString('base64');
        const trackHeaders = {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${writeKeyBase64}`,
        };
        const configHeaders = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${inputs.accessToken || ''}`,
        };

        switch (actionName) {
            case 'track': {
                const body: any = {
                    userId: inputs.userId,
                    event: inputs.event,
                    properties: inputs.properties || {},
                };
                if (inputs.anonymousId) body.anonymousId = inputs.anonymousId;
                if (inputs.timestamp) body.timestamp = inputs.timestamp;
                const res = await fetch(`${trackingApiBase}/track`, {
                    method: 'POST',
                    headers: trackHeaders,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'identify': {
                const body: any = {
                    userId: inputs.userId,
                    traits: inputs.traits || {},
                };
                if (inputs.anonymousId) body.anonymousId = inputs.anonymousId;
                const res = await fetch(`${trackingApiBase}/identify`, {
                    method: 'POST',
                    headers: trackHeaders,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'page': {
                const body: any = {
                    userId: inputs.userId,
                    name: inputs.name,
                    properties: inputs.properties || {},
                };
                if (inputs.anonymousId) body.anonymousId = inputs.anonymousId;
                const res = await fetch(`${trackingApiBase}/page`, {
                    method: 'POST',
                    headers: trackHeaders,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'screen': {
                const body: any = {
                    userId: inputs.userId,
                    name: inputs.name,
                    properties: inputs.properties || {},
                };
                if (inputs.anonymousId) body.anonymousId = inputs.anonymousId;
                const res = await fetch(`${trackingApiBase}/screen`, {
                    method: 'POST',
                    headers: trackHeaders,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'group': {
                const body: any = {
                    userId: inputs.userId,
                    groupId: inputs.groupId,
                    traits: inputs.traits || {},
                };
                if (inputs.anonymousId) body.anonymousId = inputs.anonymousId;
                const res = await fetch(`${trackingApiBase}/group`, {
                    method: 'POST',
                    headers: trackHeaders,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'alias': {
                const body = {
                    userId: inputs.userId,
                    previousId: inputs.previousId,
                };
                const res = await fetch(`${trackingApiBase}/alias`, {
                    method: 'POST',
                    headers: trackHeaders,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'batchTrack': {
                const body = {
                    batch: inputs.batch || [],
                };
                const res = await fetch(`${trackingApiBase}/batch`, {
                    method: 'POST',
                    headers: trackHeaders,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'listSources': {
                const res = await fetch(`${configApiBase}/sources`, {
                    method: 'GET',
                    headers: configHeaders,
                });
                const data = await res.json();
                return { output: data };
            }
            case 'getSource': {
                const res = await fetch(`${configApiBase}/sources/${inputs.sourceId}`, {
                    method: 'GET',
                    headers: configHeaders,
                });
                const data = await res.json();
                return { output: data };
            }
            case 'createSource': {
                const body = {
                    name: inputs.name,
                    type: inputs.type,
                    enabled: inputs.enabled !== undefined ? inputs.enabled : true,
                    config: inputs.config || {},
                };
                const res = await fetch(`${configApiBase}/sources`, {
                    method: 'POST',
                    headers: configHeaders,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'listDestinations': {
                const res = await fetch(`${configApiBase}/destinations`, {
                    method: 'GET',
                    headers: configHeaders,
                });
                const data = await res.json();
                return { output: data };
            }
            case 'getDestination': {
                const res = await fetch(`${configApiBase}/destinations/${inputs.destinationId}`, {
                    method: 'GET',
                    headers: configHeaders,
                });
                const data = await res.json();
                return { output: data };
            }
            case 'createDestination': {
                const body = {
                    name: inputs.name,
                    type: inputs.type,
                    enabled: inputs.enabled !== undefined ? inputs.enabled : true,
                    config: inputs.config || {},
                    sourceIds: inputs.sourceIds || [],
                };
                const res = await fetch(`${configApiBase}/destinations`, {
                    method: 'POST',
                    headers: configHeaders,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'listConnections': {
                const res = await fetch(`${configApiBase}/connections`, {
                    method: 'GET',
                    headers: configHeaders,
                });
                const data = await res.json();
                return { output: data };
            }
            case 'getDataPlaneStatus': {
                const res = await fetch(`${trackingApiBase}/health`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                });
                const data = await res.json().catch(() => ({ status: res.status, ok: res.ok }));
                return { output: data };
            }
            default:
                return { error: `Unknown RudderStack action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`RudderStack action error: ${err.message}`);
        return { error: err.message || 'RudderStack action failed' };
    }
}
