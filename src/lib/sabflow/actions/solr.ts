'use server';

export async function executeSolrAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const baseUrl = (inputs.baseUrl || '').replace(/\/$/, '');
        const core = inputs.core || '';
        const coreBase = core ? `${baseUrl}/solr/${core}` : `${baseUrl}/solr`;

        const buildAuthHeader = (): string => {
            if (inputs.username && inputs.password) {
                const creds = Buffer.from(`${inputs.username}:${inputs.password}`).toString('base64');
                return `Basic ${creds}`;
            }
            return '';
        };

        const authHeader = buildAuthHeader();
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(authHeader ? { Authorization: authHeader } : {}),
        };

        const doFetch = async (method: string, url: string, body?: any, contentType?: string) => {
            const res = await fetch(url, {
                method,
                headers: contentType ? { ...headers, 'Content-Type': contentType } : headers,
                body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
            });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = text; }
            if (!res.ok) throw new Error(data?.error?.msg || data || `HTTP ${res.status}`);
            return data;
        };

        switch (actionName) {
            case 'search': {
                const params = new URLSearchParams({
                    q: inputs.q || '*:*',
                    wt: 'json',
                    ...(inputs.fq ? { fq: inputs.fq } : {}),
                    ...(inputs.sort ? { sort: inputs.sort } : {}),
                    ...(inputs.rows ? { rows: String(inputs.rows) } : {}),
                    ...(inputs.start ? { start: String(inputs.start) } : {}),
                    ...(inputs.fl ? { fl: inputs.fl } : {}),
                });
                const data = await doFetch('GET', `${coreBase}/select?${params}`);
                return { output: { results: data } };
            }
            case 'addDocument': {
                const doc = typeof inputs.document === 'string' ? JSON.parse(inputs.document) : inputs.document;
                const data = await doFetch('POST', `${coreBase}/update/json/docs?commit=true`, doc);
                return { output: { result: data } };
            }
            case 'addDocuments': {
                const docs = typeof inputs.documents === 'string' ? JSON.parse(inputs.documents) : inputs.documents;
                const data = await doFetch('POST', `${coreBase}/update?commit=true`, docs);
                return { output: { result: data } };
            }
            case 'updateDocument': {
                const id = inputs.documentId;
                const fields = typeof inputs.fields === 'string' ? JSON.parse(inputs.fields) : inputs.fields;
                const updateDoc: any = { id };
                for (const [key, value] of Object.entries(fields)) {
                    updateDoc[key] = { set: value };
                }
                const data = await doFetch('POST', `${coreBase}/update?commit=true`, [updateDoc]);
                return { output: { result: data } };
            }
            case 'deleteDocument': {
                const data = await doFetch('POST', `${coreBase}/update?commit=true`, { delete: { id: inputs.documentId } });
                return { output: { result: data } };
            }
            case 'deleteByQuery': {
                const data = await doFetch('POST', `${coreBase}/update?commit=true`, { delete: { query: inputs.query || '*:*' } });
                return { output: { result: data } };
            }
            case 'commit': {
                const data = await doFetch('GET', `${coreBase}/update?commit=true`);
                return { output: { result: data } };
            }
            case 'rollback': {
                const data = await doFetch('POST', `${coreBase}/update`, { rollback: {} });
                return { output: { result: data } };
            }
            case 'optimize': {
                const data = await doFetch('GET', `${coreBase}/update?optimize=true`);
                return { output: { result: data } };
            }
            case 'getStatus': {
                const data = await doFetch('GET', `${baseUrl}/solr/admin/cores?action=STATUS&core=${core}&wt=json`);
                return { output: { status: data } };
            }
            case 'ping': {
                const data = await doFetch('GET', `${coreBase}/admin/ping?wt=json`);
                return { output: { ping: data } };
            }
            case 'listCores': {
                const data = await doFetch('GET', `${baseUrl}/solr/admin/cores?action=STATUS&wt=json`);
                return { output: { cores: data } };
            }
            case 'createCore': {
                const params = new URLSearchParams({
                    action: 'CREATE',
                    name: inputs.coreName,
                    instanceDir: inputs.instanceDir || inputs.coreName,
                    configSet: inputs.configSet || '_default',
                    wt: 'json',
                });
                const data = await doFetch('GET', `${baseUrl}/solr/admin/cores?${params}`);
                return { output: { result: data } };
            }
            case 'unloadCore': {
                const params = new URLSearchParams({
                    action: 'UNLOAD',
                    core: inputs.coreName || core,
                    deleteIndex: inputs.deleteIndex ? 'true' : 'false',
                    wt: 'json',
                });
                const data = await doFetch('GET', `${baseUrl}/solr/admin/cores?${params}`);
                return { output: { result: data } };
            }
            case 'reloadCore': {
                const params = new URLSearchParams({
                    action: 'RELOAD',
                    core: inputs.coreName || core,
                    wt: 'json',
                });
                const data = await doFetch('GET', `${baseUrl}/solr/admin/cores?${params}`);
                return { output: { result: data } };
            }
            default:
                return { error: `Unknown Solr action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Solr action error [${actionName}]: ${err.message}`);
        return { error: err.message || String(err) };
    }
}
