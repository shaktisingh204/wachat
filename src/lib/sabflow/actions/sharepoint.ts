
'use server';

export async function executeSharepointAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');

        const siteId = String(inputs.siteId ?? '').trim();
        const graphBase = 'https://graph.microsoft.com/v1.0';
        const siteBase = `${graphBase}/sites/${siteId}`;

        const headers: Record<string, string> = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        async function graphFetch(url: string, method: string = 'GET', body?: any): Promise<any> {
            const opts: RequestInit = { method, headers };
            if (body !== undefined) opts.body = JSON.stringify(body);
            const res = await fetch(url, opts);
            if (method === 'DELETE' && res.status === 204) return { status: 'deleted' };
            const data = await res.json();
            if (!res.ok) throw new Error(data.error?.message ?? JSON.stringify(data));
            return data;
        }

        switch (actionName) {
            case 'listSites': {
                const searchQuery = String(inputs.search ?? '*').trim();
                const url = `${graphBase}/sites?search=${encodeURIComponent(searchQuery)}`;
                const data = await graphFetch(url);
                logger.log(`[SharePoint] Listed ${data.value?.length ?? 0} sites`);
                return { output: { sites: data.value ?? [], count: String(data.value?.length ?? 0) } };
            }

            case 'getSite': {
                const targetSiteId = String(inputs.targetSiteId ?? siteId ?? '').trim();
                if (!targetSiteId) throw new Error('siteId or targetSiteId is required.');
                const data = await graphFetch(`${graphBase}/sites/${targetSiteId}`);
                return { output: { site: data } };
            }

            case 'listLists': {
                if (!siteId) throw new Error('siteId is required.');
                const data = await graphFetch(`${siteBase}/lists`);
                return { output: { lists: data.value ?? [], count: String(data.value?.length ?? 0) } };
            }

            case 'getList': {
                const listId = String(inputs.listId ?? '').trim();
                if (!siteId || !listId) throw new Error('siteId and listId are required.');
                const data = await graphFetch(`${siteBase}/lists/${listId}`);
                return { output: { list: data } };
            }

            case 'createList': {
                if (!siteId) throw new Error('siteId is required.');
                const displayName = String(inputs.displayName ?? inputs.name ?? '').trim();
                if (!displayName) throw new Error('displayName is required.');
                const body: Record<string, any> = { displayName };
                if (inputs.description) body.description = inputs.description;
                if (inputs.template) body.list = { template: inputs.template };
                if (inputs.columns) body.columns = inputs.columns;
                const data = await graphFetch(`${siteBase}/lists`, 'POST', body);
                return { output: { list: data, status: 'created' } };
            }

            case 'listListItems': {
                const listId = String(inputs.listId ?? '').trim();
                if (!siteId || !listId) throw new Error('siteId and listId are required.');
                let url = `${siteBase}/lists/${listId}/items?expand=fields`;
                if (inputs.filter) url += `&$filter=${encodeURIComponent(inputs.filter)}`;
                if (inputs.top) url += `&$top=${inputs.top}`;
                if (inputs.skipToken) url += `&$skipToken=${inputs.skipToken}`;
                const data = await graphFetch(url);
                logger.log(`[SharePoint] Listed ${data.value?.length ?? 0} items`);
                return { output: { items: data.value ?? [], count: String(data.value?.length ?? 0), nextLink: data['@odata.nextLink'] ?? null } };
            }

            case 'getListItem': {
                const listId = String(inputs.listId ?? '').trim();
                const itemId = String(inputs.itemId ?? '').trim();
                if (!siteId || !listId || !itemId) throw new Error('siteId, listId, and itemId are required.');
                const data = await graphFetch(`${siteBase}/lists/${listId}/items/${itemId}?expand=fields`);
                return { output: { item: data } };
            }

            case 'createListItem': {
                const listId = String(inputs.listId ?? '').trim();
                if (!siteId || !listId) throw new Error('siteId and listId are required.');
                const fields = inputs.fields ?? inputs.item ?? {};
                const data = await graphFetch(`${siteBase}/lists/${listId}/items`, 'POST', { fields });
                return { output: { item: data, status: 'created' } };
            }

            case 'updateListItem': {
                const listId = String(inputs.listId ?? '').trim();
                const itemId = String(inputs.itemId ?? '').trim();
                if (!siteId || !listId || !itemId) throw new Error('siteId, listId, and itemId are required.');
                const fields = inputs.fields ?? inputs.item ?? {};
                const data = await graphFetch(`${siteBase}/lists/${listId}/items/${itemId}/fields`, 'PATCH', fields);
                return { output: { fields: data, status: 'updated' } };
            }

            case 'deleteListItem': {
                const listId = String(inputs.listId ?? '').trim();
                const itemId = String(inputs.itemId ?? '').trim();
                if (!siteId || !listId || !itemId) throw new Error('siteId, listId, and itemId are required.');
                const data = await graphFetch(`${siteBase}/lists/${listId}/items/${itemId}`, 'DELETE');
                return { output: { itemId, ...data } };
            }

            case 'listDrives': {
                if (!siteId) throw new Error('siteId is required.');
                const data = await graphFetch(`${siteBase}/drives`);
                return { output: { drives: data.value ?? [], count: String(data.value?.length ?? 0) } };
            }

            case 'uploadFile': {
                const driveId = String(inputs.driveId ?? '').trim();
                const filePath = String(inputs.filePath ?? inputs.path ?? '').trim();
                const fileContent = String(inputs.fileContent ?? inputs.content ?? '').trim();
                if (!driveId || !filePath) throw new Error('driveId and filePath are required.');
                const url = `${graphBase}/drives/${driveId}/root:/${filePath}:/content`;
                const contentType = String(inputs.contentType ?? 'application/octet-stream');
                const uploadHeaders = { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': contentType };
                const res = await fetch(url, { method: 'PUT', headers: uploadHeaders, body: fileContent });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error?.message ?? JSON.stringify(data));
                logger.log(`[SharePoint] File uploaded to ${filePath}`);
                return { output: { file: data, id: data.id, webUrl: data.webUrl, status: 'uploaded' } };
            }

            case 'listFolderContents': {
                const driveId = String(inputs.driveId ?? '').trim();
                if (!driveId) throw new Error('driveId is required.');
                const folderPath = inputs.folderPath ? String(inputs.folderPath).trim() : null;
                const url = folderPath
                    ? `${graphBase}/drives/${driveId}/root:/${folderPath}:/children`
                    : `${graphBase}/drives/${driveId}/root/children`;
                const data = await graphFetch(url);
                return { output: { items: data.value ?? [], count: String(data.value?.length ?? 0) } };
            }

            case 'searchSite': {
                if (!siteId) throw new Error('siteId is required.');
                const query = String(inputs.query ?? inputs.search ?? '').trim();
                let url = `${siteBase}/lists`;
                if (query) url += `?$filter=contains(displayName,'${encodeURIComponent(query)}')`;
                const data = await graphFetch(url);
                return { output: { results: data.value ?? [], count: String(data.value?.length ?? 0) } };
            }

            default:
                throw new Error(`Unknown SharePoint action: ${actionName}`);
        }
    } catch (err: any) {
        return { error: err.message ?? String(err) };
    }
}
