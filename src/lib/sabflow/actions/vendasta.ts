'use server';

export async function executeVendastaAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');

        const apiBase = 'https://api.vendasta.com';
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };

        const get = async (path: string) => {
            const res = await fetch(`${apiBase}${path}`, { method: 'GET', headers });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.message || data?.error || `Vendasta API error: ${res.status}`);
            return data;
        };

        const post = async (path: string, body: any) => {
            const res = await fetch(`${apiBase}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.message || data?.error || `Vendasta API error: ${res.status}`);
            return data;
        };

        const put = async (path: string, body: any) => {
            const res = await fetch(`${apiBase}${path}`, { method: 'PUT', headers, body: JSON.stringify(body) });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.message || data?.error || `Vendasta API error: ${res.status}`);
            return data;
        };

        const del = async (path: string) => {
            const res = await fetch(`${apiBase}${path}`, { method: 'DELETE', headers });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.message || data?.error || `Vendasta API error: ${res.status}`);
            }
            return { success: true };
        };

        switch (actionName) {
            case 'listAccounts': {
                const pageSize = inputs.pageSize ?? 20;
                const pageToken = inputs.pageToken ? `&pageToken=${encodeURIComponent(inputs.pageToken)}` : '';
                const data = await get(`/account/v1/accounts?pageSize=${pageSize}${pageToken}`);
                return { output: data };
            }
            case 'getAccount': {
                const accountId = String(inputs.accountId ?? '').trim();
                if (!accountId) throw new Error('accountId is required.');
                const data = await get(`/account/v1/accounts/${accountId}`);
                return { output: data };
            }
            case 'createAccount': {
                const account = inputs.account;
                if (!account) throw new Error('account object is required.');
                const data = await post('/account/v1/accounts', account);
                return { output: data };
            }
            case 'updateAccount': {
                const accountId = String(inputs.accountId ?? '').trim();
                if (!accountId) throw new Error('accountId is required.');
                const account = inputs.account;
                if (!account) throw new Error('account object is required.');
                const data = await put(`/account/v1/accounts/${accountId}`, account);
                return { output: data };
            }
            case 'deleteAccount': {
                const accountId = String(inputs.accountId ?? '').trim();
                if (!accountId) throw new Error('accountId is required.');
                const data = await del(`/account/v1/accounts/${accountId}`);
                return { output: data };
            }
            case 'listProducts': {
                const pageSize = inputs.pageSize ?? 20;
                const data = await get(`/product/v1/products?pageSize=${pageSize}`);
                return { output: data };
            }
            case 'getProduct': {
                const productId = String(inputs.productId ?? '').trim();
                if (!productId) throw new Error('productId is required.');
                const data = await get(`/product/v1/products/${productId}`);
                return { output: data };
            }
            case 'listOrders': {
                const pageSize = inputs.pageSize ?? 20;
                const data = await get(`/order/v1/orders?pageSize=${pageSize}`);
                return { output: data };
            }
            case 'getOrder': {
                const orderId = String(inputs.orderId ?? '').trim();
                if (!orderId) throw new Error('orderId is required.');
                const data = await get(`/order/v1/orders/${orderId}`);
                return { output: data };
            }
            case 'createOrder': {
                const order = inputs.order;
                if (!order) throw new Error('order object is required.');
                const data = await post('/order/v1/orders', order);
                return { output: data };
            }
            case 'listUsers': {
                const pageSize = inputs.pageSize ?? 20;
                const data = await get(`/user/v1/users?pageSize=${pageSize}`);
                return { output: data };
            }
            case 'getUser': {
                const userId = String(inputs.userId ?? '').trim();
                if (!userId) throw new Error('userId is required.');
                const data = await get(`/user/v1/users/${userId}`);
                return { output: data };
            }
            case 'createUser': {
                const userObj = inputs.user;
                if (!userObj) throw new Error('user object is required.');
                const data = await post('/user/v1/users', userObj);
                return { output: data };
            }
            case 'listReports': {
                const pageSize = inputs.pageSize ?? 20;
                const data = await get(`/reporting/v1/reports?pageSize=${pageSize}`);
                return { output: data };
            }
            case 'getReport': {
                const reportId = String(inputs.reportId ?? '').trim();
                if (!reportId) throw new Error('reportId is required.');
                const data = await get(`/reporting/v1/reports/${reportId}`);
                return { output: data };
            }
            default:
                throw new Error(`Unknown Vendasta action: ${actionName}`);
        }
    } catch (err: any) {
        logger.log(`[Vendasta] Error: ${err.message}`);
        return { error: err.message };
    }
}
