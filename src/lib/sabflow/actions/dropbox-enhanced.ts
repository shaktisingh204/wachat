'use server';

export async function executeDropboxEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const metaBase = 'https://api.dropboxapi.com/2';
        const contentBase = 'https://content.dropboxapi.com/2';
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${inputs.accessToken}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listFolder': {
                const body: Record<string, any> = {
                    path: inputs.path || '',
                    recursive: inputs.recursive || false,
                    include_media_info: inputs.includeMediaInfo || false,
                    include_deleted: inputs.includeDeleted || false,
                    include_has_explicit_shared_members: false,
                    limit: inputs.limit || 100,
                };
                const res = await fetch(`${metaBase}/files/list_folder`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `Failed to list folder: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getFolderMetadata': {
                const body: Record<string, any> = { path: inputs.path };
                const res = await fetch(`${metaBase}/files/get_metadata`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `Failed to get folder metadata: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'createFolder': {
                const body: Record<string, any> = {
                    path: inputs.path,
                    autorename: inputs.autorename || false,
                };
                const res = await fetch(`${metaBase}/files/create_folder_v2`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `Failed to create folder: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'deleteItem': {
                const body: Record<string, any> = { path: inputs.path };
                const res = await fetch(`${metaBase}/files/delete_v2`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `Failed to delete item: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'moveItem': {
                const body: Record<string, any> = {
                    from_path: inputs.fromPath,
                    to_path: inputs.toPath,
                    autorename: inputs.autorename || false,
                    allow_ownership_transfer: inputs.allowOwnershipTransfer || false,
                };
                const res = await fetch(`${metaBase}/files/move_v2`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `Failed to move item: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'copyItem': {
                const body: Record<string, any> = {
                    from_path: inputs.fromPath,
                    to_path: inputs.toPath,
                    autorename: inputs.autorename || false,
                    allow_ownership_transfer: inputs.allowOwnershipTransfer || false,
                };
                const res = await fetch(`${metaBase}/files/copy_v2`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `Failed to copy item: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'uploadFile': {
                const uploadHeaders: Record<string, string> = {
                    'Authorization': `Bearer ${inputs.accessToken}`,
                    'Content-Type': 'application/octet-stream',
                    'Dropbox-API-Arg': JSON.stringify({
                        path: inputs.path,
                        mode: inputs.mode || 'add',
                        autorename: inputs.autorename || false,
                        mute: inputs.mute || false,
                    }),
                };
                const content = inputs.content || '';
                const buffer = Buffer.from(content, inputs.encoding || 'utf8');
                const res = await fetch(`${contentBase}/files/upload`, {
                    method: 'POST',
                    headers: uploadHeaders,
                    body: buffer,
                });
                if (!res.ok) return { error: `Failed to upload file: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'downloadFile': {
                const downloadHeaders: Record<string, string> = {
                    'Authorization': `Bearer ${inputs.accessToken}`,
                    'Dropbox-API-Arg': JSON.stringify({ path: inputs.path }),
                };
                const res = await fetch(`${contentBase}/files/download`, {
                    method: 'POST',
                    headers: downloadHeaders,
                });
                if (!res.ok) return { error: `Failed to download file: ${res.status} ${await res.text()}` };
                const buffer = await res.arrayBuffer();
                const base64 = Buffer.from(buffer).toString('base64');
                const metaHeader = res.headers.get('dropbox-api-result');
                const meta = metaHeader ? JSON.parse(metaHeader) : {};
                return { output: { ...meta, content: base64, encoding: 'base64' } };
            }

            case 'getFileMetadata': {
                const body: Record<string, any> = {
                    path: inputs.path,
                    include_media_info: inputs.includeMediaInfo || false,
                    include_deleted: false,
                    include_has_explicit_shared_members: inputs.includeSharedMembers || false,
                };
                const res = await fetch(`${metaBase}/files/get_metadata`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `Failed to get file metadata: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'searchFiles': {
                const body: Record<string, any> = {
                    query: inputs.query,
                    options: {
                        path: inputs.path || '',
                        max_results: inputs.maxResults || 20,
                        file_status: inputs.fileStatus || 'active',
                        filename_only: inputs.filenameOnly || false,
                    },
                };
                const res = await fetch(`${metaBase}/files/search_v2`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `Failed to search files: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'listSharedLinks': {
                const body: Record<string, any> = {};
                if (inputs.path) body.path = inputs.path;
                if (inputs.cursor) body.cursor = inputs.cursor;
                if (inputs.directOnly !== undefined) body.direct_only = inputs.directOnly;
                const res = await fetch(`${metaBase}/sharing/list_shared_links`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `Failed to list shared links: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'createSharedLink': {
                const body: Record<string, any> = {
                    path: inputs.path,
                    settings: {
                        requested_visibility: inputs.visibility || 'public',
                    },
                };
                if (inputs.expires) body.settings.expires = inputs.expires;
                const res = await fetch(`${metaBase}/sharing/create_shared_link_with_settings`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `Failed to create shared link: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'revokeSharedLink': {
                const body: Record<string, any> = { url: inputs.url };
                const res = await fetch(`${metaBase}/sharing/revoke_shared_link`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `Failed to revoke shared link: ${res.status} ${await res.text()}` };
                return { output: { revoked: true, url: inputs.url } };
            }

            case 'listMembers': {
                const body: Record<string, any> = {
                    shared_folder_id: inputs.sharedFolderId,
                };
                if (inputs.limit) body.limit = inputs.limit;
                if (inputs.actions) body.actions = inputs.actions;
                const res = await fetch(`${metaBase}/sharing/list_folder_members`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `Failed to list members: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'shareFolder': {
                const body: Record<string, any> = {
                    path: inputs.path,
                    acl_update_policy: inputs.aclUpdatePolicy || 'editors',
                    force_async: inputs.forceAsync || false,
                    member_policy: inputs.memberPolicy || 'anyone',
                    shared_link_policy: inputs.sharedLinkPolicy || 'anyone',
                };
                if (inputs.viewerInfoPolicy) body.viewer_info_policy = inputs.viewerInfoPolicy;
                const res = await fetch(`${metaBase}/sharing/share_folder`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `Failed to share folder: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            default:
                return { error: `Unknown Dropbox action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Dropbox Enhanced Action error: ${err.message}`);
        return { error: err.message || 'Dropbox Enhanced Action failed' };
    }
}
