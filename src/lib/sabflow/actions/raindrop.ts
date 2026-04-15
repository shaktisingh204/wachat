
'use server';

const RAINDROP_BASE = 'https://api.raindrop.io/rest/v1';

async function raindropFetch(
    method: string,
    path: string,
    accessToken: string,
    body: any,
    logger: any,
): Promise<any> {
    logger.log(`[Raindrop] ${method} ${path}`);
    const opts: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
    };
    if (body !== undefined && method !== 'GET' && method !== 'DELETE') {
        opts.body = JSON.stringify(body);
    }
    const res = await fetch(`${RAINDROP_BASE}${path}`, opts);
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) throw new Error(data?.errorMessage || data?.error || `Raindrop API error: ${res.status}`);
    return data;
}

export async function executeRaindropAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');

        const call = (method: string, path: string, body?: any) =>
            raindropFetch(method, path, accessToken, body, logger);

        switch (actionName) {
            case 'listRaindrops': {
                const collectionId = inputs.collectionId ?? 0;
                const search = encodeURIComponent(inputs.search ?? '');
                const sort = inputs.sort ?? '-created';
                const perPage = inputs.perPage ?? 25;
                const page = inputs.page ?? 0;
                const data = await call('GET', `/raindrops/${collectionId}?search=${search}&sort=${encodeURIComponent(sort)}&perpage=${perPage}&page=${page}`);
                const items = (data.items ?? []).map((r: any) => ({
                    _id: r._id,
                    title: r.title,
                    link: r.link,
                    excerpt: r.excerpt,
                    cover: r.cover,
                    tags: r.tags ?? [],
                    created: r.created,
                }));
                return { output: { items, count: data.count, collectionId: data.collectionId } };
            }

            case 'getRaindrop': {
                const raindropId = inputs.raindropId;
                if (!raindropId && raindropId !== 0) throw new Error('raindropId is required.');
                const data = await call('GET', `/raindrop/${raindropId}`);
                const r = data.item ?? {};
                return {
                    output: {
                        item: {
                            _id: r._id,
                            title: r.title,
                            link: r.link,
                            excerpt: r.excerpt,
                            cover: r.cover,
                            tags: r.tags ?? [],
                            type: r.type,
                            createdAt: r.created,
                        },
                    },
                };
            }

            case 'createRaindrop': {
                const link = String(inputs.link ?? '').trim();
                if (!link) throw new Error('link is required.');
                const body = {
                    link,
                    title: inputs.title,
                    excerpt: inputs.excerpt,
                    tags: inputs.tags ?? [],
                    collection: { $id: inputs.collectionId ?? -1 },
                };
                const data = await call('POST', '/raindrop', body);
                const r = data.item ?? {};
                return { output: { item: { _id: r._id, title: r.title, link: r.link } } };
            }

            case 'updateRaindrop': {
                const raindropId = inputs.raindropId;
                if (!raindropId && raindropId !== 0) throw new Error('raindropId is required.');
                if (!inputs.data || typeof inputs.data !== 'object') throw new Error('data (object) is required.');
                const data = await call('PUT', `/raindrop/${raindropId}`, inputs.data);
                return { output: { item: { _id: data.item?._id } } };
            }

            case 'deleteRaindrop': {
                const raindropId = inputs.raindropId;
                if (!raindropId && raindropId !== 0) throw new Error('raindropId is required.');
                await call('DELETE', `/raindrop/${raindropId}`);
                return { output: { result: true } };
            }

            case 'listCollections': {
                const data = await call('GET', '/collections');
                const items = (data.items ?? []).map((c: any) => ({
                    _id: c._id,
                    title: c.title,
                    count: c.count,
                    cover: c.cover ?? [],
                }));
                return { output: { items } };
            }

            case 'getCollection': {
                const collectionId = inputs.collectionId;
                if (!collectionId && collectionId !== 0) throw new Error('collectionId is required.');
                const data = await call('GET', `/collection/${collectionId}`);
                const c = data.item ?? {};
                return { output: { item: { _id: c._id, title: c.title, count: c.count, view: c.view, sort: c.sort } } };
            }

            case 'createCollection': {
                const title = String(inputs.title ?? '').trim();
                if (!title) throw new Error('title is required.');
                const body: any = {
                    title,
                    view: inputs.view ?? 'list',
                    sort: inputs.sort ?? 0,
                };
                if (inputs.parentId !== undefined) body.parent = { $id: inputs.parentId };
                if (inputs.color) body.color = inputs.color;
                if (inputs.cover) body.cover = [inputs.cover];
                const data = await call('POST', '/collection', body);
                const c = data.item ?? {};
                return { output: { item: { _id: c._id, title: c.title } } };
            }

            case 'updateCollection': {
                const collectionId = inputs.collectionId;
                if (!collectionId && collectionId !== 0) throw new Error('collectionId is required.');
                if (!inputs.data || typeof inputs.data !== 'object') throw new Error('data (object) is required.');
                const data = await call('PUT', `/collection/${collectionId}`, inputs.data);
                return { output: { item: { _id: data.item?._id } } };
            }

            case 'deleteCollection': {
                const collectionId = inputs.collectionId;
                if (!collectionId && collectionId !== 0) throw new Error('collectionId is required.');
                await call('DELETE', `/collection/${collectionId}`);
                return { output: { result: true } };
            }

            case 'searchRaindrops': {
                const query = String(inputs.query ?? '').trim();
                if (!query) throw new Error('query is required.');
                const collectionId = inputs.collectionId ?? 0;
                const data = await call('GET', `/raindrops/${collectionId}?search=${encodeURIComponent(query)}`);
                return { output: { items: data.items ?? [], count: data.count } };
            }

            case 'getTags': {
                const suffix = inputs.collectionId ? `/${inputs.collectionId}` : '';
                const data = await call('GET', `/tags${suffix}`);
                const items = (data.items ?? []).map((t: any) => ({ _id: t._id, count: t.count }));
                return { output: { items } };
            }

            case 'importByLink': {
                const links: string[] = inputs.links;
                if (!Array.isArray(links) || links.length === 0) throw new Error('links (array) is required.');
                const body = { items: links.map((link) => ({ link, pleaseParse: {} })) };
                const data = await call('POST', '/raindrops', body);
                return { output: { result: true, items: data.items ?? [] } };
            }

            default:
                return { error: `Raindrop action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Raindrop action failed.' };
    }
}
