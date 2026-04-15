
'use server';

const WEBFLOW_BASE = 'https://api.webflow.com/v2';

async function webflowFetch(
    token: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
) {
    logger?.log(`[Webflow] ${method} ${path}`);
    const url = `${WEBFLOW_BASE}${path}`;
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
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
        throw new Error(data?.message || data?.err || `Webflow API error: ${res.status}`);
    }
    return data;
}

export async function executeWebflowAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const token = String(inputs.token ?? '').trim();
        if (!token) throw new Error('token is required.');

        const wf = (method: string, path: string, body?: any) =>
            webflowFetch(token, method, path, body, logger);

        switch (actionName) {
            case 'listSites': {
                const data = await wf('GET', '/sites');
                const sites = data.sites ?? [];
                return { output: { sites, count: String(sites.length) } };
            }

            case 'getSite': {
                const siteId = String(inputs.siteId ?? '').trim();
                if (!siteId) throw new Error('siteId is required.');
                const data = await wf('GET', `/sites/${siteId}`);
                return { output: { id: data.id ?? '', displayName: data.displayName ?? '', shortName: data.shortName ?? '', customDomains: data.customDomains ?? [] } };
            }

            case 'publishSite': {
                const siteId = String(inputs.siteId ?? '').trim();
                if (!siteId) throw new Error('siteId is required.');
                let domains: string[] = [];
                if (inputs.domains) {
                    try { domains = typeof inputs.domains === 'string' ? JSON.parse(inputs.domains) : inputs.domains; } catch { domains = []; }
                }
                const body: any = domains.length > 0 ? { publishToWebflowSubdomain: false, customDomains: domains } : { publishToWebflowSubdomain: true };
                const data = await wf('POST', `/sites/${siteId}/publish`, body);
                return { output: { published: 'true', customDomains: data.customDomains ?? domains } };
            }

            case 'listCollections': {
                const siteId = String(inputs.siteId ?? '').trim();
                if (!siteId) throw new Error('siteId is required.');
                const data = await wf('GET', `/sites/${siteId}/collections`);
                const collections = data.collections ?? [];
                return { output: { collections, count: String(collections.length) } };
            }

            case 'getCollection': {
                const collectionId = String(inputs.collectionId ?? '').trim();
                if (!collectionId) throw new Error('collectionId is required.');
                const data = await wf('GET', `/collections/${collectionId}`);
                return { output: { id: data.id ?? '', displayName: data.displayName ?? '', slug: data.slug ?? '', fields: data.fields ?? [] } };
            }

            case 'listItems': {
                const collectionId = String(inputs.collectionId ?? '').trim();
                if (!collectionId) throw new Error('collectionId is required.');
                const limit = Number(inputs.limit ?? 25);
                const offset = Number(inputs.offset ?? 0);
                const data = await wf('GET', `/collections/${collectionId}/items?limit=${limit}&offset=${offset}`);
                const items = data.items ?? [];
                return { output: { items, count: String(data.total ?? items.length), pagination: data.pagination ?? {} } };
            }

            case 'getItem': {
                const collectionId = String(inputs.collectionId ?? '').trim();
                const itemId = String(inputs.itemId ?? '').trim();
                if (!collectionId || !itemId) throw new Error('collectionId and itemId are required.');
                const data = await wf('GET', `/collections/${collectionId}/items/${itemId}`);
                return { output: { id: data.id ?? '', fieldData: data.fieldData ?? {}, isDraft: String(data.isDraft ?? false), isArchived: String(data.isArchived ?? false) } };
            }

            case 'createItem': {
                const collectionId = String(inputs.collectionId ?? '').trim();
                if (!collectionId) throw new Error('collectionId is required.');
                let fields: any = {};
                if (inputs.fields) {
                    try { fields = typeof inputs.fields === 'string' ? JSON.parse(inputs.fields) : inputs.fields; } catch { fields = {}; }
                }
                const isDraft = inputs.isDraft !== undefined ? Boolean(inputs.isDraft) : false;
                const body: any = { fieldData: fields, isDraft };
                const data = await wf('POST', `/collections/${collectionId}/items`, body);
                return { output: { id: data.id ?? '', fieldData: data.fieldData ?? {}, created: 'true' } };
            }

            case 'updateItem': {
                const collectionId = String(inputs.collectionId ?? '').trim();
                const itemId = String(inputs.itemId ?? '').trim();
                if (!collectionId || !itemId) throw new Error('collectionId and itemId are required.');
                let fields: any = {};
                if (inputs.fields) {
                    try { fields = typeof inputs.fields === 'string' ? JSON.parse(inputs.fields) : inputs.fields; } catch { fields = {}; }
                }
                const data = await wf('PATCH', `/collections/${collectionId}/items/${itemId}`, { fieldData: fields });
                return { output: { id: data.id ?? itemId, fieldData: data.fieldData ?? {}, updated: 'true' } };
            }

            case 'deleteItem': {
                const collectionId = String(inputs.collectionId ?? '').trim();
                const itemId = String(inputs.itemId ?? '').trim();
                if (!collectionId || !itemId) throw new Error('collectionId and itemId are required.');
                await wf('DELETE', `/collections/${collectionId}/items/${itemId}`);
                return { output: { deleted: 'true', itemId } };
            }

            case 'publishItems': {
                const collectionId = String(inputs.collectionId ?? '').trim();
                if (!collectionId) throw new Error('collectionId is required.');
                let itemIds: string[] = [];
                if (inputs.itemIds) {
                    try { itemIds = typeof inputs.itemIds === 'string' ? JSON.parse(inputs.itemIds) : inputs.itemIds; } catch { itemIds = []; }
                }
                if (itemIds.length === 0) throw new Error('itemIds array is required and must not be empty.');
                const data = await wf('POST', `/collections/${collectionId}/items/publish`, { itemIds });
                const publishedItems = data.publishedItemIds ?? itemIds;
                return { output: { published: 'true', publishedItemIds: publishedItems, count: String(publishedItems.length) } };
            }

            case 'listOrders': {
                const siteId = String(inputs.siteId ?? '').trim();
                if (!siteId) throw new Error('siteId is required.');
                let path = `/sites/${siteId}/orders`;
                if (inputs.status) path += `?status=${encodeURIComponent(String(inputs.status))}`;
                const data = await wf('GET', path);
                const orders = data.orders ?? [];
                return { output: { orders, count: String(data.total ?? orders.length) } };
            }

            case 'getOrder': {
                const siteId = String(inputs.siteId ?? '').trim();
                const orderId = String(inputs.orderId ?? '').trim();
                if (!siteId || !orderId) throw new Error('siteId and orderId are required.');
                const data = await wf('GET', `/sites/${siteId}/orders/${orderId}`);
                return { output: { orderId: data.orderId ?? orderId, status: data.status ?? '', total: String(data.totals?.total ?? 0), customerInfo: data.customerInfo ?? {} } };
            }

            case 'updateOrderStatus': {
                const siteId = String(inputs.siteId ?? '').trim();
                const orderId = String(inputs.orderId ?? '').trim();
                const status = String(inputs.status ?? '').trim();
                if (!siteId || !orderId || !status) throw new Error('siteId, orderId, and status are required.');
                const data = await wf('PATCH', `/sites/${siteId}/orders/${orderId}`, { status });
                return { output: { orderId: data.orderId ?? orderId, status: data.status ?? status, updated: 'true' } };
            }

            case 'listProducts': {
                const siteId = String(inputs.siteId ?? '').trim();
                if (!siteId) throw new Error('siteId is required.');
                const limit = Number(inputs.limit ?? 25);
                const data = await wf('GET', `/sites/${siteId}/products?limit=${limit}`);
                const products = data.items ?? [];
                return { output: { products, count: String(data.total ?? products.length) } };
            }

            default:
                return { error: `Webflow action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Webflow action failed.' };
    }
}
