'use server';

const GUMROAD_BASE_URL = 'https://api.gumroad.com/v2';

async function gumroadRequest(
    method: string,
    path: string,
    accessToken: string,
    body?: Record<string, any>,
    queryParams?: Record<string, string>
): Promise<any> {
    const url = new URL(`${GUMROAD_BASE_URL}${path}`);
    url.searchParams.set('access_token', accessToken);
    if (queryParams) {
        for (const [k, v] of Object.entries(queryParams)) {
            url.searchParams.set(k, v);
        }
    }

    const headers: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
    };

    let bodyStr: string | undefined;
    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE')) {
        const params = new URLSearchParams();
        params.set('access_token', accessToken);
        for (const [k, v] of Object.entries(body)) {
            if (v !== undefined && v !== null) params.set(k, String(v));
        }
        bodyStr = params.toString();
    }

    const res = await fetch(url.toString(), {
        method,
        headers,
        body: bodyStr,
    });

    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!res.ok || data?.success === false) {
        throw new Error(data?.message ?? `Gumroad API error ${res.status}: ${text}`);
    }
    return data;
}

export async function executeGumroadAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        if (!inputs.access_token) return { error: 'Missing required input: access_token' };
        const { access_token } = inputs;
        logger.log(`Executing Gumroad action: ${actionName}`);

        switch (actionName) {

            case 'listProducts': {
                const data = await gumroadRequest('GET', '/products', access_token);
                return { output: { products: data.products ?? [] } };
            }

            case 'getProduct': {
                if (!inputs.productId) return { error: 'Missing required input: productId' };
                const data = await gumroadRequest('GET', `/products/${inputs.productId}`, access_token);
                return { output: { product: data.product } };
            }

            case 'createProduct': {
                if (!inputs.name) return { error: 'Missing required input: name' };
                if (!inputs.price) return { error: 'Missing required input: price' };
                const body: Record<string, any> = {
                    name: inputs.name,
                    price: inputs.price,
                };
                if (inputs.description) body.description = inputs.description;
                if (inputs.url) body.url = inputs.url;
                if (inputs.preview_url) body.preview_url = inputs.preview_url;
                if (inputs.customizable_price) body.customizable_price = inputs.customizable_price;
                if (inputs.suggested_price) body.suggested_price = inputs.suggested_price;
                if (inputs.currency) body.currency = inputs.currency;
                const data = await gumroadRequest('POST', '/products', access_token, body);
                return { output: { product: data.product } };
            }

            case 'updateProduct': {
                if (!inputs.productId) return { error: 'Missing required input: productId' };
                const body: Record<string, any> = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.price !== undefined) body.price = inputs.price;
                if (inputs.description) body.description = inputs.description;
                if (inputs.url) body.url = inputs.url;
                const data = await gumroadRequest('PUT', `/products/${inputs.productId}`, access_token, body);
                return { output: { product: data.product } };
            }

            case 'deleteProduct': {
                if (!inputs.productId) return { error: 'Missing required input: productId' };
                await gumroadRequest('DELETE', `/products/${inputs.productId}`, access_token, {});
                return { output: { deleted: true, productId: inputs.productId } };
            }

            case 'listSales': {
                const params: Record<string, string> = {};
                if (inputs.after) params.after = inputs.after;
                if (inputs.before) params.before = inputs.before;
                if (inputs.product_id) params.product_id = inputs.product_id;
                if (inputs.email) params.email = inputs.email;
                if (inputs.page_key) params.page_key = inputs.page_key;
                const data = await gumroadRequest('GET', '/sales', access_token, undefined, params);
                return { output: { sales: data.sales ?? [], next_page_key: data.next_page_key } };
            }

            case 'getSale': {
                if (!inputs.saleId) return { error: 'Missing required input: saleId' };
                const data = await gumroadRequest('GET', `/sales/${inputs.saleId}`, access_token);
                return { output: { sale: data.sale } };
            }

            case 'listSubscribers': {
                if (!inputs.productId) return { error: 'Missing required input: productId' };
                const data = await gumroadRequest('GET', `/products/${inputs.productId}/subscribers`, access_token);
                return { output: { subscribers: data.subscribers ?? [] } };
            }

            case 'getSubscriber': {
                if (!inputs.subscriberId) return { error: 'Missing required input: subscriberId' };
                const data = await gumroadRequest('GET', `/subscribers/${inputs.subscriberId}`, access_token);
                return { output: { subscriber: data.subscriber } };
            }

            case 'cancelSubscription': {
                if (!inputs.subscriberId) return { error: 'Missing required input: subscriberId' };
                const data = await gumroadRequest('PUT', `/subscribers/${inputs.subscriberId}/unsubscribe`, access_token, {});
                return { output: { subscriber: data.subscriber, cancelled: true } };
            }

            case 'listRefunds': {
                if (!inputs.saleId) return { error: 'Missing required input: saleId' };
                const data = await gumroadRequest('GET', `/sales/${inputs.saleId}/refund`, access_token);
                return { output: { refund: data.refund } };
            }

            case 'createOfferCode': {
                if (!inputs.productId) return { error: 'Missing required input: productId' };
                if (!inputs.offer_code) return { error: 'Missing required input: offer_code' };
                const body: Record<string, any> = {
                    offer_code: inputs.offer_code,
                };
                if (inputs.amount_off !== undefined) body.amount_off = inputs.amount_off;
                if (inputs.percent_off !== undefined) body.percent_off = inputs.percent_off;
                if (inputs.universal !== undefined) body.universal = inputs.universal;
                if (inputs.max_purchase_count !== undefined) body.max_purchase_count = inputs.max_purchase_count;
                const data = await gumroadRequest('POST', `/products/${inputs.productId}/offer_codes`, access_token, body);
                return { output: { offer_code: data.offer_code } };
            }

            case 'listOfferCodes': {
                if (!inputs.productId) return { error: 'Missing required input: productId' };
                const data = await gumroadRequest('GET', `/products/${inputs.productId}/offer_codes`, access_token);
                return { output: { offer_codes: data.offer_codes ?? [] } };
            }

            case 'getUser': {
                const data = await gumroadRequest('GET', '/user', access_token);
                return { output: { user: data.user } };
            }

            default:
                return { error: `Gumroad action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        logger.log(`Gumroad action error [${actionName}]: ${err?.message}`);
        return { error: err?.message ?? 'Unknown Gumroad error' };
    }
}
