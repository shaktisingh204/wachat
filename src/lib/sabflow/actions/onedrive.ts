'use server';

export async function executeOneDriveAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');
        const baseUrl = 'https://graph.microsoft.com/v1.0/me/drive';
        const headers: Record<string, string> = {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        };

        async function graphRequest(method: string, url: string, body?: any, customHeaders?: Record<string, string>) {
            logger?.log(`[OneDrive] ${method} ${url}`);
            const opts: RequestInit = { method, headers: { ...headers, ...customHeaders } };
            if (body !== undefined && typeof body !== 'string' && !Buffer.isBuffer(body)) opts.body = JSON.stringify(body);
            else if (body !== undefined) opts.body = body as any;
            const res = await fetch(url, opts);
            if (res.status === 204) return {};
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) throw new Error(data?.error?.message || `Graph error: ${res.status}`);
            return data;
        }

        switch (actionName) {
            case 'listItems': {
                const folderId = inputs.folderId ? String(inputs.folderId).trim() : 'root';
                const top = Math.max(1, Math.min(100, Number(inputs.top ?? 20)));
                const data = await graphRequest('GET', `${baseUrl}/items/${folderId}/children?$top=${top}`);
                return { output: { items: data.value ?? [], nextLink: data['@odata.nextLink'] ?? null } };
            }

            case 'getItem': {
                const itemId = String(inputs.itemId ?? '').trim();
                if (!itemId) throw new Error('itemId is required.');
                const data = await graphRequest('GET', `${baseUrl}/items/${itemId}`);
                return { output: data };
            }

            case 'uploadFile': {
                const fileName = String(inputs.fileName ?? '').trim();
                const fileContent = String(inputs.fileContent ?? '').trim();
                if (!fileName || !fileContent) throw new Error('fileName and fileContent are required.');
                const parentId = inputs.parentId ? String(inputs.parentId).trim() : 'root';
                const contentType = String(inputs.contentType ?? 'application/octet-stream');
                const uploadUrl = `${baseUrl}/items/${parentId}:/${fileName}:/content`;
                const res = await fetch(uploadUrl, {
                    method: 'PUT',
                    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': contentType },
                    body: Buffer.from(fileContent, 'base64'),
                });
                const text = await res.text();
                let data: any;
                try { data = JSON.parse(text); } catch { data = { raw: text }; }
                if (!res.ok) throw new Error(data?.error?.message || `Upload error: ${res.status}`);
                return { output: data };
            }

            case 'downloadFile': {
                const itemId = String(inputs.itemId ?? '').trim();
                if (!itemId) throw new Error('itemId is required.');
                const metaData = await graphRequest('GET', `${baseUrl}/items/${itemId}`);
                return { output: { downloadUrl: metaData['@microsoft.graph.downloadUrl'] ?? null, name: metaData.name, size: metaData.size, mimeType: metaData.file?.mimeType ?? null } };
            }

            case 'createFolder': {
                const folderName = String(inputs.folderName ?? '').trim();
                if (!folderName) throw new Error('folderName is required.');
                const parentId = inputs.parentId ? String(inputs.parentId).trim() : 'root';
                const data = await graphRequest('POST', `${baseUrl}/items/${parentId}/children`, {
                    name: folderName,
                    folder: {},
                    '@microsoft.graph.conflictBehavior': String(inputs.conflictBehavior ?? 'rename'),
                });
                return { output: data };
            }

            case 'deleteItem': {
                const itemId = String(inputs.itemId ?? '').trim();
                if (!itemId) throw new Error('itemId is required.');
                await graphRequest('DELETE', `${baseUrl}/items/${itemId}`);
                return { output: { success: true, deleted: itemId } };
            }

            case 'moveItem': {
                const itemId = String(inputs.itemId ?? '').trim();
                const destinationId = String(inputs.destinationId ?? '').trim();
                if (!itemId || !destinationId) throw new Error('itemId and destinationId are required.');
                const patch: any = { parentReference: { id: destinationId } };
                if (inputs.newName) patch.name = String(inputs.newName);
                const data = await graphRequest('PATCH', `${baseUrl}/items/${itemId}`, patch);
                return { output: data };
            }

            case 'copyItem': {
                const itemId = String(inputs.itemId ?? '').trim();
                const destinationId = String(inputs.destinationId ?? '').trim();
                if (!itemId || !destinationId) throw new Error('itemId and destinationId are required.');
                const body: any = { parentReference: { id: destinationId } };
                if (inputs.newName) body.name = String(inputs.newName);
                const res = await fetch(`${baseUrl}/items/${itemId}/copy`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) {
                    const text = await res.text();
                    let errData: any;
                    try { errData = JSON.parse(text); } catch { errData = { raw: text }; }
                    throw new Error(errData?.error?.message || `Copy error: ${res.status}`);
                }
                const location = res.headers.get('Location');
                return { output: { success: true, monitorUrl: location } };
            }

            case 'shareItem': {
                const itemId = String(inputs.itemId ?? '').trim();
                if (!itemId) throw new Error('itemId is required.');
                const body: any = {
                    type: String(inputs.type ?? 'view'),
                    scope: String(inputs.scope ?? 'anonymous'),
                };
                if (inputs.expirationDateTime) body.expirationDateTime = String(inputs.expirationDateTime);
                const data = await graphRequest('POST', `${baseUrl}/items/${itemId}/createLink`, body);
                return { output: { link: data.link, id: data.id } };
            }

            case 'listSharedItems': {
                const data = await graphRequest('GET', 'https://graph.microsoft.com/v1.0/me/drive/sharedWithMe');
                return { output: { sharedItems: data.value ?? [] } };
            }

            case 'searchFiles': {
                const query = String(inputs.query ?? '').trim();
                if (!query) throw new Error('query is required.');
                const top = Math.max(1, Math.min(100, Number(inputs.top ?? 20)));
                const data = await graphRequest('GET', `${baseUrl}/root/search(q='${encodeURIComponent(query)}')?$top=${top}`);
                return { output: { items: data.value ?? [], nextLink: data['@odata.nextLink'] ?? null } };
            }

            case 'getDriveInfo': {
                const data = await graphRequest('GET', baseUrl);
                return { output: { id: data.id, name: data.name, driveType: data.driveType, owner: data.owner, quota: data.quota } };
            }

            case 'listDrives': {
                const data = await graphRequest('GET', 'https://graph.microsoft.com/v1.0/me/drives');
                return { output: { drives: data.value ?? [] } };
            }

            case 'createLink': {
                const itemId = String(inputs.itemId ?? '').trim();
                if (!itemId) throw new Error('itemId is required.');
                const body: any = {
                    type: String(inputs.type ?? 'view'),
                    scope: String(inputs.scope ?? 'organization'),
                };
                if (inputs.expirationDateTime) body.expirationDateTime = String(inputs.expirationDateTime);
                if (inputs.password) body.password = String(inputs.password);
                const data = await graphRequest('POST', `${baseUrl}/items/${itemId}/createLink`, body);
                return { output: { link: data.link, shareId: data.id } };
            }

            case 'listPermissions': {
                const itemId = String(inputs.itemId ?? '').trim();
                if (!itemId) throw new Error('itemId is required.');
                const data = await graphRequest('GET', `${baseUrl}/items/${itemId}/permissions`);
                return { output: { permissions: data.value ?? [] } };
            }

            default:
                throw new Error(`Unknown action: ${actionName}`);
        }
    } catch (err: any) {
        return { error: err?.message ?? String(err) };
    }
}
