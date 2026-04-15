'use server';

export async function executeWooCommerceApiAction(actionName: string, inputs: any, user: any, logger: any) {
    const storeUrl = (inputs.storeUrl || '').replace(/\/$/, '');
    const baseUrl = `${storeUrl}/wp-json/wc/v3`;
    const basicAuth = Buffer.from(`${inputs.consumerKey || ''}:${inputs.consumerSecret || ''}`).toString('base64');

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${basicAuth}`,
    };

    try {
        switch (actionName) {
            case 'listProducts': {
                const params = new URLSearchParams({
                    page: String(inputs.page || 1),
                    per_page: String(inputs.perPage || 20),
                    ...(inputs.status ? { status: inputs.status } : {}),
                });
                const res = await fetch(`${baseUrl}/products?${params}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list products' };
                return { output: { products: data } };
            }

            case 'getProduct': {
                const res = await fetch(`${baseUrl}/products/${inputs.productId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get product' };
                return { output: { product: data } };
            }

            case 'createProduct': {
                const body: Record<string, any> = {
                    name: inputs.name,
                    type: inputs.type || 'simple',
                    status: inputs.status || 'publish',
                    ...(inputs.regularPrice !== undefined ? { regular_price: String(inputs.regularPrice) } : {}),
                    ...(inputs.description ? { description: inputs.description } : {}),
                    ...(inputs.shortDescription ? { short_description: inputs.shortDescription } : {}),
                    ...(inputs.sku ? { sku: inputs.sku } : {}),
                    ...(inputs.stockQuantity !== undefined ? { stock_quantity: inputs.stockQuantity } : {}),
                    ...(inputs.categories ? { categories: inputs.categories } : {}),
                };
                const res = await fetch(`${baseUrl}/products`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create product' };
                return { output: { product: data } };
            }

            case 'updateProduct': {
                const body: Record<string, any> = {
                    ...(inputs.name ? { name: inputs.name } : {}),
                    ...(inputs.status ? { status: inputs.status } : {}),
                    ...(inputs.regularPrice !== undefined ? { regular_price: String(inputs.regularPrice) } : {}),
                    ...(inputs.description ? { description: inputs.description } : {}),
                    ...(inputs.stockQuantity !== undefined ? { stock_quantity: inputs.stockQuantity } : {}),
                };
                const res = await fetch(`${baseUrl}/products/${inputs.productId}`, { method: 'PUT', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to update product' };
                return { output: { product: data } };
            }

            case 'deleteProduct': {
                const params = new URLSearchParams({ force: String(inputs.force || false) });
                const res = await fetch(`${baseUrl}/products/${inputs.productId}?${params}`, { method: 'DELETE', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to delete product' };
                return { output: { deleted: true, product: data } };
            }

            case 'listOrders': {
                const params = new URLSearchParams({
                    page: String(inputs.page || 1),
                    per_page: String(inputs.perPage || 20),
                    ...(inputs.status ? { status: inputs.status } : {}),
                    ...(inputs.customerId ? { customer: String(inputs.customerId) } : {}),
                });
                const res = await fetch(`${baseUrl}/orders?${params}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list orders' };
                return { output: { orders: data } };
            }

            case 'getOrder': {
                const res = await fetch(`${baseUrl}/orders/${inputs.orderId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get order' };
                return { output: { order: data } };
            }

            case 'createOrder': {
                const body: Record<string, any> = {
                    status: inputs.status || 'pending',
                    ...(inputs.customerId ? { customer_id: inputs.customerId } : {}),
                    ...(inputs.lineItems ? { line_items: inputs.lineItems } : {}),
                    ...(inputs.billing ? { billing: inputs.billing } : {}),
                    ...(inputs.shipping ? { shipping: inputs.shipping } : {}),
                    ...(inputs.paymentMethod ? { payment_method: inputs.paymentMethod } : {}),
                };
                const res = await fetch(`${baseUrl}/orders`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create order' };
                return { output: { order: data } };
            }

            case 'updateOrder': {
                const body: Record<string, any> = {
                    ...(inputs.status ? { status: inputs.status } : {}),
                    ...(inputs.billing ? { billing: inputs.billing } : {}),
                    ...(inputs.shipping ? { shipping: inputs.shipping } : {}),
                };
                const res = await fetch(`${baseUrl}/orders/${inputs.orderId}`, { method: 'PUT', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to update order' };
                return { output: { order: data } };
            }

            case 'deleteOrder': {
                const params = new URLSearchParams({ force: String(inputs.force || false) });
                const res = await fetch(`${baseUrl}/orders/${inputs.orderId}?${params}`, { method: 'DELETE', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to delete order' };
                return { output: { deleted: true, order: data } };
            }

            case 'listCustomers': {
                const params = new URLSearchParams({
                    page: String(inputs.page || 1),
                    per_page: String(inputs.perPage || 20),
                    ...(inputs.role ? { role: inputs.role } : {}),
                    ...(inputs.search ? { search: inputs.search } : {}),
                });
                const res = await fetch(`${baseUrl}/customers?${params}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list customers' };
                return { output: { customers: data } };
            }

            case 'getCustomer': {
                const res = await fetch(`${baseUrl}/customers/${inputs.customerId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get customer' };
                return { output: { customer: data } };
            }

            case 'createCustomer': {
                const body: Record<string, any> = {
                    email: inputs.email,
                    ...(inputs.firstName ? { first_name: inputs.firstName } : {}),
                    ...(inputs.lastName ? { last_name: inputs.lastName } : {}),
                    ...(inputs.username ? { username: inputs.username } : {}),
                    ...(inputs.password ? { password: inputs.password } : {}),
                    ...(inputs.billing ? { billing: inputs.billing } : {}),
                    ...(inputs.shipping ? { shipping: inputs.shipping } : {}),
                };
                const res = await fetch(`${baseUrl}/customers`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create customer' };
                return { output: { customer: data } };
            }

            case 'listCoupons': {
                const params = new URLSearchParams({
                    page: String(inputs.page || 1),
                    per_page: String(inputs.perPage || 20),
                    ...(inputs.code ? { code: inputs.code } : {}),
                });
                const res = await fetch(`${baseUrl}/coupons?${params}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list coupons' };
                return { output: { coupons: data } };
            }

            case 'getCoupon': {
                const res = await fetch(`${baseUrl}/coupons/${inputs.couponId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get coupon' };
                return { output: { coupon: data } };
            }

            default:
                return { error: `Unknown WooCommerce API action: ${actionName}` };
        }
    } catch (err: any) {
        return { error: err.message || 'WooCommerce API action failed' };
    }
}
