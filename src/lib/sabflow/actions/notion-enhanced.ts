'use server';

const NOTION_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

export async function executeNotionEnhancedAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any,
): Promise<{ output: Record<string, any> } | { error: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) return { error: 'NotionEnhanced: apiKey is required.' };

        const headers: Record<string, string> = {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Notion-Version': NOTION_VERSION,
        };

        const request = async (method: string, path: string, body?: any) => {
            logger.log(`[NotionEnhanced] ${method} ${path}`);
            const opts: RequestInit = { method, headers };
            if (body !== undefined) opts.body = JSON.stringify(body);
            const res = await fetch(`${NOTION_BASE}${path}`, opts);
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(
                    data?.message ?? data?.error ?? `Notion API error: ${res.status}`,
                );
            }
            return data;
        };

        const get = (path: string) => request('GET', path);
        const post = (path: string, body: any) => request('POST', path, body);
        const patch = (path: string, body: any) => request('PATCH', path, body);
        const del = (path: string) => request('DELETE', path);

        switch (actionName) {
            case 'listDatabases': {
                const { startCursor, pageSize } = inputs;
                const payload: any = { filter: { value: 'database', property: 'object' } };
                if (startCursor) payload.start_cursor = startCursor;
                if (pageSize) payload.page_size = Number(pageSize);
                const data = await post('/search', payload);
                return {
                    output: {
                        databases: (data.results ?? []).map((d: any) => ({ id: d.id, title: d.title?.[0]?.plain_text ?? '', url: d.url })),
                        hasMore: data.has_more ?? false,
                        nextCursor: data.next_cursor ?? null,
                    },
                };
            }

            case 'queryDatabase': {
                const { databaseId, filter, sorts, startCursor, pageSize } = inputs;
                if (!databaseId) return { error: 'NotionEnhanced queryDatabase: databaseId is required.' };
                const payload: any = {};
                if (filter) payload.filter = typeof filter === 'string' ? JSON.parse(filter) : filter;
                if (sorts) payload.sorts = typeof sorts === 'string' ? JSON.parse(sorts) : sorts;
                if (startCursor) payload.start_cursor = startCursor;
                if (pageSize) payload.page_size = Number(pageSize);
                const data = await post(`/databases/${databaseId}/query`, payload);
                return {
                    output: {
                        results: data.results ?? [],
                        hasMore: data.has_more ?? false,
                        nextCursor: data.next_cursor ?? null,
                        count: (data.results ?? []).length,
                    },
                };
            }

            case 'createDatabase': {
                const { parentPageId, title, properties, isInline } = inputs;
                if (!parentPageId) return { error: 'NotionEnhanced createDatabase: parentPageId is required.' };
                if (!title) return { error: 'NotionEnhanced createDatabase: title is required.' };
                const payload: any = {
                    parent: { type: 'page_id', page_id: parentPageId },
                    title: [{ type: 'text', text: { content: title } }],
                    properties: properties ? (typeof properties === 'string' ? JSON.parse(properties) : properties) : { Name: { title: {} } },
                };
                if (isInline !== undefined) payload.is_inline = isInline;
                const data = await post('/databases', payload);
                return { output: { id: data.id, url: data.url, title: data.title?.[0]?.plain_text ?? '' } };
            }

            case 'getDatabase': {
                const { databaseId } = inputs;
                if (!databaseId) return { error: 'NotionEnhanced getDatabase: databaseId is required.' };
                const data = await get(`/databases/${databaseId}`);
                return {
                    output: {
                        id: data.id,
                        title: data.title?.[0]?.plain_text ?? '',
                        url: data.url,
                        properties: Object.keys(data.properties ?? {}),
                        createdTime: data.created_time,
                        lastEditedTime: data.last_edited_time,
                    },
                };
            }

            case 'updateDatabase': {
                const { databaseId, title, description, properties } = inputs;
                if (!databaseId) return { error: 'NotionEnhanced updateDatabase: databaseId is required.' };
                const payload: any = {};
                if (title) payload.title = [{ type: 'text', text: { content: title } }];
                if (description) payload.description = [{ type: 'text', text: { content: description } }];
                if (properties) payload.properties = typeof properties === 'string' ? JSON.parse(properties) : properties;
                const data = await patch(`/databases/${databaseId}`, payload);
                return { output: { id: data.id, url: data.url } };
            }

            case 'getPage': {
                const { pageId } = inputs;
                if (!pageId) return { error: 'NotionEnhanced getPage: pageId is required.' };
                const data = await get(`/pages/${pageId}`);
                return {
                    output: {
                        id: data.id,
                        url: data.url,
                        archived: data.archived ?? false,
                        properties: data.properties ?? {},
                        parentType: data.parent?.type ?? null,
                        createdTime: data.created_time,
                        lastEditedTime: data.last_edited_time,
                    },
                };
            }

            case 'createPage': {
                const { parentId, parentType, properties, children, icon, cover } = inputs;
                if (!parentId) return { error: 'NotionEnhanced createPage: parentId is required.' };
                const type = parentType ?? 'page_id';
                const payload: any = {
                    parent: { type, [type]: parentId },
                    properties: properties ? (typeof properties === 'string' ? JSON.parse(properties) : properties) : {},
                };
                if (children) payload.children = typeof children === 'string' ? JSON.parse(children) : children;
                if (icon) payload.icon = typeof icon === 'string' ? JSON.parse(icon) : icon;
                if (cover) payload.cover = typeof cover === 'string' ? JSON.parse(cover) : cover;
                const data = await post('/pages', payload);
                return { output: { id: data.id, url: data.url, archived: data.archived ?? false } };
            }

            case 'updatePage': {
                const { pageId, properties, archived, icon, cover } = inputs;
                if (!pageId) return { error: 'NotionEnhanced updatePage: pageId is required.' };
                const payload: any = {};
                if (properties) payload.properties = typeof properties === 'string' ? JSON.parse(properties) : properties;
                if (archived !== undefined) payload.archived = archived;
                if (icon) payload.icon = typeof icon === 'string' ? JSON.parse(icon) : icon;
                if (cover) payload.cover = typeof cover === 'string' ? JSON.parse(cover) : cover;
                const data = await patch(`/pages/${pageId}`, payload);
                return { output: { id: data.id, url: data.url, archived: data.archived ?? false } };
            }

            case 'archivePage': {
                const { pageId } = inputs;
                if (!pageId) return { error: 'NotionEnhanced archivePage: pageId is required.' };
                const data = await patch(`/pages/${pageId}`, { archived: true });
                return { output: { id: data.id, archived: true } };
            }

            case 'getBlock': {
                const { blockId } = inputs;
                if (!blockId) return { error: 'NotionEnhanced getBlock: blockId is required.' };
                const data = await get(`/blocks/${blockId}`);
                return {
                    output: {
                        id: data.id,
                        type: data.type,
                        hasChildren: data.has_children ?? false,
                        archived: data.archived ?? false,
                        createdTime: data.created_time,
                        lastEditedTime: data.last_edited_time,
                    },
                };
            }

            case 'getBlockChildren': {
                const { blockId, startCursor, pageSize } = inputs;
                if (!blockId) return { error: 'NotionEnhanced getBlockChildren: blockId is required.' };
                const params = new URLSearchParams();
                if (startCursor) params.set('start_cursor', startCursor);
                if (pageSize) params.set('page_size', String(pageSize));
                const qs = params.toString();
                const data = await get(`/blocks/${blockId}/children${qs ? '?' + qs : ''}`);
                return {
                    output: {
                        results: data.results ?? [],
                        hasMore: data.has_more ?? false,
                        nextCursor: data.next_cursor ?? null,
                        count: (data.results ?? []).length,
                    },
                };
            }

            case 'appendBlockChildren': {
                const { blockId, children } = inputs;
                if (!blockId) return { error: 'NotionEnhanced appendBlockChildren: blockId is required.' };
                if (!children) return { error: 'NotionEnhanced appendBlockChildren: children is required.' };
                const childrenArr = typeof children === 'string' ? JSON.parse(children) : children;
                const data = await patch(`/blocks/${blockId}/children`, { children: childrenArr });
                return { output: { results: data.results ?? [], count: (data.results ?? []).length } };
            }

            case 'updateBlock': {
                const { blockId, blockData, archived } = inputs;
                if (!blockId) return { error: 'NotionEnhanced updateBlock: blockId is required.' };
                const payload: any = typeof blockData === 'string' ? JSON.parse(blockData) : (blockData ?? {});
                if (archived !== undefined) payload.archived = archived;
                const data = await patch(`/blocks/${blockId}`, payload);
                return { output: { id: data.id, type: data.type, archived: data.archived ?? false } };
            }

            case 'deleteBlock': {
                const { blockId } = inputs;
                if (!blockId) return { error: 'NotionEnhanced deleteBlock: blockId is required.' };
                const data = await del(`/blocks/${blockId}`);
                return { output: { id: data.id, archived: data.archived ?? true } };
            }

            case 'searchPages': {
                const { query, startCursor, pageSize, filterType } = inputs;
                const payload: any = {};
                if (query) payload.query = query;
                if (filterType) payload.filter = { value: filterType ?? 'page', property: 'object' };
                if (startCursor) payload.start_cursor = startCursor;
                if (pageSize) payload.page_size = Number(pageSize);
                const data = await post('/search', payload);
                return {
                    output: {
                        results: (data.results ?? []).map((r: any) => ({
                            id: r.id,
                            object: r.object,
                            url: r.url,
                            title: r.properties?.title?.title?.[0]?.plain_text
                                ?? r.title?.[0]?.plain_text
                                ?? '',
                            archived: r.archived ?? false,
                        })),
                        hasMore: data.has_more ?? false,
                        nextCursor: data.next_cursor ?? null,
                        count: (data.results ?? []).length,
                    },
                };
            }

            default:
                logger.log(`NotionEnhanced: unknown action "${actionName}"`);
                return { error: `NotionEnhanced: unknown action "${actionName}"` };
        }
    } catch (err: any) {
        logger.log(`NotionEnhanced action "${actionName}" error: ${err.message}`);
        return { error: err.message ?? 'NotionEnhanced: unknown error' };
    }
}
