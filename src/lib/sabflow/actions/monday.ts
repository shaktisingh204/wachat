
'use server';

const MONDAY_BASE = 'https://api.monday.com/v2';

async function mondayQuery(apiKey: string, query: string, variables?: any, logger?: any) {
    logger?.log(`[Monday.com] GraphQL query`);
    const res = await fetch(MONDAY_BASE, {
        method: 'POST',
        headers: {
            Authorization: apiKey,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, variables }),
    });
    const data = await res.json();
    if (!res.ok || data?.errors) {
        throw new Error(data?.errors?.[0]?.message || `Monday.com API error: ${res.status}`);
    }
    return data.data;
}

export async function executeMondayAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');
        const mq = (query: string, variables?: any) => mondayQuery(apiKey, query, variables, logger);

        switch (actionName) {
            case 'createItem': {
                const boardId = String(inputs.boardId ?? '').trim();
                const itemName = String(inputs.itemName ?? '').trim();
                const columnValues = inputs.columnValues;
                if (!boardId || !itemName) throw new Error('boardId and itemName are required.');
                const colValStr = columnValues ? (typeof columnValues === 'string' ? columnValues : JSON.stringify(columnValues)) : '{}';
                const query = `mutation ($boardId: ID!, $itemName: String!, $colVals: JSON) { create_item(board_id: $boardId, item_name: $itemName, column_values: $colVals) { id name } }`;
                const data = await mq(query, { boardId, itemName, colVals: colValStr });
                return { output: { id: String(data.create_item.id), name: data.create_item.name } };
            }

            case 'getItem': {
                const itemId = String(inputs.itemId ?? '').trim();
                if (!itemId) throw new Error('itemId is required.');
                const query = `query ($ids: [ID!]) { items(ids: $ids) { id name state column_values { id text value } } }`;
                const data = await mq(query, { ids: [itemId] });
                const item = data.items?.[0] ?? null;
                return { output: { id: String(item?.id ?? ''), name: item?.name ?? '', state: item?.state ?? '', columnValues: item?.column_values ?? [] } };
            }

            case 'updateItem': {
                const boardId = String(inputs.boardId ?? '').trim();
                const itemId = String(inputs.itemId ?? '').trim();
                const columnValues = inputs.columnValues;
                if (!boardId || !itemId) throw new Error('boardId and itemId are required.');
                const colValStr = typeof columnValues === 'string' ? columnValues : JSON.stringify(columnValues ?? {});
                const query = `mutation ($boardId: ID!, $itemId: ID!, $colVals: JSON!) { change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $colVals) { id name } }`;
                const data = await mq(query, { boardId, itemId, colVals: colValStr });
                return { output: { id: String(data.change_multiple_column_values?.id ?? itemId) } };
            }

            case 'deleteItem': {
                const itemId = String(inputs.itemId ?? '').trim();
                if (!itemId) throw new Error('itemId is required.');
                const query = `mutation ($itemId: ID!) { delete_item(item_id: $itemId) { id } }`;
                const data = await mq(query, { itemId });
                return { output: { deleted: 'true', id: String(data.delete_item?.id ?? itemId) } };
            }

            case 'archiveItem': {
                const itemId = String(inputs.itemId ?? '').trim();
                if (!itemId) throw new Error('itemId is required.');
                const query = `mutation ($itemId: ID!) { archive_item(item_id: $itemId) { id state } }`;
                const data = await mq(query, { itemId });
                return { output: { state: data.archive_item?.state ?? 'archived' } };
            }

            case 'getBoard': {
                const boardId = String(inputs.boardId ?? '').trim();
                if (!boardId) throw new Error('boardId is required.');
                const query = `query ($ids: [ID!]) { boards(ids: $ids) { id name state columns { id title type } } }`;
                const data = await mq(query, { ids: [boardId] });
                const board = data.boards?.[0] ?? null;
                return { output: { id: String(board?.id ?? ''), name: board?.name ?? '', state: board?.state ?? '', columns: board?.columns ?? [] } };
            }

            case 'listBoards': {
                const limit = Number(inputs.limit ?? 50);
                const query = `query { boards(limit: ${limit}) { id name state } }`;
                const data = await mq(query);
                return { output: { boards: data.boards ?? [], count: (data.boards ?? []).length } };
            }

            case 'listItems': {
                const boardId = String(inputs.boardId ?? '').trim();
                const limit = Number(inputs.limit ?? 50);
                if (!boardId) throw new Error('boardId is required.');
                const query = `query ($ids: [ID!]) { boards(ids: $ids) { items_page(limit: ${limit}) { items { id name state } } } }`;
                const data = await mq(query, { ids: [boardId] });
                const items = data.boards?.[0]?.items_page?.items ?? [];
                return { output: { items, count: items.length } };
            }

            case 'createUpdate': {
                const itemId = String(inputs.itemId ?? '').trim();
                const body = String(inputs.body ?? '').trim();
                if (!itemId || !body) throw new Error('itemId and body are required.');
                const query = `mutation ($itemId: ID!, $body: String!) { create_update(item_id: $itemId, body: $body) { id body } }`;
                const data = await mq(query, { itemId, body });
                return { output: { id: String(data.create_update?.id ?? ''), body: data.create_update?.body ?? '' } };
            }

            case 'createGroup': {
                const boardId = String(inputs.boardId ?? '').trim();
                const groupName = String(inputs.groupName ?? '').trim();
                if (!boardId || !groupName) throw new Error('boardId and groupName are required.');
                const query = `mutation ($boardId: ID!, $groupName: String!) { create_group(board_id: $boardId, group_name: $groupName) { id title } }`;
                const data = await mq(query, { boardId, groupName });
                return { output: { id: data.create_group?.id ?? '', title: data.create_group?.title ?? '' } };
            }

            case 'searchItems': {
                const boardId = String(inputs.boardId ?? '').trim();
                const term = String(inputs.term ?? '').trim();
                if (!boardId || !term) throw new Error('boardId and term are required.');
                const query = `query ($ids: [ID!]) { boards(ids: $ids) { items_page { items { id name } } } }`;
                const data = await mq(query, { ids: [boardId] });
                const all = data.boards?.[0]?.items_page?.items ?? [];
                const filtered = all.filter((i: any) => i.name?.toLowerCase().includes(term.toLowerCase()));
                return { output: { items: filtered, count: filtered.length } };
            }

            default:
                return { error: `Monday.com action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Monday.com action failed.' };
    }
}
