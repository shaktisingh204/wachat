
'use server';

async function magentoFetch(storeUrl: string, accessToken: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Magento] ${method} ${path}`);
    const url = `${storeUrl}/rest/V1${path}`;
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = text; }
    if (!res.ok) {
        throw new Error(data?.message || `Magento API error: ${res.status}`);
    }
    return data;
}

export async function executeMagentoAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const storeUrl = String(inputs.storeUrl ?? '').trim().replace(/\/$/, '');
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!storeUrl || !accessToken) throw new Error('storeUrl and accessToken are required.');
        const mf = (method: string, path: string, body?: any) => magentoFetch(storeUrl, accessToken, method, path, body, logger);

        switch (actionName) {
            case 'listProducts': {
                const pageSize = Number(inputs.pageSize ?? 20);
                const currentPage = Number(inputs.currentPage ?? 1);
                const data = await mf('GET', `/products?searchCriteria[pageSize]=${pageSize}&searchCriteria[currentPage]=${currentPage}`);
                return { output: { items: data.items ?? [], totalCount: data.total_count ?? 0 } };
            }

            case 'getProduct': {
                const sku = String(inputs.sku ?? '').trim();
                if (!sku) throw new Error('sku is required.');
                const data = await mf('GET', `/products/${encodeURIComponent(sku)}`);
                return { output: { id: data.id, sku: data.sku, name: data.name, price: data.price, status: data.status, typeId: data.type_id } };
            }

            case 'createProduct': {
                const sku = String(inputs.sku ?? '').trim();
                const name = String(inputs.name ?? '').trim();
                const price = Number(inputs.price ?? 0);
                const typeId = String(inputs.typeId ?? 'simple');
                const attributeSetId = Number(inputs.attributeSetId ?? 4);
                if (!sku || !name) throw new Error('sku and name are required.');
                const data = await mf('POST', '/products', { product: { sku, name, price, type_id: typeId, attribute_set_id: attributeSetId, status: 1, visibility: 4, weight: Number(inputs.weight ?? 1) } });
                return { output: { id: data.id, sku: data.sku, name: data.name, price: data.price } };
            }

            case 'updateProduct': {
                const sku = String(inputs.sku ?? '').trim();
                if (!sku) throw new Error('sku is required.');
                const body: any = {};
                if (inputs.name) body.name = String(inputs.name);
                if (inputs.price !== undefined) body.price = Number(inputs.price);
                if (inputs.status !== undefined) body.status = Number(inputs.status);
                const data = await mf('PUT', `/products/${encodeURIComponent(sku)}`, { product: body });
                return { output: { id: data.id, sku: data.sku, name: data.name, price: data.price } };
            }

            case 'deleteProduct': {
                const sku = String(inputs.sku ?? '').trim();
                if (!sku) throw new Error('sku is required.');
                const data = await mf('DELETE', `/products/${encodeURIComponent(sku)}`);
                return { output: { success: data === true || data === 'true' || true } };
            }

            case 'listOrders': {
                const pageSize = Number(inputs.pageSize ?? 20);
                const currentPage = Number(inputs.currentPage ?? 1);
                const data = await mf('GET', `/orders?searchCriteria[pageSize]=${pageSize}&searchCriteria[currentPage]=${currentPage}`);
                return { output: { items: data.items ?? [], totalCount: data.total_count ?? 0 } };
            }

            case 'getOrder': {
                const orderId = String(inputs.orderId ?? '').trim();
                if (!orderId) throw new Error('orderId is required.');
                const data = await mf('GET', `/orders/${orderId}`);
                return { output: { id: data.entity_id, status: data.status, state: data.state, grandTotal: data.grand_total, customerEmail: data.customer_email } };
            }

            case 'createOrder': {
                const cartId = String(inputs.cartId ?? '').trim();
                if (!cartId) throw new Error('cartId is required.');
                const data = await mf('PUT', `/carts/${cartId}/order`, { paymentMethod: { method: String(inputs.paymentMethod ?? 'checkmo') } });
                return { output: { orderId: String(data) } };
            }

            case 'updateOrderStatus': {
                const orderId = String(inputs.orderId ?? '').trim();
                const status = String(inputs.status ?? '').trim();
                if (!orderId || !status) throw new Error('orderId and status are required.');
                const data = await mf('POST', `/orders/${orderId}/comments`, { statusHistory: { comment: String(inputs.comment ?? ''), is_customer_notified: 0, is_visible_on_front: 0, parent_id: Number(orderId), status } });
                return { output: { success: true, orderId, status } };
            }

            case 'listCustomers': {
                const pageSize = Number(inputs.pageSize ?? 20);
                const currentPage = Number(inputs.currentPage ?? 1);
                const data = await mf('GET', `/customers/search?searchCriteria[pageSize]=${pageSize}&searchCriteria[currentPage]=${currentPage}`);
                return { output: { items: data.items ?? [], totalCount: data.total_count ?? 0 } };
            }

            case 'getCustomer': {
                const customerId = String(inputs.customerId ?? '').trim();
                if (!customerId) throw new Error('customerId is required.');
                const data = await mf('GET', `/customers/${customerId}`);
                return { output: { id: data.id, email: data.email, firstname: data.firstname, lastname: data.lastname } };
            }

            case 'createCustomer': {
                const email = String(inputs.email ?? '').trim();
                const firstname = String(inputs.firstname ?? '').trim();
                const lastname = String(inputs.lastname ?? '').trim();
                if (!email || !firstname || !lastname) throw new Error('email, firstname, and lastname are required.');
                const data = await mf('POST', '/customers', { customer: { email, firstname, lastname, store_id: Number(inputs.storeId ?? 1), website_id: Number(inputs.websiteId ?? 1) }, password: String(inputs.password ?? '') });
                return { output: { id: data.id, email: data.email, firstname: data.firstname, lastname: data.lastname } };
            }

            case 'listCategories': {
                const data = await mf('GET', '/categories/list?searchCriteria[pageSize]=50');
                return { output: { items: data.items ?? [], totalCount: data.total_count ?? 0 } };
            }

            case 'getCategory': {
                const categoryId = String(inputs.categoryId ?? '').trim();
                if (!categoryId) throw new Error('categoryId is required.');
                const data = await mf('GET', `/categories/${categoryId}`);
                return { output: { id: data.id, name: data.name, parentId: data.parent_id, isActive: data.is_active } };
            }

            case 'listInventory': {
                const sku = String(inputs.sku ?? '').trim();
                if (!sku) throw new Error('sku is required.');
                const data = await mf('GET', `/stockItems/${encodeURIComponent(sku)}`);
                return { output: { qty: data.qty, isInStock: data.is_in_stock, sku: data.product_sku } };
            }

            default:
                throw new Error(`Unsupported Magento action: ${actionName}`);
        }
    } catch (err: any) {
        return { error: err?.message ?? String(err) };
    }
}
