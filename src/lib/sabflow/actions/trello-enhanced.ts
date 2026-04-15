'use server';

export async function executeTrelloEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE = 'https://api.trello.com/1';

    try {
        const auth = `key=${inputs.apiKey}&token=${inputs.token}`;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };

        let url = '';
        let method = 'GET';
        let body: any = undefined;

        switch (actionName) {
            case 'listBoards': {
                const memberId = inputs.memberId || 'me';
                url = `${BASE}/members/${memberId}/boards?${auth}&fields=${inputs.fields || 'all'}`;
                break;
            }
            case 'getBoard': {
                url = `${BASE}/boards/${inputs.boardId}?${auth}`;
                break;
            }
            case 'createBoard': {
                url = `${BASE}/boards?${auth}`;
                method = 'POST';
                body = JSON.stringify({
                    name: inputs.name,
                    desc: inputs.desc,
                    idOrganization: inputs.idOrganization,
                    prefs_permissionLevel: inputs.permissionLevel,
                    defaultLists: inputs.defaultLists ?? true,
                    idBoardSource: inputs.idBoardSource,
                });
                break;
            }
            case 'updateBoard': {
                url = `${BASE}/boards/${inputs.boardId}?${auth}`;
                method = 'PUT';
                body = JSON.stringify({
                    name: inputs.name,
                    desc: inputs.desc,
                    closed: inputs.closed,
                    prefs: inputs.prefs,
                });
                break;
            }
            case 'listLists': {
                const filter = inputs.filter || 'open';
                url = `${BASE}/boards/${inputs.boardId}/lists?${auth}&filter=${filter}`;
                break;
            }
            case 'createList': {
                url = `${BASE}/lists?${auth}`;
                method = 'POST';
                body = JSON.stringify({
                    name: inputs.name,
                    idBoard: inputs.boardId,
                    pos: inputs.pos,
                    idListSource: inputs.idListSource,
                });
                break;
            }
            case 'archiveList': {
                url = `${BASE}/lists/${inputs.listId}/closed?${auth}`;
                method = 'PUT';
                body = JSON.stringify({ value: inputs.value ?? true });
                break;
            }
            case 'listCards': {
                const filter = inputs.filter || 'open';
                url = `${BASE}/lists/${inputs.listId}/cards?${auth}&filter=${filter}`;
                break;
            }
            case 'getCard': {
                url = `${BASE}/cards/${inputs.cardId}?${auth}`;
                break;
            }
            case 'createCard': {
                url = `${BASE}/cards?${auth}`;
                method = 'POST';
                body = JSON.stringify({
                    name: inputs.name,
                    desc: inputs.desc,
                    pos: inputs.pos,
                    due: inputs.due,
                    dueComplete: inputs.dueComplete,
                    idList: inputs.listId,
                    idMembers: inputs.idMembers,
                    idLabels: inputs.idLabels,
                    urlSource: inputs.urlSource,
                    idCardSource: inputs.idCardSource,
                    keepFromSource: inputs.keepFromSource,
                    address: inputs.address,
                    locationName: inputs.locationName,
                    coordinates: inputs.coordinates,
                });
                break;
            }
            case 'updateCard': {
                url = `${BASE}/cards/${inputs.cardId}?${auth}`;
                method = 'PUT';
                body = JSON.stringify({
                    name: inputs.name,
                    desc: inputs.desc,
                    closed: inputs.closed,
                    idMembers: inputs.idMembers,
                    idAttachmentCover: inputs.idAttachmentCover,
                    idList: inputs.idList,
                    idLabels: inputs.idLabels,
                    idBoard: inputs.idBoard,
                    pos: inputs.pos,
                    due: inputs.due,
                    dueComplete: inputs.dueComplete,
                    subscribed: inputs.subscribed,
                });
                break;
            }
            case 'archiveCard': {
                url = `${BASE}/cards/${inputs.cardId}?${auth}`;
                method = 'PUT';
                body = JSON.stringify({ closed: inputs.closed ?? true });
                break;
            }
            case 'addComment': {
                url = `${BASE}/cards/${inputs.cardId}/actions/comments?${auth}`;
                method = 'POST';
                body = JSON.stringify({ text: inputs.text });
                break;
            }
            case 'addMember': {
                url = `${BASE}/cards/${inputs.cardId}/idMembers?${auth}`;
                method = 'POST';
                body = JSON.stringify({ value: inputs.memberId });
                break;
            }
            case 'listMembers': {
                url = `${BASE}/boards/${inputs.boardId}/members?${auth}`;
                break;
            }
            default:
                return { error: `Unknown Trello Enhanced action: ${actionName}` };
        }

        const res = await fetch(url, {
            method,
            headers,
            body,
        });

        const data = await res.json();

        if (!res.ok) {
            return { error: data.message || data.error || `Trello API error: ${res.status}` };
        }

        return { output: data };
    } catch (err: any) {
        logger.log(`Trello Enhanced action error: ${err.message}`);
        return { error: err.message };
    }
}
