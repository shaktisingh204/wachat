
'use server';

export async function executeSanityAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const projectId = String(inputs.projectId ?? '').trim();
        if (!projectId) throw new Error('projectId is required.');
        const apiToken = String(inputs.apiToken ?? '').trim();
        const dataset = String(inputs.dataset ?? 'production').trim() || 'production';

        const BASE = `https://${projectId}.api.sanity.io/v2022-03-07`;

        const sanityFetch = async (method: string, path: string, body?: any) => {
            logger?.log(`[Sanity] ${method} ${path}`);
            const opts: RequestInit = {
                method,
                headers: {
                    ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
                    'Content-Type': 'application/json',
                },
            };
            if (body !== undefined) opts.body = JSON.stringify(body);
            const res = await fetch(`${BASE}${path}`, opts);
            if (res.status === 204) return {};
            const text = await res.text();
            if (!text) return {};
            let data: any;
            try { data = JSON.parse(text); } catch { data = { message: text }; }
            if (!res.ok) throw new Error(data?.error?.description || data?.message || `Sanity API error: ${res.status}`);
            return data;
        };

        switch (actionName) {
            case 'queryDocuments': {
                const query = String(inputs.query ?? '').trim();
                if (!query) throw new Error('query is required.');
                const encoded = encodeURIComponent(query);
                const data = await sanityFetch('GET', `/data/query/${dataset}?query=${encoded}`);
                return { output: { result: data.result ?? [] } };
            }

            case 'getDocument': {
                const documentId = String(inputs.documentId ?? '').trim();
                if (!documentId) throw new Error('documentId is required.');
                const data = await sanityFetch('GET', `/data/doc/${dataset}/${documentId}`);
                return { output: { documents: data.documents ?? [] } };
            }

            case 'createDocument': {
                if (!inputs.document) throw new Error('document is required.');
                const document = typeof inputs.document === 'string' ? JSON.parse(inputs.document) : inputs.document;
                const data = await sanityFetch('POST', `/data/mutate/${dataset}`, { mutations: [{ create: document }] });
                return { output: { transactionId: data.transactionId ?? '', results: data.results ?? [] } };
            }

            case 'updateDocument': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                if (!inputs.set) throw new Error('set is required.');
                const set = typeof inputs.set === 'string' ? JSON.parse(inputs.set) : inputs.set;
                const data = await sanityFetch('POST', `/data/mutate/${dataset}`, { mutations: [{ patch: { id, set } }] });
                return { output: { transactionId: data.transactionId ?? '', results: data.results ?? [] } };
            }

            case 'deleteDocument': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await sanityFetch('POST', `/data/mutate/${dataset}`, { mutations: [{ delete: { id } }] });
                return { output: { transactionId: data.transactionId ?? '', deleted: 'true' } };
            }

            case 'publishDocument': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                if (!inputs.document) throw new Error('document is required.');
                const document = typeof inputs.document === 'string' ? JSON.parse(inputs.document) : inputs.document;
                const publishedDoc = { ...document, _id: id.replace(/^drafts\./, '') };
                const data = await sanityFetch('POST', `/data/mutate/${dataset}`, { mutations: [{ createOrReplace: publishedDoc }] });
                return { output: { transactionId: data.transactionId ?? '', results: data.results ?? [] } };
            }

            case 'unpublishDocument': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const publishedId = id.replace(/^drafts\./, '');
                const data = await sanityFetch('POST', `/data/mutate/${dataset}`, { mutations: [{ delete: { id: publishedId } }] });
                return { output: { transactionId: data.transactionId ?? '', unpublished: 'true' } };
            }

            case 'listDatasets': {
                const data = await sanityFetch('GET', '/datasets');
                return { output: { datasets: Array.isArray(data) ? data : [] } };
            }

            case 'createDataset': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const aclMode = String(inputs.aclMode ?? 'private').trim() || 'private';
                const data = await sanityFetch('PUT', `/datasets/${name}`, { aclMode });
                return { output: { dataset: data } };
            }

            case 'uploadAsset': {
                const assetType = String(inputs.assetType ?? 'images').trim() || 'images';
                const fileUrl = String(inputs.fileUrl ?? '').trim();
                if (!fileUrl) throw new Error('fileUrl is required.');
                const filename = String(inputs.filename ?? '').trim();
                const fileRes = await fetch(fileUrl);
                if (!fileRes.ok) throw new Error(`Failed to fetch asset from fileUrl: ${fileRes.status}`);
                const blob = await fileRes.blob();
                const contentType = blob.type || 'application/octet-stream';
                let uploadPath = `/assets/${assetType}/${dataset}`;
                if (filename) uploadPath += `?filename=${encodeURIComponent(filename)}`;
                logger?.log(`[Sanity] POST ${uploadPath}`);
                const res = await fetch(`${BASE}${uploadPath}`, {
                    method: 'POST',
                    headers: {
                        ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
                        'Content-Type': contentType,
                    },
                    body: blob,
                });
                const text = await res.text();
                let data: any;
                try { data = JSON.parse(text); } catch { data = { message: text }; }
                if (!res.ok) throw new Error(data?.error?.description || data?.message || `Sanity upload error: ${res.status}`);
                return { output: { document: data.document ?? data } };
            }

            case 'listAssets': {
                const assetType = String(inputs.assetType ?? 'sanity.imageAsset').trim() || 'sanity.imageAsset';
                const query = encodeURIComponent(`*[_type == "${assetType}"]`);
                const data = await sanityFetch('GET', `/data/query/${dataset}?query=${query}`);
                return { output: { assets: data.result ?? [] } };
            }

            case 'deleteAsset': {
                const assetId = String(inputs.assetId ?? '').trim();
                if (!assetId) throw new Error('assetId is required.');
                const assetType = String(inputs.assetType ?? 'images').trim() || 'images';
                const data = await sanityFetch('DELETE', `/assets/${assetType}/${dataset}/${assetId}`);
                return { output: { deleted: 'true', assetId } };
            }

            default:
                return { error: `Sanity action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Sanity action failed.' };
    }
}
