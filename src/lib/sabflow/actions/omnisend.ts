'use server';

const OMNISEND_BASE = 'https://api.omnisend.com/v3';

async function omnisendFetch(apiKey: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Omnisend] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            'X-API-KEY': apiKey,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${OMNISEND_BASE}${path}`, options);
    if (res.status === 204) return {};
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || data?.message || `Omnisend API error: ${res.status}`);
    return data;
}

export async function executeOmnisendAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');
        const os = (method: string, path: string, body?: any) => omnisendFetch(apiKey, method, path, body, logger);

        switch (actionName) {
            case 'createContact': {
                const payload: any = {
                    identifiers: [{ type: 'email', id: inputs.email, channels: { email: { status: inputs.emailStatus ?? 'subscribed' } } }],
                };
                if (inputs.firstName) payload.firstName = inputs.firstName;
                if (inputs.lastName) payload.lastName = inputs.lastName;
                if (inputs.phone) payload.phone = inputs.phone;
                if (inputs.tags) payload.tags = inputs.tags;
                if (inputs.customProperties) payload.customProperties = inputs.customProperties;
                const data = await os('POST', '/contacts', payload);
                return { output: data };
            }
            case 'updateContact': {
                const contactId = inputs.contactId;
                const payload: any = {};
                if (inputs.firstName) payload.firstName = inputs.firstName;
                if (inputs.lastName) payload.lastName = inputs.lastName;
                if (inputs.phone) payload.phone = inputs.phone;
                if (inputs.tags) payload.tags = inputs.tags;
                if (inputs.customProperties) payload.customProperties = inputs.customProperties;
                const data = await os('PATCH', `/contacts/${contactId}`, payload);
                return { output: data };
            }
            case 'getContact': {
                const params = new URLSearchParams();
                if (inputs.email) params.set('email', inputs.email);
                if (inputs.phone) params.set('phone', inputs.phone);
                if (inputs.contactId) {
                    const data = await os('GET', `/contacts/${inputs.contactId}`);
                    return { output: data };
                }
                const data = await os('GET', `/contacts?${params.toString()}`);
                return { output: data };
            }
            case 'listContacts': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                if (inputs.status) params.set('status', inputs.status);
                const data = await os('GET', `/contacts?${params.toString()}`);
                return { output: data };
            }
            case 'deleteContact': {
                const contactId = inputs.contactId;
                await os('DELETE', `/contacts/${contactId}`);
                return { output: { success: true, contactId } };
            }
            case 'createEvent': {
                const data = await os('POST', '/events', {
                    name: inputs.name,
                    fields: inputs.fields,
                    contact: inputs.contact,
                });
                return { output: data };
            }
            case 'trackActivity': {
                const data = await os('POST', '/contacts/activities', {
                    eventName: inputs.eventName,
                    contact: inputs.contact,
                    properties: inputs.properties,
                    occurredAt: inputs.occurredAt ?? new Date().toISOString(),
                });
                return { output: data };
            }
            case 'listProducts': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                const data = await os('GET', `/products?${params.toString()}`);
                return { output: data };
            }
            case 'createProduct': {
                const payload: any = {
                    productID: inputs.productID,
                    title: inputs.title,
                    url: inputs.url,
                    variants: inputs.variants,
                };
                if (inputs.description) payload.description = inputs.description;
                if (inputs.imageUrl) payload.imageUrl = inputs.imageUrl;
                if (inputs.tags) payload.tags = inputs.tags;
                if (inputs.vendor) payload.vendor = inputs.vendor;
                if (inputs.type) payload.type = inputs.type;
                const data = await os('POST', '/products', payload);
                return { output: data };
            }
            case 'updateProduct': {
                const productId = inputs.productId;
                const payload: any = {};
                if (inputs.title) payload.title = inputs.title;
                if (inputs.variants) payload.variants = inputs.variants;
                if (inputs.description) payload.description = inputs.description;
                if (inputs.tags) payload.tags = inputs.tags;
                const data = await os('PATCH', `/products/${productId}`, payload);
                return { output: data };
            }
            case 'listOrders': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                if (inputs.status) params.set('status', inputs.status);
                const data = await os('GET', `/orders?${params.toString()}`);
                return { output: data };
            }
            case 'createOrder': {
                const payload: any = {
                    orderID: inputs.orderID,
                    email: inputs.email,
                    currency: inputs.currency ?? 'USD',
                    orderSum: inputs.orderSum,
                    paymentStatus: inputs.paymentStatus ?? 'awaiting',
                    fulfillmentStatus: inputs.fulfillmentStatus ?? 'unfulfilled',
                    createdAt: inputs.createdAt ?? new Date().toISOString(),
                    updatedAt: inputs.updatedAt ?? new Date().toISOString(),
                    products: inputs.products,
                };
                if (inputs.billingAddress) payload.billingAddress = inputs.billingAddress;
                if (inputs.shippingAddress) payload.shippingAddress = inputs.shippingAddress;
                const data = await os('POST', '/orders', payload);
                return { output: data };
            }
            case 'updateOrder': {
                const orderId = inputs.orderId;
                const payload: any = {};
                if (inputs.paymentStatus) payload.paymentStatus = inputs.paymentStatus;
                if (inputs.fulfillmentStatus) payload.fulfillmentStatus = inputs.fulfillmentStatus;
                if (inputs.orderSum !== undefined) payload.orderSum = inputs.orderSum;
                if (inputs.updatedAt) payload.updatedAt = inputs.updatedAt;
                const data = await os('PATCH', `/orders/${orderId}`, payload);
                return { output: data };
            }
            case 'createCampaign': {
                const payload: any = {
                    name: inputs.name,
                    type: inputs.type ?? 'regular',
                    status: inputs.status ?? 'draft',
                    options: inputs.options,
                    segments: inputs.segments,
                };
                if (inputs.sendAtHour) payload.sendAtHour = inputs.sendAtHour;
                const data = await os('POST', '/campaigns', payload);
                return { output: data };
            }
            case 'listCampaigns': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                if (inputs.status) params.set('status', inputs.status);
                if (inputs.type) params.set('type', inputs.type);
                const data = await os('GET', `/campaigns?${params.toString()}`);
                return { output: data };
            }
            default:
                return { error: `Unknown Omnisend action: ${actionName}` };
        }
    } catch (err: any) {
        logger?.log(`[Omnisend] Error: ${err.message}`);
        return { error: err.message ?? 'Unknown error' };
    }
}
