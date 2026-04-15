'use server';

export async function executeSegmentEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    const publicApiBase = 'https://api.segmentapis.com';
    const trackApiBase = 'https://api.segment.io/v1';

    try {
        const bearerToken = inputs.accessToken || '';
        const writeKeyBase64 = Buffer.from((inputs.writeKey || '') + ':').toString('base64');

        const publicHeaders = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${bearerToken}`,
        };
        const trackHeaders = {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${writeKeyBase64}`,
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
                const res = await fetch(`${trackApiBase}/track`, {
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
                const res = await fetch(`${trackApiBase}/identify`, {
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
                const res = await fetch(`${trackApiBase}/page`, {
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
                const res = await fetch(`${trackApiBase}/screen`, {
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
                const res = await fetch(`${trackApiBase}/group`, {
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
                const res = await fetch(`${trackApiBase}/alias`, {
                    method: 'POST',
                    headers: trackHeaders,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'listSources': {
                const params = new URLSearchParams();
                if (inputs.count) params.set('count', String(inputs.count));
                if (inputs.cursor) params.set('cursor', inputs.cursor);
                const res = await fetch(`${publicApiBase}/catalog/sources?${params.toString()}`, {
                    method: 'GET',
                    headers: publicHeaders,
                });
                const data = await res.json();
                return { output: data };
            }
            case 'getSource': {
                const res = await fetch(`${publicApiBase}/sources/${inputs.sourceId}`, {
                    method: 'GET',
                    headers: publicHeaders,
                });
                const data = await res.json();
                return { output: data };
            }
            case 'createSource': {
                const body = {
                    slug: inputs.slug,
                    name: inputs.name,
                    catalogSourceName: inputs.catalogSourceName,
                    enabled: inputs.enabled !== undefined ? inputs.enabled : true,
                };
                const res = await fetch(`${publicApiBase}/sources`, {
                    method: 'POST',
                    headers: publicHeaders,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'listDestinations': {
                const params = new URLSearchParams();
                if (inputs.count) params.set('count', String(inputs.count));
                if (inputs.cursor) params.set('cursor', inputs.cursor);
                const res = await fetch(`${publicApiBase}/destinations?${params.toString()}`, {
                    method: 'GET',
                    headers: publicHeaders,
                });
                const data = await res.json();
                return { output: data };
            }
            case 'getDestination': {
                const res = await fetch(`${publicApiBase}/destinations/${inputs.destinationId}`, {
                    method: 'GET',
                    headers: publicHeaders,
                });
                const data = await res.json();
                return { output: data };
            }
            case 'createDestination': {
                const body = {
                    sourceId: inputs.sourceId,
                    catalogDestinationName: inputs.catalogDestinationName,
                    enabled: inputs.enabled !== undefined ? inputs.enabled : true,
                    settings: inputs.settings || {},
                };
                const res = await fetch(`${publicApiBase}/destinations`, {
                    method: 'POST',
                    headers: publicHeaders,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'updateDestination': {
                const body: any = {};
                if (inputs.enabled !== undefined) body.enabled = inputs.enabled;
                if (inputs.settings) body.settings = inputs.settings;
                const res = await fetch(`${publicApiBase}/destinations/${inputs.destinationId}`, {
                    method: 'PATCH',
                    headers: publicHeaders,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'listAudiences': {
                const params = new URLSearchParams();
                if (inputs.spaceId) params.set('spaceId', inputs.spaceId);
                const res = await fetch(`${publicApiBase}/spaces/${inputs.spaceId}/audiences?${params.toString()}`, {
                    method: 'GET',
                    headers: publicHeaders,
                });
                const data = await res.json();
                return { output: data };
            }
            case 'getAudience': {
                const res = await fetch(`${publicApiBase}/spaces/${inputs.spaceId}/audiences/${inputs.audienceId}`, {
                    method: 'GET',
                    headers: publicHeaders,
                });
                const data = await res.json();
                return { output: data };
            }
            default:
                return { error: `Unknown Segment action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Segment enhanced action error: ${err.message}`);
        return { error: err.message || 'Segment enhanced action failed' };
    }
}
