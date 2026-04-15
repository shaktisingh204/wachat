'use server';

export async function executeMondayEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const endpoint = 'https://api.monday.com/v2';
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${inputs.apiKey}`,
            'Content-Type': 'application/json',
            'API-Version': '2024-01',
        };

        async function gql(query: string, variables: Record<string, any> = {}) {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify({ query, variables }),
            });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Monday.com API error: ${res.status} ${text}`);
            }
            const json = await res.json();
            if (json.errors && json.errors.length > 0) {
                throw new Error(json.errors.map((e: any) => e.message).join(', '));
            }
            return json.data;
        }

        switch (actionName) {
            case 'listBoards': {
                const data = await gql(
                    `query ($limit: Int, $page: Int) {
                        boards(limit: $limit, page: $page) {
                            id name description state board_kind
                        }
                    }`,
                    { limit: inputs.limit || 25, page: inputs.page || 1 }
                );
                return { output: data };
            }

            case 'getBoard': {
                const data = await gql(
                    `query ($id: ID!) {
                        boards(ids: [$id]) {
                            id name description state board_kind
                            columns { id title type settings_str }
                            groups { id title color position }
                        }
                    }`,
                    { id: inputs.boardId }
                );
                return { output: data };
            }

            case 'createBoard': {
                const data = await gql(
                    `mutation ($boardName: String!, $boardKind: BoardKind!, $workspaceId: ID) {
                        create_board(board_name: $boardName, board_kind: $boardKind, workspace_id: $workspaceId) {
                            id name
                        }
                    }`,
                    {
                        boardName: inputs.boardName,
                        boardKind: inputs.boardKind || 'public',
                        workspaceId: inputs.workspaceId || null,
                    }
                );
                return { output: data };
            }

            case 'listItems': {
                const data = await gql(
                    `query ($boardId: ID!, $limit: Int, $page: Int) {
                        boards(ids: [$boardId]) {
                            items_page(limit: $limit) {
                                cursor
                                items {
                                    id name state
                                    column_values { id text value }
                                }
                            }
                        }
                    }`,
                    { boardId: inputs.boardId, limit: inputs.limit || 25, page: inputs.page || 1 }
                );
                return { output: data };
            }

            case 'getItem': {
                const data = await gql(
                    `query ($id: ID!) {
                        items(ids: [$id]) {
                            id name state
                            column_values { id title text value }
                            board { id name }
                            group { id title }
                        }
                    }`,
                    { id: inputs.itemId }
                );
                return { output: data };
            }

            case 'createItem': {
                const data = await gql(
                    `mutation ($boardId: ID!, $itemName: String!, $groupId: String, $columnValues: JSON) {
                        create_item(board_id: $boardId, item_name: $itemName, group_id: $groupId, column_values: $columnValues) {
                            id name
                        }
                    }`,
                    {
                        boardId: inputs.boardId,
                        itemName: inputs.itemName,
                        groupId: inputs.groupId || null,
                        columnValues: inputs.columnValues ? JSON.stringify(inputs.columnValues) : null,
                    }
                );
                return { output: data };
            }

            case 'updateItem': {
                const data = await gql(
                    `mutation ($boardId: ID!, $itemId: ID!, $columnId: String!, $value: JSON!) {
                        change_column_value(board_id: $boardId, item_id: $itemId, column_id: $columnId, value: $value) {
                            id name
                        }
                    }`,
                    {
                        boardId: inputs.boardId,
                        itemId: inputs.itemId,
                        columnId: inputs.columnId,
                        value: JSON.stringify(inputs.value),
                    }
                );
                return { output: data };
            }

            case 'deleteItem': {
                const data = await gql(
                    `mutation ($itemId: ID!) {
                        delete_item(item_id: $itemId) { id }
                    }`,
                    { itemId: inputs.itemId }
                );
                return { output: data };
            }

            case 'listColumns': {
                const data = await gql(
                    `query ($boardId: ID!) {
                        boards(ids: [$boardId]) {
                            columns { id title type settings_str }
                        }
                    }`,
                    { boardId: inputs.boardId }
                );
                return { output: data };
            }

            case 'createColumn': {
                const data = await gql(
                    `mutation ($boardId: ID!, $title: String!, $columnType: ColumnType!, $defaults: JSON) {
                        create_column(board_id: $boardId, title: $title, column_type: $columnType, defaults: $defaults) {
                            id title type
                        }
                    }`,
                    {
                        boardId: inputs.boardId,
                        title: inputs.title,
                        columnType: inputs.columnType,
                        defaults: inputs.defaults ? JSON.stringify(inputs.defaults) : null,
                    }
                );
                return { output: data };
            }

            case 'listGroups': {
                const data = await gql(
                    `query ($boardId: ID!) {
                        boards(ids: [$boardId]) {
                            groups { id title color position }
                        }
                    }`,
                    { boardId: inputs.boardId }
                );
                return { output: data };
            }

            case 'createGroup': {
                const data = await gql(
                    `mutation ($boardId: ID!, $groupName: String!) {
                        create_group(board_id: $boardId, group_name: $groupName) {
                            id title
                        }
                    }`,
                    { boardId: inputs.boardId, groupName: inputs.groupName }
                );
                return { output: data };
            }

            case 'deleteGroup': {
                const data = await gql(
                    `mutation ($boardId: ID!, $groupId: String!) {
                        delete_group(board_id: $boardId, group_id: $groupId) {
                            id deleted
                        }
                    }`,
                    { boardId: inputs.boardId, groupId: inputs.groupId }
                );
                return { output: data };
            }

            case 'uploadFile': {
                const data = await gql(
                    `mutation ($itemId: ID!, $columnId: String!, $file: File!) {
                        add_file_to_column(item_id: $itemId, column_id: $columnId, file: $file) {
                            id name url
                        }
                    }`,
                    {
                        itemId: inputs.itemId,
                        columnId: inputs.columnId,
                        file: inputs.file,
                    }
                );
                return { output: data };
            }

            case 'createUpdate': {
                const data = await gql(
                    `mutation ($itemId: ID!, $body: String!) {
                        create_update(item_id: $itemId, body: $body) {
                            id body created_at
                        }
                    }`,
                    { itemId: inputs.itemId, body: inputs.body }
                );
                return { output: data };
            }

            default:
                return { error: `Unknown Monday.com action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Monday Enhanced Action error: ${err.message}`);
        return { error: err.message || 'Monday Enhanced Action failed' };
    }
}
