
'use server';

const BOX_API_BASE = 'https://api.box.com/2.0';
const BOX_UPLOAD_BASE = 'https://upload.box.com/api/2.0';

async function boxFetch(accessToken: string, method: string, path: string, body?: any, isUpload = false, logger?: any) {
    logger?.log(`[Box] ${method} ${path}`);
    const base = isUpload ? BOX_UPLOAD_BASE : BOX_API_BASE;
    const url = `${base}${path}`;
    const headers: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
    };
    const options: RequestInit = { method, headers };
    if (body !== undefined && !isUpload) {
        headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = text; }
    if (!res.ok) {
        throw new Error(data?.message || `Box API error: ${res.status}`);
    }
    return data;
}

export async function executeBoxAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');
        const bf = (method: string, path: string, body?: any) => boxFetch(accessToken, method, path, body, false, logger);

        switch (actionName) {
            case 'listFolder': {
                const folderId = String(inputs.folderId ?? '0');
                const data = await bf('GET', `/folders/${folderId}/items?limit=${Number(inputs.limit ?? 100)}&offset=${Number(inputs.offset ?? 0)}`);
                return { output: { entries: data.entries ?? [], totalCount: data.total_count ?? 0 } };
            }

            case 'getFolder': {
                const folderId = String(inputs.folderId ?? '').trim();
                if (!folderId) throw new Error('folderId is required.');
                const data = await bf('GET', `/folders/${folderId}`);
                return { output: { id: data.id, name: data.name, type: data.type, parentId: data.parent?.id } };
            }

            case 'createFolder': {
                const name = String(inputs.name ?? '').trim();
                const parentId = String(inputs.parentId ?? '0');
                if (!name) throw new Error('name is required.');
                const data = await bf('POST', '/folders', { name, parent: { id: parentId } });
                return { output: { id: data.id, name: data.name, type: data.type, parentId: data.parent?.id } };
            }

            case 'uploadFile': {
                const fileUrl = String(inputs.fileUrl ?? '').trim();
                const name = String(inputs.name ?? '').trim();
                const parentId = String(inputs.parentId ?? '0');
                if (!fileUrl || !name) throw new Error('fileUrl and name are required.');

                // Fetch the file content from the external URL
                const fileRes = await fetch(fileUrl);
                if (!fileRes.ok) throw new Error(`Failed to fetch file from URL: ${fileRes.status}`);
                const fileBlob = await fileRes.blob();

                // Prepare multipart form data
                const formData = new FormData();
                formData.append('attributes', JSON.stringify({ name, parent: { id: parentId } }));
                formData.append('file', fileBlob, name);

                const uploadRes = await fetch(`${BOX_UPLOAD_BASE}/files/content`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${accessToken}` },
                    body: formData,
                });
                const uploadText = await uploadRes.text();
                let data: any;
                try { data = JSON.parse(uploadText); } catch { data = uploadText; }
                if (!uploadRes.ok) throw new Error(data?.message || `Box upload error: ${uploadRes.status}`);
                const entry = data.entries?.[0] ?? data;
                return { output: { id: entry.id, name: entry.name, size: entry.size, type: entry.type } };
            }

            case 'getFile': {
                const fileId = String(inputs.fileId ?? '').trim();
                if (!fileId) throw new Error('fileId is required.');
                const data = await bf('GET', `/files/${fileId}`);
                return { output: { id: data.id, name: data.name, size: data.size, type: data.type, parentId: data.parent?.id } };
            }

            case 'downloadFile': {
                const fileId = String(inputs.fileId ?? '').trim();
                if (!fileId) throw new Error('fileId is required.');
                // Box returns a 302 redirect to the actual download URL
                const url = `${BOX_API_BASE}/files/${fileId}/content`;
                const res = await fetch(url, {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${accessToken}` },
                    redirect: 'manual',
                });
                const downloadUrl = res.headers.get('location') ?? url;
                return { output: { downloadUrl, fileId } };
            }

            case 'deleteFile': {
                const fileId = String(inputs.fileId ?? '').trim();
                if (!fileId) throw new Error('fileId is required.');
                await bf('DELETE', `/files/${fileId}`);
                return { output: { success: true, fileId } };
            }

            case 'deleteFolder': {
                const folderId = String(inputs.folderId ?? '').trim();
                const recursive = inputs.recursive !== false;
                if (!folderId) throw new Error('folderId is required.');
                await bf('DELETE', `/folders/${folderId}?recursive=${recursive}`);
                return { output: { success: true, folderId } };
            }

            case 'copyFile': {
                const fileId = String(inputs.fileId ?? '').trim();
                const parentId = String(inputs.parentId ?? '').trim();
                if (!fileId || !parentId) throw new Error('fileId and parentId are required.');
                const body: any = { parent: { id: parentId } };
                if (inputs.name) body.name = String(inputs.name);
                const data = await bf('POST', `/files/${fileId}/copy`, body);
                return { output: { id: data.id, name: data.name, parentId: data.parent?.id } };
            }

            case 'moveFile': {
                const fileId = String(inputs.fileId ?? '').trim();
                const parentId = String(inputs.parentId ?? '').trim();
                if (!fileId || !parentId) throw new Error('fileId and parentId are required.');
                const data = await bf('PUT', `/files/${fileId}`, { parent: { id: parentId } });
                return { output: { id: data.id, name: data.name, parentId: data.parent?.id } };
            }

            case 'searchFiles': {
                const query = String(inputs.query ?? '').trim();
                if (!query) throw new Error('query is required.');
                const data = await bf('GET', `/search?query=${encodeURIComponent(query)}&limit=${Number(inputs.limit ?? 30)}`);
                return { output: { entries: data.entries ?? [], totalCount: data.total_count ?? 0 } };
            }

            case 'getSharedLink': {
                const fileId = String(inputs.fileId ?? '').trim();
                if (!fileId) throw new Error('fileId is required.');
                const data = await bf('GET', `/files/${fileId}?fields=shared_link`);
                return { output: { sharedLink: data.shared_link, fileId } };
            }

            case 'createSharedLink': {
                const fileId = String(inputs.fileId ?? '').trim();
                if (!fileId) throw new Error('fileId is required.');
                const access = String(inputs.access ?? 'open');
                const data = await bf('PUT', `/files/${fileId}`, { shared_link: { access, permissions: { can_download: inputs.canDownload !== false } } });
                return { output: { sharedLink: data.shared_link?.url, fileId } };
            }

            case 'getUserInfo': {
                const data = await bf('GET', '/users/me');
                return { output: { id: data.id, name: data.name, login: data.login, spaceUsed: data.space_used, spaceAmount: data.space_amount } };
            }

            default:
                throw new Error(`Unsupported Box action: ${actionName}`);
        }
    } catch (err: any) {
        return { error: err?.message ?? String(err) };
    }
}
