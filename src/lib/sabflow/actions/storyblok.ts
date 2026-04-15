
'use server';

const STORYBLOK_MGMT_BASE = 'https://mapi.storyblok.com/v1';
const STORYBLOK_CDN_BASE = 'https://api.storyblok.com/v2';

async function sbMgmt(
    pat: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
): Promise<any> {
    const url = `${STORYBLOK_MGMT_BASE}${path}`;
    logger?.log(`[Storyblok Mgmt] ${method} ${path}`);

    const options: RequestInit = {
        method,
        headers: {
            Authorization: pat,
            'Content-Type': 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);

    const res = await fetch(url, options);

    if (res.status === 204) return {};

    const text = await res.text();
    let data: any;
    try {
        data = JSON.parse(text);
    } catch {
        data = text;
    }

    if (!res.ok) {
        throw new Error(
            (typeof data === 'object' ? data?.error || data?.message : undefined) ||
            `Storyblok Management API error: ${res.status}`
        );
    }
    return data;
}

async function sbCdn(
    publicToken: string,
    path: string,
    queryParams: Record<string, string> = {},
    logger?: any
): Promise<any> {
    const params = new URLSearchParams({ ...queryParams, token: publicToken });
    const url = `${STORYBLOK_CDN_BASE}${path}?${params.toString()}`;
    logger?.log(`[Storyblok CDN] GET ${path}`);

    const res = await fetch(url);

    const text = await res.text();
    let data: any;
    try {
        data = JSON.parse(text);
    } catch {
        data = text;
    }

    if (!res.ok) {
        throw new Error(
            (typeof data === 'object' ? data?.error || data?.message : undefined) ||
            `Storyblok Content Delivery API error: ${res.status}`
        );
    }
    return { data, total: res.headers.get('total') };
}

export async function executeStoryblokAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const spaceId = String(inputs.spaceId ?? '').trim();
        if (!spaceId) throw new Error('spaceId is required.');

        const pat = String(inputs.personalAccessToken ?? '').trim();
        const publicToken = String(inputs.publicToken ?? '').trim();

        const mgmt = (method: string, path: string, body?: any) =>
            sbMgmt(pat, method, path, body, logger);

        switch (actionName) {
            case 'listStories': {
                if (!publicToken) throw new Error('publicToken is required.');

                const queryParams: Record<string, string> = {
                    version: String(inputs.version ?? 'published'),
                };
                if (inputs.page) queryParams.page = String(inputs.page);
                if (inputs.perPage) queryParams.per_page = String(inputs.perPage);
                if (inputs.startsWith) queryParams.starts_with = String(inputs.startsWith);
                if (inputs.filterQuery) queryParams.filter_query = String(inputs.filterQuery);

                const { data, total } = await sbCdn(publicToken, `/spaces/${spaceId}/stories`, queryParams, logger);
                const stories = (data?.stories ?? []).map((s: any) => ({
                    id: s.id,
                    slug: s.slug,
                    name: s.name,
                    content: s.content ?? {},
                }));
                return { output: { stories, total: total ? Number(total) : stories.length } };
            }

            case 'getStory': {
                if (!publicToken) throw new Error('publicToken is required.');
                const slug = String(inputs.slug ?? '').trim();
                if (!slug) throw new Error('slug is required.');

                const { data } = await sbCdn(
                    publicToken,
                    `/spaces/${spaceId}/stories/${slug}`,
                    { version: 'published' },
                    logger
                );
                const s = data?.story ?? {};
                return { output: { story: { id: s.id, slug: s.slug, name: s.name, content: s.content ?? {} } } };
            }

            case 'createStory': {
                if (!pat) throw new Error('personalAccessToken is required.');
                const name = String(inputs.name ?? '').trim();
                const slug = String(inputs.slug ?? '').trim();
                if (!name) throw new Error('name is required.');
                if (!slug) throw new Error('slug is required.');
                if (!inputs.content) throw new Error('content is required.');

                const storyBody: any = { name, slug, content: inputs.content };
                if (inputs.parentId) storyBody.parent_id = inputs.parentId;

                const data = await mgmt('POST', `/spaces/${spaceId}/stories/`, { story: storyBody });
                logger.log(`[Storyblok] Story created: ${data.story?.id}`);
                return { output: { story: { id: data.story?.id, slug: data.story?.slug } } };
            }

            case 'updateStory': {
                if (!pat) throw new Error('personalAccessToken is required.');
                const storyId = String(inputs.storyId ?? '').trim();
                if (!storyId) throw new Error('storyId is required.');

                const storyBody: any = {};
                if (inputs.name !== undefined) storyBody.name = inputs.name;
                if (inputs.slug !== undefined) storyBody.slug = inputs.slug;
                if (inputs.content !== undefined) storyBody.content = inputs.content;

                const data = await mgmt('PUT', `/spaces/${spaceId}/stories/${storyId}`, { story: storyBody });
                logger.log(`[Storyblok] Story updated: ${storyId}`);
                return { output: { story: { id: data.story?.id ?? storyId } } };
            }

            case 'deleteStory': {
                if (!pat) throw new Error('personalAccessToken is required.');
                const storyId = String(inputs.storyId ?? '').trim();
                if (!storyId) throw new Error('storyId is required.');

                const data = await mgmt('DELETE', `/spaces/${spaceId}/stories/${storyId}`);
                logger.log(`[Storyblok] Story deleted: ${storyId}`);
                return { output: { story: { id: data.story?.id ?? storyId } } };
            }

            case 'publishStory': {
                if (!pat) throw new Error('personalAccessToken is required.');
                const storyId = String(inputs.storyId ?? '').trim();
                if (!storyId) throw new Error('storyId is required.');

                // Fetch the current story first
                const current = await mgmt('GET', `/spaces/${spaceId}/stories/${storyId}`);
                const updatedStory = { ...(current.story ?? {}), published: true };

                const data = await mgmt('PUT', `/spaces/${spaceId}/stories/${storyId}`, { story: updatedStory });
                logger.log(`[Storyblok] Story published: ${storyId}`);
                return { output: { story: { id: data.story?.id ?? storyId, published: true } } };
            }

            case 'unpublishStory': {
                if (!pat) throw new Error('personalAccessToken is required.');
                const storyId = String(inputs.storyId ?? '').trim();
                if (!storyId) throw new Error('storyId is required.');

                const data = await mgmt('POST', `/spaces/${spaceId}/stories/${storyId}/unpublish`);
                logger.log(`[Storyblok] Story unpublished: ${storyId}`);
                return { output: { story: { id: data.story?.id ?? storyId } } };
            }

            case 'listComponents': {
                if (!pat) throw new Error('personalAccessToken is required.');

                const data = await mgmt('GET', `/spaces/${spaceId}/components/`);
                const components = (data.components ?? []).map((c: any) => ({
                    id: c.id,
                    name: c.name,
                    schema: c.schema ?? {},
                }));
                return { output: { components } };
            }

            case 'createComponent': {
                if (!pat) throw new Error('personalAccessToken is required.');
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                if (!inputs.schema) throw new Error('schema is required.');

                const componentBody: any = {
                    name,
                    schema: inputs.schema,
                    is_root: inputs.isRoot ?? false,
                    is_sectionable: inputs.isSectionable ?? false,
                };

                const data = await mgmt('POST', `/spaces/${spaceId}/components/`, { component: componentBody });
                logger.log(`[Storyblok] Component created: ${data.component?.id}`);
                return { output: { component: { id: data.component?.id, name: data.component?.name } } };
            }

            case 'listSpaces': {
                if (!pat) throw new Error('personalAccessToken is required.');
                const data = await sbMgmt(pat, 'GET', '/spaces/', undefined, logger);
                return { output: { spaces: data.spaces ?? [] } };
            }

            case 'getSpace': {
                if (!pat) throw new Error('personalAccessToken is required.');
                const data = await mgmt('GET', `/spaces/${spaceId}`);
                return { output: { space: data.space ?? data } };
            }

            case 'updateComponent': {
                if (!pat) throw new Error('personalAccessToken is required.');
                const componentId = String(inputs.componentId ?? '').trim();
                if (!componentId) throw new Error('componentId is required.');
                const componentBody: any = {};
                if (inputs.name !== undefined) componentBody.name = inputs.name;
                if (inputs.schema !== undefined) componentBody.schema = inputs.schema;
                if (inputs.isRoot !== undefined) componentBody.is_root = inputs.isRoot;
                if (inputs.isSectionable !== undefined) componentBody.is_sectionable = inputs.isSectionable;
                const data = await mgmt('PUT', `/spaces/${spaceId}/components/${componentId}`, { component: componentBody });
                return { output: { component: { id: data.component?.id ?? componentId, name: data.component?.name } } };
            }

            case 'listDatasources': {
                if (!pat) throw new Error('personalAccessToken is required.');
                const data = await mgmt('GET', `/spaces/${spaceId}/datasources/`);
                const datasources = (data.datasources ?? []).map((d: any) => ({ id: d.id, name: d.name, slug: d.slug }));
                return { output: { datasources } };
            }

            case 'getDatasource': {
                if (!pat) throw new Error('personalAccessToken is required.');
                const datasourceId = String(inputs.datasourceId ?? '').trim();
                if (!datasourceId) throw new Error('datasourceId is required.');
                const data = await mgmt('GET', `/spaces/${spaceId}/datasources/${datasourceId}`);
                return { output: { datasource: data.datasource ?? data } };
            }

            case 'listAssets': {
                if (!pat) throw new Error('personalAccessToken is required.');

                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));

                const qs = params.toString();
                const data = await mgmt('GET', `/spaces/${spaceId}/assets${qs ? `?${qs}` : ''}`);
                const assets = (data.assets ?? []).map((a: any) => ({
                    id: a.id,
                    filename: a.filename,
                    content_type: a.content_type,
                }));
                const total = data.total ?? assets.length;
                return { output: { assets, total } };
            }

            case 'uploadAsset': {
                if (!pat) throw new Error('personalAccessToken is required.');
                const filename = String(inputs.filename ?? '').trim();
                const fileUrl = String(inputs.fileUrl ?? '').trim();
                if (!filename) throw new Error('filename is required.');
                if (!fileUrl) throw new Error('fileUrl is required.');

                // Step 1: Get signed upload URL from Storyblok
                const signedData = await mgmt('POST', `/spaces/${spaceId}/assets`, {
                    filename,
                    ...(inputs.altText ? { alt: String(inputs.altText) } : {}),
                });
                const signedUrl = signedData.signed_request ?? signedData.post_url;

                logger.log(`[Storyblok] Asset signed URL obtained for: ${filename}`);
                return {
                    output: {
                        id: signedData.id,
                        filename: signedData.filename ?? filename,
                        signedUrl,
                    },
                };
            }

            case 'listTags': {
                if (!pat) throw new Error('personalAccessToken is required.');

                const data = await mgmt('GET', `/spaces/${spaceId}/tags/`);
                const tags = (data.tags ?? []).map((t: any) => ({ name: t.name }));
                return { output: { tags } };
            }

            case 'listDataSources': {
                if (!pat) throw new Error('personalAccessToken is required.');

                const data = await mgmt('GET', `/spaces/${spaceId}/datasources/`);
                const datasources = (data.datasources ?? []).map((d: any) => ({
                    id: d.id,
                    name: d.name,
                    slug: d.slug,
                }));
                return { output: { datasources } };
            }

            default:
                return { error: `Storyblok action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Storyblok action failed.' };
    }
}
