'use server';

export async function executeObsidianSyncAction(actionName: string, inputs: any, user: any, logger: any) {
    const apiKey = inputs.apiKey;
    const baseUrl = `${inputs.vaultUrl}/api/v1`;
    const headers: Record<string, string> = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'getFile': {
                const res = await fetch(`${baseUrl}/vault/${encodeURIComponent(inputs.filePath)}`, {
                    method: 'GET',
                    headers: { ...headers, 'Accept': 'text/markdown' },
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    return { error: (err as any).message || 'Failed to get file' };
                }
                const content = await res.text();
                return { output: { content, filePath: inputs.filePath } };
            }
            case 'putFile': {
                const putHeaders = { ...headers, 'Content-Type': 'text/markdown' };
                const res = await fetch(`${baseUrl}/vault/${encodeURIComponent(inputs.filePath)}`, {
                    method: 'PUT',
                    headers: putHeaders,
                    body: inputs.content || '',
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    return { error: (err as any).message || 'Failed to put file' };
                }
                return { output: { success: true, filePath: inputs.filePath } };
            }
            case 'deleteFile': {
                const res = await fetch(`${baseUrl}/vault/${encodeURIComponent(inputs.filePath)}`, { method: 'DELETE', headers });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    return { error: (err as any).message || 'Failed to delete file' };
                }
                return { output: { success: true, filePath: inputs.filePath } };
            }
            case 'getActiveFile': {
                const res = await fetch(`${baseUrl}/active/`, {
                    method: 'GET',
                    headers: { ...headers, 'Accept': 'text/markdown' },
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    return { error: (err as any).message || 'Failed to get active file' };
                }
                const content = await res.text();
                return { output: { content } };
            }
            case 'updateActiveFile': {
                const putHeaders = { ...headers, 'Content-Type': 'text/markdown' };
                const res = await fetch(`${baseUrl}/active/`, {
                    method: 'PUT',
                    headers: putHeaders,
                    body: inputs.content || '',
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    return { error: (err as any).message || 'Failed to update active file' };
                }
                return { output: { success: true } };
            }
            case 'appendToActiveFile': {
                const patchHeaders = { ...headers, 'Content-Type': 'text/markdown' };
                const res = await fetch(`${baseUrl}/active/`, {
                    method: 'POST',
                    headers: patchHeaders,
                    body: inputs.content || '',
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    return { error: (err as any).message || 'Failed to append to active file' };
                }
                return { output: { success: true } };
            }
            case 'listFiles': {
                const path = inputs.dirPath ? encodeURIComponent(inputs.dirPath) : '';
                const res = await fetch(`${baseUrl}/vault/${path}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: (data as any).message || 'Failed to list files' };
                return { output: data };
            }
            case 'searchInFiles': {
                const searchHeaders = { ...headers, 'Content-Type': 'application/json' };
                const body: Record<string, any> = { query: inputs.query || '' };
                if (inputs.contextLength) body.contextLength = inputs.contextLength;
                const res = await fetch(`${baseUrl}/search/simple/`, {
                    method: 'POST',
                    headers: searchHeaders,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: (data as any).message || 'Failed to search in files' };
                return { output: data };
            }
            case 'openFile': {
                const body: Record<string, any> = { filePath: inputs.filePath };
                if (inputs.newLeaf !== undefined) body.newLeaf = inputs.newLeaf;
                const res = await fetch(`${baseUrl}/open/${encodeURIComponent(inputs.filePath)}`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    return { error: (err as any).message || 'Failed to open file' };
                }
                return { output: { success: true } };
            }
            case 'patchFile': {
                const patchHeaders = { ...headers, 'Content-Type': 'text/markdown' };
                const res = await fetch(`${baseUrl}/vault/${encodeURIComponent(inputs.filePath)}`, {
                    method: 'PATCH',
                    headers: patchHeaders,
                    body: inputs.content || '',
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    return { error: (err as any).message || 'Failed to patch file' };
                }
                return { output: { success: true } };
            }
            case 'getFileMetadata': {
                const res = await fetch(`${baseUrl}/vault/${encodeURIComponent(inputs.filePath)}`, {
                    method: 'HEAD',
                    headers,
                });
                if (!res.ok) {
                    return { error: 'Failed to get file metadata' };
                }
                const metadata: Record<string, string> = {};
                res.headers.forEach((value, key) => { metadata[key] = value; });
                return { output: { metadata } };
            }
            case 'listDailyNotes': {
                const res = await fetch(`${baseUrl}/periodic/daily/`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: (data as any).message || 'Failed to list daily notes' };
                return { output: data };
            }
            case 'createDailyNote': {
                const putHeaders = { ...headers, 'Content-Type': 'text/markdown' };
                const date = inputs.date || new Date().toISOString().slice(0, 10);
                const res = await fetch(`${baseUrl}/periodic/daily/${date}`, {
                    method: 'PUT',
                    headers: putHeaders,
                    body: inputs.content || '',
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    return { error: (err as any).message || 'Failed to create daily note' };
                }
                return { output: { success: true, date } };
            }
            case 'listTags': {
                const res = await fetch(`${baseUrl}/tags/`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: (data as any).message || 'Failed to list tags' };
                return { output: data };
            }
            case 'listLinkedMentions': {
                const res = await fetch(`${baseUrl}/vault/${encodeURIComponent(inputs.filePath)}/links`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: (data as any).message || 'Failed to list linked mentions' };
                return { output: data };
            }
            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        return { error: err.message || 'Unexpected error in obsidian-sync action' };
    }
}
