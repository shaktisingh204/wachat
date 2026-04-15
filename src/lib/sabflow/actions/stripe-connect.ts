'use server';

export async function executeStripeConnectAction(actionName: string, inputs: any, user: any, logger: any) {
    const secretKey = inputs.secretKey;
    const baseUrl = 'https://api.stripe.com/v1';
    const headers: Record<string, string> = {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
    };

    try {
        switch (actionName) {
            case 'createAccount': {
                const body = new URLSearchParams();
                if (inputs.type) body.append('type', inputs.type);
                if (inputs.country) body.append('country', inputs.country);
                if (inputs.email) body.append('email', inputs.email);
                const res = await fetch(`${baseUrl}/accounts`, { method: 'POST', headers, body: body.toString() });
                const data = await res.json();
                if (!res.ok) return { error: data?.error?.message || 'createAccount failed' };
                return { output: data };
            }
            case 'getAccount': {
                const accountId = inputs.accountId;
                const res = await fetch(`${baseUrl}/accounts/${accountId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.error?.message || 'getAccount failed' };
                return { output: data };
            }
            case 'updateAccount': {
                const accountId = inputs.accountId;
                const body = new URLSearchParams();
                if (inputs.email) body.append('email', inputs.email);
                if (inputs.businessType) body.append('business_type', inputs.businessType);
                const res = await fetch(`${baseUrl}/accounts/${accountId}`, { method: 'POST', headers, body: body.toString() });
                const data = await res.json();
                if (!res.ok) return { error: data?.error?.message || 'updateAccount failed' };
                return { output: data };
            }
            case 'deleteAccount': {
                const accountId = inputs.accountId;
                const res = await fetch(`${baseUrl}/accounts/${accountId}`, { method: 'DELETE', headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.error?.message || 'deleteAccount failed' };
                return { output: data };
            }
            case 'listAccounts': {
                const params = new URLSearchParams();
                if (inputs.limit) params.append('limit', inputs.limit);
                if (inputs.startingAfter) params.append('starting_after', inputs.startingAfter);
                const res = await fetch(`${baseUrl}/accounts?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.error?.message || 'listAccounts failed' };
                return { output: data };
            }
            case 'createAccountLink': {
                const body = new URLSearchParams();
                body.append('account', inputs.account);
                body.append('refresh_url', inputs.refreshUrl);
                body.append('return_url', inputs.returnUrl);
                body.append('type', inputs.type || 'account_onboarding');
                const res = await fetch(`${baseUrl}/account_links`, { method: 'POST', headers, body: body.toString() });
                const data = await res.json();
                if (!res.ok) return { error: data?.error?.message || 'createAccountLink failed' };
                return { output: data };
            }
            case 'createLoginLink': {
                const accountId = inputs.accountId;
                const res = await fetch(`${baseUrl}/accounts/${accountId}/login_links`, { method: 'POST', headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.error?.message || 'createLoginLink failed' };
                return { output: data };
            }
            case 'listTransfers': {
                const params = new URLSearchParams();
                if (inputs.destination) params.append('destination', inputs.destination);
                if (inputs.limit) params.append('limit', inputs.limit);
                if (inputs.startingAfter) params.append('starting_after', inputs.startingAfter);
                const res = await fetch(`${baseUrl}/transfers?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.error?.message || 'listTransfers failed' };
                return { output: data };
            }
            case 'createTransfer': {
                const body = new URLSearchParams();
                body.append('amount', inputs.amount);
                body.append('currency', inputs.currency);
                body.append('destination', inputs.destination);
                if (inputs.description) body.append('description', inputs.description);
                const res = await fetch(`${baseUrl}/transfers`, { method: 'POST', headers, body: body.toString() });
                const data = await res.json();
                if (!res.ok) return { error: data?.error?.message || 'createTransfer failed' };
                return { output: data };
            }
            case 'listPayouts': {
                const params = new URLSearchParams();
                if (inputs.limit) params.append('limit', inputs.limit);
                if (inputs.status) params.append('status', inputs.status);
                if (inputs.startingAfter) params.append('starting_after', inputs.startingAfter);
                const res = await fetch(`${baseUrl}/payouts?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.error?.message || 'listPayouts failed' };
                return { output: data };
            }
            case 'createPayout': {
                const body = new URLSearchParams();
                body.append('amount', inputs.amount);
                body.append('currency', inputs.currency);
                if (inputs.method) body.append('method', inputs.method);
                if (inputs.description) body.append('description', inputs.description);
                const res = await fetch(`${baseUrl}/payouts`, { method: 'POST', headers, body: body.toString() });
                const data = await res.json();
                if (!res.ok) return { error: data?.error?.message || 'createPayout failed' };
                return { output: data };
            }
            case 'listCharges': {
                const params = new URLSearchParams();
                if (inputs.limit) params.append('limit', inputs.limit);
                if (inputs.customer) params.append('customer', inputs.customer);
                if (inputs.startingAfter) params.append('starting_after', inputs.startingAfter);
                const res = await fetch(`${baseUrl}/charges?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.error?.message || 'listCharges failed' };
                return { output: data };
            }
            case 'createCharge': {
                const body = new URLSearchParams();
                body.append('amount', inputs.amount);
                body.append('currency', inputs.currency);
                if (inputs.source) body.append('source', inputs.source);
                if (inputs.customer) body.append('customer', inputs.customer);
                if (inputs.description) body.append('description', inputs.description);
                const res = await fetch(`${baseUrl}/charges`, { method: 'POST', headers, body: body.toString() });
                const data = await res.json();
                if (!res.ok) return { error: data?.error?.message || 'createCharge failed' };
                return { output: data };
            }
            case 'listBalanceTransactions': {
                const params = new URLSearchParams();
                if (inputs.limit) params.append('limit', inputs.limit);
                if (inputs.type) params.append('type', inputs.type);
                if (inputs.startingAfter) params.append('starting_after', inputs.startingAfter);
                const res = await fetch(`${baseUrl}/balance_transactions?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.error?.message || 'listBalanceTransactions failed' };
                return { output: data };
            }
            case 'getBalance': {
                const res = await fetch(`${baseUrl}/balance`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.error?.message || 'getBalance failed' };
                return { output: data };
            }
            default:
                return { error: `Unknown stripe-connect action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`stripe-connect error: ${err.message}`);
        return { error: err.message || 'stripe-connect action failed' };
    }
}
