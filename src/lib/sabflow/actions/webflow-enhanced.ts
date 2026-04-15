'use server';

const WEBFLOW_V2_BASE = 'https://api.webflow.com/v2';

async function wfFetch(
    token: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
): Promise<any> {
    const url = `${WEBFLOW_V2_BASE}${path}`;
    logger?.log(`[WebflowEnhanced] ${method} ${path}`);
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
    if (!res.ok) throw new Error(data?.message || data?.err || `Webflow API error: ${res.status}`);
    return data;
}

export async function executeWebflowEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const token = String(inputs.accessToken ?? '').trim();
        if (!token) throw new Error('accessToken is required.');

        const wf = (method: string, path: string, body?: any) =>
            wfFetch(token, method, path, body, logger);

        switch (actionName) {
            case 'listSites': {
                const data = await wf('GET', '/sites');
                return { output: { sites: data.sites ?? [], count: String((data.sites ?? []).length) } };
            }

            case 'getSite': {
                const siteId = String(inputs.siteId ?? '').trim();
                if (!siteId) throw new Error('siteId is required.');
                const data = await wf('GET', `/sites/${siteId}`);
                return { output: data };
            }

            case 'publishSite': {
                const siteId = String(inputs.siteId ?? '').trim();
                if (!siteId) throw new Error('siteId is required.');
                const domains: string[] = inputs.domains
                    ? (Array.isArray(inputs.domains) ? inputs.domains : [inputs.domains])
                    : [];
                const data = await wf('POST', `/sites/${siteId}/publish`, { domains });
                return { output: data };
            }

            case 'listCollections': {
                const siteId = String(inputs.siteId ?? '').trim();
                if (!siteId) throw new Error('siteId is required.');
                const data = await wf('GET', `/sites/${siteId}/collections`);
                return { output: { collections: data.collections ?? [], count: String((data.collections ?? []).length) } };
            }

            case 'getCollection': {
                const collectionId = String(inputs.collectionId ?? '').trim();
                if (!collectionId) throw new Error('collectionId is required.');
                const data = await wf('GET', `/collections/${collectionId}`);
                return { output: data };
            }

            case 'listItems': {
                const collectionId = String(inputs.collectionId ?? '').trim();
                if (!collectionId) throw new Error('collectionId is required.');
                const limit = inputs.limit ? `&limit=${inputs.limit}` : '';
                const offset = inputs.offset ? `&offset=${inputs.offset}` : '';
                const data = await wf('GET', `/collections/${collectionId}/items?${limit}${offset}`);
                return { output: { items: data.items ?? [], pagination: data.pagination ?? {} } };
            }

            case 'getItem': {
                const collectionId = String(inputs.collectionId ?? '').trim();
                const itemId = String(inputs.itemId ?? '').trim();
                if (!collectionId) throw new Error('collectionId is required.');
                if (!itemId) throw new Error('itemId is required.');
                const data = await wf('GET', `/collections/${collectionId}/items/${itemId}`);
                return { output: data };
            }

            case 'createItem': {
                const collectionId = String(inputs.collectionId ?? '').trim();
                if (!collectionId) throw new Error('collectionId is required.');
                const fieldData = inputs.fieldData ?? {};
                const data = await wf('POST', `/collections/${collectionId}/items`, { fieldData, isArchived: inputs.isArchived ?? false, isDraft: inputs.isDraft ?? false });
                return { output: data };
            }

            case 'updateItem': {
                const collectionId = String(inputs.collectionId ?? '').trim();
                const itemId = String(inputs.itemId ?? '').trim();
                if (!collectionId) throw new Error('collectionId is required.');
                if (!itemId) throw new Error('itemId is required.');
                const fieldData = inputs.fieldData ?? {};
                const data = await wf('PUT', `/collections/${collectionId}/items/${itemId}`, { fieldData, isArchived: inputs.isArchived, isDraft: inputs.isDraft });
                return { output: data };
            }

            case 'deleteItem': {
                const collectionId = String(inputs.collectionId ?? '').trim();
                const itemId = String(inputs.itemId ?? '').trim();
                if (!collectionId) throw new Error('collectionId is required.');
                if (!itemId) throw new Error('itemId is required.');
                await wf('DELETE', `/collections/${collectionId}/items/${itemId}`);
                return { output: { deleted: true, itemId } };
            }

            case 'patchItem': {
                const collectionId = String(inputs.collectionId ?? '').trim();
                const itemId = String(inputs.itemId ?? '').trim();
                if (!collectionId) throw new Error('collectionId is required.');
                if (!itemId) throw new Error('itemId is required.');
                const fieldData = inputs.fieldData ?? {};
                const data = await wf('PATCH', `/collections/${collectionId}/items/${itemId}`, { fieldData });
                return { output: data };
            }

            case 'listOrders': {
                const siteId = String(inputs.siteId ?? '').trim();
                if (!siteId) throw new Error('siteId is required.');
                const data = await wf('GET', `/sites/${siteId}/orders`);
                return { output: { orders: data.orders ?? [], count: String((data.orders ?? []).length) } };
            }

            case 'getOrder': {
                const siteId = String(inputs.siteId ?? '').trim();
                const orderId = String(inputs.orderId ?? '').trim();
                if (!siteId) throw new Error('siteId is required.');
                if (!orderId) throw new Error('orderId is required.');
                const data = await wf('GET', `/sites/${siteId}/orders/${orderId}`);
                return { output: data };
            }

            case 'updateOrder': {
                const siteId = String(inputs.siteId ?? '').trim();
                const orderId = String(inputs.orderId ?? '').trim();
                if (!siteId) throw new Error('siteId is required.');
                if (!orderId) throw new Error('orderId is required.');
                const body: any = {};
                if (inputs.comment !== undefined) body.comment = inputs.comment;
                if (inputs.shippingAddress !== undefined) body.shippingAddress = inputs.shippingAddress;
                const data = await wf('PATCH', `/sites/${siteId}/orders/${orderId}`, body);
                return { output: data };
            }

            case 'fulfillOrder': {
                const siteId = String(inputs.siteId ?? '').trim();
                const orderId = String(inputs.orderId ?? '').trim();
                if (!siteId) throw new Error('siteId is required.');
                if (!orderId) throw new Error('orderId is required.');
                const body: any = { sendEmail: inputs.sendEmail ?? true };
                if (inputs.trackingNumber) body.trackingNumber = inputs.trackingNumber;
                if (inputs.trackingUrl) body.trackingUrl = inputs.trackingUrl;
                const data = await wf('POST', `/sites/${siteId}/orders/${orderId}/fulfill`, body);
                return { output: data };
            }

            case 'listInventory': {
                const collectionId = String(inputs.collectionId ?? '').trim();
                if (!collectionId) throw new Error('collectionId is required.');
                const data = await wf('GET', `/collections/${collectionId}/items/inventory`);
                return { output: { inventory: data.inventoryItems ?? data ?? [], count: String((data.inventoryItems ?? []).length) } };
            }

            default:
                throw new Error(`Unknown Webflow Enhanced action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.log(`[WebflowEnhanced] Error: ${err.message}`);
        return { error: err.message ?? 'Unknown error' };
    }
}
