
'use server';

async function productboardFetch(accessToken: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Productboard] ${method} ${path}`);
    const url = `https://api.productboard.com${path}`;
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-Version': '1',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.error?.message || data?.message || `Productboard API error: ${res.status}`);
    }
    return data;
}

export async function executeProductboardAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');
        const pb = (method: string, path: string, body?: any) => productboardFetch(accessToken, method, path, body, logger);

        switch (actionName) {
            case 'listFeatures': {
                const pageLimit = Number(inputs.pageLimit ?? 100);
                const qs = [`pageLimit=${pageLimit}`];
                if (inputs.productId) qs.push(`productId=${inputs.productId}`);
                if (inputs.componentId) qs.push(`componentId=${inputs.componentId}`);
                const data = await pb('GET', `/features?${qs.join('&')}`);
                return { output: { features: data.data ?? [], totalCount: String(data.totalCount ?? 0), pageCursor: data.links?.next ?? '' } };
            }

            case 'getFeature': {
                const featureId = String(inputs.featureId ?? '').trim();
                if (!featureId) throw new Error('featureId is required.');
                const data = await pb('GET', `/features/${featureId}`);
                return { output: { feature: data.data ?? data } };
            }

            case 'createFeature': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const body: any = { data: { name } };
                if (inputs.description) body.data.description = String(inputs.description);
                if (inputs.status) body.data.status = { name: String(inputs.status) };
                if (inputs.productId) body.data.product = { id: String(inputs.productId) };
                if (inputs.componentId) body.data.component = { id: String(inputs.componentId) };
                if (inputs.owner) body.data.owner = { email: String(inputs.owner) };
                const data = await pb('POST', '/features', body);
                return { output: { feature: data.data ?? data, featureId: String(data.data?.id ?? '') } };
            }

            case 'updateFeature': {
                const featureId = String(inputs.featureId ?? '').trim();
                if (!featureId) throw new Error('featureId is required.');
                const body: any = { data: {} };
                if (inputs.name) body.data.name = String(inputs.name);
                if (inputs.description) body.data.description = String(inputs.description);
                if (inputs.status) body.data.status = { name: String(inputs.status) };
                const data = await pb('PATCH', `/features/${featureId}`, body);
                return { output: { feature: data.data ?? data } };
            }

            case 'deleteFeature': {
                const featureId = String(inputs.featureId ?? '').trim();
                if (!featureId) throw new Error('featureId is required.');
                await pb('DELETE', `/features/${featureId}`);
                return { output: { deleted: 'true', featureId } };
            }

            case 'listComponents': {
                const pageLimit = Number(inputs.pageLimit ?? 100);
                const qs = [`pageLimit=${pageLimit}`];
                if (inputs.productId) qs.push(`productId=${inputs.productId}`);
                const data = await pb('GET', `/components?${qs.join('&')}`);
                return { output: { components: data.data ?? [], totalCount: String(data.totalCount ?? 0) } };
            }

            case 'getComponent': {
                const componentId = String(inputs.componentId ?? '').trim();
                if (!componentId) throw new Error('componentId is required.');
                const data = await pb('GET', `/components/${componentId}`);
                return { output: { component: data.data ?? data } };
            }

            case 'createComponent': {
                const name = String(inputs.name ?? '').trim();
                const productId = String(inputs.productId ?? '').trim();
                if (!name || !productId) throw new Error('name and productId are required.');
                const body: any = { data: { name, product: { id: productId } } };
                if (inputs.description) body.data.description = String(inputs.description);
                const data = await pb('POST', '/components', body);
                return { output: { component: data.data ?? data, componentId: String(data.data?.id ?? '') } };
            }

            case 'listProducts': {
                const pageLimit = Number(inputs.pageLimit ?? 100);
                const data = await pb('GET', `/products?pageLimit=${pageLimit}`);
                return { output: { products: data.data ?? [], totalCount: String(data.totalCount ?? 0) } };
            }

            case 'getProduct': {
                const productId = String(inputs.productId ?? '').trim();
                if (!productId) throw new Error('productId is required.');
                const data = await pb('GET', `/products/${productId}`);
                return { output: { product: data.data ?? data } };
            }

            case 'listNotes': {
                const pageLimit = Number(inputs.pageLimit ?? 100);
                const qs = [`pageLimit=${pageLimit}`];
                if (inputs.featureId) qs.push(`featureId=${inputs.featureId}`);
                const data = await pb('GET', `/notes?${qs.join('&')}`);
                return { output: { notes: data.data ?? [], totalCount: String(data.totalCount ?? 0) } };
            }

            case 'getNote': {
                const noteId = String(inputs.noteId ?? '').trim();
                if (!noteId) throw new Error('noteId is required.');
                const data = await pb('GET', `/notes/${noteId}`);
                return { output: { note: data.data ?? data } };
            }

            case 'createNote': {
                const title = String(inputs.title ?? '').trim();
                const content = String(inputs.content ?? '').trim();
                if (!title) throw new Error('title is required.');
                const body: any = { data: { title, content } };
                if (inputs.customerEmail) body.data.customer = { email: String(inputs.customerEmail) };
                if (inputs.featureId) body.data.feature = { id: String(inputs.featureId) };
                if (inputs.tags) body.data.tags = Array.isArray(inputs.tags) ? inputs.tags : [String(inputs.tags)];
                const data = await pb('POST', '/notes', body);
                return { output: { note: data.data ?? data, noteId: String(data.data?.id ?? '') } };
            }

            case 'deleteNote': {
                const noteId = String(inputs.noteId ?? '').trim();
                if (!noteId) throw new Error('noteId is required.');
                await pb('DELETE', `/notes/${noteId}`);
                return { output: { deleted: 'true', noteId } };
            }

            case 'listUsers': {
                const data = await pb('GET', '/users');
                return { output: { users: data.data ?? [], count: String(data.data?.length ?? 0) } };
            }

            case 'listTags': {
                const data = await pb('GET', '/tags');
                return { output: { tags: data.data ?? [], count: String(data.data?.length ?? 0) } };
            }

            case 'listReleases': {
                const pageLimit = Number(inputs.pageLimit ?? 100);
                const data = await pb('GET', `/releases?pageLimit=${pageLimit}`);
                return { output: { releases: data.data ?? [], totalCount: String(data.totalCount ?? 0) } };
            }

            case 'getRelease': {
                const releaseId = String(inputs.releaseId ?? '').trim();
                if (!releaseId) throw new Error('releaseId is required.');
                const data = await pb('GET', `/releases/${releaseId}`);
                return { output: { release: data.data ?? data } };
            }

            default:
                return { error: `Productboard action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Productboard action failed.' };
    }
}
