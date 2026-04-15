
'use server';

const CANVA_BASE = 'https://api.canva.com/rest/v1';

async function canvaFetch(token: string, method: string, path: string, body?: any, logger?: any): Promise<any> {
    logger?.log(`[Canva] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${CANVA_BASE}${path}`, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || data?.error?.message || `Canva API error: ${res.status}`);
    }
    return data;
}

export async function executeCanvaAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const token = String(inputs.accessToken ?? '').trim();
        if (!token) throw new Error('accessToken is required.');
        const canva = (method: string, path: string, body?: any) => canvaFetch(token, method, path, body, logger);

        switch (actionName) {
            case 'listDesigns': {
                const query = inputs.query ? `?query=${encodeURIComponent(String(inputs.query))}` : '';
                const data = await canva('GET', `/designs${query}`);
                return { output: { designs: data.items ?? [], count: (data.items ?? []).length, continuation: data.continuation ?? null } };
            }

            case 'getDesign': {
                const designId = String(inputs.designId ?? '').trim();
                if (!designId) throw new Error('designId is required.');
                const data = await canva('GET', `/designs/${designId}`);
                return { output: { id: data.design?.id ?? designId, title: data.design?.title ?? '', urls: data.design?.urls ?? {} } };
            }

            case 'createDesign': {
                const assetType = String(inputs.assetType ?? 'presentation').trim();
                const body: any = { asset_type: assetType };
                if (inputs.title) body.title = String(inputs.title);
                if (inputs.width) body.width = Number(inputs.width);
                if (inputs.height) body.height = Number(inputs.height);
                const data = await canva('POST', '/designs', body);
                return { output: { id: data.design?.id ?? '', title: data.design?.title ?? '', urls: data.design?.urls ?? {} } };
            }

            case 'exportDesign': {
                const designId = String(inputs.designId ?? '').trim();
                const format = String(inputs.format ?? 'pdf').trim();
                if (!designId) throw new Error('designId is required.');
                const body: any = { format: { type: format } };
                if (inputs.pages) body.pages = inputs.pages;
                const data = await canva('POST', `/designs/${designId}/exports`, body);
                return { output: { exportId: data.job?.id ?? '', status: data.job?.status ?? '' } };
            }

            case 'getExport': {
                const exportId = String(inputs.exportId ?? '').trim();
                if (!exportId) throw new Error('exportId is required.');
                const data = await canva('GET', `/exports/${exportId}`);
                return { output: { exportId, status: data.job?.status ?? '', urls: data.job?.urls ?? [] } };
            }

            case 'listFolders': {
                const data = await canva('GET', '/folders');
                return { output: { folders: data.items ?? [], count: (data.items ?? []).length } };
            }

            case 'getFolder': {
                const folderId = String(inputs.folderId ?? '').trim();
                if (!folderId) throw new Error('folderId is required.');
                const data = await canva('GET', `/folders/${folderId}`);
                return { output: { id: data.folder?.id ?? folderId, name: data.folder?.name ?? '' } };
            }

            case 'createFolder': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const body: any = { name };
                if (inputs.parentFolderId) body.parent_folder_id = String(inputs.parentFolderId);
                const data = await canva('POST', '/folders', body);
                return { output: { id: data.folder?.id ?? '', name: data.folder?.name ?? '' } };
            }

            case 'deleteFolder': {
                const folderId = String(inputs.folderId ?? '').trim();
                if (!folderId) throw new Error('folderId is required.');
                await canva('DELETE', `/folders/${folderId}`);
                return { output: { deleted: 'true', folderId } };
            }

            case 'listBrands': {
                const data = await canva('GET', '/brands');
                return { output: { brands: data.items ?? [], count: (data.items ?? []).length } };
            }

            case 'getBrand': {
                const brandId = String(inputs.brandId ?? '').trim();
                if (!brandId) throw new Error('brandId is required.');
                const data = await canva('GET', `/brands/${brandId}`);
                return { output: { id: data.brand?.id ?? brandId, name: data.brand?.name ?? '' } };
            }

            case 'listComments': {
                const designId = String(inputs.designId ?? '').trim();
                if (!designId) throw new Error('designId is required.');
                const data = await canva('GET', `/designs/${designId}/comments`);
                return { output: { comments: data.items ?? [], count: (data.items ?? []).length } };
            }

            case 'createComment': {
                const designId = String(inputs.designId ?? '').trim();
                const message = String(inputs.message ?? '').trim();
                if (!designId) throw new Error('designId is required.');
                if (!message) throw new Error('message is required.');
                const body: any = { message };
                if (inputs.threadId) body.thread_id = String(inputs.threadId);
                const data = await canva('POST', `/designs/${designId}/comments`, body);
                return { output: { id: data.comment?.id ?? '', message: data.comment?.message ?? '' } };
            }

            case 'listAssets': {
                const data = await canva('GET', '/assets');
                return { output: { assets: data.items ?? [], count: (data.items ?? []).length } };
            }

            case 'uploadAsset': {
                const name = String(inputs.name ?? '').trim();
                const url = String(inputs.url ?? '').trim();
                if (!name) throw new Error('name is required.');
                if (!url) throw new Error('url is required (public URL of the asset).');
                const body: any = { name, url };
                if (inputs.folderId) body.parent_folder_id = String(inputs.folderId);
                const data = await canva('POST', '/assets/upload', body);
                return { output: { id: data.asset?.id ?? '', name: data.asset?.name ?? '', status: data.asset?.status ?? '' } };
            }

            default:
                return { error: `Canva action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Canva action failed.' };
    }
}
