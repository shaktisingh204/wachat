'use server';

export async function executeNotionAIAction(actionName: string, inputs: any, user: any, logger: any) {
    const secret = inputs.secret;
    const baseUrl = 'https://api.notion.com/v1';
    const headers: Record<string, string> = {
        'Authorization': `Bearer ${secret}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'createPage': {
                const body: Record<string, any> = {
                    parent: inputs.parent || { page_id: inputs.parentId },
                    properties: inputs.properties || { title: { title: [{ text: { content: inputs.title || '' } }] } },
                };
                if (inputs.children) body.children = inputs.children;
                const res = await fetch(`${baseUrl}/pages`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create page' };
                return { output: data };
            }
            case 'getPage': {
                const res = await fetch(`${baseUrl}/pages/${inputs.pageId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get page' };
                return { output: data };
            }
            case 'updatePage': {
                const body: Record<string, any> = {};
                if (inputs.properties) body.properties = inputs.properties;
                if (inputs.archived !== undefined) body.archived = inputs.archived;
                const res = await fetch(`${baseUrl}/pages/${inputs.pageId}`, { method: 'PATCH', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to update page' };
                return { output: data };
            }
            case 'archivePage': {
                const res = await fetch(`${baseUrl}/pages/${inputs.pageId}`, { method: 'PATCH', headers, body: JSON.stringify({ archived: true }) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to archive page' };
                return { output: data };
            }
            case 'listPages': {
                const query: Record<string, any> = {
                    filter: inputs.filter || { property: 'object', value: 'page' },
                };
                if (inputs.startCursor) query.start_cursor = inputs.startCursor;
                if (inputs.pageSize) query.page_size = inputs.pageSize;
                const res = await fetch(`${baseUrl}/search`, { method: 'POST', headers, body: JSON.stringify(query) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list pages' };
                return { output: data };
            }
            case 'createDatabase': {
                const body: Record<string, any> = {
                    parent: inputs.parent || { page_id: inputs.parentId },
                    title: inputs.title || [{ text: { content: 'New Database' } }],
                    properties: inputs.properties || { Name: { title: {} } },
                };
                const res = await fetch(`${baseUrl}/databases`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create database' };
                return { output: data };
            }
            case 'getDatabase': {
                const res = await fetch(`${baseUrl}/databases/${inputs.databaseId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get database' };
                return { output: data };
            }
            case 'updateDatabase': {
                const body: Record<string, any> = {};
                if (inputs.title) body.title = inputs.title;
                if (inputs.properties) body.properties = inputs.properties;
                const res = await fetch(`${baseUrl}/databases/${inputs.databaseId}`, { method: 'PATCH', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to update database' };
                return { output: data };
            }
            case 'queryDatabase': {
                const body: Record<string, any> = {};
                if (inputs.filter) body.filter = inputs.filter;
                if (inputs.sorts) body.sorts = inputs.sorts;
                if (inputs.startCursor) body.start_cursor = inputs.startCursor;
                if (inputs.pageSize) body.page_size = inputs.pageSize;
                const res = await fetch(`${baseUrl}/databases/${inputs.databaseId}/query`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to query database' };
                return { output: data };
            }
            case 'createDatabaseItem': {
                const body: Record<string, any> = {
                    parent: { database_id: inputs.databaseId },
                    properties: inputs.properties || {},
                };
                if (inputs.children) body.children = inputs.children;
                const res = await fetch(`${baseUrl}/pages`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create database item' };
                return { output: data };
            }
            case 'updateDatabaseItem': {
                const body: Record<string, any> = { properties: inputs.properties || {} };
                if (inputs.archived !== undefined) body.archived = inputs.archived;
                const res = await fetch(`${baseUrl}/pages/${inputs.pageId}`, { method: 'PATCH', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to update database item' };
                return { output: data };
            }
            case 'addComment': {
                const body: Record<string, any> = {
                    parent: { page_id: inputs.pageId },
                    rich_text: inputs.richText || [{ text: { content: inputs.content || '' } }],
                };
                const res = await fetch(`${baseUrl}/comments`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to add comment' };
                return { output: data };
            }
            case 'listComments': {
                const params = new URLSearchParams({ block_id: inputs.blockId || inputs.pageId });
                if (inputs.startCursor) params.append('start_cursor', inputs.startCursor);
                const res = await fetch(`${baseUrl}/comments?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list comments' };
                return { output: data };
            }
            case 'searchPages': {
                const body: Record<string, any> = {};
                if (inputs.query) body.query = inputs.query;
                if (inputs.filter) body.filter = inputs.filter;
                if (inputs.sort) body.sort = inputs.sort;
                if (inputs.startCursor) body.start_cursor = inputs.startCursor;
                if (inputs.pageSize) body.page_size = inputs.pageSize;
                const res = await fetch(`${baseUrl}/search`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to search pages' };
                return { output: data };
            }
            case 'getBlock': {
                const res = await fetch(`${baseUrl}/blocks/${inputs.blockId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get block' };
                return { output: data };
            }
            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        return { error: err.message || 'Unexpected error in notion-ai action' };
    }
}
