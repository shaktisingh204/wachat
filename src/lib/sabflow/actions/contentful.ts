
'use server';

const CONTENTFUL_MGMT = 'https://api.contentful.com';
const CONTENTFUL_CDN = 'https://cdn.contentful.com';

async function contentfulFetch(
    token: string,
    method: string,
    url: string,
    body?: any,
    extraHeaders?: Record<string, string>,
    logger?: any
) {
    logger?.log(`[Contentful] ${method} ${url}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(extraHeaders ?? {}),
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const text = await res.text();
    if (!text) return {};
    let data: any;
    try { data = JSON.parse(text); } catch { data = { message: text }; }
    if (!res.ok) {
        throw new Error(data?.message || data?.sys?.id || `Contentful API error: ${res.status}`);
    }
    return data;
}

export async function executeContentfulAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const spaceId = String(inputs.spaceId ?? '').trim();
        if (!spaceId) throw new Error('spaceId is required.');

        const environment = String(inputs.environment ?? 'master').trim() || 'master';
        const managementToken = String(inputs.managementToken ?? '').trim();
        const deliveryToken = String(inputs.deliveryToken ?? '').trim();

        const envPath = `/spaces/${spaceId}/environments/${environment}`;

        const mgmt = (method: string, path: string, body?: any, extraHeaders?: Record<string, string>) => {
            if (!managementToken) throw new Error('managementToken is required for this action.');
            return contentfulFetch(managementToken, method, `${CONTENTFUL_MGMT}${path}`, body, extraHeaders, logger);
        };

        const cdn = (method: string, path: string) => {
            if (!deliveryToken && !managementToken) throw new Error('deliveryToken or managementToken is required for reads.');
            const token = deliveryToken || managementToken;
            return contentfulFetch(token, method, `${CONTENTFUL_CDN}${path}`, undefined, undefined, logger);
        };

        switch (actionName) {
            case 'getEntries': {
                const limit = Number(inputs.limit ?? 100);
                const skip = Number(inputs.skip ?? 0);
                let path = `${envPath}/entries?limit=${limit}&skip=${skip}`;
                if (inputs.contentType) path += `&content_type=${encodeURIComponent(String(inputs.contentType))}`;
                if (inputs.locale) path += `&locale=${encodeURIComponent(String(inputs.locale))}`;
                const data = await cdn('GET', path);
                return { output: { items: data.items ?? [], total: String(data.total ?? 0) } };
            }

            case 'getEntry': {
                const entryId = String(inputs.entryId ?? '').trim();
                if (!entryId) throw new Error('entryId is required.');
                const data = await cdn('GET', `${envPath}/entries/${entryId}`);
                return { output: { sys: data.sys ?? {}, fields: data.fields ?? {} } };
            }

            case 'createEntry': {
                const contentTypeId = String(inputs.contentTypeId ?? '').trim();
                if (!contentTypeId) throw new Error('contentTypeId is required.');
                if (!inputs.fields) throw new Error('fields is required.');
                const fields = typeof inputs.fields === 'string' ? JSON.parse(inputs.fields) : inputs.fields;
                const data = await mgmt(
                    'POST',
                    `${envPath}/entries`,
                    { fields },
                    { 'X-Contentful-Content-Type': contentTypeId }
                );
                return { output: { sys: data.sys ?? {}, fields: data.fields ?? {} } };
            }

            case 'updateEntry': {
                const entryId = String(inputs.entryId ?? '').trim();
                if (!entryId) throw new Error('entryId is required.');
                if (!inputs.fields) throw new Error('fields is required.');
                if (inputs.version === undefined || inputs.version === '') throw new Error('version is required.');
                const fields = typeof inputs.fields === 'string' ? JSON.parse(inputs.fields) : inputs.fields;
                const version = String(inputs.version);
                const data = await mgmt(
                    'PUT',
                    `${envPath}/entries/${entryId}`,
                    { fields },
                    { 'X-Contentful-Version': version }
                );
                return { output: { sys: data.sys ?? {} } };
            }

            case 'publishEntry': {
                const entryId = String(inputs.entryId ?? '').trim();
                if (!entryId) throw new Error('entryId is required.');
                if (inputs.version === undefined || inputs.version === '') throw new Error('version is required.');
                const version = String(inputs.version);
                const data = await mgmt(
                    'PUT',
                    `${envPath}/entries/${entryId}/published`,
                    undefined,
                    { 'X-Contentful-Version': version }
                );
                return { output: { sys: { publishedAt: data.sys?.publishedAt ?? '' } } };
            }

            case 'unpublishEntry': {
                const entryId = String(inputs.entryId ?? '').trim();
                if (!entryId) throw new Error('entryId is required.');
                const data = await mgmt('DELETE', `${envPath}/entries/${entryId}/published`);
                return { output: { sys: data.sys ?? { id: entryId } } };
            }

            case 'deleteEntry': {
                const entryId = String(inputs.entryId ?? '').trim();
                if (!entryId) throw new Error('entryId is required.');
                await mgmt('DELETE', `${envPath}/entries/${entryId}`);
                return { output: { deleted: 'true', entryId } };
            }

            case 'listAssets': {
                const limit = Number(inputs.limit ?? 100);
                const skip = Number(inputs.skip ?? 0);
                const data = await cdn('GET', `${envPath}/assets?limit=${limit}&skip=${skip}`);
                return { output: { items: data.items ?? [], total: String(data.total ?? 0) } };
            }

            case 'getAsset': {
                const assetId = String(inputs.assetId ?? '').trim();
                if (!assetId) throw new Error('assetId is required.');
                const data = await cdn('GET', `${envPath}/assets/${assetId}`);
                return { output: { sys: data.sys ?? {}, fields: { title: data.fields?.title ?? '', file: data.fields?.file ?? {} } } };
            }

            case 'createAsset': {
                const title = String(inputs.title ?? '').trim();
                const fileUrl = String(inputs.fileUrl ?? '').trim();
                const fileName = String(inputs.fileName ?? '').trim();
                const contentType = String(inputs.contentType ?? 'application/octet-stream').trim();
                if (!title) throw new Error('title is required.');
                if (!fileUrl) throw new Error('fileUrl is required.');
                if (!fileName) throw new Error('fileName is required.');
                const locale = String(inputs.locale ?? 'en-US').trim() || 'en-US';
                const body = {
                    fields: {
                        title: { [locale]: title },
                        file: {
                            [locale]: {
                                contentType,
                                fileName,
                                upload: fileUrl,
                            },
                        },
                    },
                };
                const data = await mgmt('POST', `${envPath}/assets`, body);
                return { output: { sys: data.sys ?? {} } };
            }

            case 'publishAsset': {
                const assetId = String(inputs.assetId ?? '').trim();
                if (!assetId) throw new Error('assetId is required.');
                if (inputs.version === undefined || inputs.version === '') throw new Error('version is required.');
                const version = String(inputs.version);
                const data = await mgmt(
                    'PUT',
                    `${envPath}/assets/${assetId}/published`,
                    undefined,
                    { 'X-Contentful-Version': version }
                );
                return { output: { sys: { publishedAt: data.sys?.publishedAt ?? '' } } };
            }

            case 'listContentTypes': {
                const data = await mgmt('GET', `${envPath}/content_types`);
                return { output: { items: data.items ?? [], total: String(data.total ?? 0) } };
            }

            case 'getContentType': {
                const contentTypeId = String(inputs.contentTypeId ?? '').trim();
                if (!contentTypeId) throw new Error('contentTypeId is required.');
                const data = await mgmt('GET', `${envPath}/content_types/${contentTypeId}`);
                return { output: { sys: data.sys ?? {}, name: data.name ?? '', fields: data.fields ?? [] } };
            }

            case 'listLocales': {
                const data = await mgmt('GET', `${envPath}/locales`);
                return { output: { items: data.items ?? [] } };
            }

            default:
                return { error: `Contentful action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Contentful action failed.' };
    }
}
