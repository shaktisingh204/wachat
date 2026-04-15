
'use server';

import type { WithId, User } from '@/lib/definitions';
import axios from 'axios';

const TRELLO_BASE = 'https://api.trello.com/1';

async function trelloRequest(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    apiKey: string,
    token: string,
    body?: any,
    extra?: Record<string, any>
) {
    const params: Record<string, any> = { key: apiKey, token, ...extra };
    const res = await axios({
        method,
        url: `${TRELLO_BASE}${path}`,
        params,
        data: body,
        headers: { 'Content-Type': 'application/json' },
    });
    return res.data;
}

export async function executeTrelloAction(
    actionName: string,
    inputs: any,
    user: WithId<User>,
    logger: any
) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        const token = String(inputs.token ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');
        if (!token) throw new Error('token is required.');

        switch (actionName) {
            case 'createCard': {
                const listId = String(inputs.listId ?? '').trim();
                const name = String(inputs.name ?? '').trim();
                if (!listId) throw new Error('listId is required.');
                if (!name) throw new Error('name is required.');
                const extra: Record<string, any> = { idList: listId, name };
                if (inputs.desc) extra.desc = String(inputs.desc);
                if (inputs.due) extra.due = String(inputs.due);
                if (inputs.labels) extra.idLabels = String(inputs.labels);
                if (inputs.memberIds) extra.idMembers = String(inputs.memberIds);
                const data = await trelloRequest('POST', '/cards', apiKey, token, undefined, extra);
                logger.log(`[Trello] Created card ${data.id}`);
                return { output: { id: data.id, name: data.name, url: data.url, shortLink: data.shortLink } };
            }

            case 'getCard': {
                const cardId = String(inputs.cardId ?? '').trim();
                if (!cardId) throw new Error('cardId is required.');
                const data = await trelloRequest('GET', `/cards/${cardId}`, apiKey, token);
                return {
                    output: {
                        id: data.id,
                        name: data.name,
                        desc: data.desc,
                        due: data.due,
                        closed: String(data.closed),
                        labels: data.labels,
                        members: data.idMembers,
                        url: data.url,
                    },
                };
            }

            case 'updateCard': {
                const cardId = String(inputs.cardId ?? '').trim();
                if (!cardId) throw new Error('cardId is required.');
                const extra: Record<string, any> = {};
                if (inputs.name !== undefined && inputs.name !== '') extra.name = String(inputs.name);
                if (inputs.desc !== undefined && inputs.desc !== '') extra.desc = String(inputs.desc);
                if (inputs.due !== undefined && inputs.due !== '') extra.due = String(inputs.due);
                if (inputs.closed !== undefined && inputs.closed !== '')
                    extra.closed = String(inputs.closed).toLowerCase() === 'true';
                if (Object.keys(extra).length === 0) throw new Error('At least one field to update is required.');
                await trelloRequest('PUT', `/cards/${cardId}`, apiKey, token, undefined, extra);
                return { output: { success: 'true' } };
            }

            case 'archiveCard': {
                const cardId = String(inputs.cardId ?? '').trim();
                if (!cardId) throw new Error('cardId is required.');
                await trelloRequest('PUT', `/cards/${cardId}`, apiKey, token, undefined, { closed: true });
                logger.log(`[Trello] Archived card ${cardId}`);
                return { output: { success: 'true' } };
            }

            case 'moveCard': {
                const cardId = String(inputs.cardId ?? '').trim();
                const listId = String(inputs.listId ?? '').trim();
                if (!cardId) throw new Error('cardId is required.');
                if (!listId) throw new Error('listId is required.');
                await trelloRequest('PUT', `/cards/${cardId}`, apiKey, token, undefined, { idList: listId });
                logger.log(`[Trello] Moved card ${cardId} to list ${listId}`);
                return { output: { success: 'true' } };
            }

            case 'addCardComment': {
                const cardId = String(inputs.cardId ?? '').trim();
                const text = String(inputs.text ?? '').trim();
                if (!cardId) throw new Error('cardId is required.');
                if (!text) throw new Error('text is required.');
                const data = await trelloRequest('POST', `/cards/${cardId}/actions/comments`, apiKey, token, undefined, { text });
                logger.log(`[Trello] Added comment to card ${cardId}`);
                return { output: { commentId: data.id } };
            }

            case 'addCardAttachment': {
                const cardId = String(inputs.cardId ?? '').trim();
                const url = String(inputs.url ?? '').trim();
                if (!cardId) throw new Error('cardId is required.');
                if (!url) throw new Error('url is required.');
                const extra: Record<string, any> = { url };
                if (inputs.name) extra.name = String(inputs.name);
                const data = await trelloRequest('POST', `/cards/${cardId}/attachments`, apiKey, token, undefined, extra);
                return { output: { id: data.id } };
            }

            case 'addCardChecklist': {
                const cardId = String(inputs.cardId ?? '').trim();
                const name = String(inputs.name ?? '').trim() || 'Checklist';
                if (!cardId) throw new Error('cardId is required.');
                const checklist = await trelloRequest('POST', '/checklists', apiKey, token, undefined, { idCard: cardId, name });
                const items = String(inputs.items ?? '')
                    .split('\n')
                    .map((i: string) => i.trim())
                    .filter(Boolean);
                for (const item of items) {
                    await trelloRequest('POST', `/checklists/${checklist.id}/checkItems`, apiKey, token, undefined, { name: item });
                }
                logger.log(`[Trello] Created checklist ${checklist.id} on card ${cardId}`);
                return { output: { checklistId: checklist.id } };
            }

            case 'getBoard': {
                const boardId = String(inputs.boardId ?? '').trim();
                if (!boardId) throw new Error('boardId is required.');
                const data = await trelloRequest('GET', `/boards/${boardId}`, apiKey, token);
                return { output: { id: data.id, name: data.name, desc: data.desc, url: data.url } };
            }

            case 'getBoardLists': {
                const boardId = String(inputs.boardId ?? '').trim();
                if (!boardId) throw new Error('boardId is required.');
                const data = await trelloRequest('GET', `/boards/${boardId}/lists`, apiKey, token);
                const lists = (data as any[]).map((l: any) => ({ id: l.id, name: l.name }));
                return { output: { lists } };
            }

            case 'createList': {
                const boardId = String(inputs.boardId ?? '').trim();
                const name = String(inputs.name ?? '').trim();
                if (!boardId) throw new Error('boardId is required.');
                if (!name) throw new Error('name is required.');
                const pos = ['top', 'bottom'].includes(String(inputs.pos)) ? String(inputs.pos) : 'bottom';
                const data = await trelloRequest('POST', '/lists', apiKey, token, undefined, { idBoard: boardId, name, pos });
                logger.log(`[Trello] Created list ${data.id} on board ${boardId}`);
                return { output: { id: data.id, name: data.name } };
            }

            case 'getMember': {
                const memberIdOrUsername = String(inputs.memberIdOrUsername ?? '').trim();
                if (!memberIdOrUsername) throw new Error('memberIdOrUsername is required.');
                const data = await trelloRequest('GET', `/members/${memberIdOrUsername}`, apiKey, token, undefined, { fields: 'id,username,fullName,email' });
                return { output: { id: data.id, username: data.username, fullName: data.fullName, email: data.email } };
            }

            case 'addCardMember': {
                const cardId = String(inputs.cardId ?? '').trim();
                const memberId = String(inputs.memberId ?? '').trim();
                if (!cardId) throw new Error('cardId is required.');
                if (!memberId) throw new Error('memberId is required.');
                await trelloRequest('POST', `/cards/${cardId}/idMembers`, apiKey, token, undefined, { value: memberId });
                logger.log(`[Trello] Added member ${memberId} to card ${cardId}`);
                return { output: { success: 'true' } };
            }

            default:
                return { error: `Trello action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        const msg = e?.response?.data?.message || e?.response?.data || e.message || 'Trello action failed.';
        return { error: String(msg) };
    }
}
