'use server';

export async function executeOpenCartApiAction(actionName: string, inputs: any, user: any, logger: any) {
    const storeUrl = (inputs.storeUrl || '').replace(/\/$/, '');
    const baseUrl = `${storeUrl}/index.php?route=api`;
    const apiKey = inputs.apiKey || '';

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'listProducts': {
                const params = new URLSearchParams({
                    key: apiKey,
                    page: String(inputs.page || 1),
                    limit: String(inputs.limit || 20),
                    ...(inputs.search ? { search: inputs.search } : {}),
                });
                const res = await fetch(`${baseUrl}/product/products&${params}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to list products' };
                return { output: { products: data } };
            }

            case 'getProduct': {
                const params = new URLSearchParams({ key: apiKey, product_id: String(inputs.productId) });
                const res = await fetch(`${baseUrl}/product/product&${params}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to get product' };
                return { output: { product: data } };
            }

            case 'createProduct': {
                const body = {
                    key: apiKey,
                    name: inputs.name,
                    price: inputs.price || 0,
                    quantity: inputs.quantity || 0,
                    status: inputs.status !== undefined ? inputs.status : 1,
                    ...(inputs.description ? { description: inputs.description } : {}),
                    ...(inputs.model ? { model: inputs.model } : {}),
                    ...(inputs.sku ? { sku: inputs.sku } : {}),
                };
                const res = await fetch(`${baseUrl}/product/add`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to create product' };
                return { output: { product: data } };
            }

            case 'updateProduct': {
                const body: Record<string, any> = {
                    key: apiKey,
                    product_id: inputs.productId,
                    ...(inputs.name ? { name: inputs.name } : {}),
                    ...(inputs.price !== undefined ? { price: inputs.price } : {}),
                    ...(inputs.quantity !== undefined ? { quantity: inputs.quantity } : {}),
                    ...(inputs.status !== undefined ? { status: inputs.status } : {}),
                };
                const res = await fetch(`${baseUrl}/product/edit`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to update product' };
                return { output: { product: data } };
            }

            case 'listOrders': {
                const params = new URLSearchParams({
                    key: apiKey,
                    page: String(inputs.page || 1),
                    limit: String(inputs.limit || 20),
                    ...(inputs.orderStatusId ? { order_status_id: String(inputs.orderStatusId) } : {}),
                });
                const res = await fetch(`${baseUrl}/order/orders&${params}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to list orders' };
                return { output: { orders: data } };
            }

            case 'getOrder': {
                const params = new URLSearchParams({ key: apiKey, order_id: String(inputs.orderId) });
                const res = await fetch(`${baseUrl}/order/order&${params}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to get order' };
                return { output: { order: data } };
            }

            case 'createOrder': {
                const body: Record<string, any> = {
                    key: apiKey,
                    customer_id: inputs.customerId || 0,
                    order_status_id: inputs.orderStatusId || 1,
                    ...(inputs.products ? { products: inputs.products } : {}),
                    ...(inputs.payment ? { payment: inputs.payment } : {}),
                    ...(inputs.shipping ? { shipping: inputs.shipping } : {}),
                };
                const res = await fetch(`${baseUrl}/order/add`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to create order' };
                return { output: { order: data } };
            }

            case 'listCustomers': {
                const params = new URLSearchParams({
                    key: apiKey,
                    page: String(inputs.page || 1),
                    limit: String(inputs.limit || 20),
                    ...(inputs.search ? { search: inputs.search } : {}),
                });
                const res = await fetch(`${baseUrl}/customer/customers&${params}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to list customers' };
                return { output: { customers: data } };
            }

            case 'getCustomer': {
                const params = new URLSearchParams({ key: apiKey, customer_id: String(inputs.customerId) });
                const res = await fetch(`${baseUrl}/customer/customer&${params}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to get customer' };
                return { output: { customer: data } };
            }

            case 'createCustomer': {
                const body: Record<string, any> = {
                    key: apiKey,
                    firstname: inputs.firstName || '',
                    lastname: inputs.lastName || '',
                    email: inputs.email,
                    telephone: inputs.telephone || '',
                    ...(inputs.password ? { password: inputs.password } : {}),
                };
                const res = await fetch(`${baseUrl}/customer/add`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to create customer' };
                return { output: { customer: data } };
            }

            case 'listCategories': {
                const params = new URLSearchParams({
                    key: apiKey,
                    page: String(inputs.page || 1),
                    limit: String(inputs.limit || 20),
                    ...(inputs.parentId ? { parent_id: String(inputs.parentId) } : {}),
                });
                const res = await fetch(`${baseUrl}/catalog/categories&${params}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to list categories' };
                return { output: { categories: data } };
            }

            case 'getCategory': {
                const params = new URLSearchParams({ key: apiKey, category_id: String(inputs.categoryId) });
                const res = await fetch(`${baseUrl}/catalog/category&${params}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to get category' };
                return { output: { category: data } };
            }

            case 'listManufacturers': {
                const params = new URLSearchParams({
                    key: apiKey,
                    page: String(inputs.page || 1),
                    limit: String(inputs.limit || 20),
                });
                const res = await fetch(`${baseUrl}/catalog/manufacturers&${params}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to list manufacturers' };
                return { output: { manufacturers: data } };
            }

            case 'listCoupons': {
                const params = new URLSearchParams({
                    key: apiKey,
                    page: String(inputs.page || 1),
                    limit: String(inputs.limit || 20),
                });
                const res = await fetch(`${baseUrl}/marketing/coupons&${params}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to list coupons' };
                return { output: { coupons: data } };
            }

            case 'getStock': {
                const params = new URLSearchParams({ key: apiKey, product_id: String(inputs.productId) });
                const res = await fetch(`${baseUrl}/product/stock&${params}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to get stock' };
                return { output: { stock: data } };
            }

            default:
                return { error: `Unknown OpenCart API action: ${actionName}` };
        }
    } catch (err: any) {
        return { error: err.message || 'OpenCart API action failed' };
    }
}
