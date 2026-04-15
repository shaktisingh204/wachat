
'use server';

export async function executePrismicAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const repoName = String(inputs.repoName ?? '').trim();
        if (!repoName) throw new Error('repoName is required.');
        const accessToken = String(inputs.accessToken ?? '').trim();

        const CDN_BASE = `https://${repoName}.cdn.prismic.io/api/v2`;
        const MGMT_BASE = 'https://customtypes.prismic.io';

        const cdnFetch = async (path: string) => {
            logger?.log(`[Prismic] GET ${CDN_BASE}${path}`);
            const res = await fetch(`${CDN_BASE}${path}`);
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { message: text }; }
            if (!res.ok) throw new Error(data?.message || `Prismic CDN error: ${res.status}`);
            return data;
        };

        const mgmtFetch = async (method: string, path: string, body?: any) => {
            if (!accessToken) throw new Error('accessToken is required for write operations.');
            logger?.log(`[Prismic] ${method} ${MGMT_BASE}${path}`);
            const opts: RequestInit = {
                method,
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    repository: repoName,
                },
            };
            if (body !== undefined) opts.body = JSON.stringify(body);
            const res = await fetch(`${MGMT_BASE}${path}`, opts);
            if (res.status === 204) return {};
            const text = await res.text();
            if (!text) return {};
            let data: any;
            try { data = JSON.parse(text); } catch { data = { message: text }; }
            if (!res.ok) throw new Error(data?.message || `Prismic write API error: ${res.status}`);
            return data;
        };

        const getRef = async (): Promise<string> => {
            if (inputs.ref) return String(inputs.ref);
            const api = await cdnFetch('');
            return api.refs?.find((r: any) => r.isMasterRef)?.ref ?? api.refs?.[0]?.ref ?? '';
        };

        switch (actionName) {
            case 'getRef': {
                const api = await cdnFetch('');
                const masterRef = api.refs?.find((r: any) => r.isMasterRef);
                return { output: { ref: masterRef?.ref ?? '', refs: api.refs ?? [] } };
            }

            case 'getDocuments': {
                const ref = await getRef();
                const pageSize = Number(inputs.pageSize ?? 20);
                const page = Number(inputs.page ?? 1);
                let q = String(inputs.q ?? '').trim() || '[[at(document.type,"*")]]';
                const data = await cdnFetch(`/documents/search?ref=${encodeURIComponent(ref)}&q=${encodeURIComponent(q)}&pageSize=${pageSize}&page=${page}`);
                return { output: { results: data.results ?? [], total_results_size: data.total_results_size ?? 0, next_page: data.next_page ?? null } };
            }

            case 'getDocument': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const ref = await getRef();
                const q = encodeURIComponent(`[[at(document.id,"${id}")]]`);
                const data = await cdnFetch(`/documents/search?ref=${encodeURIComponent(ref)}&q=${q}`);
                const doc = data.results?.[0] ?? null;
                return { output: { document: doc } };
            }

            case 'queryByType': {
                const type = String(inputs.type ?? '').trim();
                if (!type) throw new Error('type is required.');
                const ref = await getRef();
                const q = encodeURIComponent(`[[at(document.type,"${type}")]]`);
                const pageSize = Number(inputs.pageSize ?? 20);
                const page = Number(inputs.page ?? 1);
                const data = await cdnFetch(`/documents/search?ref=${encodeURIComponent(ref)}&q=${q}&pageSize=${pageSize}&page=${page}`);
                return { output: { results: data.results ?? [], total_results_size: data.total_results_size ?? 0 } };
            }

            case 'searchByTag': {
                const tag = String(inputs.tag ?? '').trim();
                if (!tag) throw new Error('tag is required.');
                const ref = await getRef();
                const q = encodeURIComponent(`[[at(document.tags,["${tag}"])]]`);
                const data = await cdnFetch(`/documents/search?ref=${encodeURIComponent(ref)}&q=${q}`);
                return { output: { results: data.results ?? [], total_results_size: data.total_results_size ?? 0 } };
            }

            case 'getLocales': {
                const api = await cdnFetch('');
                return { output: { locales: api.languages ?? [] } };
            }

            case 'listCustomTypes': {
                const data = await mgmtFetch('GET', '/customtypes');
                return { output: { customTypes: Array.isArray(data) ? data : [] } };
            }

            case 'createCustomType': {
                if (!inputs.customType) throw new Error('customType is required.');
                const customType = typeof inputs.customType === 'string' ? JSON.parse(inputs.customType) : inputs.customType;
                const data = await mgmtFetch('POST', '/customtypes/insert', customType);
                return { output: { customType: data } };
            }

            case 'updateCustomType': {
                if (!inputs.customType) throw new Error('customType is required.');
                const customType = typeof inputs.customType === 'string' ? JSON.parse(inputs.customType) : inputs.customType;
                const data = await mgmtFetch('POST', '/customtypes/update', customType);
                return { output: { customType: data } };
            }

            case 'getSlices': {
                const data = await mgmtFetch('GET', '/slices');
                return { output: { slices: Array.isArray(data) ? data : [] } };
            }

            case 'createSlice': {
                if (!inputs.slice) throw new Error('slice is required.');
                const slice = typeof inputs.slice === 'string' ? JSON.parse(inputs.slice) : inputs.slice;
                const data = await mgmtFetch('POST', '/slices/insert', slice);
                return { output: { slice: data } };
            }

            default:
                return { error: `Prismic action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Prismic action failed.' };
    }
}
