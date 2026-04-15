'use server';

export async function executeSanityEnhancedAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const token: string = inputs.token;
        const projectId: string = inputs.projectId;
        const dataset: string = inputs.dataset || 'production';

        if (!token) return { error: 'inputs.token is required' };
        if (!projectId) return { error: 'inputs.projectId is required' };

        const BASE = `https://${projectId}.api.sanity.io/v2021-10-21`;
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        };

        async function req(method: string, path: string, body?: any) {
            const res = await fetch(`${BASE}${path}`, {
                method,
                headers,
                ...(body ? { body: JSON.stringify(body) } : {}),
            });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) return { error: data?.error?.description || data?.message || `HTTP ${res.status}` };
            return { output: data };
        }

        switch (actionName) {
            case 'getDocument': {
                if (!inputs.documentId) return { error: 'inputs.documentId is required' };
                return req('GET', `/data/doc/${dataset}/${inputs.documentId}`);
            }
            case 'createDocument': {
                if (!inputs._type) return { error: 'inputs._type is required' };
                const doc: any = { _type: inputs._type };
                if (inputs._id) doc._id = inputs._id;
                if (inputs.fields && typeof inputs.fields === 'object') Object.assign(doc, inputs.fields);
                const mutations = [{ create: doc }];
                return req('POST', `/data/mutate/${dataset}`, { mutations });
            }
            case 'updateDocument': {
                if (!inputs.documentId) return { error: 'inputs.documentId is required' };
                if (!inputs.fields || typeof inputs.fields !== 'object') return { error: 'inputs.fields (object) is required' };
                const set: Record<string, any> = {};
                for (const [k, v] of Object.entries(inputs.fields)) set[k] = v;
                const mutations = [{ patch: { id: inputs.documentId, set } }];
                return req('POST', `/data/mutate/${dataset}`, { mutations });
            }
            case 'deleteDocument': {
                if (!inputs.documentId) return { error: 'inputs.documentId is required' };
                const mutations = [{ delete: { id: inputs.documentId } }];
                return req('POST', `/data/mutate/${dataset}`, { mutations });
            }
            case 'queryDocuments': {
                if (!inputs.query) return { error: 'inputs.query (GROQ string) is required' };
                const params = inputs.params ? JSON.stringify(inputs.params) : '{}';
                const encodedQuery = encodeURIComponent(inputs.query);
                const encodedParams = encodeURIComponent(params);
                return req('GET', `/data/query/${dataset}?query=${encodedQuery}&params=${encodedParams}`);
            }
            case 'patchDocument': {
                if (!inputs.documentId) return { error: 'inputs.documentId is required' };
                const patch: any = { id: inputs.documentId };
                if (inputs.set) patch.set = inputs.set;
                if (inputs.unset) patch.unset = inputs.unset;
                if (inputs.inc) patch.inc = inputs.inc;
                if (inputs.dec) patch.dec = inputs.dec;
                if (inputs.ifRevisionId) patch.ifRevisionID = inputs.ifRevisionId;
                const mutations = [{ patch }];
                return req('POST', `/data/mutate/${dataset}`, { mutations });
            }
            case 'listAssets': {
                const assetType = inputs.assetType || 'image';
                const limit = inputs.limit || 50;
                const offset = inputs.offset || 0;
                const query = `*[_type == "${assetType}.asset"][${offset}...${offset + limit}]{_id, url, originalFilename, mimeType, size, _createdAt}`;
                return req('GET', `/data/query/${dataset}?query=${encodeURIComponent(query)}`);
            }
            case 'uploadAsset': {
                if (!inputs.assetType) return { error: 'inputs.assetType is required (image or file)' };
                if (!inputs.url) return { error: 'inputs.url (public URL to asset) is required' };
                const fetchRes = await fetch(inputs.url);
                if (!fetchRes.ok) return { error: `Failed to fetch asset from URL: HTTP ${fetchRes.status}` };
                const buffer = await fetchRes.arrayBuffer();
                const contentType = fetchRes.headers.get('content-type') || 'application/octet-stream';
                const uploadRes = await fetch(`${BASE}/assets/${inputs.assetType}s/${dataset}`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': contentType },
                    body: buffer,
                });
                const uploadText = await uploadRes.text();
                let uploadData: any;
                try { uploadData = JSON.parse(uploadText); } catch { uploadData = { raw: uploadText }; }
                if (!uploadRes.ok) return { error: uploadData?.error?.description || `HTTP ${uploadRes.status}` };
                return { output: uploadData };
            }
            case 'getAsset': {
                if (!inputs.assetId) return { error: 'inputs.assetId is required' };
                return req('GET', `/data/doc/${dataset}/${inputs.assetId}`);
            }
            case 'deleteAsset': {
                if (!inputs.assetId) return { error: 'inputs.assetId is required' };
                const mutations = [{ delete: { id: inputs.assetId } }];
                return req('POST', `/data/mutate/${dataset}`, { mutations });
            }
            case 'listDatasets': {
                return req('GET', `/datasets`);
            }
            case 'createDataset': {
                if (!inputs.datasetName) return { error: 'inputs.datasetName is required' };
                const aclMode = inputs.aclMode || 'public';
                return req('PUT', `/datasets/${inputs.datasetName}`, { aclMode });
            }
            case 'deleteDataset': {
                if (!inputs.datasetName) return { error: 'inputs.datasetName is required' };
                return req('DELETE', `/datasets/${inputs.datasetName}`);
            }
            case 'exportDataset': {
                const exportDataset = inputs.datasetName || dataset;
                const res = await fetch(`${BASE}/data/export/${exportDataset}`, { headers });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `Export failed: HTTP ${res.status} - ${err}` };
                }
                const text = await res.text();
                const lines = text.trim().split('\n').filter(Boolean).map((l: string) => JSON.parse(l));
                return { output: { documents: lines, count: lines.length } };
            }
            case 'createRelease': {
                if (!inputs.releaseId) return { error: 'inputs.releaseId is required' };
                if (!inputs.title) return { error: 'inputs.title is required' };
                const doc = {
                    _id: `_.releases.${inputs.releaseId}`,
                    _type: 'system.release',
                    metadata: {
                        title: inputs.title,
                        description: inputs.description || '',
                        releaseType: inputs.releaseType || 'asap',
                    },
                };
                const mutations = [{ createOrReplace: doc }];
                return req('POST', `/data/mutate/${dataset}`, { mutations });
            }
            case 'listDocumentsByType': {
                if (!inputs._type) return { error: 'inputs._type is required' };
                const limit = inputs.limit || 50;
                const offset = inputs.offset || 0;
                const query = `*[_type == $type][${offset}...${offset + limit}]`;
                const params = encodeURIComponent(JSON.stringify({ type: inputs._type }));
                return req('GET', `/data/query/${dataset}?query=${encodeURIComponent(query)}&params=${params}`);
            }
            default:
                return { error: `Unknown Sanity Enhanced action: ${actionName}` };
        }
    } catch (e: any) {
        return { error: e?.message || 'Unknown error in executeSanityEnhancedAction' };
    }
}
