
'use server';

const SQUARESPACE_BASE = 'https://api.squarespace.com/1.0';

async function sqsFetch(
    apiKey: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
) {
    logger?.log(`[Squarespace] ${method} ${path}`);
    const url = `${SQUARESPACE_BASE}${path}`;
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || data?.type || `Squarespace API error: ${res.status}`);
    }
    return data;
}

export async function executeSquarespaceAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        const sqs = (method: string, path: string, body?: any) =>
            sqsFetch(apiKey, method, path, body, logger);

        switch (actionName) {
            // Products
            case 'listProducts': {
                const cursor = inputs.cursor ? `?cursor=${encodeURIComponent(inputs.cursor)}` : '';
                const data = await sqs('GET', `/commerce/products${cursor}`);
                return { output: { products: data.products ?? [], pagination: data.pagination } };
            }

            case 'getProduct': {
                const productId = String(inputs.productId ?? '').trim();
                if (!productId) throw new Error('productId is required.');
                const data = await sqs('GET', `/commerce/products/${productId}`);
                return { output: { product: data } };
            }

            case 'createProduct': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const body: any = {
                    type: String(inputs.type ?? 'PHYSICAL'),
                    storePageId: String(inputs.storePageId ?? ''),
                    name,
                    description: inputs.description ? String(inputs.description) : undefined,
                    variants: inputs.variants ?? [{ sku: inputs.sku ?? '', pricing: { basePrice: { currency: inputs.currency ?? 'USD', value: String(inputs.price ?? '0') } } }],
                };
                const data = await sqs('POST', '/commerce/products', body);
                logger.log(`[Squarespace] Created product ${data.id}`);
                return { output: { product: data, productId: String(data.id) } };
            }

            case 'updateProduct': {
                const productId = String(inputs.productId ?? '').trim();
                if (!productId) throw new Error('productId is required.');
                const body: any = {};
                if (inputs.name) body.name = String(inputs.name);
                if (inputs.description) body.description = String(inputs.description);
                if (inputs.isVisible !== undefined) body.isVisible = Boolean(inputs.isVisible);
                const data = await sqs('POST', `/commerce/products/${productId}`, body);
                return { output: { product: data } };
            }

            case 'deleteProduct': {
                const productId = String(inputs.productId ?? '').trim();
                if (!productId) throw new Error('productId is required.');
                await sqs('DELETE', `/commerce/products/${productId}`);
                logger.log(`[Squarespace] Deleted product ${productId}`);
                return { output: { deleted: true, productId } };
            }

            // Orders
            case 'listOrders': {
                const params = new URLSearchParams();
                if (inputs.cursor) params.set('cursor', inputs.cursor);
                if (inputs.modifiedAfter) params.set('modifiedAfter', inputs.modifiedAfter);
                if (inputs.modifiedBefore) params.set('modifiedBefore', inputs.modifiedBefore);
                if (inputs.fulfillmentStatus) params.set('fulfillmentStatus', inputs.fulfillmentStatus);
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await sqs('GET', `/commerce/orders${qs}`);
                return { output: { orders: data.result ?? [], pagination: data.pagination } };
            }

            case 'getOrder': {
                const orderId = String(inputs.orderId ?? '').trim();
                if (!orderId) throw new Error('orderId is required.');
                const data = await sqs('GET', `/commerce/orders/${orderId}`);
                return { output: { order: data } };
            }

            case 'fulfillOrder': {
                const orderId = String(inputs.orderId ?? '').trim();
                if (!orderId) throw new Error('orderId is required.');
                const body: any = {
                    shouldSendNotification: inputs.shouldSendNotification !== false,
                    shipments: inputs.shipments ?? [],
                };
                if (inputs.trackingNumber) {
                    body.shipments = [{ trackingNumber: String(inputs.trackingNumber), carrierName: String(inputs.carrierName ?? '') }];
                }
                const data = await sqs('POST', `/commerce/orders/${orderId}/fulfillments`, body);
                return { output: { fulfillment: data } };
            }

            // Inventory
            case 'listInventory': {
                const cursor = inputs.cursor ? `?cursor=${encodeURIComponent(inputs.cursor)}` : '';
                const data = await sqs('GET', `/commerce/inventory${cursor}`);
                return { output: { inventory: data.inventory ?? [], pagination: data.pagination } };
            }

            case 'adjustInventory': {
                const body: any = { increments: inputs.increments ?? [] };
                if (inputs.variantId && inputs.quantity !== undefined) {
                    body.increments = [{ variantId: String(inputs.variantId), quantity: Number(inputs.quantity) }];
                }
                const data = await sqs('POST', '/commerce/inventory/adjustments', body);
                return { output: { result: data } };
            }

            // Website / Pages
            case 'getWebsite': {
                const siteId = String(inputs.siteId ?? '').trim();
                if (!siteId) throw new Error('siteId is required.');
                const data = await sqs('GET', `/sites/${siteId}`);
                return { output: { site: data } };
            }

            case 'listPages': {
                const siteId = String(inputs.siteId ?? '').trim();
                if (!siteId) throw new Error('siteId is required.');
                const data = await sqs('GET', `/sites/${siteId}/pages`);
                return { output: { pages: data.pages ?? [] } };
            }

            // Forms
            case 'listForms': {
                const siteId = String(inputs.siteId ?? '').trim();
                if (!siteId) throw new Error('siteId is required.');
                const data = await sqs('GET', `/sites/${siteId}/form-submissions`);
                return { output: { forms: data.result ?? [] } };
            }

            case 'getFormSubmissions': {
                const siteId = String(inputs.siteId ?? '').trim();
                const formId = String(inputs.formId ?? '').trim();
                if (!siteId || !formId) throw new Error('siteId and formId are required.');
                const cursor = inputs.cursor ? `?cursor=${encodeURIComponent(inputs.cursor)}` : '';
                const data = await sqs('GET', `/sites/${siteId}/form-submissions${cursor}`);
                const submissions = (data.result ?? []).filter((s: any) => !formId || s.formId === formId);
                return { output: { submissions, pagination: data.pagination } };
            }

            default:
                return { error: `Squarespace action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        const msg = e?.message || 'Squarespace action failed.';
        return { error: typeof msg === 'string' ? msg : JSON.stringify(msg) };
    }
}
