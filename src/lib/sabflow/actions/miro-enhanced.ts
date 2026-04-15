'use server';

export async function executeMiroEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE = 'https://api.miro.com/v2';
    const token = inputs.accessToken;

    try {
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };

        let url = '';
        let method = 'GET';
        let body: any = undefined;

        switch (actionName) {
            case 'listBoards':
                url = `${BASE}/boards`;
                if (inputs.query) url += `?query=${encodeURIComponent(inputs.query)}`;
                break;

            case 'getBoard':
                url = `${BASE}/boards/${inputs.boardId}`;
                break;

            case 'createBoard':
                url = `${BASE}/boards`;
                method = 'POST';
                body = JSON.stringify({
                    name: inputs.name,
                    description: inputs.description || '',
                    policy: inputs.policy || {},
                });
                break;

            case 'updateBoard':
                url = `${BASE}/boards/${inputs.boardId}`;
                method = 'PATCH';
                body = JSON.stringify({
                    name: inputs.name,
                    description: inputs.description,
                });
                break;

            case 'deleteBoard':
                url = `${BASE}/boards/${inputs.boardId}`;
                method = 'DELETE';
                break;

            case 'createStickyNote':
                url = `${BASE}/boards/${inputs.boardId}/sticky_notes`;
                method = 'POST';
                body = JSON.stringify({
                    data: { content: inputs.content, shape: inputs.shape || 'square' },
                    style: inputs.style || {},
                    position: inputs.position || { x: 0, y: 0, origin: 'center' },
                    geometry: inputs.geometry || {},
                });
                break;

            case 'getStickyNote':
                url = `${BASE}/boards/${inputs.boardId}/sticky_notes/${inputs.itemId}`;
                break;

            case 'updateStickyNote':
                url = `${BASE}/boards/${inputs.boardId}/sticky_notes/${inputs.itemId}`;
                method = 'PATCH';
                body = JSON.stringify({
                    data: { content: inputs.content, shape: inputs.shape },
                    style: inputs.style || {},
                    position: inputs.position || {},
                });
                break;

            case 'deleteStickyNote':
                url = `${BASE}/boards/${inputs.boardId}/sticky_notes/${inputs.itemId}`;
                method = 'DELETE';
                break;

            case 'createShape':
                url = `${BASE}/boards/${inputs.boardId}/shapes`;
                method = 'POST';
                body = JSON.stringify({
                    data: { content: inputs.content || '', shape: inputs.shape || 'rectangle' },
                    style: inputs.style || {},
                    position: inputs.position || { x: 0, y: 0, origin: 'center' },
                    geometry: inputs.geometry || { width: 200, height: 100 },
                });
                break;

            case 'createCard':
                url = `${BASE}/boards/${inputs.boardId}/cards`;
                method = 'POST';
                body = JSON.stringify({
                    data: {
                        title: inputs.title || '',
                        description: inputs.description || '',
                        assigneeId: inputs.assigneeId || '',
                        dueDate: inputs.dueDate || '',
                    },
                    style: inputs.style || {},
                    position: inputs.position || { x: 0, y: 0, origin: 'center' },
                    geometry: inputs.geometry || {},
                });
                break;

            case 'createFrame':
                url = `${BASE}/boards/${inputs.boardId}/frames`;
                method = 'POST';
                body = JSON.stringify({
                    data: { title: inputs.title || '', format: inputs.format || 'custom', type: inputs.type || 'freeform' },
                    position: inputs.position || { x: 0, y: 0, origin: 'center' },
                    geometry: inputs.geometry || { width: 800, height: 600 },
                });
                break;

            case 'createConnector':
                url = `${BASE}/boards/${inputs.boardId}/connectors`;
                method = 'POST';
                body = JSON.stringify({
                    startItem: inputs.startItem || {},
                    endItem: inputs.endItem || {},
                    captions: inputs.captions || [],
                    style: inputs.style || {},
                });
                break;

            case 'listBoardMembers':
                url = `${BASE}/boards/${inputs.boardId}/members`;
                break;

            case 'shareBoardWithUser':
                url = `${BASE}/boards/${inputs.boardId}/members`;
                method = 'POST';
                body = JSON.stringify({
                    emails: inputs.emails,
                    role: inputs.role || 'viewer',
                    message: inputs.message || '',
                });
                break;

            default:
                return { error: `Unknown Miro Enhanced action: ${actionName}` };
        }

        const response = await fetch(url, {
            method,
            headers,
            ...(body ? { body } : {}),
        });

        if (response.status === 204) {
            logger.log(`Miro Enhanced [${actionName}] succeeded (no content)`);
            return { output: { success: true } };
        }

        const data = await response.json();

        if (!response.ok) {
            logger.log(`Miro Enhanced API error [${actionName}]: ${response.status}`, data);
            return { error: data.message || data.description || `Miro API error: ${response.status}` };
        }

        logger.log(`Miro Enhanced [${actionName}] succeeded`);
        return { output: data };
    } catch (err: any) {
        logger.log(`Miro Enhanced action error [${actionName}]: ${err.message}`);
        return { error: err.message || 'Miro Enhanced action failed' };
    }
}
