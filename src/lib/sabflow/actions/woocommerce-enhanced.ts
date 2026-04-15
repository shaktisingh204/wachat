'use server';

export async function executeWoocommerceEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const siteUrl = (inputs.siteUrl || '').replace(/\/$/, '');
        const baseUrl = `${siteUrl}/wp-json/wc/v3`;
        const credentials = `${inputs.consumerKey}:${inputs.consumerSecret}`;
        const authHeader = `Basic ${Buffer.from(credentials).toString('base64')}`;

        const wcFetch = async (path: string, method = 'GET', body?: any) => {
            const res = await fetch(`${baseUrl}${path}`, {
                method,
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/json',
                },
                ...(body ? { body: JSON.stringify(body) } : {}),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.message || `WooCommerce API error: ${res.status}`);
            return data;
        };

        switch (actionName) {
            case 'listProducts': {
                const params = new URLSearchParams();
                if (inputs.perPage) params.set('per_page', inputs.perPage);
                if (inputs.page) params.set('page', inputs.page);
                if (inputs.search) params.set('search', inputs.search);
                if (inputs.status) params.set('status', inputs.status);
                const data = await wcFetch(`/products?${params.toString()}`);
                return { output: { products: data } };
            }
            case 'getProduct': {
                const data = await wcFetch(`/products/${inputs.productId}`);
                return { output: { product: data } };
            }
            case 'createProduct': {
                const data = await wcFetch('/products', 'POST', {
                    name: inputs.name,
                    type: inputs.type || 'simple',
                    regular_price: inputs.regularPrice,
                    description: inputs.description,
                    short_description: inputs.shortDescription,
                    sku: inputs.sku,
                    stock_quantity: inputs.stockQuantity,
                    manage_stock: inputs.manageStock,
                    categories: inputs.categories,
                    images: inputs.images,
                    status: inputs.status || 'publish',
                });
                return { output: { product: data } };
            }
            case 'updateProduct': {
                const data = await wcFetch(`/products/${inputs.productId}`, 'PUT', {
                    name: inputs.name,
                    regular_price: inputs.regularPrice,
                    description: inputs.description,
                    short_description: inputs.shortDescription,
                    sku: inputs.sku,
                    stock_quantity: inputs.stockQuantity,
                    manage_stock: inputs.manageStock,
                    categories: inputs.categories,
                    images: inputs.images,
                    status: inputs.status,
                });
                return { output: { product: data } };
            }
            case 'deleteProduct': {
                const data = await wcFetch(`/products/${inputs.productId}?force=${inputs.force || false}`, 'DELETE');
                return { output: { product: data } };
            }
            case 'listOrders': {
                const params = new URLSearchParams();
                if (inputs.perPage) params.set('per_page', inputs.perPage);
                if (inputs.page) params.set('page', inputs.page);
                if (inputs.status) params.set('status', inputs.status);
                if (inputs.customerId) params.set('customer', inputs.customerId);
                const data = await wcFetch(`/orders?${params.toString()}`);
                return { output: { orders: data } };
            }
            case 'getOrder': {
                const data = await wcFetch(`/orders/${inputs.orderId}`);
                return { output: { order: data } };
            }
            case 'createOrder': {
                const data = await wcFetch('/orders', 'POST', {
                    customer_id: inputs.customerId,
                    status: inputs.status || 'pending',
                    line_items: inputs.lineItems,
                    billing: inputs.billing,
                    shipping: inputs.shipping,
                    payment_method: inputs.paymentMethod,
                    payment_method_title: inputs.paymentMethodTitle,
                    set_paid: inputs.setPaid || false,
                });
                return { output: { order: data } };
            }
            case 'updateOrder': {
                const data = await wcFetch(`/orders/${inputs.orderId}`, 'PUT', {
                    status: inputs.status,
                    billing: inputs.billing,
                    shipping: inputs.shipping,
                });
                return { output: { order: data } };
            }
            case 'deleteOrder': {
                const data = await wcFetch(`/orders/${inputs.orderId}?force=${inputs.force || false}`, 'DELETE');
                return { output: { order: data } };
            }
            case 'listCustomers': {
                const params = new URLSearchParams();
                if (inputs.perPage) params.set('per_page', inputs.perPage);
                if (inputs.page) params.set('page', inputs.page);
                if (inputs.search) params.set('search', inputs.search);
                if (inputs.email) params.set('email', inputs.email);
                const data = await wcFetch(`/customers?${params.toString()}`);
                return { output: { customers: data } };
            }
            case 'getCustomer': {
                const data = await wcFetch(`/customers/${inputs.customerId}`);
                return { output: { customer: data } };
            }
            case 'createCustomer': {
                const data = await wcFetch('/customers', 'POST', {
                    email: inputs.email,
                    first_name: inputs.firstName,
                    last_name: inputs.lastName,
                    username: inputs.username,
                    password: inputs.password,
                    billing: inputs.billing,
                    shipping: inputs.shipping,
                });
                return { output: { customer: data } };
            }
            case 'updateCustomer': {
                const data = await wcFetch(`/customers/${inputs.customerId}`, 'PUT', {
                    email: inputs.email,
                    first_name: inputs.firstName,
                    last_name: inputs.lastName,
                    billing: inputs.billing,
                    shipping: inputs.shipping,
                });
                return { output: { customer: data } };
            }
            case 'listCoupons': {
                const params = new URLSearchParams();
                if (inputs.perPage) params.set('per_page', inputs.perPage);
                if (inputs.page) params.set('page', inputs.page);
                if (inputs.search) params.set('search', inputs.search);
                const data = await wcFetch(`/coupons?${params.toString()}`);
                return { output: { coupons: data } };
            }
            default:
                logger.log(`WooCommerce Enhanced: unknown action "${actionName}"`);
                return { error: `Unknown WooCommerce Enhanced action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`WooCommerce Enhanced action error: ${err.message}`);
        return { error: err.message || 'WooCommerce Enhanced action failed' };
    }
}
