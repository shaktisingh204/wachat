'use server';

export async function executeMercuryAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const { apiKey } = inputs;
        if (!apiKey) return { error: 'Mercury apiKey is required.' };

        const BASE = 'https://backend.mercury.com/api/v1';

        const req = async (method: string, path: string, body?: any) => {
            const res = await fetch(`${BASE}${path}`, {
                method,
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                ...(body ? { body: JSON.stringify(body) } : {}),
            });
            const json = await res.json();
            if (!res.ok) {
                throw new Error(json.message || json.error || 'Mercury API error');
            }
            return json;
        };

        switch (actionName) {
            case 'listAccounts': {
                const result = await req('GET', '/accounts');
                return { output: result };
            }
            case 'getAccount': {
                const { accountId } = inputs;
                if (!accountId) return { error: 'accountId is required.' };
                const result = await req('GET', `/accounts/${accountId}`);
                return { output: result };
            }
            case 'getAccountBalance': {
                const { accountId } = inputs;
                if (!accountId) return { error: 'accountId is required.' };
                const result = await req('GET', `/accounts/${accountId}`);
                return { output: { accountId, availableBalance: result.availableBalance, currentBalance: result.currentBalance, currency: result.currencyType } };
            }
            case 'listTransactions': {
                const { accountId, limit, offset, start, end } = inputs;
                if (!accountId) return { error: 'accountId is required.' };
                const params = new URLSearchParams();
                if (limit) params.set('limit', String(limit));
                if (offset) params.set('offset', String(offset));
                if (start) params.set('start', start);
                if (end) params.set('end', end);
                const qs = params.toString() ? `?${params.toString()}` : '';
                const result = await req('GET', `/account/${accountId}/transactions${qs}`);
                return { output: result };
            }
            case 'getTransaction': {
                const { accountId, transactionId } = inputs;
                if (!accountId || !transactionId) return { error: 'accountId and transactionId are required.' };
                const result = await req('GET', `/account/${accountId}/transactions/${transactionId}`);
                return { output: result };
            }
            case 'listRecipients': {
                const result = await req('GET', '/recipients');
                return { output: result };
            }
            case 'getRecipient': {
                const { recipientId } = inputs;
                if (!recipientId) return { error: 'recipientId is required.' };
                const result = await req('GET', `/recipients/${recipientId}`);
                return { output: result };
            }
            case 'addRecipient': {
                const { name, emails, accountNumber, routingNumber, accountType, address } = inputs;
                if (!name) return { error: 'Recipient name is required.' };
                const body: any = { name };
                if (emails) body.emails = Array.isArray(emails) ? emails : [emails];
                if (accountNumber) body.accountNumber = accountNumber;
                if (routingNumber) body.routingNumber = routingNumber;
                if (accountType) body.accountType = accountType;
                if (address) body.address = address;
                const result = await req('POST', '/recipients', body);
                return { output: result };
            }
            case 'initiatePayment': {
                const { accountId, recipientId, amount, paymentMethod, memo } = inputs;
                if (!accountId || !recipientId || !amount) return { error: 'accountId, recipientId, and amount are required.' };
                const body: any = {
                    recipientId,
                    amount,
                    paymentMethod: paymentMethod || 'ach',
                };
                if (memo) body.memo = memo;
                const result = await req('POST', `/account/${accountId}/transactions`, body);
                return { output: result };
            }
            case 'getPayment': {
                const { accountId, paymentId } = inputs;
                if (!accountId || !paymentId) return { error: 'accountId and paymentId are required.' };
                const result = await req('GET', `/account/${accountId}/transactions/${paymentId}`);
                return { output: result };
            }
            case 'listPayments': {
                const { accountId, status, limit } = inputs;
                if (!accountId) return { error: 'accountId is required.' };
                const params = new URLSearchParams();
                if (status) params.set('status', status);
                if (limit) params.set('limit', String(limit));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const result = await req('GET', `/account/${accountId}/transactions${qs}`);
                return { output: result };
            }
            case 'cancelPayment': {
                const { accountId, transactionId } = inputs;
                if (!accountId || !transactionId) return { error: 'accountId and transactionId are required.' };
                const result = await req('DELETE', `/account/${accountId}/transactions/${transactionId}`);
                return { output: result };
            }
            case 'listChecks': {
                const { accountId } = inputs;
                if (!accountId) return { error: 'accountId is required.' };
                const result = await req('GET', `/account/${accountId}/checks`);
                return { output: result };
            }
            case 'createCheck': {
                const { accountId, recipientName, recipientAddress, amount, memo } = inputs;
                if (!accountId || !recipientName || !amount) return { error: 'accountId, recipientName, and amount are required.' };
                const body: any = { recipientName, amount };
                if (recipientAddress) body.recipientAddress = recipientAddress;
                if (memo) body.memo = memo;
                const result = await req('POST', `/account/${accountId}/checks`, body);
                return { output: result };
            }
            case 'getCheckStatus': {
                const { accountId, checkId } = inputs;
                if (!accountId || !checkId) return { error: 'accountId and checkId are required.' };
                const result = await req('GET', `/account/${accountId}/checks/${checkId}`);
                return { output: result };
            }
            default:
                logger.log(`Error: Mercury action "${actionName}" is not implemented.`);
                return { error: `Mercury action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        logger.log(`Mercury action error: ${err.message}`);
        return { error: err.message || 'Unknown Mercury error.' };
    }
}
