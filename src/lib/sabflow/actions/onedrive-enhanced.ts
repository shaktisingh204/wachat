'use server';

export async function executeOneDriveEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        switch (actionName) {
            case 'listDrives': {
                const res = await fetch('https://graph.microsoft.com/v1.0/me/drives', {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { drives: data.value, count: data.value?.length ?? 0 } };
            }
            case 'getDrive': {
                const driveId = String(inputs.driveId ?? '').trim();
                const url = driveId
                    ? `https://graph.microsoft.com/v1.0/drives/${driveId}`
                    : 'https://graph.microsoft.com/v1.0/me/drive';
                const res = await fetch(url, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { drive: data } };
            }
            case 'listItems': {
                const driveId = String(inputs.driveId ?? '').trim();
                const parentId = String(inputs.parentId ?? 'root').trim();
                const base = driveId
                    ? `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${parentId}/children`
                    : `https://graph.microsoft.com/v1.0/me/drive/items/${parentId}/children`;
                const params = new URLSearchParams();
                if (inputs.top) params.set('$top', String(inputs.top));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const res = await fetch(`${base}${qs}`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { items: data.value, count: data.value?.length ?? 0 } };
            }
            case 'getDriveItem': {
                const driveId = String(inputs.driveId ?? '').trim();
                const itemId = String(inputs.itemId ?? '').trim();
                const url = driveId
                    ? `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}`
                    : `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}`;
                const res = await fetch(url, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { item: data } };
            }
            case 'createFolder': {
                const parentId = String(inputs.parentId ?? 'root').trim();
                const driveId = String(inputs.driveId ?? '').trim();
                const body = {
                    name: String(inputs.folderName ?? ''),
                    folder: {},
                    '@microsoft.graph.conflictBehavior': inputs.conflictBehavior ?? 'rename',
                };
                const url = driveId
                    ? `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${parentId}/children`
                    : `https://graph.microsoft.com/v1.0/me/drive/items/${parentId}/children`;
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { folder: data } };
            }
            case 'uploadFile': {
                const driveId = String(inputs.driveId ?? '').trim();
                const parentPath = String(inputs.parentPath ?? '').trim();
                const fileName = String(inputs.fileName ?? '').trim();
                const fileContent = String(inputs.fileContent ?? '');
                const url = driveId
                    ? `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${parentPath}/${fileName}:/content`
                    : `https://graph.microsoft.com/v1.0/me/drive/root:/${parentPath}/${fileName}:/content`;
                const res = await fetch(url, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': inputs.mimeType ?? 'application/octet-stream',
                    },
                    body: fileContent,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { file: data } };
            }
            case 'downloadFile': {
                const driveId = String(inputs.driveId ?? '').trim();
                const itemId = String(inputs.itemId ?? '').trim();
                const url = driveId
                    ? `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/content`
                    : `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}/content`;
                const res = await fetch(url, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                    redirect: 'follow',
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err?.error?.message || `API error: ${res.status}`);
                }
                const buffer = await res.arrayBuffer();
                const base64 = Buffer.from(buffer).toString('base64');
                const contentType = res.headers.get('content-type') ?? 'application/octet-stream';
                return { output: { base64, contentType, size: buffer.byteLength } };
            }
            case 'moveItem': {
                const driveId = String(inputs.driveId ?? '').trim();
                const itemId = String(inputs.itemId ?? '').trim();
                const destinationParentId = String(inputs.destinationParentId ?? '').trim();
                const body: Record<string, any> = {
                    parentReference: { id: destinationParentId },
                };
                if (inputs.newName) body.name = String(inputs.newName);
                const url = driveId
                    ? `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}`
                    : `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}`;
                const res = await fetch(url, {
                    method: 'PATCH',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { item: data } };
            }
            case 'copyItem': {
                const driveId = String(inputs.driveId ?? '').trim();
                const itemId = String(inputs.itemId ?? '').trim();
                const body: Record<string, any> = {
                    parentReference: { id: String(inputs.destinationParentId ?? '').trim() },
                };
                if (inputs.newName) body.name = String(inputs.newName);
                const url = driveId
                    ? `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/copy`
                    : `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}/copy`;
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                if (res.status === 202) {
                    const location = res.headers.get('Location') ?? '';
                    return { output: { status: 'copying', monitorUrl: location } };
                }
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { item: data } };
            }
            case 'deleteItem': {
                const driveId = String(inputs.driveId ?? '').trim();
                const itemId = String(inputs.itemId ?? '').trim();
                const url = driveId
                    ? `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}`
                    : `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}`;
                const res = await fetch(url, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err?.error?.message || `API error: ${res.status}`);
                }
                return { output: { success: true, itemId } };
            }
            case 'createShareLink': {
                const driveId = String(inputs.driveId ?? '').trim();
                const itemId = String(inputs.itemId ?? '').trim();
                const body = {
                    type: inputs.type ?? 'view',
                    scope: inputs.scope ?? 'anonymous',
                    expirationDateTime: inputs.expirationDateTime,
                };
                const url = driveId
                    ? `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/createLink`
                    : `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}/createLink`;
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { shareLink: data } };
            }
            case 'listSharedItems': {
                const res = await fetch('https://graph.microsoft.com/v1.0/me/drive/sharedWithMe', {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { items: data.value, count: data.value?.length ?? 0 } };
            }
            case 'searchFiles': {
                const query = String(inputs.query ?? '').trim();
                const driveId = String(inputs.driveId ?? '').trim();
                const url = driveId
                    ? `https://graph.microsoft.com/v1.0/drives/${driveId}/root/search(q='${encodeURIComponent(query)}')`
                    : `https://graph.microsoft.com/v1.0/me/drive/root/search(q='${encodeURIComponent(query)}')`;
                const res = await fetch(url, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { results: data.value, count: data.value?.length ?? 0 } };
            }
            case 'getItemPermissions': {
                const driveId = String(inputs.driveId ?? '').trim();
                const itemId = String(inputs.itemId ?? '').trim();
                const url = driveId
                    ? `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/permissions`
                    : `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}/permissions`;
                const res = await fetch(url, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { permissions: data.value, count: data.value?.length ?? 0 } };
            }
            case 'updateItemPermissions': {
                const driveId = String(inputs.driveId ?? '').trim();
                const itemId = String(inputs.itemId ?? '').trim();
                const permId = String(inputs.permissionId ?? '').trim();
                const body = { roles: inputs.roles ?? ['read'] };
                const url = driveId
                    ? `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/permissions/${permId}`
                    : `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}/permissions/${permId}`;
                const res = await fetch(url, {
                    method: 'PATCH',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { permission: data } };
            }
            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
