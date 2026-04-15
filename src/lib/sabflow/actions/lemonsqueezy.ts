'use server';

// ---------------------------------------------------------------------------
// Lemon Squeezy – API v1
// Docs: https://docs.lemonsqueezy.com/api
// ---------------------------------------------------------------------------

async function lsFetch(
    apiKey: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
): Promise<any> {
    const base = 'https://api.lemonsqueezy.com/v1';
    const url = `${base}${path}`;
    logger?.log(`[LemonSqueezy] ${method} ${path}`);

    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/vnd.api+json',
            Accept: 'application/vnd.api+json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);

    const res = await fetch(url, options);
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) {
        const errMsg = data?.errors?.[0]?.detail || data?.message || `HTTP ${res.status}`;
        return { error: errMsg };
    }
    return data;
}

function buildLsQueryString(params: Record<string, any>): string {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
    }
    const qs = p.toString();
    return qs ? `?${qs}` : '';
}

export async function executeLemonsqueezyAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey: string = inputs.apiKey || '';

        switch (actionName) {
            case 'listStores': {
                const qs = buildLsQueryString({
                    'page[number]': inputs.page,
                    'page[size]': inputs.pageSize,
                });
                const result = await lsFetch(apiKey, 'GET', `/stores${qs}`, undefined, logger);
                if (result.error) return { error: result.error };
                return { output: result };
            }

            case 'getStore': {
                const storeId: string = inputs.storeId || '';
                const result = await lsFetch(apiKey, 'GET', `/stores/${storeId}`, undefined, logger);
                if (result.error) return { error: result.error };
                return { output: result };
            }

            case 'listProducts': {
                const qs = buildLsQueryString({
                    'filter[store_id]': inputs.storeId,
                    'page[number]': inputs.page,
                    'page[size]': inputs.pageSize,
                });
                const result = await lsFetch(apiKey, 'GET', `/products${qs}`, undefined, logger);
                if (result.error) return { error: result.error };
                return { output: result };
            }

            case 'getProduct': {
                const productId: string = inputs.productId || '';
                const result = await lsFetch(apiKey, 'GET', `/products/${productId}`, undefined, logger);
                if (result.error) return { error: result.error };
                return { output: result };
            }

            case 'listVariants': {
                const qs = buildLsQueryString({
                    'filter[product_id]': inputs.productId,
                    'page[number]': inputs.page,
                    'page[size]': inputs.pageSize,
                });
                const result = await lsFetch(apiKey, 'GET', `/variants${qs}`, undefined, logger);
                if (result.error) return { error: result.error };
                return { output: result };
            }

            case 'getVariant': {
                const variantId: string = inputs.variantId || '';
                const result = await lsFetch(apiKey, 'GET', `/variants/${variantId}`, undefined, logger);
                if (result.error) return { error: result.error };
                return { output: result };
            }

            case 'listOrders': {
                const qs = buildLsQueryString({
                    'filter[store_id]': inputs.storeId,
                    'filter[status]': inputs.status,
                    'filter[user_email]': inputs.userEmail,
                    'page[number]': inputs.page,
                    'page[size]': inputs.pageSize,
                });
                const result = await lsFetch(apiKey, 'GET', `/orders${qs}`, undefined, logger);
                if (result.error) return { error: result.error };
                return { output: result };
            }

            case 'getOrder': {
                const orderId: string = inputs.orderId || '';
                const result = await lsFetch(apiKey, 'GET', `/orders/${orderId}`, undefined, logger);
                if (result.error) return { error: result.error };
                return { output: result };
            }

            case 'listOrderItems': {
                const qs = buildLsQueryString({
                    'filter[order_id]': inputs.orderId,
                    'filter[product_id]': inputs.productId,
                    'filter[variant_id]': inputs.variantId,
                    'page[number]': inputs.page,
                    'page[size]': inputs.pageSize,
                });
                const result = await lsFetch(apiKey, 'GET', `/order-items${qs}`, undefined, logger);
                if (result.error) return { error: result.error };
                return { output: result };
            }

            case 'listSubscriptions': {
                const qs = buildLsQueryString({
                    'filter[store_id]': inputs.storeId,
                    'filter[order_id]': inputs.orderId,
                    'filter[order_item_id]': inputs.orderItemId,
                    'filter[product_id]': inputs.productId,
                    'filter[variant_id]': inputs.variantId,
                    'filter[user_email]': inputs.userEmail,
                    'filter[status]': inputs.status,
                    'page[number]': inputs.page,
                    'page[size]': inputs.pageSize,
                });
                const result = await lsFetch(apiKey, 'GET', `/subscriptions${qs}`, undefined, logger);
                if (result.error) return { error: result.error };
                return { output: result };
            }

            case 'getSubscription': {
                const subscriptionId: string = inputs.subscriptionId || '';
                const result = await lsFetch(apiKey, 'GET', `/subscriptions/${subscriptionId}`, undefined, logger);
                if (result.error) return { error: result.error };
                return { output: result };
            }

            case 'cancelSubscription': {
                const subscriptionId: string = inputs.subscriptionId || '';
                const result = await lsFetch(apiKey, 'DELETE', `/subscriptions/${subscriptionId}`, undefined, logger);
                if (result.error) return { error: result.error };
                return { output: result };
            }

            case 'listCustomers': {
                const qs = buildLsQueryString({
                    'filter[store_id]': inputs.storeId,
                    'filter[email]': inputs.email,
                    'page[number]': inputs.page,
                    'page[size]': inputs.pageSize,
                });
                const result = await lsFetch(apiKey, 'GET', `/customers${qs}`, undefined, logger);
                if (result.error) return { error: result.error };
                return { output: result };
            }

            case 'getCustomer': {
                const customerId: string = inputs.customerId || '';
                const result = await lsFetch(apiKey, 'GET', `/customers/${customerId}`, undefined, logger);
                if (result.error) return { error: result.error };
                return { output: result };
            }

            case 'listLicenses': {
                const qs = buildLsQueryString({
                    'filter[store_id]': inputs.storeId,
                    'filter[order_id]': inputs.orderId,
                    'filter[order_item_id]': inputs.orderItemId,
                    'filter[product_id]': inputs.productId,
                    'filter[status]': inputs.status,
                    'page[number]': inputs.page,
                    'page[size]': inputs.pageSize,
                });
                const result = await lsFetch(apiKey, 'GET', `/license-keys${qs}`, undefined, logger);
                if (result.error) return { error: result.error };
                return { output: result };
            }

            default:
                return { error: `Lemon Squeezy action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        return { error: err?.message || String(err) };
    }
}
