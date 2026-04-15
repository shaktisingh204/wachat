
'use server';

const MIRO_BASE = 'https://api.miro.com/v2';

async function miroFetch(token: string, method: string, path: string, body?: any, logger?: any): Promise<any> {
    logger?.log(`[Miro] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${MIRO_BASE}${path}`, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || data?.description || `Miro API error: ${res.status}`);
    }
    return data;
}

export async function executeMiroAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const token = String(inputs.accessToken ?? '').trim();
        if (!token) throw new Error('accessToken is required.');
        const miro = (method: string, path: string, body?: any) => miroFetch(token, method, path, body, logger);

        switch (actionName) {
            case 'listBoards': {
                const data = await miro('GET', '/boards');
                return { output: { boards: data.data ?? [], total: data.total ?? 0 } };
            }

            case 'getBoard': {
                const boardId = String(inputs.boardId ?? '').trim();
                if (!boardId) throw new Error('boardId is required.');
                const data = await miro('GET', `/boards/${boardId}`);
                return { output: { id: data.id, name: data.name, description: data.description ?? '', viewLink: data.viewLink ?? '' } };
            }

            case 'createBoard': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const body: any = { name };
                if (inputs.description) body.description = String(inputs.description);
                const data = await miro('POST', '/boards', body);
                return { output: { id: data.id, name: data.name, viewLink: data.viewLink ?? '' } };
            }

            case 'updateBoard': {
                const boardId = String(inputs.boardId ?? '').trim();
                if (!boardId) throw new Error('boardId is required.');
                const body: any = {};
                if (inputs.name) body.name = String(inputs.name);
                if (inputs.description !== undefined) body.description = String(inputs.description);
                const data = await miro('PATCH', `/boards/${boardId}`, body);
                return { output: { id: data.id, name: data.name } };
            }

            case 'deleteBoard': {
                const boardId = String(inputs.boardId ?? '').trim();
                if (!boardId) throw new Error('boardId is required.');
                await miro('DELETE', `/boards/${boardId}`);
                return { output: { deleted: 'true', boardId } };
            }

            case 'listItems': {
                const boardId = String(inputs.boardId ?? '').trim();
                if (!boardId) throw new Error('boardId is required.');
                const data = await miro('GET', `/boards/${boardId}/items`);
                return { output: { items: data.data ?? [], total: data.total ?? 0 } };
            }

            case 'createStickyNote': {
                const boardId = String(inputs.boardId ?? '').trim();
                const content = String(inputs.content ?? '').trim();
                if (!boardId) throw new Error('boardId is required.');
                if (!content) throw new Error('content is required.');
                const body: any = { data: { content } };
                if (inputs.fillColor) body.style = { fillColor: String(inputs.fillColor) };
                const data = await miro('POST', `/boards/${boardId}/sticky_notes`, body);
                return { output: { id: data.id, type: data.type } };
            }

            case 'createTextItem': {
                const boardId = String(inputs.boardId ?? '').trim();
                const content = String(inputs.content ?? '').trim();
                if (!boardId) throw new Error('boardId is required.');
                if (!content) throw new Error('content is required.');
                const body: any = { data: { content } };
                const data = await miro('POST', `/boards/${boardId}/texts`, body);
                return { output: { id: data.id, type: data.type } };
            }

            case 'createShape': {
                const boardId = String(inputs.boardId ?? '').trim();
                if (!boardId) throw new Error('boardId is required.');
                const body: any = { data: {} };
                if (inputs.shape) body.data.shape = String(inputs.shape);
                if (inputs.content) body.data.content = String(inputs.content);
                const data = await miro('POST', `/boards/${boardId}/shapes`, body);
                return { output: { id: data.id, type: data.type } };
            }

            case 'createCard': {
                const boardId = String(inputs.boardId ?? '').trim();
                const title = String(inputs.title ?? '').trim();
                if (!boardId) throw new Error('boardId is required.');
                if (!title) throw new Error('title is required.');
                const body: any = { data: { title } };
                if (inputs.description) body.data.description = String(inputs.description);
                if (inputs.dueDate) body.data.dueDate = String(inputs.dueDate);
                const data = await miro('POST', `/boards/${boardId}/cards`, body);
                return { output: { id: data.id, type: data.type } };
            }

            case 'updateItem': {
                const boardId = String(inputs.boardId ?? '').trim();
                const itemId = String(inputs.itemId ?? '').trim();
                if (!boardId) throw new Error('boardId is required.');
                if (!itemId) throw new Error('itemId is required.');
                const body: any = {};
                if (inputs.data) body.data = inputs.data;
                if (inputs.position) body.position = inputs.position;
                const data = await miro('PATCH', `/boards/${boardId}/items/${itemId}`, body);
                return { output: { id: data.id, type: data.type } };
            }

            case 'deleteItem': {
                const boardId = String(inputs.boardId ?? '').trim();
                const itemId = String(inputs.itemId ?? '').trim();
                if (!boardId) throw new Error('boardId is required.');
                if (!itemId) throw new Error('itemId is required.');
                await miro('DELETE', `/boards/${boardId}/items/${itemId}`);
                return { output: { deleted: 'true', itemId } };
            }

            case 'createFrame': {
                const boardId = String(inputs.boardId ?? '').trim();
                if (!boardId) throw new Error('boardId is required.');
                const body: any = { data: { type: 'freeform' } };
                if (inputs.title) body.data.title = String(inputs.title);
                if (inputs.width) body.geometry = { width: Number(inputs.width), height: Number(inputs.height ?? 600) };
                const data = await miro('POST', `/boards/${boardId}/frames`, body);
                return { output: { id: data.id, type: data.type } };
            }

            case 'listMembers': {
                const boardId = String(inputs.boardId ?? '').trim();
                if (!boardId) throw new Error('boardId is required.');
                const data = await miro('GET', `/boards/${boardId}/members`);
                return { output: { members: data.data ?? [], total: data.total ?? 0 } };
            }

            case 'inviteMember': {
                const boardId = String(inputs.boardId ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                const role = String(inputs.role ?? 'viewer').trim();
                if (!boardId) throw new Error('boardId is required.');
                if (!email) throw new Error('email is required.');
                const data = await miro('POST', `/boards/${boardId}/members`, { emails: [email], role });
                return { output: { invited: 'true', email } };
            }

            default:
                return { error: `Miro action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Miro action failed.' };
    }
}
