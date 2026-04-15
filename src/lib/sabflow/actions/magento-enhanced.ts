'use server';

export async function executeMagentoEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        const baseUrl = String(inputs.baseUrl ?? '').trim().replace(/\/$/, '');
        if (!accessToken || !baseUrl) throw new Error('accessToken and baseUrl are required.');

        const apiBase = `${baseUrl}/rest/V1`;
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };

        const get = async (path: string) => {
            const res = await fetch(`${apiBase}${path}`, { method: 'GET', headers });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.message || `Magento API error: ${res.status}`);
            return data;
        };

        const post = async (path: string, body: any) => {
            const res = await fetch(`${apiBase}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.message || `Magento API error: ${res.status}`);
            return data;
        };

        const put = async (path: string, body: any) => {
            const res = await fetch(`${apiBase}${path}`, { method: 'PUT', headers, body: JSON.stringify(body) });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.message || `Magento API error: ${res.status}`);
            return data;
        };

        const del = async (path: string) => {
            const res = await fetch(`${apiBase}${path}`, { method: 'DELETE', headers });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.message || `Magento API error: ${res.status}`);
            }
            return { success: true };
        };

        switch (actionName) {
            case 'listProducts': {
                const pageSize = inputs.pageSize ?? 20;
                const currentPage = inputs.currentPage ?? 1;
                const data = await get(`/products?searchCriteria[pageSize]=${pageSize}&searchCriteria[currentPage]=${currentPage}`);
                return { output: data };
            }
            case 'getProduct': {
                const sku = String(inputs.sku ?? '').trim();
                if (!sku) throw new Error('sku is required.');
                const data = await get(`/products/${encodeURIComponent(sku)}`);
                return { output: data };
            }
            case 'createProduct': {
                const product = inputs.product;
                if (!product) throw new Error('product object is required.');
                const data = await post('/products', { product });
                return { output: data };
            }
            case 'updateProduct': {
                const sku = String(inputs.sku ?? '').trim();
                if (!sku) throw new Error('sku is required.');
                const product = inputs.product;
                if (!product) throw new Error('product object is required.');
                const data = await put(`/products/${encodeURIComponent(sku)}`, { product });
                return { output: data };
            }
            case 'deleteProduct': {
                const sku = String(inputs.sku ?? '').trim();
                if (!sku) throw new Error('sku is required.');
                const data = await del(`/products/${encodeURIComponent(sku)}`);
                return { output: data };
            }
            case 'listOrders': {
                const pageSize = inputs.pageSize ?? 20;
                const currentPage = inputs.currentPage ?? 1;
                const data = await get(`/orders?searchCriteria[pageSize]=${pageSize}&searchCriteria[currentPage]=${currentPage}`);
                return { output: data };
            }
            case 'getOrder': {
                const orderId = String(inputs.orderId ?? '').trim();
                if (!orderId) throw new Error('orderId is required.');
                const data = await get(`/orders/${orderId}`);
                return { output: data };
            }
            case 'listCustomers': {
                const pageSize = inputs.pageSize ?? 20;
                const currentPage = inputs.currentPage ?? 1;
                const data = await get(`/customers/search?searchCriteria[pageSize]=${pageSize}&searchCriteria[currentPage]=${currentPage}`);
                return { output: data };
            }
            case 'getCustomer': {
                const customerId = String(inputs.customerId ?? '').trim();
                if (!customerId) throw new Error('customerId is required.');
                const data = await get(`/customers/${customerId}`);
                return { output: data };
            }
            case 'createCustomer': {
                const customer = inputs.customer;
                if (!customer) throw new Error('customer object is required.');
                const data = await post('/customers', { customer });
                return { output: data };
            }
            case 'listCategories': {
                const data = await get('/categories/list?searchCriteria[pageSize]=50');
                return { output: data };
            }
            case 'getCategory': {
                const categoryId = String(inputs.categoryId ?? '').trim();
                if (!categoryId) throw new Error('categoryId is required.');
                const data = await get(`/categories/${categoryId}`);
                return { output: data };
            }
            case 'listInventory': {
                const skus = inputs.skus;
                if (!skus) throw new Error('skus (comma-separated or array) is required.');
                const skuList = Array.isArray(skus) ? skus : String(skus).split(',').map((s: string) => s.trim());
                const results = await Promise.all(
                    skuList.map((sku: string) => get(`/stockItems/${encodeURIComponent(sku)}`).catch((e: Error) => ({ sku, error: e.message })))
                );
                return { output: { items: results } };
            }
            case 'updateInventory': {
                const sku = String(inputs.sku ?? '').trim();
                const stockItem = inputs.stockItem;
                if (!sku || !stockItem) throw new Error('sku and stockItem are required.');
                const data = await put(`/products/${encodeURIComponent(sku)}/stockItems/1`, { stockItem });
                return { output: data };
            }
            case 'listCoupons': {
                const ruleId = String(inputs.ruleId ?? '').trim();
                if (!ruleId) throw new Error('ruleId is required.');
                const data = await get(`/coupons/search?searchCriteria[filterGroups][0][filters][0][field]=rule_id&searchCriteria[filterGroups][0][filters][0][value]=${ruleId}`);
                return { output: data };
            }
            default:
                throw new Error(`Unknown Magento Enhanced action: ${actionName}`);
        }
    } catch (err: any) {
        logger.log(`[MagentoEnhanced] Error: ${err.message}`);
        return { error: err.message };
    }
}
