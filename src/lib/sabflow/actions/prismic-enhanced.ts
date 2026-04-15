'use server';

export async function executePrismicEnhancedAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const repositoryName: string = inputs.repositoryName;
        const token: string = inputs.token; // write/migration API token
        const accessToken: string = inputs.accessToken; // delivery API token

        if (!repositoryName) return { error: 'inputs.repositoryName is required' };

        const CDN_BASE = `https://${repositoryName}.cdn.prismic.io/api/v2`;
        const WRITE_BASE = `https://migration.prismic.io`;

        async function delivery(path: string, extraParams: string = '') {
            const sep = path.includes('?') ? '&' : '?';
            let url = `${CDN_BASE}${path}${sep}`;
            if (accessToken) url += `access_token=${accessToken}&`;
            if (extraParams) url += extraParams;
            const res = await fetch(url.replace(/[&?]$/, ''), {
                headers: { 'Content-Type': 'application/json' },
            });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) return { error: data?.message || `HTTP ${res.status}` };
            return { output: data };
        }

        async function write(method: string, path: string, body?: any) {
            if (!token) return { error: 'inputs.token is required for write/migration operations' };
            const res = await fetch(`${WRITE_BASE}${path}`, {
                method,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'x-prismic-repository': repositoryName,
                    'Content-Type': 'application/json',
                },
                ...(body ? { body: JSON.stringify(body) } : {}),
            });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) return { error: data?.message || data?.error || `HTTP ${res.status}` };
            return { output: data };
        }

        switch (actionName) {
            case 'getRepository': {
                return delivery('/');
            }
            case 'queryDocuments': {
                let qs = '';
                if (inputs.q) qs += `q=${encodeURIComponent(inputs.q)}&`;
                if (inputs.pageSize) qs += `pageSize=${inputs.pageSize}&`;
                if (inputs.page) qs += `page=${inputs.page}&`;
                if (inputs.orderings) qs += `orderings=${encodeURIComponent(inputs.orderings)}&`;
                if (inputs.lang) qs += `lang=${inputs.lang}&`;
                return delivery('/documents/search', qs.replace(/&$/, ''));
            }
            case 'getDocument': {
                if (!inputs.documentId) return { error: 'inputs.documentId is required' };
                return delivery(`/documents/search`, `q=${encodeURIComponent(`[[at(document.id,"${inputs.documentId}")]]`)}`);
            }
            case 'getDocumentByUID': {
                if (!inputs.type) return { error: 'inputs.type is required' };
                if (!inputs.uid) return { error: 'inputs.uid is required' };
                const lang = inputs.lang || '*';
                return delivery(`/documents/search`, `q=${encodeURIComponent(`[[at(my.${inputs.type}.uid,"${inputs.uid}")]]`)}&lang=${lang}`);
            }
            case 'listDocumentTypes': {
                const repoResult = await delivery('/');
                if (repoResult.error) return repoResult;
                const types = repoResult.output?.types || {};
                return { output: { types, typeNames: Object.keys(types) } };
            }
            case 'listTags': {
                return delivery('/tags');
            }
            case 'createRelease': {
                if (!inputs.label) return { error: 'inputs.label is required' };
                return write('POST', '/releases', { label: inputs.label });
            }
            case 'queryRelease': {
                if (!inputs.releaseRef) return { error: 'inputs.releaseRef is required' };
                let qs = `ref=${inputs.releaseRef}&`;
                if (inputs.q) qs += `q=${encodeURIComponent(inputs.q)}&`;
                if (inputs.pageSize) qs += `pageSize=${inputs.pageSize}&`;
                if (inputs.page) qs += `page=${inputs.page}&`;
                return delivery('/documents/search', qs.replace(/&$/, ''));
            }
            case 'deleteRelease': {
                if (!inputs.releaseId) return { error: 'inputs.releaseId is required' };
                return write('DELETE', `/releases/${inputs.releaseId}`);
            }
            case 'publishRelease': {
                if (!inputs.releaseId) return { error: 'inputs.releaseId is required' };
                return write('POST', `/releases/${inputs.releaseId}/publish`);
            }
            case 'listReleases': {
                return write('GET', '/releases');
            }
            case 'createDocument': {
                if (!inputs.type) return { error: 'inputs.type is required' };
                if (!inputs.uid) return { error: 'inputs.uid is required' };
                if (!inputs.data) return { error: 'inputs.data (object) is required' };
                const doc: any = {
                    type: inputs.type,
                    uid: inputs.uid,
                    data: inputs.data,
                };
                if (inputs.lang) doc.lang = inputs.lang;
                if (inputs.title) doc.title = inputs.title;
                return write('POST', '/documents', doc);
            }
            case 'updateDocument': {
                if (!inputs.documentId) return { error: 'inputs.documentId is required' };
                if (!inputs.data) return { error: 'inputs.data (object) is required' };
                const patch: any = { data: inputs.data };
                if (inputs.uid) patch.uid = inputs.uid;
                if (inputs.title) patch.title = inputs.title;
                return write('PATCH', `/documents/${inputs.documentId}`, patch);
            }
            case 'deleteDocument': {
                if (!inputs.documentId) return { error: 'inputs.documentId is required' };
                return write('DELETE', `/documents/${inputs.documentId}`);
            }
            case 'exportDocuments': {
                let qs = 'pageSize=100&';
                if (inputs.type) qs += `q=${encodeURIComponent(`[[at(document.type,"${inputs.type}")]]`)}&`;
                if (inputs.lang) qs += `lang=${inputs.lang}&`;
                return delivery('/documents/search', qs.replace(/&$/, ''));
            }
            default:
                return { error: `Unknown Prismic Enhanced action: ${actionName}` };
        }
    } catch (e: any) {
        return { error: e?.message || 'Unknown error in executePrismicEnhancedAction' };
    }
}
