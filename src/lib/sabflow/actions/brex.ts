'use server';

export async function executeBrexAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const { accessToken } = inputs;
        if (!accessToken) return { error: 'Brex accessToken is required.' };

        const BASE = 'https://platform.brexapis.com';

        const req = async (method: string, path: string, body?: any) => {
            const res = await fetch(`${BASE}${path}`, {
                method,
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                ...(body ? { body: JSON.stringify(body) } : {}),
            });
            const json = await res.json();
            if (!res.ok) {
                throw new Error(json.message || json.error || 'Brex API error');
            }
            return json;
        };

        switch (actionName) {
            case 'listAccounts': {
                const result = await req('GET', '/v2/accounts/cash');
                return { output: result };
            }
            case 'getAccount': {
                const { accountId } = inputs;
                if (!accountId) return { error: 'accountId is required.' };
                const result = await req('GET', `/v2/accounts/cash/${accountId}`);
                return { output: result };
            }
            case 'listTransactions': {
                const { accountId, cursor, limit } = inputs;
                if (!accountId) return { error: 'accountId is required.' };
                const params = new URLSearchParams();
                if (cursor) params.set('cursor', cursor);
                if (limit) params.set('limit', String(limit));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const result = await req('GET', `/v2/accounts/cash/${accountId}/statements${qs}`);
                return { output: result };
            }
            case 'getTransaction': {
                const { accountId, transactionId } = inputs;
                if (!accountId || !transactionId) return { error: 'accountId and transactionId are required.' };
                const result = await req('GET', `/v2/accounts/cash/${accountId}/statements/${transactionId}`);
                return { output: result };
            }
            case 'listCards': {
                const { cursor, limit } = inputs;
                const params = new URLSearchParams();
                if (cursor) params.set('cursor', cursor);
                if (limit) params.set('limit', String(limit));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const result = await req('GET', `/v2/cards${qs}`);
                return { output: result };
            }
            case 'getCard': {
                const { cardId } = inputs;
                if (!cardId) return { error: 'cardId is required.' };
                const result = await req('GET', `/v2/cards/${cardId}`);
                return { output: result };
            }
            case 'createCard': {
                const { employeeId, cardType, displayName, limitAmount, limitCurrency, limitInterval } = inputs;
                if (!employeeId || !cardType) return { error: 'employeeId and cardType are required.' };
                const body: any = { owner: { user_id: employeeId }, card_type: cardType };
                if (displayName) body.display_name = displayName;
                if (limitAmount) {
                    body.limit = {
                        amount: { amount: limitAmount, currency: limitCurrency || 'USD' },
                        limit_type: 'MONTHLY',
                        spend_duration: limitInterval || 'MONTHLY',
                    };
                }
                const result = await req('POST', '/v2/cards', body);
                return { output: result };
            }
            case 'updateCard': {
                const { cardId, displayName, limitAmount, limitCurrency } = inputs;
                if (!cardId) return { error: 'cardId is required.' };
                const body: any = {};
                if (displayName) body.display_name = displayName;
                if (limitAmount) body.limit = { amount: { amount: limitAmount, currency: limitCurrency || 'USD' } };
                const result = await req('PUT', `/v2/cards/${cardId}`, body);
                return { output: result };
            }
            case 'lockCard': {
                const { cardId, reason } = inputs;
                if (!cardId) return { error: 'cardId is required.' };
                const result = await req('POST', `/v2/cards/${cardId}/lock`, { reason: reason || 'CARD_LOST' });
                return { output: result };
            }
            case 'unlockCard': {
                const { cardId } = inputs;
                if (!cardId) return { error: 'cardId is required.' };
                const result = await req('POST', `/v2/cards/${cardId}/unlock`, {});
                return { output: result };
            }
            case 'listVendors': {
                const { cursor, limit } = inputs;
                const params = new URLSearchParams();
                if (cursor) params.set('cursor', cursor);
                if (limit) params.set('limit', String(limit));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const result = await req('GET', `/v2/vendors${qs}`);
                return { output: result };
            }
            case 'createVendor': {
                const { name, email, phone, address } = inputs;
                if (!name) return { error: 'Vendor name is required.' };
                const body: any = { name };
                if (email) body.email = email;
                if (phone) body.phone = phone;
                if (address) body.address = address;
                const result = await req('POST', '/v2/vendors', body);
                return { output: result };
            }
            case 'updateVendor': {
                const { vendorId, name, email } = inputs;
                if (!vendorId) return { error: 'vendorId is required.' };
                const body: any = {};
                if (name) body.name = name;
                if (email) body.email = email;
                const result = await req('PUT', `/v2/vendors/${vendorId}`, body);
                return { output: result };
            }
            case 'listReimbursements': {
                const { cursor, limit } = inputs;
                const params = new URLSearchParams();
                if (cursor) params.set('cursor', cursor);
                if (limit) params.set('limit', String(limit));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const result = await req('GET', `/v2/reimbursements${qs}`);
                return { output: result };
            }
            case 'createReimbursement': {
                const { amount, currency, memo, userId, receiptIds } = inputs;
                if (!amount || !userId) return { error: 'amount and userId are required.' };
                const body: any = {
                    amount: { amount, currency: currency || 'USD' },
                    memo: memo || '',
                    payee: { user_id: userId },
                };
                if (receiptIds) body.receipts = receiptIds;
                const result = await req('POST', '/v2/reimbursements', body);
                return { output: result };
            }
            default:
                logger.log(`Error: Brex action "${actionName}" is not implemented.`);
                return { error: `Brex action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        logger.log(`Brex action error: ${err.message}`);
        return { error: err.message || 'Unknown Brex error.' };
    }
}
