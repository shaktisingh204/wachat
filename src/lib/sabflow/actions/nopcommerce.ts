'use server';

export async function executeNopCommerceAction(actionName: string, inputs: any, user: any, logger: any) {
    const storeUrl = (inputs.storeUrl || '').replace(/\/$/, '');
    const baseUrl = `${storeUrl}/api`;
    const basicAuth = Buffer.from(`${inputs.username || ''}:${inputs.password || ''}`).toString('base64');

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${basicAuth}`,
    };

    try {
        switch (actionName) {
            case 'listProducts': {
                const params = new URLSearchParams({
                    pageIndex: String(inputs.pageIndex || 0),
                    pageSize: String(inputs.pageSize || 20),
                    ...(inputs.keywords ? { keywords: inputs.keywords } : {}),
                    ...(inputs.categoryId ? { categoryId: String(inputs.categoryId) } : {}),
                    ...(inputs.manufacturerId ? { manufacturerId: String(inputs.manufacturerId) } : {}),
                    ...(inputs.published !== undefined ? { published: String(inputs.published) } : {}),
                });
                const res = await fetch(`${baseUrl}/products?${params}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to list products' };
                return { output: { products: data } };
            }

            case 'getProduct': {
                const res = await fetch(`${baseUrl}/products/${inputs.productId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to get product' };
                return { output: { product: data } };
            }

            case 'createProduct': {
                const body: Record<string, any> = {
                    name: inputs.name,
                    ...(inputs.shortDescription ? { shortDescription: inputs.shortDescription } : {}),
                    ...(inputs.fullDescription ? { fullDescription: inputs.fullDescription } : {}),
                    ...(inputs.price !== undefined ? { price: inputs.price } : {}),
                    ...(inputs.sku ? { sku: inputs.sku } : {}),
                    ...(inputs.stockQuantity !== undefined ? { stockQuantity: inputs.stockQuantity } : {}),
                    published: inputs.published !== undefined ? inputs.published : true,
                    ...(inputs.vendorId ? { vendorId: inputs.vendorId } : {}),
                };
                const res = await fetch(`${baseUrl}/products`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to create product' };
                return { output: { product: data } };
            }

            case 'updateProduct': {
                const body: Record<string, any> = {
                    id: inputs.productId,
                    ...(inputs.name ? { name: inputs.name } : {}),
                    ...(inputs.price !== undefined ? { price: inputs.price } : {}),
                    ...(inputs.sku ? { sku: inputs.sku } : {}),
                    ...(inputs.stockQuantity !== undefined ? { stockQuantity: inputs.stockQuantity } : {}),
                    ...(inputs.published !== undefined ? { published: inputs.published } : {}),
                };
                const res = await fetch(`${baseUrl}/products/${inputs.productId}`, { method: 'PUT', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to update product' };
                return { output: { product: data } };
            }

            case 'deleteProduct': {
                const res = await fetch(`${baseUrl}/products/${inputs.productId}`, { method: 'DELETE', headers });
                if (res.status === 204) return { output: { deleted: true, productId: inputs.productId } };
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to delete product' };
                return { output: { deleted: true } };
            }

            case 'listOrders': {
                const params = new URLSearchParams({
                    pageIndex: String(inputs.pageIndex || 0),
                    pageSize: String(inputs.pageSize || 20),
                    ...(inputs.customerId ? { customerId: String(inputs.customerId) } : {}),
                    ...(inputs.orderStatusId ? { orderStatusId: String(inputs.orderStatusId) } : {}),
                    ...(inputs.paymentStatusId ? { paymentStatusId: String(inputs.paymentStatusId) } : {}),
                });
                const res = await fetch(`${baseUrl}/orders?${params}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to list orders' };
                return { output: { orders: data } };
            }

            case 'getOrder': {
                const res = await fetch(`${baseUrl}/orders/${inputs.orderId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to get order' };
                return { output: { order: data } };
            }

            case 'createOrder': {
                const body: Record<string, any> = {
                    customerId: inputs.customerId || 0,
                    orderStatusId: inputs.orderStatusId || 1,
                    ...(inputs.billingAddress ? { billingAddress: inputs.billingAddress } : {}),
                    ...(inputs.shippingAddress ? { shippingAddress: inputs.shippingAddress } : {}),
                    ...(inputs.orderItems ? { orderItems: inputs.orderItems } : {}),
                    ...(inputs.paymentMethodSystemName ? { paymentMethodSystemName: inputs.paymentMethodSystemName } : {}),
                };
                const res = await fetch(`${baseUrl}/orders`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to create order' };
                return { output: { order: data } };
            }

            case 'listCustomers': {
                const params = new URLSearchParams({
                    pageIndex: String(inputs.pageIndex || 0),
                    pageSize: String(inputs.pageSize || 20),
                    ...(inputs.email ? { email: inputs.email } : {}),
                    ...(inputs.firstName ? { firstName: inputs.firstName } : {}),
                    ...(inputs.lastName ? { lastName: inputs.lastName } : {}),
                });
                const res = await fetch(`${baseUrl}/customers?${params}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to list customers' };
                return { output: { customers: data } };
            }

            case 'getCustomer': {
                const res = await fetch(`${baseUrl}/customers/${inputs.customerId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to get customer' };
                return { output: { customer: data } };
            }

            case 'createCustomer': {
                const body: Record<string, any> = {
                    email: inputs.email,
                    ...(inputs.firstName ? { firstName: inputs.firstName } : {}),
                    ...(inputs.lastName ? { lastName: inputs.lastName } : {}),
                    ...(inputs.username ? { username: inputs.username } : {}),
                    ...(inputs.password ? { password: inputs.password } : {}),
                    active: inputs.active !== undefined ? inputs.active : true,
                };
                const res = await fetch(`${baseUrl}/customers`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to create customer' };
                return { output: { customer: data } };
            }

            case 'listCategories': {
                const params = new URLSearchParams({
                    pageIndex: String(inputs.pageIndex || 0),
                    pageSize: String(inputs.pageSize || 20),
                    ...(inputs.published !== undefined ? { published: String(inputs.published) } : {}),
                });
                const res = await fetch(`${baseUrl}/categories?${params}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to list categories' };
                return { output: { categories: data } };
            }

            case 'getCategory': {
                const res = await fetch(`${baseUrl}/categories/${inputs.categoryId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to get category' };
                return { output: { category: data } };
            }

            case 'listManufacturers': {
                const params = new URLSearchParams({
                    pageIndex: String(inputs.pageIndex || 0),
                    pageSize: String(inputs.pageSize || 20),
                    ...(inputs.name ? { name: inputs.name } : {}),
                    ...(inputs.published !== undefined ? { published: String(inputs.published) } : {}),
                });
                const res = await fetch(`${baseUrl}/manufacturers?${params}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to list manufacturers' };
                return { output: { manufacturers: data } };
            }

            case 'getManufacturer': {
                const res = await fetch(`${baseUrl}/manufacturers/${inputs.manufacturerId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to get manufacturer' };
                return { output: { manufacturer: data } };
            }

            default:
                return { error: `Unknown NopCommerce action: ${actionName}` };
        }
    } catch (err: any) {
        return { error: err.message || 'NopCommerce action failed' };
    }
}
