'use server';

async function wekanLogin(serverUrl: string, username: string, password: string, logger?: any): Promise<{ token: string; userId: string }> {
    logger?.log('[Wekan] Authenticating...');
    const res = await fetch(`${serverUrl}/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    });
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = text; }
    if (!res.ok) throw new Error(data?.message || data?.error || `Wekan login error: ${res.status}`);
    if (!data.token) throw new Error('Wekan login did not return a token.');
    return { token: data.token, userId: data.id };
}

async function wekanFetch(serverUrl: string, token: string, method: string, path: string, body?: any, logger?: any): Promise<any> {
    logger?.log(`[Wekan] ${method} ${path}`);
    const res = await fetch(`${serverUrl}${path}`, {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (res.status === 200 && res.headers.get('content-length') === '0') return { success: true };
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = text; }
    if (!res.ok) throw new Error(data?.message || data?.error || `Wekan API error: ${res.status}`);
    return data;
}

export async function executeWekanAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const serverUrl = String(inputs.serverUrl ?? '').replace(/\/$/, '');
        if (!serverUrl) throw new Error('serverUrl is required.');
        const username = String(inputs.username ?? '').trim();
        const password = String(inputs.password ?? '').trim();

        // Auto-login helper: use provided token or fetch a new one
        let token = String(inputs.token ?? '').trim();
        let userId = String(inputs.userId ?? '').trim();

        const ensureAuth = async () => {
            if (!token) {
                if (!username || !password) throw new Error('username and password are required when no token is provided.');
                const auth = await wekanLogin(serverUrl, username, password, logger);
                token = auth.token;
                userId = auth.userId;
            }
        };

        switch (actionName) {
            case 'login': {
                if (!username) throw new Error('username is required.');
                if (!password) throw new Error('password is required.');
                const auth = await wekanLogin(serverUrl, username, password, logger);
                return { output: { token: auth.token, userId: auth.userId } };
            }

            case 'listBoards': {
                await ensureAuth();
                const targetUserId = inputs.targetUserId ? String(inputs.targetUserId) : userId;
                const data = await wekanFetch(serverUrl, token, 'GET', `/api/users/${targetUserId}/boards`, undefined, logger);
                return { output: { boards: Array.isArray(data) ? data : [] } };
            }

            case 'getBoard': {
                await ensureAuth();
                const boardId = String(inputs.boardId ?? '').trim();
                if (!boardId) throw new Error('boardId is required.');
                const data = await wekanFetch(serverUrl, token, 'GET', `/api/boards/${boardId}`, undefined, logger);
                return { output: data };
            }

            case 'createBoard': {
                await ensureAuth();
                const title = String(inputs.title ?? '').trim();
                if (!title) throw new Error('title is required.');
                const payload: any = { title, owner: userId };
                if (inputs.isAdmin !== undefined) payload.isAdmin = Boolean(inputs.isAdmin);
                if (inputs.isActive !== undefined) payload.isActive = Boolean(inputs.isActive);
                if (inputs.isNoComments !== undefined) payload.isNoComments = Boolean(inputs.isNoComments);
                if (inputs.permission) payload.permission = String(inputs.permission);
                const data = await wekanFetch(serverUrl, token, 'POST', '/api/boards', payload, logger);
                return { output: { _id: data._id, title } };
            }

            case 'listLists': {
                await ensureAuth();
                const boardId = String(inputs.boardId ?? '').trim();
                if (!boardId) throw new Error('boardId is required.');
                const data = await wekanFetch(serverUrl, token, 'GET', `/api/boards/${boardId}/lists`, undefined, logger);
                return { output: { lists: Array.isArray(data) ? data : [] } };
            }

            case 'createList': {
                await ensureAuth();
                const boardId = String(inputs.boardId ?? '').trim();
                if (!boardId) throw new Error('boardId is required.');
                const title = String(inputs.title ?? '').trim();
                if (!title) throw new Error('title is required.');
                const data = await wekanFetch(serverUrl, token, 'POST', `/api/boards/${boardId}/lists`, { title }, logger);
                return { output: { _id: data._id, title } };
            }

            case 'listCards': {
                await ensureAuth();
                const boardId = String(inputs.boardId ?? '').trim();
                if (!boardId) throw new Error('boardId is required.');
                const listId = String(inputs.listId ?? '').trim();
                if (!listId) throw new Error('listId is required.');
                const data = await wekanFetch(serverUrl, token, 'GET', `/api/boards/${boardId}/lists/${listId}/cards`, undefined, logger);
                return { output: { cards: Array.isArray(data) ? data : [] } };
            }

            case 'getCard': {
                await ensureAuth();
                const boardId = String(inputs.boardId ?? '').trim();
                if (!boardId) throw new Error('boardId is required.');
                const listId = String(inputs.listId ?? '').trim();
                if (!listId) throw new Error('listId is required.');
                const cardId = String(inputs.cardId ?? '').trim();
                if (!cardId) throw new Error('cardId is required.');
                const data = await wekanFetch(serverUrl, token, 'GET', `/api/boards/${boardId}/lists/${listId}/cards/${cardId}`, undefined, logger);
                return { output: data };
            }

            case 'createCard': {
                await ensureAuth();
                const boardId = String(inputs.boardId ?? '').trim();
                if (!boardId) throw new Error('boardId is required.');
                const listId = String(inputs.listId ?? '').trim();
                if (!listId) throw new Error('listId is required.');
                const title = String(inputs.title ?? '').trim();
                if (!title) throw new Error('title is required.');
                const payload: any = { title, authorId: userId };
                if (inputs.description) payload.description = String(inputs.description);
                if (inputs.assignees) payload.assignees = inputs.assignees;
                if (inputs.dueAt) payload.dueAt = String(inputs.dueAt);
                const data = await wekanFetch(serverUrl, token, 'POST', `/api/boards/${boardId}/lists/${listId}/cards`, payload, logger);
                return { output: { _id: data._id, title } };
            }

            case 'updateCard': {
                await ensureAuth();
                const boardId = String(inputs.boardId ?? '').trim();
                if (!boardId) throw new Error('boardId is required.');
                const listId = String(inputs.listId ?? '').trim();
                if (!listId) throw new Error('listId is required.');
                const cardId = String(inputs.cardId ?? '').trim();
                if (!cardId) throw new Error('cardId is required.');
                const payload: any = {};
                if (inputs.title) payload.title = String(inputs.title);
                if (inputs.description !== undefined) payload.description = String(inputs.description);
                if (inputs.listId2) payload.listId = String(inputs.listId2);
                if (inputs.dueAt) payload.dueAt = String(inputs.dueAt);
                if (inputs.assignees) payload.assignees = inputs.assignees;
                const data = await wekanFetch(serverUrl, token, 'PUT', `/api/boards/${boardId}/lists/${listId}/cards/${cardId}`, payload, logger);
                return { output: { updated: true, response: data } };
            }

            case 'deleteCard': {
                await ensureAuth();
                const boardId = String(inputs.boardId ?? '').trim();
                if (!boardId) throw new Error('boardId is required.');
                const listId = String(inputs.listId ?? '').trim();
                if (!listId) throw new Error('listId is required.');
                const cardId = String(inputs.cardId ?? '').trim();
                if (!cardId) throw new Error('cardId is required.');
                await wekanFetch(serverUrl, token, 'DELETE', `/api/boards/${boardId}/lists/${listId}/cards/${cardId}`, undefined, logger);
                return { output: { deleted: true } };
            }

            case 'addComment': {
                await ensureAuth();
                const boardId = String(inputs.boardId ?? '').trim();
                if (!boardId) throw new Error('boardId is required.');
                const cardId = String(inputs.cardId ?? '').trim();
                if (!cardId) throw new Error('cardId is required.');
                const comment = String(inputs.comment ?? '').trim();
                if (!comment) throw new Error('comment is required.');
                const data = await wekanFetch(serverUrl, token, 'POST', `/api/boards/${boardId}/cards/${cardId}/comments`, { authorId: userId, comment }, logger);
                return { output: { _id: data._id, comment } };
            }

            case 'listMembers': {
                await ensureAuth();
                const boardId = String(inputs.boardId ?? '').trim();
                if (!boardId) throw new Error('boardId is required.');
                const data = await wekanFetch(serverUrl, token, 'GET', `/api/boards/${boardId}/members`, undefined, logger);
                return { output: { members: Array.isArray(data) ? data : [] } };
            }

            default:
                return { error: `Wekan action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Wekan action failed.' };
    }
}
