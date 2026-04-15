
'use server';

const NOTION_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

async function notionFetch(apiKey: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Notion v2] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'Notion-Version': NOTION_VERSION,
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${NOTION_BASE}${path}`, options);
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || data?.code || `Notion API error: ${res.status}`);
    }
    return data;
}

export async function executeNotionV2Action(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');
        const nt = (method: string, path: string, body?: any) => notionFetch(apiKey, method, path, body, logger);

        switch (actionName) {
            case 'createPage': {
                const parentId = String(inputs.parentId ?? '').trim();
                const parentType = inputs.parentType ?? 'page_id';
                if (!parentId) throw new Error('parentId is required.');
                const payload: any = {
                    parent: { [parentType]: parentId },
                    properties: {},
                };
                if (inputs.title) {
                    payload.properties.title = {
                        title: [{ type: 'text', text: { content: String(inputs.title) } }],
                    };
                }
                if (inputs.properties) {
                    const props = typeof inputs.properties === 'string' ? JSON.parse(inputs.properties) : inputs.properties;
                    payload.properties = { ...payload.properties, ...props };
                }
                if (inputs.children) {
                    payload.children = typeof inputs.children === 'string' ? JSON.parse(inputs.children) : inputs.children;
                }
                if (inputs.icon) payload.icon = typeof inputs.icon === 'string' ? JSON.parse(inputs.icon) : inputs.icon;
                if (inputs.cover) payload.cover = typeof inputs.cover === 'string' ? JSON.parse(inputs.cover) : inputs.cover;
                const data = await nt('POST', '/pages', payload);
                return { output: { id: data.id ?? '', url: data.url ?? '', archived: String(data.archived ?? false) } };
            }

            case 'queryDatabase': {
                const databaseId = String(inputs.databaseId ?? '').trim();
                if (!databaseId) throw new Error('databaseId is required.');
                const payload: any = {};
                if (inputs.filter) payload.filter = typeof inputs.filter === 'string' ? JSON.parse(inputs.filter) : inputs.filter;
                if (inputs.sorts) payload.sorts = typeof inputs.sorts === 'string' ? JSON.parse(inputs.sorts) : inputs.sorts;
                if (inputs.pageSize) payload.page_size = Number(inputs.pageSize);
                if (inputs.startCursor) payload.start_cursor = String(inputs.startCursor);
                const data = await nt('POST', `/databases/${databaseId}/query`, payload);
                const results = data.results ?? [];
                return { output: { count: String(results.length), hasMore: String(data.has_more ?? false), nextCursor: data.next_cursor ?? '', results: JSON.stringify(results) } };
            }

            case 'updatePage': {
                const pageId = String(inputs.pageId ?? '').trim();
                if (!pageId) throw new Error('pageId is required.');
                const payload: any = {};
                if (inputs.properties) payload.properties = typeof inputs.properties === 'string' ? JSON.parse(inputs.properties) : inputs.properties;
                if (inputs.archived !== undefined) payload.archived = inputs.archived === true || inputs.archived === 'true';
                if (inputs.icon) payload.icon = typeof inputs.icon === 'string' ? JSON.parse(inputs.icon) : inputs.icon;
                if (inputs.cover) payload.cover = typeof inputs.cover === 'string' ? JSON.parse(inputs.cover) : inputs.cover;
                const data = await nt('PATCH', `/pages/${pageId}`, payload);
                return { output: { id: data.id ?? pageId, url: data.url ?? '', archived: String(data.archived ?? false) } };
            }

            case 'appendBlocks': {
                const blockId = String(inputs.blockId ?? '').trim();
                if (!blockId) throw new Error('blockId is required.');
                const children = inputs.children
                    ? (typeof inputs.children === 'string' ? JSON.parse(inputs.children) : inputs.children)
                    : [];
                const data = await nt('PATCH', `/blocks/${blockId}/children`, { children });
                const results = data.results ?? [];
                return { output: { count: String(results.length), results: JSON.stringify(results) } };
            }

            case 'searchPages': {
                const payload: any = {};
                if (inputs.query) payload.query = String(inputs.query);
                if (inputs.filter) payload.filter = typeof inputs.filter === 'string' ? JSON.parse(inputs.filter) : inputs.filter;
                if (inputs.sort) payload.sort = typeof inputs.sort === 'string' ? JSON.parse(inputs.sort) : inputs.sort;
                if (inputs.pageSize) payload.page_size = Number(inputs.pageSize);
                if (inputs.startCursor) payload.start_cursor = String(inputs.startCursor);
                const data = await nt('POST', '/search', payload);
                const results = data.results ?? [];
                return { output: { count: String(results.length), hasMore: String(data.has_more ?? false), results: JSON.stringify(results) } };
            }

            case 'getPage': {
                const pageId = String(inputs.pageId ?? '').trim();
                if (!pageId) throw new Error('pageId is required.');
                const data = await nt('GET', `/pages/${pageId}`);
                return { output: { id: data.id ?? '', url: data.url ?? '', archived: String(data.archived ?? false), properties: JSON.stringify(data.properties ?? {}) } };
            }

            case 'getDatabase': {
                const databaseId = String(inputs.databaseId ?? '').trim();
                if (!databaseId) throw new Error('databaseId is required.');
                const data = await nt('GET', `/databases/${databaseId}`);
                return { output: { id: data.id ?? '', title: JSON.stringify(data.title ?? []), url: data.url ?? '' } };
            }

            case 'getBlockChildren': {
                const blockId = String(inputs.blockId ?? '').trim();
                if (!blockId) throw new Error('blockId is required.');
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('page_size', String(inputs.pageSize));
                if (inputs.startCursor) params.set('start_cursor', String(inputs.startCursor));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await nt('GET', `/blocks/${blockId}/children${qs}`);
                const results = data.results ?? [];
                return { output: { count: String(results.length), hasMore: String(data.has_more ?? false), results: JSON.stringify(results) } };
            }

            default:
                return { error: `Notion v2 action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Notion v2 action failed.' };
    }
}
