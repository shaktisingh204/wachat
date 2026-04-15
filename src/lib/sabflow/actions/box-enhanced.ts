'use server';

export async function executeBoxEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const baseUrl = 'https://api.box.com/2.0';
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${inputs.accessToken}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listFolderItems': {
                const folderId = inputs.folderId || '0';
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                if (inputs.fields) params.set('fields', inputs.fields);
                const query = params.toString() ? `?${params}` : '';
                const res = await fetch(`${baseUrl}/folders/${folderId}/items${query}`, { headers });
                if (!res.ok) return { error: `Failed to list folder items: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getFolderInfo': {
                const folderId = inputs.folderId || '0';
                const params = new URLSearchParams();
                if (inputs.fields) params.set('fields', inputs.fields);
                const query = params.toString() ? `?${params}` : '';
                const res = await fetch(`${baseUrl}/folders/${folderId}${query}`, { headers });
                if (!res.ok) return { error: `Failed to get folder info: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'createFolder': {
                const body: Record<string, any> = {
                    name: inputs.name,
                    parent: { id: inputs.parentId || '0' },
                };
                const res = await fetch(`${baseUrl}/folders`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `Failed to create folder: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'deleteFolder': {
                const params = new URLSearchParams();
                if (inputs.recursive !== undefined) params.set('recursive', String(inputs.recursive));
                const query = params.toString() ? `?${params}` : '';
                const res = await fetch(`${baseUrl}/folders/${inputs.folderId}${query}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) return { error: `Failed to delete folder: ${res.status} ${await res.text()}` };
                return { output: { deleted: true, folderId: inputs.folderId } };
            }

            case 'uploadFile': {
                const uploadHeaders: Record<string, string> = {
                    'Authorization': `Bearer ${inputs.accessToken}`,
                };
                const attributes = JSON.stringify({
                    name: inputs.name,
                    parent: { id: inputs.parentId || '0' },
                });
                const formData = new FormData();
                formData.append('attributes', attributes);
                const fileContent = inputs.content || '';
                const blob = new Blob([fileContent], { type: inputs.mimeType || 'application/octet-stream' });
                formData.append('file', blob, inputs.name);
                const res = await fetch('https://upload.box.com/api/2.0/files/content', {
                    method: 'POST',
                    headers: uploadHeaders,
                    body: formData,
                });
                if (!res.ok) return { error: `Failed to upload file: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'downloadFile': {
                const res = await fetch(`${baseUrl}/files/${inputs.fileId}/content`, { headers });
                if (!res.ok) return { error: `Failed to download file: ${res.status} ${await res.text()}` };
                const buffer = await res.arrayBuffer();
                const base64 = Buffer.from(buffer).toString('base64');
                return { output: { fileId: inputs.fileId, content: base64, encoding: 'base64' } };
            }

            case 'getFileInfo': {
                const params = new URLSearchParams();
                if (inputs.fields) params.set('fields', inputs.fields);
                const query = params.toString() ? `?${params}` : '';
                const res = await fetch(`${baseUrl}/files/${inputs.fileId}${query}`, { headers });
                if (!res.ok) return { error: `Failed to get file info: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'updateFile': {
                const body: Record<string, any> = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.description) body.description = inputs.description;
                if (inputs.tags) body.tags = inputs.tags;
                if (inputs.parent) body.parent = { id: inputs.parent };
                const res = await fetch(`${baseUrl}/files/${inputs.fileId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `Failed to update file: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'deleteFile': {
                const res = await fetch(`${baseUrl}/files/${inputs.fileId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) return { error: `Failed to delete file: ${res.status} ${await res.text()}` };
                return { output: { deleted: true, fileId: inputs.fileId } };
            }

            case 'copyFile': {
                const body: Record<string, any> = {
                    parent: { id: inputs.parentId },
                };
                if (inputs.name) body.name = inputs.name;
                if (inputs.version) body.version = inputs.version;
                const res = await fetch(`${baseUrl}/files/${inputs.fileId}/copy`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `Failed to copy file: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'moveFile': {
                const body: Record<string, any> = {
                    parent: { id: inputs.parentId },
                };
                if (inputs.name) body.name = inputs.name;
                const res = await fetch(`${baseUrl}/files/${inputs.fileId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `Failed to move file: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'searchContent': {
                const params = new URLSearchParams({ query: inputs.query });
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                if (inputs.type) params.set('type', inputs.type);
                if (inputs.ancestorFolderIds) params.set('ancestor_folder_ids', inputs.ancestorFolderIds);
                if (inputs.contentTypes) params.set('content_types', inputs.contentTypes);
                const res = await fetch(`${baseUrl}/search?${params}`, { headers });
                if (!res.ok) return { error: `Failed to search content: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'listCollaborations': {
                const type = inputs.type || 'file';
                const itemId = inputs.itemId;
                const params = new URLSearchParams({ fields: inputs.fields || 'id,role,accessible_by,created_at' });
                const res = await fetch(`${baseUrl}/${type}s/${itemId}/collaborations?${params}`, { headers });
                if (!res.ok) return { error: `Failed to list collaborations: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'addCollaboration': {
                const body: Record<string, any> = {
                    item: { id: inputs.itemId, type: inputs.itemType || 'folder' },
                    accessible_by: {
                        id: inputs.userId,
                        type: inputs.accessibleByType || 'user',
                    },
                    role: inputs.role,
                };
                if (inputs.notify !== undefined) body.notify = inputs.notify;
                if (inputs.canViewPath !== undefined) body.can_view_path = inputs.canViewPath;
                const res = await fetch(`${baseUrl}/collaborations`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `Failed to add collaboration: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'removeCollaboration': {
                const res = await fetch(`${baseUrl}/collaborations/${inputs.collaborationId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) return { error: `Failed to remove collaboration: ${res.status} ${await res.text()}` };
                return { output: { deleted: true, collaborationId: inputs.collaborationId } };
            }

            default:
                return { error: `Unknown Box action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Box Enhanced Action error: ${err.message}`);
        return { error: err.message || 'Box Enhanced Action failed' };
    }
}
