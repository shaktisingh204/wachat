'use server';

export async function executeConfluenceEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    const base64 = Buffer.from(inputs.email + ':' + inputs.apiToken).toString('base64');
    const baseUrl = `https://${inputs.domain}.atlassian.net/wiki/rest/api`;
    const headers: Record<string, string> = {
        'Authorization': `Basic ${base64}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'listSpaces': {
                const res = await fetch(`${baseUrl}/space?limit=${inputs.limit || 25}&start=${inputs.start || 0}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list spaces' };
                return { output: data };
            }
            case 'getSpace': {
                const res = await fetch(`${baseUrl}/space/${inputs.spaceKey}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get space' };
                return { output: data };
            }
            case 'createSpace': {
                const body = {
                    key: inputs.spaceKey,
                    name: inputs.name,
                    description: inputs.description ? { plain: { value: inputs.description, representation: 'plain' } } : undefined,
                };
                const res = await fetch(`${baseUrl}/space`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create space' };
                return { output: data };
            }
            case 'listPages': {
                const params = new URLSearchParams({ spaceKey: inputs.spaceKey, limit: String(inputs.limit || 25), start: String(inputs.start || 0) });
                const res = await fetch(`${baseUrl}/content?${params.toString()}&type=page`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list pages' };
                return { output: data };
            }
            case 'getPage': {
                const expand = inputs.expand || 'body.storage,version,ancestors';
                const res = await fetch(`${baseUrl}/content/${inputs.pageId}?expand=${expand}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get page' };
                return { output: data };
            }
            case 'createPage': {
                const body = {
                    type: 'page',
                    title: inputs.title,
                    space: { key: inputs.spaceKey },
                    ancestors: inputs.parentId ? [{ id: inputs.parentId }] : undefined,
                    body: {
                        storage: {
                            value: inputs.content || '',
                            representation: 'storage',
                        },
                    },
                };
                const res = await fetch(`${baseUrl}/content`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create page' };
                return { output: data };
            }
            case 'updatePage': {
                const current = await fetch(`${baseUrl}/content/${inputs.pageId}?expand=version`, { headers });
                const currentData = await current.json();
                if (!current.ok) return { error: currentData.message || 'Failed to fetch current page version' };
                const body = {
                    type: 'page',
                    title: inputs.title || currentData.title,
                    version: { number: currentData.version.number + 1 },
                    body: {
                        storage: {
                            value: inputs.content || '',
                            representation: 'storage',
                        },
                    },
                };
                const res = await fetch(`${baseUrl}/content/${inputs.pageId}`, { method: 'PUT', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to update page' };
                return { output: data };
            }
            case 'deletePage': {
                const res = await fetch(`${baseUrl}/content/${inputs.pageId}`, { method: 'DELETE', headers });
                if (res.status === 204) return { output: { success: true, pageId: inputs.pageId } };
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to delete page' };
                return { output: data };
            }
            case 'listChildren': {
                const res = await fetch(`${baseUrl}/content/${inputs.pageId}/child/page?limit=${inputs.limit || 25}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list children' };
                return { output: data };
            }
            case 'getPageHistory': {
                const res = await fetch(`${baseUrl}/content/${inputs.pageId}/history`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get page history' };
                return { output: data };
            }
            case 'addComment': {
                const body = {
                    type: 'comment',
                    container: { id: inputs.pageId, type: 'page' },
                    body: {
                        storage: {
                            value: inputs.comment,
                            representation: 'storage',
                        },
                    },
                };
                const res = await fetch(`${baseUrl}/content`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to add comment' };
                return { output: data };
            }
            case 'listComments': {
                const res = await fetch(`${baseUrl}/content/${inputs.pageId}/child/comment?expand=body.storage`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list comments' };
                return { output: data };
            }
            case 'createLabel': {
                const body = [{ prefix: inputs.prefix || 'global', name: inputs.name }];
                const res = await fetch(`${baseUrl}/content/${inputs.pageId}/label`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create label' };
                return { output: data };
            }
            case 'addLabel': {
                const body = [{ prefix: inputs.prefix || 'global', name: inputs.label }];
                const res = await fetch(`${baseUrl}/content/${inputs.pageId}/label`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to add label' };
                return { output: data };
            }
            case 'searchContent': {
                const params = new URLSearchParams({ cql: inputs.cql, limit: String(inputs.limit || 25), start: String(inputs.start || 0) });
                const res = await fetch(`${baseUrl}/content/search?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to search content' };
                return { output: data };
            }
            default:
                return { error: `Unknown Confluence Enhanced action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Confluence Enhanced action error: ${err.message}`);
        return { error: err.message || 'Confluence Enhanced action failed' };
    }
}
