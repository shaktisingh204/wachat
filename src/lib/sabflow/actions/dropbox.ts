
'use server';

const DROPBOX_API_BASE = 'https://api.dropboxapi.com/2';
const DROPBOX_CONTENT_BASE = 'https://content.dropboxapi.com/2';

async function dropboxApiFetch(token: string, endpoint: string, body?: any, logger?: any) {
    logger?.log(`[Dropbox] POST ${endpoint}`);
    const res = await fetch(`${DROPBOX_API_BASE}${endpoint}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: body !== undefined ? JSON.stringify(body) : '',
    });
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) throw new Error(data?.error_summary || data?.message || `Dropbox API error: ${res.status}`);
    return data;
}

export async function executeDropboxAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');
        const api = (endpoint: string, body?: any) => dropboxApiFetch(accessToken, endpoint, body, logger);

        switch (actionName) {
            case 'listFolder': {
                const path = String(inputs.path ?? '');
                const recursive = inputs.recursive === true || inputs.recursive === 'true';
                const data = await api('/files/list_folder', { path, recursive });
                return { output: { entries: data.entries ?? [], hasMore: data.has_more ?? false, cursor: data.cursor ?? '' } };
            }

            case 'getFileMetadata': {
                const path = String(inputs.path ?? '').trim();
                if (!path) throw new Error('path is required.');
                const data = await api('/files/get_metadata', { path });
                return { output: data };
            }

            case 'createFolder': {
                const path = String(inputs.path ?? '').trim();
                if (!path) throw new Error('path is required.');
                const data = await api('/files/create_folder_v2', { path });
                return { output: { metadata: data.metadata ?? data } };
            }

            case 'deleteFile': {
                const path = String(inputs.path ?? '').trim();
                if (!path) throw new Error('path is required.');
                const data = await api('/files/delete_v2', { path });
                return { output: { metadata: data.metadata ?? data } };
            }

            case 'moveFile': {
                const from_path = String(inputs.fromPath ?? '').trim();
                const to_path = String(inputs.toPath ?? '').trim();
                if (!from_path || !to_path) throw new Error('fromPath and toPath are required.');
                const data = await api('/files/move_v2', { from_path, to_path });
                return { output: { metadata: data.metadata ?? data } };
            }

            case 'copyFile': {
                const from_path = String(inputs.fromPath ?? '').trim();
                const to_path = String(inputs.toPath ?? '').trim();
                if (!from_path || !to_path) throw new Error('fromPath and toPath are required.');
                const data = await api('/files/copy_v2', { from_path, to_path });
                return { output: { metadata: data.metadata ?? data } };
            }

            case 'downloadFile': {
                const path = String(inputs.path ?? '').trim();
                if (!path) throw new Error('path is required.');
                logger?.log(`[Dropbox] POST /files/download`);
                const res = await fetch(`${DROPBOX_CONTENT_BASE}/files/download`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Dropbox-API-Arg': JSON.stringify({ path }),
                    },
                });
                if (!res.ok) {
                    const err = await res.text();
                    throw new Error(`Dropbox download error: ${res.status} ${err}`);
                }
                const metaHeader = res.headers.get('dropbox-api-result');
                const meta = metaHeader ? JSON.parse(metaHeader) : {};
                const buffer = await res.arrayBuffer();
                const base64 = Buffer.from(buffer).toString('base64');
                return { output: { metadata: meta, base64Content: base64, size: buffer.byteLength } };
            }

            case 'uploadFile': {
                const path = String(inputs.path ?? '').trim();
                const fileUrl = String(inputs.fileUrl ?? '').trim();
                const mode = String(inputs.mode ?? 'add');
                if (!path || !fileUrl) throw new Error('path and fileUrl are required.');
                logger?.log(`[Dropbox] Fetching source file: ${fileUrl}`);
                const fileRes = await fetch(fileUrl);
                if (!fileRes.ok) throw new Error(`Failed to fetch fileUrl: ${fileRes.status}`);
                const fileBytes = await fileRes.arrayBuffer();
                logger?.log(`[Dropbox] POST /files/upload`);
                const res = await fetch(`${DROPBOX_CONTENT_BASE}/files/upload`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/octet-stream',
                        'Dropbox-API-Arg': JSON.stringify({ path, mode, autorename: true }),
                    },
                    body: fileBytes,
                });
                const text = await res.text();
                let data: any;
                try { data = JSON.parse(text); } catch { data = { raw: text }; }
                if (!res.ok) throw new Error(data?.error_summary || `Dropbox upload error: ${res.status}`);
                return { output: { id: data.id, name: data.name, path: data.path_display, size: data.size } };
            }

            case 'searchFiles': {
                const query = String(inputs.query ?? '').trim();
                const path = String(inputs.path ?? '');
                if (!query) throw new Error('query is required.');
                const data = await api('/files/search_v2', { query, options: { path } });
                return { output: { matches: data.matches ?? [], hasMore: data.has_more ?? false } };
            }

            case 'shareFolder': {
                const path = String(inputs.path ?? '').trim();
                if (!path) throw new Error('path is required.');
                const data = await api('/sharing/share_folder', { path });
                return { output: data };
            }

            case 'createSharedLink': {
                const path = String(inputs.path ?? '').trim();
                if (!path) throw new Error('path is required.');
                const data = await api('/sharing/create_shared_link_with_settings', { path });
                return { output: { url: data.url, metadata: data.metadata ?? data } };
            }

            case 'getSharedLinks': {
                const path = inputs.path ? String(inputs.path).trim() : undefined;
                const body: any = {};
                if (path) body.path = path;
                const data = await api('/sharing/list_shared_links', body);
                return { output: { links: data.links ?? [] } };
            }

            case 'getAccountInfo': {
                const data = await api('/users/get_current_account', null);
                return { output: { accountId: data.account_id, name: data.name?.display_name ?? '', email: data.email, country: data.country } };
            }

            default:
                throw new Error(`Unknown Dropbox action: ${actionName}`);
        }
    } catch (err: any) {
        return { error: err?.message ?? String(err) };
    }
}
