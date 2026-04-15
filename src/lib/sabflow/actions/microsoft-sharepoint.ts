'use server';

export async function executeMicrosoftSharePointAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');
        const siteId = String(inputs.siteId ?? '').trim();
        const baseUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}`;
        const headers: Record<string, string> = {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        };

        async function graphRequest(method: string, url: string, body?: any) {
            logger?.log(`[SharePoint] ${method} ${url}`);
            const opts: RequestInit = { method, headers };
            if (body !== undefined) opts.body = JSON.stringify(body);
            const res = await fetch(url, opts);
            if (res.status === 204) return {};
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) throw new Error(data?.error?.message || `Graph error: ${res.status}`);
            return data;
        }

        switch (actionName) {
            case 'listSites': {
                const query = inputs.query ? `?search=${encodeURIComponent(String(inputs.query))}` : '';
                const data = await graphRequest('GET', `https://graph.microsoft.com/v1.0/sites${query}`);
                return { output: { sites: data.value ?? [] } };
            }

            case 'getSite': {
                if (!siteId) throw new Error('siteId is required.');
                const data = await graphRequest('GET', baseUrl);
                return { output: data };
            }

            case 'listLists': {
                if (!siteId) throw new Error('siteId is required.');
                const data = await graphRequest('GET', `${baseUrl}/lists`);
                return { output: { lists: data.value ?? [] } };
            }

            case 'getList': {
                const listId = String(inputs.listId ?? '').trim();
                if (!siteId || !listId) throw new Error('siteId and listId are required.');
                const data = await graphRequest('GET', `${baseUrl}/lists/${listId}`);
                return { output: data };
            }

            case 'createList': {
                if (!siteId) throw new Error('siteId is required.');
                const displayName = String(inputs.displayName ?? '').trim();
                if (!displayName) throw new Error('displayName is required.');
                const body: any = {
                    displayName,
                    list: { template: String(inputs.template ?? 'genericList') },
                };
                if (inputs.description) body.description = String(inputs.description);
                const data = await graphRequest('POST', `${baseUrl}/lists`, body);
                return { output: data };
            }

            case 'listItems': {
                const listId = String(inputs.listId ?? '').trim();
                if (!siteId || !listId) throw new Error('siteId and listId are required.');
                const top = Math.max(1, Math.min(100, Number(inputs.top ?? 20)));
                const expand = inputs.expand ? `&$expand=${encodeURIComponent(String(inputs.expand))}` : '&$expand=fields';
                const filter = inputs.filter ? `&$filter=${encodeURIComponent(String(inputs.filter))}` : '';
                const data = await graphRequest('GET', `${baseUrl}/lists/${listId}/items?$top=${top}${expand}${filter}`);
                return { output: { items: data.value ?? [], nextLink: data['@odata.nextLink'] ?? null } };
            }

            case 'getItem': {
                const listId = String(inputs.listId ?? '').trim();
                const itemId = String(inputs.itemId ?? '').trim();
                if (!siteId || !listId || !itemId) throw new Error('siteId, listId, and itemId are required.');
                const data = await graphRequest('GET', `${baseUrl}/lists/${listId}/items/${itemId}?$expand=fields`);
                return { output: data };
            }

            case 'createItem': {
                const listId = String(inputs.listId ?? '').trim();
                if (!siteId || !listId) throw new Error('siteId and listId are required.');
                const fields = inputs.fields && typeof inputs.fields === 'object' ? inputs.fields : {};
                const data = await graphRequest('POST', `${baseUrl}/lists/${listId}/items`, { fields });
                return { output: data };
            }

            case 'updateItem': {
                const listId = String(inputs.listId ?? '').trim();
                const itemId = String(inputs.itemId ?? '').trim();
                if (!siteId || !listId || !itemId) throw new Error('siteId, listId, and itemId are required.');
                const fields = inputs.fields && typeof inputs.fields === 'object' ? inputs.fields : {};
                const data = await graphRequest('PATCH', `${baseUrl}/lists/${listId}/items/${itemId}/fields`, fields);
                return { output: data };
            }

            case 'deleteItem': {
                const listId = String(inputs.listId ?? '').trim();
                const itemId = String(inputs.itemId ?? '').trim();
                if (!siteId || !listId || !itemId) throw new Error('siteId, listId, and itemId are required.');
                await graphRequest('DELETE', `${baseUrl}/lists/${listId}/items/${itemId}`);
                return { output: { success: true, deleted: itemId } };
            }

            case 'listDocumentLibraries': {
                if (!siteId) throw new Error('siteId is required.');
                const data = await graphRequest('GET', `${baseUrl}/drives`);
                return { output: { drives: data.value ?? [] } };
            }

            case 'uploadFile': {
                const driveId = String(inputs.driveId ?? '').trim();
                const fileName = String(inputs.fileName ?? '').trim();
                const fileContent = String(inputs.fileContent ?? '').trim();
                if (!siteId || !driveId || !fileName || !fileContent) throw new Error('siteId, driveId, fileName, and fileContent are required.');
                const uploadHeaders = { Authorization: `Bearer ${accessToken}`, 'Content-Type': String(inputs.contentType ?? 'application/octet-stream') };
                const parentPath = inputs.parentPath ? String(inputs.parentPath).trim() : 'root';
                const uploadUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/items/${parentPath}:/${fileName}:/content`;
                const uploadRes = await fetch(uploadUrl, { method: 'PUT', headers: uploadHeaders, body: Buffer.from(fileContent, 'base64') });
                const uploadText = await uploadRes.text();
                let uploadData: any;
                try { uploadData = JSON.parse(uploadText); } catch { uploadData = { raw: uploadText }; }
                if (!uploadRes.ok) throw new Error(uploadData?.error?.message || `Upload error: ${uploadRes.status}`);
                return { output: uploadData };
            }

            case 'getFile': {
                const driveId = String(inputs.driveId ?? '').trim();
                const itemId = String(inputs.itemId ?? '').trim();
                if (!siteId || !driveId || !itemId) throw new Error('siteId, driveId, and itemId are required.');
                const data = await graphRequest('GET', `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/items/${itemId}`);
                return { output: data };
            }

            case 'deleteFile': {
                const driveId = String(inputs.driveId ?? '').trim();
                const itemId = String(inputs.itemId ?? '').trim();
                if (!siteId || !driveId || !itemId) throw new Error('siteId, driveId, and itemId are required.');
                await graphRequest('DELETE', `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/items/${itemId}`);
                return { output: { success: true, deleted: itemId } };
            }

            case 'listColumns': {
                const listId = String(inputs.listId ?? '').trim();
                if (!siteId || !listId) throw new Error('siteId and listId are required.');
                const data = await graphRequest('GET', `${baseUrl}/lists/${listId}/columns`);
                return { output: { columns: data.value ?? [] } };
            }

            default:
                throw new Error(`Unknown action: ${actionName}`);
        }
    } catch (err: any) {
        return { error: err?.message ?? String(err) };
    }
}
