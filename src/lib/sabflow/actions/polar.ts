
'use server';

const POLAR_BASE = 'https://api.polar.sh/v1';

async function polarFetch(apiKey: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Polar] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${POLAR_BASE}${path}`, options);
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.detail?.[0]?.msg || data?.detail || data?.message || `Polar API error: ${res.status}`);
    }
    return data;
}

export async function executePolarAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');
        const pol = (method: string, path: string, body?: any) => polarFetch(apiKey, method, path, body, logger);

        switch (actionName) {
            case 'createProduct': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const priceAmount = Number(inputs.priceAmount ?? 0);
                const priceCurrency = String(inputs.priceCurrency ?? 'usd').toLowerCase();
                const payload: any = {
                    name,
                    prices: [{ price_amount: priceAmount, price_currency: priceCurrency, type: inputs.priceType ?? 'one_time' }],
                };
                if (inputs.description) payload.description = String(inputs.description);
                if (inputs.isRecurring !== undefined) {
                    payload.prices[0].type = inputs.isRecurring === true || inputs.isRecurring === 'true' ? 'recurring' : 'one_time';
                    if (payload.prices[0].type === 'recurring') payload.prices[0].recurring_interval = inputs.recurringInterval ?? 'month';
                }
                const data = await pol('POST', '/products', payload);
                return { output: { id: data.id ?? '', name: data.name ?? name, type: data.type ?? '' } };
            }

            case 'listProducts': {
                const params = new URLSearchParams();
                if (inputs.isArchived !== undefined) params.set('is_archived', String(inputs.isArchived));
                if (inputs.organizationId) params.set('organization_id', String(inputs.organizationId));
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await pol('GET', `/products${qs}`);
                const items = data.items ?? [];
                return { output: { count: String(data.pagination?.total_count ?? items.length), products: JSON.stringify(items) } };
            }

            case 'createCheckout': {
                const productId = String(inputs.productId ?? '').trim();
                if (!productId) throw new Error('productId is required.');
                const payload: any = { product_id: productId };
                if (inputs.customerEmail) payload.customer_email = String(inputs.customerEmail);
                if (inputs.successUrl) payload.success_url = String(inputs.successUrl);
                if (inputs.metadata) payload.metadata = typeof inputs.metadata === 'string' ? JSON.parse(inputs.metadata) : inputs.metadata;
                const data = await pol('POST', '/checkouts', payload);
                return { output: { id: data.id ?? '', url: data.url ?? '', status: data.status ?? '' } };
            }

            case 'listOrders': {
                const params = new URLSearchParams();
                if (inputs.productId) params.set('product_id', String(inputs.productId));
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await pol('GET', `/orders${qs}`);
                const items = data.items ?? [];
                return { output: { count: String(data.pagination?.total_count ?? items.length), orders: JSON.stringify(items) } };
            }

            case 'getOrder': {
                const orderId = String(inputs.orderId ?? '').trim();
                if (!orderId) throw new Error('orderId is required.');
                const data = await pol('GET', `/orders/${orderId}`);
                return { output: { id: data.id ?? '', amount: String(data.amount ?? 0), currency: data.currency ?? '', status: data.status ?? '' } };
            }

            case 'listSubscriptions': {
                const params = new URLSearchParams();
                if (inputs.productId) params.set('product_id', String(inputs.productId));
                if (inputs.active !== undefined) params.set('active', String(inputs.active));
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await pol('GET', `/subscriptions${qs}`);
                const items = data.items ?? [];
                return { output: { count: String(data.pagination?.total_count ?? items.length), subscriptions: JSON.stringify(items) } };
            }

            default:
                return { error: `Polar action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Polar action failed.' };
    }
}
