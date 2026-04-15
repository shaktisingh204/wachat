
'use server';

const MONDAY_API_URL = 'https://api.monday.com/v2';

async function mondayGraphQL(apiKey: string, query: string, variables?: Record<string, any>): Promise<any> {
    const res = await fetch(MONDAY_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: apiKey,
            'API-Version': '2024-01',
        },
        body: JSON.stringify({ query, variables: variables || {} }),
    });
    const json = await res.json();
    if (!res.ok) {
        throw new Error(json?.errors?.[0]?.message || `Monday.com error ${res.status}`);
    }
    if (json?.errors?.length) {
        throw new Error(json.errors[0]?.message || 'Monday.com GraphQL error');
    }
    return json?.data;
}

export async function executeMondayBoardAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey: string = inputs.apiKey || inputs.api_key;
        if (!apiKey) throw new Error('Missing Monday.com apiKey in inputs');

        switch (actionName) {
            case 'query': {
                const result = await mondayGraphQL(apiKey, inputs.query, inputs.variables);
                return { output: result };
            }
            case 'getBoard': {
                const result = await mondayGraphQL(apiKey, `
                    query getBoard($id: ID!) {
                        boards(ids: [$id]) {
                            id
                            name
                            description
                            state
                            columns { id title type }
                            groups { id title }
                            items_page(limit: 20) {
                                cursor
                                items { id name }
                            }
                        }
                    }
                `, { id: inputs.boardId || inputs.id });
                return { output: result };
            }
            case 'createBoard': {
                const result = await mondayGraphQL(apiKey, `
                    mutation createBoard($board_name: String!, $board_kind: BoardKind!) {
                        create_board(board_name: $board_name, board_kind: $board_kind) {
                            id
                            name
                        }
                    }
                `, {
                    board_name: inputs.board_name || inputs.name,
                    board_kind: inputs.board_kind || 'public',
                });
                return { output: result };
            }
            case 'deleteBoard': {
                const result = await mondayGraphQL(apiKey, `
                    mutation deleteBoard($board_id: ID!) {
                        delete_board(board_id: $board_id) { id }
                    }
                `, { board_id: inputs.boardId || inputs.board_id || inputs.id });
                return { output: result };
            }
            case 'listGroups': {
                const result = await mondayGraphQL(apiKey, `
                    query listGroups($board_id: ID!) {
                        boards(ids: [$board_id]) {
                            groups { id title color archived }
                        }
                    }
                `, { board_id: inputs.boardId || inputs.board_id });
                return { output: result };
            }
            case 'createGroup': {
                const result = await mondayGraphQL(apiKey, `
                    mutation createGroup($board_id: ID!, $group_name: String!) {
                        create_group(board_id: $board_id, group_name: $group_name) {
                            id
                            title
                        }
                    }
                `, {
                    board_id: inputs.boardId || inputs.board_id,
                    group_name: inputs.group_name || inputs.name,
                });
                return { output: result };
            }
            case 'deleteGroup': {
                const result = await mondayGraphQL(apiKey, `
                    mutation deleteGroup($board_id: ID!, $group_id: String!) {
                        delete_group(board_id: $board_id, group_id: $group_id) {
                            id
                            deleted
                        }
                    }
                `, {
                    board_id: inputs.boardId || inputs.board_id,
                    group_id: inputs.groupId || inputs.group_id,
                });
                return { output: result };
            }
            case 'listItems': {
                const result = await mondayGraphQL(apiKey, `
                    query listItems($board_id: ID!, $limit: Int, $cursor: String) {
                        boards(ids: [$board_id]) {
                            items_page(limit: $limit, cursor: $cursor) {
                                cursor
                                items {
                                    id
                                    name
                                    state
                                    group { id title }
                                    column_values { id text value }
                                }
                            }
                        }
                    }
                `, {
                    board_id: inputs.boardId || inputs.board_id,
                    limit: inputs.limit || 25,
                    cursor: inputs.cursor || null,
                });
                return { output: result };
            }
            case 'getItem': {
                const result = await mondayGraphQL(apiKey, `
                    query getItem($ids: [ID!]!) {
                        items(ids: $ids) {
                            id
                            name
                            state
                            board { id name }
                            group { id title }
                            column_values { id title text value type }
                            updates(limit: 5) { id body creator { id name } }
                        }
                    }
                `, { ids: [inputs.itemId || inputs.id] });
                return { output: result };
            }
            case 'createItem': {
                const result = await mondayGraphQL(apiKey, `
                    mutation createItem($board_id: ID!, $group_id: String, $item_name: String!, $column_values: JSON) {
                        create_item(
                            board_id: $board_id,
                            group_id: $group_id,
                            item_name: $item_name,
                            column_values: $column_values
                        ) {
                            id
                            name
                        }
                    }
                `, {
                    board_id: inputs.boardId || inputs.board_id,
                    group_id: inputs.groupId || inputs.group_id || null,
                    item_name: inputs.item_name || inputs.name,
                    column_values: inputs.column_values
                        ? (typeof inputs.column_values === 'string' ? inputs.column_values : JSON.stringify(inputs.column_values))
                        : null,
                });
                return { output: result };
            }
            case 'updateItem': {
                const result = await mondayGraphQL(apiKey, `
                    mutation updateItem($board_id: ID!, $item_id: ID!, $column_values: JSON!) {
                        change_multiple_column_values(
                            board_id: $board_id,
                            item_id: $item_id,
                            column_values: $column_values
                        ) {
                            id
                            name
                        }
                    }
                `, {
                    board_id: inputs.boardId || inputs.board_id,
                    item_id: inputs.itemId || inputs.item_id || inputs.id,
                    column_values: typeof inputs.column_values === 'string'
                        ? inputs.column_values
                        : JSON.stringify(inputs.column_values),
                });
                return { output: result };
            }
            case 'deleteItem': {
                const result = await mondayGraphQL(apiKey, `
                    mutation deleteItem($item_id: ID!) {
                        delete_item(item_id: $item_id) { id }
                    }
                `, { item_id: inputs.itemId || inputs.item_id || inputs.id });
                return { output: result };
            }
            case 'createUpdate': {
                const result = await mondayGraphQL(apiKey, `
                    mutation createUpdate($item_id: ID!, $body: String!) {
                        create_update(item_id: $item_id, body: $body) {
                            id
                            body
                        }
                    }
                `, {
                    item_id: inputs.itemId || inputs.item_id,
                    body: inputs.body || inputs.text,
                });
                return { output: result };
            }
            case 'listColumns': {
                const result = await mondayGraphQL(apiKey, `
                    query listColumns($board_id: ID!) {
                        boards(ids: [$board_id]) {
                            columns { id title type settings_str }
                        }
                    }
                `, { board_id: inputs.boardId || inputs.board_id });
                return { output: result };
            }
            case 'createColumn': {
                const result = await mondayGraphQL(apiKey, `
                    mutation createColumn($board_id: ID!, $title: String!, $column_type: ColumnType!) {
                        create_column(board_id: $board_id, title: $title, column_type: $column_type) {
                            id
                            title
                            type
                        }
                    }
                `, {
                    board_id: inputs.boardId || inputs.board_id,
                    title: inputs.title,
                    column_type: inputs.column_type || inputs.type,
                });
                return { output: result };
            }
            case 'moveItemToGroup': {
                const result = await mondayGraphQL(apiKey, `
                    mutation moveItemToGroup($item_id: ID!, $group_id: String!) {
                        move_item_to_group(item_id: $item_id, group_id: $group_id) {
                            id
                        }
                    }
                `, {
                    item_id: inputs.itemId || inputs.item_id,
                    group_id: inputs.groupId || inputs.group_id,
                });
                return { output: result };
            }
            default:
                throw new Error(`Unknown Monday.com Board action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.error?.('MondayBoardAction error', err);
        return { error: err?.message || String(err) };
    }
}
