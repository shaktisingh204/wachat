
'use server';

const FIGMA_BASE = 'https://api.figma.com/v1';

async function figmaFetch(token: string, method: string, path: string, body?: any, logger?: any): Promise<any> {
    logger?.log(`[Figma] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            'X-Figma-Token': token,
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const url = path.startsWith('/v2/') ? `https://api.figma.com${path}` : `${FIGMA_BASE}${path}`;
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || data?.err || `Figma API error: ${res.status}`);
    }
    return data;
}

export async function executeFigmaAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const token = String(inputs.accessToken ?? '').trim();
        if (!token) throw new Error('accessToken is required.');
        const figma = (method: string, path: string, body?: any) => figmaFetch(token, method, path, body, logger);

        switch (actionName) {
            case 'getFile': {
                const fileKey = String(inputs.fileKey ?? '').trim();
                if (!fileKey) throw new Error('fileKey is required.');
                const data = await figma('GET', `/files/${fileKey}`);
                return { output: { name: data.name, lastModified: data.lastModified ?? '', thumbnailUrl: data.thumbnailUrl ?? '', version: data.version ?? '' } };
            }

            case 'getFileNodes': {
                const fileKey = String(inputs.fileKey ?? '').trim();
                const nodeIds = String(inputs.nodeIds ?? '').trim();
                if (!fileKey) throw new Error('fileKey is required.');
                if (!nodeIds) throw new Error('nodeIds is required.');
                const data = await figma('GET', `/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeIds)}`);
                return { output: { nodes: data.nodes ?? {} } };
            }

            case 'getFileImages': {
                const fileKey = String(inputs.fileKey ?? '').trim();
                const ids = String(inputs.ids ?? '').trim();
                if (!fileKey) throw new Error('fileKey is required.');
                if (!ids) throw new Error('ids is required.');
                const format = String(inputs.format ?? 'png').trim();
                const data = await figma('GET', `/images/${fileKey}?ids=${encodeURIComponent(ids)}&format=${format}`);
                return { output: { images: data.images ?? {}, err: data.err ?? null } };
            }

            case 'getFileComments': {
                const fileKey = String(inputs.fileKey ?? '').trim();
                if (!fileKey) throw new Error('fileKey is required.');
                const data = await figma('GET', `/files/${fileKey}/comments`);
                return { output: { comments: data.comments ?? [], count: (data.comments ?? []).length } };
            }

            case 'postComment': {
                const fileKey = String(inputs.fileKey ?? '').trim();
                const message = String(inputs.message ?? '').trim();
                if (!fileKey) throw new Error('fileKey is required.');
                if (!message) throw new Error('message is required.');
                const body: any = { message };
                if (inputs.clientMeta) body.client_meta = inputs.clientMeta;
                const data = await figma('POST', `/files/${fileKey}/comments`, body);
                return { output: { id: data.id, message: data.message, createdAt: data.created_at ?? '' } };
            }

            case 'getTeamProjects': {
                const teamId = String(inputs.teamId ?? '').trim();
                if (!teamId) throw new Error('teamId is required.');
                const data = await figma('GET', `/teams/${teamId}/projects`);
                return { output: { projects: data.projects ?? [], count: (data.projects ?? []).length } };
            }

            case 'getProjectFiles': {
                const projectId = String(inputs.projectId ?? '').trim();
                if (!projectId) throw new Error('projectId is required.');
                const data = await figma('GET', `/projects/${projectId}/files`);
                return { output: { files: data.files ?? [], count: (data.files ?? []).length } };
            }

            case 'getComponents': {
                const fileKey = String(inputs.fileKey ?? '').trim();
                if (!fileKey) throw new Error('fileKey is required.');
                const data = await figma('GET', `/files/${fileKey}/components`);
                return { output: { components: data.meta?.components ?? [], count: (data.meta?.components ?? []).length } };
            }

            case 'getStyles': {
                const fileKey = String(inputs.fileKey ?? '').trim();
                if (!fileKey) throw new Error('fileKey is required.');
                const data = await figma('GET', `/files/${fileKey}/styles`);
                return { output: { styles: data.meta?.styles ?? [], count: (data.meta?.styles ?? []).length } };
            }

            case 'getComponentSets': {
                const fileKey = String(inputs.fileKey ?? '').trim();
                if (!fileKey) throw new Error('fileKey is required.');
                const data = await figma('GET', `/files/${fileKey}/component_sets`);
                return { output: { componentSets: data.meta?.component_sets ?? [], count: (data.meta?.component_sets ?? []).length } };
            }

            case 'publishedComponents': {
                const teamId = String(inputs.teamId ?? '').trim();
                if (!teamId) throw new Error('teamId is required.');
                const data = await figma('GET', `/teams/${teamId}/components`);
                return { output: { components: data.meta?.components ?? [], count: (data.meta?.components ?? []).length } };
            }

            case 'getWebhooks': {
                const data = await figma('GET', '/v2/webhooks');
                return { output: { webhooks: data.webhooks ?? [], count: (data.webhooks ?? []).length } };
            }

            case 'createWebhook': {
                const eventType = String(inputs.eventType ?? '').trim();
                const teamId = String(inputs.teamId ?? '').trim();
                const endpoint = String(inputs.endpoint ?? '').trim();
                const passcode = String(inputs.passcode ?? '').trim();
                if (!eventType) throw new Error('eventType is required.');
                if (!teamId) throw new Error('teamId is required.');
                if (!endpoint) throw new Error('endpoint is required.');
                if (!passcode) throw new Error('passcode is required.');
                const data = await figma('POST', '/v2/webhooks', { event_type: eventType, team_id: teamId, endpoint, passcode });
                return { output: { id: data.id, eventType: data.event_type, endpoint: data.endpoint } };
            }

            case 'deleteWebhook': {
                const webhookId = String(inputs.webhookId ?? '').trim();
                if (!webhookId) throw new Error('webhookId is required.');
                await figma('DELETE', `/v2/webhooks/${webhookId}`);
                return { output: { deleted: 'true', webhookId } };
            }

            case 'getVersionHistory': {
                const fileKey = String(inputs.fileKey ?? '').trim();
                if (!fileKey) throw new Error('fileKey is required.');
                const data = await figma('GET', `/files/${fileKey}/versions`);
                return { output: { versions: data.versions ?? [], count: (data.versions ?? []).length } };
            }

            default:
                return { error: `Figma action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Figma action failed.' };
    }
}
