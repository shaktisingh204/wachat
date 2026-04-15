
'use server';

const CS_BASE = 'https://api.contentstack.io/v3';

export async function executeContentstackAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');
        const authToken = String(inputs.authToken ?? '').trim();
        if (!authToken) throw new Error('authToken is required.');

        const csFetch = async (method: string, path: string, body?: any, isMultipart = false) => {
            logger?.log(`[Contentstack] ${method} ${CS_BASE}${path}`);
            const headers: Record<string, string> = {
                api_key: apiKey,
                authtoken: authToken,
            };
            if (!isMultipart) headers['Content-Type'] = 'application/json';

            const opts: RequestInit = { method, headers };
            if (body !== undefined && !isMultipart) opts.body = JSON.stringify(body);
            if (body !== undefined && isMultipart) opts.body = body;

            const res = await fetch(`${CS_BASE}${path}`, opts);
            if (res.status === 204) return {};
            const text = await res.text();
            if (!text) return {};
            let data: any;
            try { data = JSON.parse(text); } catch { data = { message: text }; }
            if (!res.ok) throw new Error(data?.error_message || data?.message || `Contentstack API error: ${res.status}`);
            return data;
        };

        switch (actionName) {
            case 'listContentTypes': {
                const data = await csFetch('GET', '/content_types');
                return { output: { content_types: data.content_types ?? [], count: String(data.count ?? 0) } };
            }

            case 'getContentType': {
                const uid = String(inputs.uid ?? '').trim();
                if (!uid) throw new Error('uid is required.');
                const data = await csFetch('GET', `/content_types/${uid}`);
                return { output: { content_type: data.content_type ?? {} } };
            }

            case 'createContentType': {
                if (!inputs.content_type) throw new Error('content_type is required.');
                const ct = typeof inputs.content_type === 'string' ? JSON.parse(inputs.content_type) : inputs.content_type;
                const data = await csFetch('POST', '/content_types', { content_type: ct });
                return { output: { content_type: data.content_type ?? {} } };
            }

            case 'updateContentType': {
                const uid = String(inputs.uid ?? '').trim();
                if (!uid) throw new Error('uid is required.');
                if (!inputs.content_type) throw new Error('content_type is required.');
                const ct = typeof inputs.content_type === 'string' ? JSON.parse(inputs.content_type) : inputs.content_type;
                const data = await csFetch('PUT', `/content_types/${uid}`, { content_type: ct });
                return { output: { content_type: data.content_type ?? {} } };
            }

            case 'deleteContentType': {
                const uid = String(inputs.uid ?? '').trim();
                if (!uid) throw new Error('uid is required.');
                await csFetch('DELETE', `/content_types/${uid}`);
                return { output: { deleted: 'true', uid } };
            }

            case 'listEntries': {
                const contentTypeUid = String(inputs.contentTypeUid ?? '').trim();
                if (!contentTypeUid) throw new Error('contentTypeUid is required.');
                const locale = String(inputs.locale ?? 'en-us').trim() || 'en-us';
                const limit = Number(inputs.limit ?? 100);
                const skip = Number(inputs.skip ?? 0);
                const data = await csFetch('GET', `/content_types/${contentTypeUid}/entries?locale=${locale}&limit=${limit}&skip=${skip}`);
                return { output: { entries: data.entries ?? [], count: String(data.count ?? 0) } };
            }

            case 'getEntry': {
                const contentTypeUid = String(inputs.contentTypeUid ?? '').trim();
                if (!contentTypeUid) throw new Error('contentTypeUid is required.');
                const entryUid = String(inputs.entryUid ?? '').trim();
                if (!entryUid) throw new Error('entryUid is required.');
                const locale = String(inputs.locale ?? 'en-us').trim() || 'en-us';
                const data = await csFetch('GET', `/content_types/${contentTypeUid}/entries/${entryUid}?locale=${locale}`);
                return { output: { entry: data.entry ?? {} } };
            }

            case 'createEntry': {
                const contentTypeUid = String(inputs.contentTypeUid ?? '').trim();
                if (!contentTypeUid) throw new Error('contentTypeUid is required.');
                if (!inputs.entry) throw new Error('entry is required.');
                const entry = typeof inputs.entry === 'string' ? JSON.parse(inputs.entry) : inputs.entry;
                const data = await csFetch('POST', `/content_types/${contentTypeUid}/entries`, { entry });
                return { output: { entry: data.entry ?? {} } };
            }

            case 'updateEntry': {
                const contentTypeUid = String(inputs.contentTypeUid ?? '').trim();
                if (!contentTypeUid) throw new Error('contentTypeUid is required.');
                const entryUid = String(inputs.entryUid ?? '').trim();
                if (!entryUid) throw new Error('entryUid is required.');
                if (!inputs.entry) throw new Error('entry is required.');
                const entry = typeof inputs.entry === 'string' ? JSON.parse(inputs.entry) : inputs.entry;
                const data = await csFetch('PUT', `/content_types/${contentTypeUid}/entries/${entryUid}`, { entry });
                return { output: { entry: data.entry ?? {} } };
            }

            case 'publishEntry': {
                const contentTypeUid = String(inputs.contentTypeUid ?? '').trim();
                if (!contentTypeUid) throw new Error('contentTypeUid is required.');
                const entryUid = String(inputs.entryUid ?? '').trim();
                if (!entryUid) throw new Error('entryUid is required.');
                const environments = inputs.environments ? (Array.isArray(inputs.environments) ? inputs.environments : [inputs.environments]) : ['production'];
                const locales = inputs.locales ? (Array.isArray(inputs.locales) ? inputs.locales : [inputs.locales]) : ['en-us'];
                const data = await csFetch('POST', `/content_types/${contentTypeUid}/entries/${entryUid}/publish`, {
                    entry: { environments, locales },
                });
                return { output: { notice: data.notice ?? 'Entry published.' } };
            }

            case 'unpublishEntry': {
                const contentTypeUid = String(inputs.contentTypeUid ?? '').trim();
                if (!contentTypeUid) throw new Error('contentTypeUid is required.');
                const entryUid = String(inputs.entryUid ?? '').trim();
                if (!entryUid) throw new Error('entryUid is required.');
                const environments = inputs.environments ? (Array.isArray(inputs.environments) ? inputs.environments : [inputs.environments]) : ['production'];
                const locales = inputs.locales ? (Array.isArray(inputs.locales) ? inputs.locales : [inputs.locales]) : ['en-us'];
                const data = await csFetch('POST', `/content_types/${contentTypeUid}/entries/${entryUid}/unpublish`, {
                    entry: { environments, locales },
                });
                return { output: { notice: data.notice ?? 'Entry unpublished.' } };
            }

            case 'deleteEntry': {
                const contentTypeUid = String(inputs.contentTypeUid ?? '').trim();
                if (!contentTypeUid) throw new Error('contentTypeUid is required.');
                const entryUid = String(inputs.entryUid ?? '').trim();
                if (!entryUid) throw new Error('entryUid is required.');
                await csFetch('DELETE', `/content_types/${contentTypeUid}/entries/${entryUid}`);
                return { output: { deleted: 'true', entryUid } };
            }

            case 'listAssets': {
                const limit = Number(inputs.limit ?? 100);
                const skip = Number(inputs.skip ?? 0);
                const data = await csFetch('GET', `/assets?limit=${limit}&skip=${skip}`);
                return { output: { assets: data.assets ?? [], count: String(data.count ?? 0) } };
            }

            case 'uploadAsset': {
                const fileUrl = String(inputs.fileUrl ?? '').trim();
                if (!fileUrl) throw new Error('fileUrl is required.');
                const filename = String(inputs.filename ?? 'upload').trim() || 'upload';
                const title = String(inputs.title ?? filename).trim() || filename;
                const fileRes = await fetch(fileUrl);
                if (!fileRes.ok) throw new Error(`Failed to fetch file: ${fileRes.status}`);
                const blob = await fileRes.blob();
                const formData = new FormData();
                formData.append('asset[upload]', blob, filename);
                formData.append('asset[title]', title);
                const data = await csFetch('POST', '/assets', formData, true);
                return { output: { asset: data.asset ?? {} } };
            }

            case 'deleteAsset': {
                const uid = String(inputs.uid ?? '').trim();
                if (!uid) throw new Error('uid is required.');
                await csFetch('DELETE', `/assets/${uid}`);
                return { output: { deleted: 'true', uid } };
            }

            case 'listEnvironments': {
                const data = await csFetch('GET', '/environments');
                return { output: { environments: data.environments ?? [] } };
            }

            default:
                return { error: `Contentstack action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Contentstack action failed.' };
    }
}
