
'use server';

async function wooFetch(storeUrl: string, consumerKey: string, consumerSecret: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[WooCommerce] ${method} ${path}`);
    const base64Auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    const url = `${storeUrl.replace(/\/$/, '')}/wp-json/wc/v3${path}`;
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Basic ${base64Auth}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || `WooCommerce API error: ${res.status}`);
    }
    return data;
}

export async function executeWoocommerceAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const storeUrl = String(inputs.storeUrl ?? '').trim();
        const consumerKey = String(inputs.consumerKey ?? '').trim();
        const consumerSecret = String(inputs.consumerSecret ?? '').trim();
        if (!storeUrl || !consumerKey || !consumerSecret) throw new Error('storeUrl, consumerKey, and consumerSecret are required.');
        const woo = (method: string, path: string, body?: any) => wooFetch(storeUrl, consumerKey, consumerSecret, method, path, body, logger);

        switch (actionName) {
            case 'getOrder': {
                const orderId = String(inputs.orderId ?? '').trim();
                if (!orderId) throw new Error('orderId is required.');
                const data = await woo('GET', `/orders/${orderId}`);
                return { output: { id: String(data.id), status: data.status, total: data.total, currency: data.currency, customerEmail: data.billing?.email ?? '' } };
            }

            case 'listOrders': {
                const status = String(inputs.status ?? '').trim();
                const perPage = Number(inputs.perPage ?? 20);
                const query = status ? `?status=${status}&per_page=${perPage}` : `?per_page=${perPage}`;
                const data = await woo('GET', `/orders${query}`);
                return { output: { orders: data ?? [], count: (data ?? []).length } };
            }

            case 'updateOrderStatus': {
                const orderId = String(inputs.orderId ?? '').trim();
                const status = String(inputs.status ?? '').trim();
                if (!orderId || !status) throw new Error('orderId and status are required.');
                const data = await woo('PUT', `/orders/${orderId}`, { status });
                return { output: { id: String(data.id), status: data.status } };
            }

            case 'createOrder': {
                const paymentMethod = String(inputs.paymentMethod ?? 'bacs').trim();
                const lineItems = inputs.lineItems;
                const billingEmail = String(inputs.billingEmail ?? '').trim();
                const lineItemsArr = Array.isArray(lineItems) ? lineItems : (typeof lineItems === 'string' ? JSON.parse(lineItems) : []);
                const body: any = { payment_method: paymentMethod, line_items: lineItemsArr };
                if (billingEmail) body.billing = { email: billingEmail };
                const data = await woo('POST', '/orders', body);
                return { output: { id: String(data.id), status: data.status, total: data.total } };
            }

            case 'getProduct': {
                const productId = String(inputs.productId ?? '').trim();
                if (!productId) throw new Error('productId is required.');
                const data = await woo('GET', `/products/${productId}`);
                return { output: { id: String(data.id), name: data.name, price: data.price, status: data.status, stockQuantity: String(data.stock_quantity ?? '') } };
            }

            case 'listProducts': {
                const perPage = Number(inputs.perPage ?? 20);
                const search = String(inputs.search ?? '').trim();
                const query = search ? `?per_page=${perPage}&search=${encodeURIComponent(search)}` : `?per_page=${perPage}`;
                const data = await woo('GET', `/products${query}`);
                return { output: { products: data ?? [], count: (data ?? []).length } };
            }

            case 'updateProduct': {
                const productId = String(inputs.productId ?? '').trim();
                if (!productId) throw new Error('productId is required.');
                const body: any = {};
                if (inputs.name) body.name = String(inputs.name);
                if (inputs.price) body.regular_price = String(inputs.price);
                if (inputs.status) body.status = String(inputs.status);
                if (inputs.stockQuantity !== undefined) body.stock_quantity = Number(inputs.stockQuantity);
                const data = await woo('PUT', `/products/${productId}`, body);
                return { output: { id: String(data.id), name: data.name, price: data.price } };
            }

            case 'getCustomer': {
                const customerId = String(inputs.customerId ?? '').trim();
                if (!customerId) throw new Error('customerId is required.');
                const data = await woo('GET', `/customers/${customerId}`);
                return { output: { id: String(data.id), email: data.email, firstName: data.first_name, lastName: data.last_name, totalSpent: data.total_spent ?? '0' } };
            }

            case 'listCustomers': {
                const perPage = Number(inputs.perPage ?? 20);
                const search = String(inputs.search ?? '').trim();
                const query = search ? `?per_page=${perPage}&search=${encodeURIComponent(search)}` : `?per_page=${perPage}`;
                const data = await woo('GET', `/customers${query}`);
                return { output: { customers: data ?? [], count: (data ?? []).length } };
            }

            case 'createCoupon': {
                const code = String(inputs.code ?? '').trim();
                const discountType = String(inputs.discountType ?? 'percent').trim();
                const amount = String(inputs.amount ?? '').trim();
                if (!code || !amount) throw new Error('code and amount are required.');
                const data = await woo('POST', '/coupons', { code, discount_type: discountType, amount });
                return { output: { id: String(data.id), code: data.code, amount: data.amount } };
            }

            case 'getReports': {
                const period = String(inputs.period ?? 'week').trim();
                const data = await woo('GET', `/reports/sales?period=${period}`);
                const report = Array.isArray(data) ? data[0] : data;
                return { output: { totalSales: report?.total_sales ?? '0', totalOrders: String(report?.total_orders ?? 0), netSales: report?.net_sales ?? '0' } };
            }

            case 'addProductReview': {
                const productId = String(inputs.productId ?? '').trim();
                const review = String(inputs.review ?? '').trim();
                const reviewer = String(inputs.reviewer ?? '').trim();
                const reviewerEmail = String(inputs.reviewerEmail ?? '').trim();
                const rating = Number(inputs.rating ?? 5);
                if (!productId || !review || !reviewer || !reviewerEmail) throw new Error('productId, review, reviewer, and reviewerEmail are required.');
                const data = await woo('POST', '/products/reviews', { product_id: Number(productId), review, reviewer, reviewer_email: reviewerEmail, rating });
                return { output: { id: String(data.id), status: data.status } };
            }

            default:
                return { error: `WooCommerce action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'WooCommerce action failed.' };
    }
}
