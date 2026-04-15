
'use server';

const GDRIVE_BASE = 'https://www.googleapis.com/drive/v3';
const GDRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';

async function gdriveFetch(accessToken: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Google Drive] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${GDRIVE_BASE}${path}`, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.error?.message || `Google Drive API error: ${res.status}`);
    }
    return data;
}

export async function executeGoogleDriveAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');
        const gd = (method: string, path: string, body?: any) => gdriveFetch(accessToken, method, path, body, logger);

        switch (actionName) {
            case 'listFiles': {
                const query = String(inputs.query ?? '').trim();
                const pageSize = Number(inputs.pageSize ?? 30);
                const orderBy = String(inputs.orderBy ?? 'modifiedTime desc').trim();
                let path = `/files?pageSize=${pageSize}&orderBy=${encodeURIComponent(orderBy)}&fields=files(id,name,mimeType,size,modifiedTime,webViewLink)`;
                if (query) path += `&q=${encodeURIComponent(query)}`;
                const data = await gd('GET', path);
                return { output: { files: data.files ?? [], count: (data.files ?? []).length, nextPageToken: data.nextPageToken ?? '' } };
            }

            case 'getFile': {
                const fileId = String(inputs.fileId ?? '').trim();
                if (!fileId) throw new Error('fileId is required.');
                const data = await gd('GET', `/files/${fileId}?fields=id,name,mimeType,size,modifiedTime,webViewLink,parents`);
                return { output: { id: data.id, name: data.name, mimeType: data.mimeType, size: String(data.size ?? ''), webViewLink: data.webViewLink ?? '', modifiedTime: data.modifiedTime ?? '' } };
            }

            case 'createFolder': {
                const name = String(inputs.name ?? '').trim();
                const parentId = String(inputs.parentId ?? '').trim();
                if (!name) throw new Error('name is required.');
                const metadata: any = { name, mimeType: 'application/vnd.google-apps.folder' };
                if (parentId) metadata.parents = [parentId];
                const data = await gd('POST', '/files', metadata);
                return { output: { id: data.id, name: data.name, mimeType: data.mimeType } };
            }

            case 'uploadFile': {
                const name = String(inputs.name ?? '').trim();
                const fileUrl = String(inputs.fileUrl ?? '').trim();
                const mimeType = String(inputs.mimeType ?? 'application/octet-stream').trim();
                const parentId = String(inputs.parentId ?? '').trim();
                if (!name || !fileUrl) throw new Error('name and fileUrl are required.');
                // Fetch the file content
                const fileRes = await fetch(fileUrl);
                if (!fileRes.ok) throw new Error(`Failed to fetch file: ${fileRes.status}`);
                const fileBuffer = await fileRes.arrayBuffer();
                // Multipart upload
                const metadata: any = { name, mimeType };
                if (parentId) metadata.parents = [parentId];
                const boundary = '-------314159265358979323846';
                const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`;
                const bodyEnd = `\r\n--${boundary}--`;
                const bodyBytes = new TextEncoder().encode(body);
                const endBytes = new TextEncoder().encode(bodyEnd);
                const combined = new Uint8Array(bodyBytes.length + fileBuffer.byteLength + endBytes.length);
                combined.set(bodyBytes, 0);
                combined.set(new Uint8Array(fileBuffer), bodyBytes.length);
                combined.set(endBytes, bodyBytes.length + fileBuffer.byteLength);
                const uploadRes = await fetch(`${GDRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,name,webViewLink`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
                    body: combined,
                });
                const uploadData = await uploadRes.json();
                if (!uploadRes.ok) throw new Error(uploadData?.error?.message || 'Upload failed');
                return { output: { id: uploadData.id, name: uploadData.name, webViewLink: uploadData.webViewLink ?? '' } };
            }

            case 'copyFile': {
                const fileId = String(inputs.fileId ?? '').trim();
                const name = String(inputs.name ?? '').trim();
                const parentId = String(inputs.parentId ?? '').trim();
                if (!fileId) throw new Error('fileId is required.');
                const body: any = {};
                if (name) body.name = name;
                if (parentId) body.parents = [parentId];
                const data = await gd('POST', `/files/${fileId}/copy`, body);
                return { output: { id: data.id, name: data.name } };
            }

            case 'moveFile': {
                const fileId = String(inputs.fileId ?? '').trim();
                const newParentId = String(inputs.newParentId ?? '').trim();
                if (!fileId || !newParentId) throw new Error('fileId and newParentId are required.');
                // Get current parents
                const currentFile = await gd('GET', `/files/${fileId}?fields=parents`);
                const removeParents = (currentFile.parents ?? []).join(',');
                const data = await gd('PATCH', `/files/${fileId}?addParents=${newParentId}&removeParents=${removeParents}&fields=id,name,parents`, {});
                return { output: { id: data.id, name: data.name } };
            }

            case 'deleteFile': {
                const fileId = String(inputs.fileId ?? '').trim();
                if (!fileId) throw new Error('fileId is required.');
                await gd('DELETE', `/files/${fileId}`);
                return { output: { deleted: 'true', fileId } };
            }

            case 'shareFile': {
                const fileId = String(inputs.fileId ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                const role = String(inputs.role ?? 'reader').trim();
                const type = String(inputs.type ?? 'user').trim();
                if (!fileId) throw new Error('fileId is required.');
                const body: any = { role, type };
                if (email && type !== 'anyone') body.emailAddress = email;
                const res = await fetch(`${GDRIVE_BASE}/files/${fileId}/permissions`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: { permissionId: data.id ?? '', role: data.role ?? role, type: data.type ?? type } };
            }

            case 'downloadFile': {
                const fileId = String(inputs.fileId ?? '').trim();
                if (!fileId) throw new Error('fileId is required.');
                const res = await fetch(`${GDRIVE_BASE}/files/${fileId}?alt=media`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                if (!res.ok) throw new Error(`Download failed: ${res.status}`);
                const content = await res.text();
                return { output: { content, fileId } };
            }

            case 'searchFiles': {
                const query = String(inputs.query ?? '').trim();
                const pageSize = Number(inputs.pageSize ?? 30);
                if (!query) throw new Error('query is required.');
                const data = await gd('GET', `/files?q=${encodeURIComponent(query)}&pageSize=${pageSize}&fields=files(id,name,mimeType,webViewLink)`);
                return { output: { files: data.files ?? [], count: (data.files ?? []).length } };
            }

            case 'exportFile': {
                const fileId = String(inputs.fileId ?? '').trim();
                const mimeType = String(inputs.mimeType ?? 'application/pdf').trim();
                if (!fileId) throw new Error('fileId is required.');
                const res = await fetch(`${GDRIVE_BASE}/files/${fileId}/export?mimeType=${encodeURIComponent(mimeType)}`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                if (!res.ok) throw new Error(`Export failed: ${res.status}`);
                const content = await res.text();
                return { output: { content, fileId, mimeType } };
            }

            default:
                return { error: `Google Drive action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Google Drive action failed.' };
    }
}
