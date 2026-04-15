
'use server';

async function confluenceFetch(
    method: string,
    url: string,
    authHeader: string,
    body?: any,
    isFormData?: boolean
): Promise<any> {
    const headers: Record<string, string> = {
        Authorization: authHeader,
    };
    if (!isFormData) {
        headers['Content-Type'] = 'application/json';
        headers['Accept'] = 'application/json';
    }
    const res = await fetch(url, {
        method,
        headers,
        body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
    });
    if (res.status === 204) return { success: true };
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.message || data?.errorMessage || `Confluence API error ${res.status}`);
    }
    return data;
}

export async function executeConfluenceAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const domain = String(inputs.domain ?? '').trim();
        const email = String(inputs.email ?? '').trim();
        const apiToken = String(inputs.apiToken ?? '').trim();
        if (!domain) throw new Error('domain is required.');
        if (!email) throw new Error('email is required.');
        if (!apiToken) throw new Error('apiToken is required.');

        const authHeader = `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`;
        const BASE = `https://${domain}.atlassian.net/wiki/rest/api`;

        switch (actionName) {
            case 'listSpaces': {
                const limit = inputs.limit || 25;
                const start = inputs.start || 0;
                const data = await confluenceFetch('GET', `${BASE}/space?limit=${limit}&start=${start}`, authHeader);
                logger.log(`[Confluence] listSpaces`);
                return { output: data };
            }

            case 'getSpace': {
                const spaceKey = String(inputs.spaceKey ?? '').trim();
                if (!spaceKey) throw new Error('spaceKey is required.');
                const data = await confluenceFetch('GET', `${BASE}/space/${spaceKey}`, authHeader);
                logger.log(`[Confluence] getSpace ${spaceKey}`);
                return { output: data };
            }

            case 'createSpace': {
                const key = String(inputs.key ?? '').trim();
                const name = String(inputs.name ?? '').trim();
                if (!key) throw new Error('key is required.');
                if (!name) throw new Error('name is required.');
                const data = await confluenceFetch('POST', `${BASE}/space`, authHeader, { key, name });
                logger.log(`[Confluence] createSpace ${key}`);
                return { output: data };
            }

            case 'listPages': {
                const spaceKey = String(inputs.spaceKey ?? '').trim();
                const limit = inputs.limit || 25;
                const start = inputs.start || 0;
                let url = `${BASE}/content?type=page&limit=${limit}&start=${start}`;
                if (spaceKey) url += `&spaceKey=${spaceKey}`;
                const data = await confluenceFetch('GET', url, authHeader);
                logger.log(`[Confluence] listPages`);
                return { output: data };
            }

            case 'getPage': {
                const pageId = String(inputs.pageId ?? '').trim();
                if (!pageId) throw new Error('pageId is required.');
                const data = await confluenceFetch('GET', `${BASE}/content/${pageId}?expand=body.storage,version`, authHeader);
                logger.log(`[Confluence] getPage ${pageId}`);
                return { output: data };
            }

            case 'createPage': {
                const title = String(inputs.title ?? '').trim();
                const spaceKey = String(inputs.spaceKey ?? '').trim();
                const bodyValue = String(inputs.body ?? '').trim();
                if (!title) throw new Error('title is required.');
                if (!spaceKey) throw new Error('spaceKey is required.');
                const data = await confluenceFetch('POST', `${BASE}/content`, authHeader, {
                    type: 'page',
                    title,
                    space: { key: spaceKey },
                    body: {
                        storage: {
                            value: bodyValue,
                            representation: 'storage',
                        },
                    },
                });
                logger.log(`[Confluence] createPage "${title}"`);
                return { output: { id: data.id, title: data.title, url: data._links?.webui } };
            }

            case 'updatePage': {
                const pageId = String(inputs.pageId ?? '').trim();
                const title = String(inputs.title ?? '').trim();
                const bodyValue = String(inputs.body ?? '').trim();
                const version = Number(inputs.version ?? 1);
                if (!pageId) throw new Error('pageId is required.');
                if (!title) throw new Error('title is required.');
                const data = await confluenceFetch('PUT', `${BASE}/content/${pageId}`, authHeader, {
                    version: { number: version },
                    title,
                    type: 'page',
                    body: {
                        storage: {
                            value: bodyValue,
                            representation: 'storage',
                        },
                    },
                });
                logger.log(`[Confluence] updatePage ${pageId}`);
                return { output: { id: data.id, title: data.title } };
            }

            case 'deletePage': {
                const pageId = String(inputs.pageId ?? '').trim();
                if (!pageId) throw new Error('pageId is required.');
                await confluenceFetch('DELETE', `${BASE}/content/${pageId}`, authHeader);
                logger.log(`[Confluence] deletePage ${pageId}`);
                return { output: { deleted: true, pageId } };
            }

            case 'searchContent': {
                const cql = String(inputs.cql ?? '').trim();
                if (!cql) throw new Error('cql is required.');
                const limit = inputs.limit || 25;
                const data = await confluenceFetch('GET', `${BASE}/content/search?cql=${encodeURIComponent(cql)}&limit=${limit}`, authHeader);
                logger.log(`[Confluence] searchContent`);
                return { output: data };
            }

            case 'getPageChildren': {
                const pageId = String(inputs.pageId ?? '').trim();
                if (!pageId) throw new Error('pageId is required.');
                const data = await confluenceFetch('GET', `${BASE}/content/${pageId}/child/page`, authHeader);
                logger.log(`[Confluence] getPageChildren ${pageId}`);
                return { output: data };
            }

            case 'addComment': {
                const pageId = String(inputs.pageId ?? '').trim();
                const commentBody = String(inputs.body ?? '').trim();
                if (!pageId) throw new Error('pageId is required.');
                if (!commentBody) throw new Error('body is required.');
                const data = await confluenceFetch('POST', `${BASE}/content`, authHeader, {
                    type: 'comment',
                    container: { id: pageId, type: 'page' },
                    body: {
                        storage: {
                            value: commentBody,
                            representation: 'storage',
                        },
                    },
                });
                logger.log(`[Confluence] addComment to ${pageId}`);
                return { output: { id: data.id } };
            }

            case 'getPageAttachments': {
                const pageId = String(inputs.pageId ?? '').trim();
                if (!pageId) throw new Error('pageId is required.');
                const data = await confluenceFetch('GET', `${BASE}/content/${pageId}/child/attachment`, authHeader);
                logger.log(`[Confluence] getPageAttachments ${pageId}`);
                return { output: data };
            }

            case 'uploadAttachment': {
                const pageId = String(inputs.pageId ?? '').trim();
                const fileUrl = String(inputs.fileUrl ?? '').trim();
                const filename = String(inputs.filename ?? 'attachment').trim();
                if (!pageId) throw new Error('pageId is required.');
                if (!fileUrl) throw new Error('fileUrl is required.');
                const fileRes = await fetch(fileUrl);
                const fileBlob = await fileRes.blob();
                const formData = new FormData();
                formData.append('file', fileBlob, filename);
                const uploadHeaders: Record<string, string> = {
                    Authorization: authHeader,
                    'X-Atlassian-Token': 'no-check',
                };
                const res = await fetch(`${BASE}/content/${pageId}/child/attachment`, {
                    method: 'POST',
                    headers: uploadHeaders,
                    body: formData,
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data?.message || `Upload error ${res.status}`);
                logger.log(`[Confluence] uploadAttachment to ${pageId}`);
                return { output: data };
            }

            case 'getLabels': {
                const pageId = String(inputs.pageId ?? '').trim();
                if (!pageId) throw new Error('pageId is required.');
                const data = await confluenceFetch('GET', `${BASE}/content/${pageId}/label`, authHeader);
                logger.log(`[Confluence] getLabels ${pageId}`);
                return { output: data };
            }

            case 'addLabel': {
                const pageId = String(inputs.pageId ?? '').trim();
                const labelName = String(inputs.labelName ?? '').trim();
                if (!pageId) throw new Error('pageId is required.');
                if (!labelName) throw new Error('labelName is required.');
                const data = await confluenceFetch('POST', `${BASE}/content/${pageId}/label`, authHeader, [
                    { prefix: 'global', name: labelName },
                ]);
                logger.log(`[Confluence] addLabel "${labelName}" to ${pageId}`);
                return { output: data };
            }

            default:
                throw new Error(`Confluence action "${actionName}" is not implemented.`);
        }
    } catch (err: any) {
        const message = err?.message || 'Unknown Confluence error';
        logger.log(`[Confluence] Error: ${message}`);
        return { error: message };
    }
}
