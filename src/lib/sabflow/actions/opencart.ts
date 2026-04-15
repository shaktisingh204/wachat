'use server';

export async function executeOpencartAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const siteUrl = (inputs.siteUrl || '').replace(/\/$/, '');
        const apiKey = inputs.apiKey || inputs.key;
        const session = inputs.session || '';

        const ocFetch = async (route: string, method = 'GET', body?: Record<string, string>) => {
            const url = `${siteUrl}/index.php?route=api/${route}`;
            const headers: Record<string, string> = {
                'X-Oc-Merchant-Id': apiKey,
            };
            if (session) {
                headers['X-Oc-Session'] = session;
                headers['Cookie'] = `OCSESSID=${session}`;
            }

            let res: Response;
            if (method === 'POST' && body) {
                const form = new URLSearchParams(body);
                headers['Content-Type'] = 'application/x-www-form-urlencoded';
                res = await fetch(url, { method: 'POST', headers, body: form.toString() });
            } else {
                res = await fetch(url, { method, headers });
            }

            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) throw new Error(data?.error || data?.message || `OpenCart API error: ${res.status}`);
            return data;
        };

        switch (actionName) {
            case 'login': {
                const data = await ocFetch('login', 'POST', { key: apiKey });
                return { output: { session: data.session, apiToken: data.api_token, success: data.success } };
            }
            case 'listProducts': {
                const data = await ocFetch(`catalog/product&limit=${inputs.limit || 20}&start=${inputs.start || 0}`);
                return { output: { products: data.products || data } };
            }
            case 'getProduct': {
                const data = await ocFetch(`catalog/product/info&product_id=${inputs.productId}`);
                return { output: { product: data.product || data } };
            }
            case 'addProduct': {
                const body: Record<string, string> = {
                    'product_description[1][name]': inputs.name,
                    'product_description[1][description]': inputs.description || '',
                    'model': inputs.model || '',
                    'price': inputs.price || '0',
                    'quantity': inputs.quantity || '0',
                    'status': inputs.status || '1',
                };
                const data = await ocFetch('catalog/product/add', 'POST', body);
                return { output: { productId: data.product_id, success: data.success } };
            }
            case 'updateProduct': {
                const body: Record<string, string> = {
                    'product_id': inputs.productId,
                    'price': inputs.price,
                    'quantity': inputs.quantity,
                    'status': inputs.status,
                };
                const data = await ocFetch('catalog/product/edit', 'POST', body);
                return { output: { success: data.success } };
            }
            case 'deleteProduct': {
                const data = await ocFetch('catalog/product/delete', 'POST', { product_id: inputs.productId });
                return { output: { success: data.success } };
            }
            case 'listOrders': {
                const data = await ocFetch(`sale/order&limit=${inputs.limit || 20}&start=${inputs.start || 0}`);
                return { output: { orders: data.orders || data } };
            }
            case 'getOrder': {
                const data = await ocFetch(`sale/order/info&order_id=${inputs.orderId}`);
                return { output: { order: data.order || data } };
            }
            case 'addOrder': {
                const body: Record<string, string> = {
                    payment_firstname: inputs.paymentFirstname || '',
                    payment_lastname: inputs.paymentLastname || '',
                    payment_email: inputs.email || '',
                    payment_telephone: inputs.phone || '',
                    payment_method: inputs.paymentMethod || 'Cash On Delivery',
                    shipping_method: inputs.shippingMethod || 'Flat Shipping Rate',
                    comment: inputs.comment || '',
                    total: inputs.total || '0',
                };
                const data = await ocFetch('sale/order/add', 'POST', body);
                return { output: { orderId: data.order_id, success: data.success } };
            }
            case 'updateOrder': {
                const data = await ocFetch('sale/order/edit', 'POST', {
                    order_id: inputs.orderId,
                    order_status_id: inputs.orderStatusId || '1',
                    comment: inputs.comment || '',
                    notify: inputs.notify || '0',
                });
                return { output: { success: data.success } };
            }
            case 'listCustomers': {
                const data = await ocFetch(`customer/customer&limit=${inputs.limit || 20}&start=${inputs.start || 0}`);
                return { output: { customers: data.customers || data } };
            }
            case 'addCustomer': {
                const data = await ocFetch('customer/customer/add', 'POST', {
                    firstname: inputs.firstName || '',
                    lastname: inputs.lastName || '',
                    email: inputs.email || '',
                    telephone: inputs.phone || '',
                    password: inputs.password || '',
                    customer_group_id: inputs.customerGroupId || '1',
                    status: inputs.status || '1',
                });
                return { output: { customerId: data.customer_id, success: data.success } };
            }
            case 'getCart': {
                const data = await ocFetch('cart/cart');
                return { output: { products: data.products || [], totals: data.totals || [] } };
            }
            case 'addToCart': {
                const data = await ocFetch('cart/cart/add', 'POST', {
                    product_id: inputs.productId,
                    quantity: inputs.quantity || '1',
                });
                return { output: { success: data.success } };
            }
            case 'listCategories': {
                const data = await ocFetch(`catalog/category&limit=${inputs.limit || 50}&start=${inputs.start || 0}`);
                return { output: { categories: data.categories || data } };
            }
            default:
                logger.log(`OpenCart: unknown action "${actionName}"`);
                return { error: `Unknown OpenCart action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`OpenCart action error: ${err.message}`);
        return { error: err.message || 'OpenCart action failed' };
    }
}
