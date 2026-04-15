'use server';

export async function executeAnytypeAction(actionName: string, inputs: any, user: any, logger: any) {
    const apiKey = inputs.apiKey;
    const baseUrl = 'https://api.any.coop/v1';
    const headers: Record<string, string> = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'getSpaces': {
                const params = new URLSearchParams();
                if (inputs.offset) params.append('offset', String(inputs.offset));
                if (inputs.limit) params.append('limit', String(inputs.limit));
                const res = await fetch(`${baseUrl}/spaces?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get spaces' };
                return { output: data };
            }
            case 'createSpace': {
                const body: Record<string, any> = { name: inputs.name || 'New Space' };
                if (inputs.description) body.description = inputs.description;
                const res = await fetch(`${baseUrl}/spaces`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create space' };
                return { output: data };
            }
            case 'getSpace': {
                const res = await fetch(`${baseUrl}/spaces/${inputs.spaceId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get space' };
                return { output: data };
            }
            case 'getObjects': {
                const params = new URLSearchParams();
                if (inputs.offset) params.append('offset', String(inputs.offset));
                if (inputs.limit) params.append('limit', String(inputs.limit));
                const res = await fetch(`${baseUrl}/spaces/${inputs.spaceId}/objects?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get objects' };
                return { output: data };
            }
            case 'createObject': {
                const body: Record<string, any> = {
                    name: inputs.name || '',
                    typeKey: inputs.typeKey || 'page',
                };
                if (inputs.templateId) body.templateId = inputs.templateId;
                if (inputs.description) body.description = inputs.description;
                if (inputs.body) body.body = inputs.body;
                if (inputs.icon) body.icon = inputs.icon;
                const res = await fetch(`${baseUrl}/spaces/${inputs.spaceId}/objects`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create object' };
                return { output: data };
            }
            case 'getObject': {
                const res = await fetch(`${baseUrl}/spaces/${inputs.spaceId}/objects/${inputs.objectId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get object' };
                return { output: data };
            }
            case 'updateObject': {
                const body: Record<string, any> = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.description) body.description = inputs.description;
                if (inputs.body) body.body = inputs.body;
                if (inputs.icon) body.icon = inputs.icon;
                const res = await fetch(`${baseUrl}/spaces/${inputs.spaceId}/objects/${inputs.objectId}`, { method: 'PATCH', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to update object' };
                return { output: data };
            }
            case 'deleteObject': {
                const res = await fetch(`${baseUrl}/spaces/${inputs.spaceId}/objects/${inputs.objectId}`, { method: 'DELETE', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to delete object' };
                return { output: data };
            }
            case 'searchObjects': {
                const body: Record<string, any> = { query: inputs.query || '' };
                if (inputs.types) body.types = inputs.types;
                if (inputs.offset) body.offset = inputs.offset;
                if (inputs.limit) body.limit = inputs.limit;
                const res = await fetch(`${baseUrl}/spaces/${inputs.spaceId}/search`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to search objects' };
                return { output: data };
            }
            case 'getTypes': {
                const params = new URLSearchParams();
                if (inputs.offset) params.append('offset', String(inputs.offset));
                if (inputs.limit) params.append('limit', String(inputs.limit));
                const res = await fetch(`${baseUrl}/spaces/${inputs.spaceId}/types?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get types' };
                return { output: data };
            }
            case 'createType': {
                const body: Record<string, any> = {
                    name: inputs.name || 'New Type',
                    icon: inputs.icon || '',
                };
                if (inputs.pluralName) body.pluralName = inputs.pluralName;
                const res = await fetch(`${baseUrl}/spaces/${inputs.spaceId}/types`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create type' };
                return { output: data };
            }
            case 'getRelations': {
                const params = new URLSearchParams();
                if (inputs.offset) params.append('offset', String(inputs.offset));
                if (inputs.limit) params.append('limit', String(inputs.limit));
                const res = await fetch(`${baseUrl}/spaces/${inputs.spaceId}/relations?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get relations' };
                return { output: data };
            }
            case 'addRelation': {
                const body: Record<string, any> = {
                    name: inputs.name || '',
                    format: inputs.format || 'text',
                };
                if (inputs.description) body.description = inputs.description;
                const res = await fetch(`${baseUrl}/spaces/${inputs.spaceId}/relations`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to add relation' };
                return { output: data };
            }
            case 'getMembers': {
                const params = new URLSearchParams();
                if (inputs.offset) params.append('offset', String(inputs.offset));
                if (inputs.limit) params.append('limit', String(inputs.limit));
                const res = await fetch(`${baseUrl}/spaces/${inputs.spaceId}/members?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get members' };
                return { output: data };
            }
            case 'inviteMember': {
                const body: Record<string, any> = { email: inputs.email };
                if (inputs.role) body.role = inputs.role;
                const res = await fetch(`${baseUrl}/spaces/${inputs.spaceId}/members`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to invite member' };
                return { output: data };
            }
            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        return { error: err.message || 'Unexpected error in anytype action' };
    }
}
