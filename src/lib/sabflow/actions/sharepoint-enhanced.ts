'use server';

export async function executeSharePointEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        const siteId = String(inputs.siteId ?? '').trim();
        switch (actionName) {
            case 'getSite': {
                const id = siteId || String(inputs.targetSiteId ?? '').trim();
                const res = await fetch(`https://graph.microsoft.com/v1.0/sites/${id}`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { site: data } };
            }
            case 'listSites': {
                const params = new URLSearchParams();
                if (inputs.search) params.set('search', String(inputs.search));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const res = await fetch(`https://graph.microsoft.com/v1.0/sites${qs}`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { sites: data.value, count: data.value?.length ?? 0 } };
            }
            case 'listLists': {
                const res = await fetch(`https://graph.microsoft.com/v1.0/sites/${siteId}/lists`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { lists: data.value, count: data.value?.length ?? 0 } };
            }
            case 'getList': {
                const listId = String(inputs.listId ?? '').trim();
                const res = await fetch(`https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { list: data } };
            }
            case 'createList': {
                const body = {
                    displayName: String(inputs.displayName ?? ''),
                    list: {
                        template: inputs.template ?? 'genericList',
                    },
                    columns: inputs.columns ?? [],
                };
                const res = await fetch(`https://graph.microsoft.com/v1.0/sites/${siteId}/lists`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { list: data } };
            }
            case 'listItems': {
                const listId = String(inputs.listId ?? '').trim();
                const params = new URLSearchParams();
                if (inputs.top) params.set('$top', String(inputs.top));
                if (inputs.filter) params.set('$filter', String(inputs.filter));
                params.set('expand', 'fields');
                const qs = params.toString() ? `?${params.toString()}` : '';
                const res = await fetch(`https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items${qs}`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { items: data.value, count: data.value?.length ?? 0 } };
            }
            case 'getItem': {
                const listId = String(inputs.listId ?? '').trim();
                const itemId = String(inputs.itemId ?? '').trim();
                const res = await fetch(`https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items/${itemId}?expand=fields`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { item: data } };
            }
            case 'createItem': {
                const listId = String(inputs.listId ?? '').trim();
                const body = { fields: inputs.fields ?? {} };
                const res = await fetch(`https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { item: data } };
            }
            case 'updateItem': {
                const listId = String(inputs.listId ?? '').trim();
                const itemId = String(inputs.itemId ?? '').trim();
                const body = { fields: inputs.fields ?? {} };
                const res = await fetch(`https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items/${itemId}/fields`, {
                    method: 'PATCH',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body.fields),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { fields: data } };
            }
            case 'deleteItem': {
                const listId = String(inputs.listId ?? '').trim();
                const itemId = String(inputs.itemId ?? '').trim();
                const res = await fetch(`https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items/${itemId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err?.error?.message || `API error: ${res.status}`);
                }
                return { output: { success: true, itemId } };
            }
            case 'uploadFile': {
                const driveId = String(inputs.driveId ?? '').trim();
                const folderPath = String(inputs.folderPath ?? 'root').trim();
                const fileName = String(inputs.fileName ?? '').trim();
                const fileContent = String(inputs.fileContent ?? '');
                const uploadUrl = driveId
                    ? `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root:/${folderPath}/${fileName}:/content`
                    : `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${folderPath}/${fileName}:/content`;
                const res = await fetch(uploadUrl, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': inputs.mimeType ?? 'application/octet-stream',
                    },
                    body: fileContent,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { file: data } };
            }
            case 'getFile': {
                const itemPath = String(inputs.itemPath ?? '').trim();
                const res = await fetch(`https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${itemPath}`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { file: data } };
            }
            case 'searchContent': {
                const query = String(inputs.query ?? '').trim();
                const res = await fetch(`https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root/search(q='${encodeURIComponent(query)}')`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { results: data.value, count: data.value?.length ?? 0 } };
            }
            case 'listSubsites': {
                const res = await fetch(`https://graph.microsoft.com/v1.0/sites/${siteId}/sites`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { subsites: data.value, count: data.value?.length ?? 0 } };
            }
            case 'createFolder': {
                const parentItemId = String(inputs.parentItemId ?? 'root').trim();
                const body = {
                    name: String(inputs.folderName ?? ''),
                    folder: {},
                    '@microsoft.graph.conflictBehavior': inputs.conflictBehavior ?? 'rename',
                };
                const res = await fetch(`https://graph.microsoft.com/v1.0/sites/${siteId}/drive/items/${parentItemId}/children`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { folder: data } };
            }
            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
