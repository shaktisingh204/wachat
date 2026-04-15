'use server';

export async function executeXoxodayAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const { accessToken, apiKey } = inputs;

        if (!accessToken) return { error: 'Xoxoday: accessToken is required.' };
        if (!apiKey) return { error: 'Xoxoday: apiKey is required.' };

        const base = 'https://api.xoxoday.com/storefront/v1';
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${accessToken}`,
            'X-Api-Key': apiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };

        async function get(path: string): Promise<any> {
            const res = await fetch(`${base}${path}`, { method: 'GET', headers });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) throw new Error(data?.message || data?.error || JSON.stringify(data) || `Xoxoday error: ${res.status}`);
            return data;
        }

        async function post(path: string, body: any): Promise<any> {
            const res = await fetch(`${base}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) throw new Error(data?.message || data?.error || JSON.stringify(data) || `Xoxoday error: ${res.status}`);
            return data;
        }

        logger.log(`Executing Xoxoday action: ${actionName}`, { inputs });

        switch (actionName) {
            case 'getVouchers': {
                const { limit, type } = inputs;
                const qs = new URLSearchParams();
                if (limit) qs.set('limit', String(limit));
                if (type) qs.set('type', type);
                const data = await get(`/vouchers${qs.toString() ? '?' + qs.toString() : ''}`);
                return { output: data };
            }

            case 'getVoucher': {
                const { voucherId } = inputs;
                if (!voucherId) return { error: 'Xoxoday getVoucher: voucherId is required.' };
                const data = await get(`/vouchers/${voucherId}`);
                return { output: data };
            }

            case 'placeOrder': {
                const { products, userInfo } = inputs;
                if (!products) return { error: 'Xoxoday placeOrder: products is required.' };
                const data = await post('/orders', { products, userInfo });
                return { output: data };
            }

            case 'getOrder': {
                const { orderId } = inputs;
                if (!orderId) return { error: 'Xoxoday getOrder: orderId is required.' };
                const data = await get(`/orders/${orderId}`);
                return { output: data };
            }

            case 'listOrders': {
                const data = await get('/orders');
                return { output: data };
            }

            case 'getBalance': {
                const data = await get('/wallet/balance');
                return { output: data };
            }

            case 'addBalance': {
                const { amount, currency } = inputs;
                if (!amount) return { error: 'Xoxoday addBalance: amount is required.' };
                const data = await post('/wallet/add', { amount, currency });
                return { output: data };
            }

            case 'listRewards': {
                const data = await get('/rewards');
                return { output: data };
            }

            case 'sendReward': {
                const { email, rewardId, amount, note } = inputs;
                if (!email) return { error: 'Xoxoday sendReward: email is required.' };
                if (!rewardId) return { error: 'Xoxoday sendReward: rewardId is required.' };
                if (!amount) return { error: 'Xoxoday sendReward: amount is required.' };
                const data = await post('/rewards/send', { to: { email }, rewardId, amount, note });
                return { output: data };
            }

            case 'listCampaigns': {
                const data = await get('/campaigns');
                return { output: data };
            }

            case 'createCampaign': {
                const { name, budget, startDate, endDate, ...rest } = inputs;
                if (!name) return { error: 'Xoxoday createCampaign: name is required.' };
                const data = await post('/campaigns', { name, budget, startDate, endDate, ...rest });
                return { output: data };
            }

            case 'getRedemptions': {
                const data = await get('/redemptions');
                return { output: data };
            }

            case 'listCategories': {
                const data = await get('/categories');
                return { output: data };
            }

            case 'searchProducts': {
                const { q, categoryId } = inputs;
                const qs = new URLSearchParams();
                if (q) qs.set('search', q);
                if (categoryId) qs.set('categoryId', categoryId);
                const data = await get(`/products${qs.toString() ? '?' + qs.toString() : ''}`);
                return { output: data };
            }

            default:
                return { error: `Xoxoday: Unknown action "${actionName}".` };
        }
    } catch (err: any) {
        logger.log(`Xoxoday action error [${actionName}]:`, err?.message ?? err);
        return { error: err?.message ?? 'Xoxoday: An unexpected error occurred.' };
    }
}
