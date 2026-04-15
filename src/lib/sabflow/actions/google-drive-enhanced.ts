'use server';

const BASE = 'https://www.googleapis.com/drive/v3';

async function req(accessToken: string, method: string, url: string, body?: any, logger?: any) {
    logger?.log(`[GDriveEnhanced] ${method} ${url}`);
    const opts: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `Drive API error ${res.status}`);
    return data;
}

export async function executeGoogleDriveEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');

        const g = (method: string, path: string, body?: any) => req(accessToken, method, `${BASE}${path}`, body, logger);

        switch (actionName) {
            case 'listFiles': {
                const query = String(inputs.query ?? '').trim();
                const pageSize = Number(inputs.pageSize ?? 30);
                const orderBy = String(inputs.orderBy ?? 'modifiedTime desc').trim();
                const pageToken = String(inputs.pageToken ?? '').trim();
                let path = `/files?pageSize=${pageSize}&orderBy=${encodeURIComponent(orderBy)}&fields=files(id,name,mimeType,size,modifiedTime,webViewLink,parents),nextPageToken`;
                if (query) path += `&q=${encodeURIComponent(query)}`;
                if (pageToken) path += `&pageToken=${encodeURIComponent(pageToken)}`;
                const data = await g('GET', path);
                return { output: { files: data.files ?? [], count: (data.files ?? []).length, nextPageToken: data.nextPageToken ?? '' } };
            }

            case 'getFile': {
                const fileId = String(inputs.fileId ?? '').trim();
                if (!fileId) throw new Error('fileId is required.');
                const data = await g('GET', `/files/${fileId}?fields=id,name,mimeType,size,modifiedTime,webViewLink,parents,description,starred,trashed`);
                return { output: data };
            }

            case 'createFile': {
                const name = String(inputs.name ?? '').trim();
                const mimeType = String(inputs.mimeType ?? 'application/octet-stream').trim();
                const parentId = String(inputs.parentId ?? '').trim();
                if (!name) throw new Error('name is required.');
                const metadata: any = { name, mimeType };
                if (parentId) metadata.parents = [parentId];
                const data = await g('POST', '/files', metadata);
                return { output: { id: data.id, name: data.name, mimeType: data.mimeType, webViewLink: data.webViewLink ?? '' } };
            }

            case 'updateFile': {
                const fileId = String(inputs.fileId ?? '').trim();
                if (!fileId) throw new Error('fileId is required.');
                const body: any = {};
                if (inputs.name) body.name = String(inputs.name).trim();
                if (inputs.description !== undefined) body.description = String(inputs.description);
                if (inputs.starred !== undefined) body.starred = Boolean(inputs.starred);
                const data = await g('PATCH', `/files/${fileId}?fields=id,name,modifiedTime`, body);
                return { output: { id: data.id, name: data.name, modifiedTime: data.modifiedTime ?? '' } };
            }

            case 'deleteFile': {
                const fileId = String(inputs.fileId ?? '').trim();
                if (!fileId) throw new Error('fileId is required.');
                await g('DELETE', `/files/${fileId}`);
                return { output: { deleted: true, fileId } };
            }

            case 'moveFile': {
                const fileId = String(inputs.fileId ?? '').trim();
                const newParentId = String(inputs.newParentId ?? '').trim();
                if (!fileId || !newParentId) throw new Error('fileId and newParentId are required.');
                const current = await g('GET', `/files/${fileId}?fields=parents`);
                const removeParents = (current.parents ?? []).join(',');
                const data = await g('PATCH', `/files/${fileId}?addParents=${newParentId}&removeParents=${removeParents}&fields=id,name,parents`, {});
                return { output: { id: data.id, name: data.name, parents: data.parents ?? [] } };
            }

            case 'copyFile': {
                const fileId = String(inputs.fileId ?? '').trim();
                if (!fileId) throw new Error('fileId is required.');
                const body: any = {};
                if (inputs.name) body.name = String(inputs.name).trim();
                if (inputs.parentId) body.parents = [String(inputs.parentId).trim()];
                const data = await g('POST', `/files/${fileId}/copy`, body);
                return { output: { id: data.id, name: data.name, webViewLink: data.webViewLink ?? '' } };
            }

            case 'createFolder': {
                const name = String(inputs.name ?? '').trim();
                const parentId = String(inputs.parentId ?? '').trim();
                if (!name) throw new Error('name is required.');
                const metadata: any = { name, mimeType: 'application/vnd.google-apps.folder' };
                if (parentId) metadata.parents = [parentId];
                const data = await g('POST', '/files', metadata);
                return { output: { id: data.id, name: data.name, mimeType: data.mimeType } };
            }

            case 'shareFile': {
                const fileId = String(inputs.fileId ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                const role = String(inputs.role ?? 'reader').trim();
                const type = String(inputs.type ?? 'user').trim();
                if (!fileId) throw new Error('fileId is required.');
                const body: any = { role, type };
                if (email && type !== 'anyone') body.emailAddress = email;
                const res = await fetch(`${BASE}/files/${fileId}/permissions`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || 'Share failed');
                return { output: { permissionId: data.id ?? '', role: data.role ?? role, type: data.type ?? type } };
            }

            case 'listPermissions': {
                const fileId = String(inputs.fileId ?? '').trim();
                if (!fileId) throw new Error('fileId is required.');
                const data = await g('GET', `/files/${fileId}/permissions?fields=permissions(id,emailAddress,role,type,displayName)`);
                return { output: { permissions: data.permissions ?? [], count: (data.permissions ?? []).length } };
            }

            case 'addPermission': {
                const fileId = String(inputs.fileId ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                const role = String(inputs.role ?? 'reader').trim();
                const type = String(inputs.type ?? 'user').trim();
                if (!fileId) throw new Error('fileId is required.');
                const body: any = { role, type };
                if (email && type !== 'anyone') body.emailAddress = email;
                const data = await g('POST', `/files/${fileId}/permissions`, body);
                return { output: { permissionId: data.id ?? '', role: data.role ?? role, type: data.type ?? type } };
            }

            case 'removePermission': {
                const fileId = String(inputs.fileId ?? '').trim();
                const permissionId = String(inputs.permissionId ?? '').trim();
                if (!fileId || !permissionId) throw new Error('fileId and permissionId are required.');
                await g('DELETE', `/files/${fileId}/permissions/${permissionId}`);
                return { output: { deleted: true, fileId, permissionId } };
            }

            case 'downloadFile': {
                const fileId = String(inputs.fileId ?? '').trim();
                if (!fileId) throw new Error('fileId is required.');
                const res = await fetch(`${BASE}/files/${fileId}?alt=media`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                if (!res.ok) throw new Error(`Download failed: ${res.status}`);
                const content = await res.text();
                return { output: { content, fileId, size: content.length } };
            }

            case 'searchFiles': {
                const query = String(inputs.query ?? '').trim();
                const pageSize = Number(inputs.pageSize ?? 30);
                if (!query) throw new Error('query is required.');
                const data = await g('GET', `/files?q=${encodeURIComponent(query)}&pageSize=${pageSize}&fields=files(id,name,mimeType,webViewLink,modifiedTime),nextPageToken`);
                return { output: { files: data.files ?? [], count: (data.files ?? []).length, nextPageToken: data.nextPageToken ?? '' } };
            }

            case 'getStorageQuota': {
                const data = await g('GET', '/about?fields=storageQuota,user');
                return { output: { storageQuota: data.storageQuota ?? {}, user: data.user ?? {} } };
            }

            default:
                return { error: `Google Drive Enhanced action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Google Drive Enhanced action failed.' };
    }
}
