'use server';

export async function executeRecurlyAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const credentials = Buffer.from(`${inputs.apiKey}:`).toString('base64');
        const baseUrl = 'https://v3.recurly.com';

        const headers: Record<string, string> = {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.recurly.v2021-02-25+json',
        };

        switch (actionName) {
            case 'listAccounts': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.cursor) params.set('cursor', inputs.cursor);
                if (inputs.state) params.set('state', inputs.state);
                const res = await fetch(`${baseUrl}/accounts?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list accounts' };
                return { output: data };
            }
            case 'getAccount': {
                const res = await fetch(`${baseUrl}/accounts/${inputs.accountCode}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get account' };
                return { output: data };
            }
            case 'createAccount': {
                const body: Record<string, any> = {
                    code: inputs.code,
                };
                if (inputs.email) body.email = inputs.email;
                if (inputs.firstName) body.first_name = inputs.firstName;
                if (inputs.lastName) body.last_name = inputs.lastName;
                if (inputs.company) body.company = inputs.company;
                if (inputs.address) body.address = inputs.address;
                const res = await fetch(`${baseUrl}/accounts`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create account' };
                return { output: data };
            }
            case 'updateAccount': {
                const body: Record<string, any> = {};
                if (inputs.email) body.email = inputs.email;
                if (inputs.firstName) body.first_name = inputs.firstName;
                if (inputs.lastName) body.last_name = inputs.lastName;
                if (inputs.company) body.company = inputs.company;
                if (inputs.address) body.address = inputs.address;
                const res = await fetch(`${baseUrl}/accounts/${inputs.accountCode}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to update account' };
                return { output: data };
            }
            case 'closeAccount': {
                const res = await fetch(`${baseUrl}/accounts/${inputs.accountCode}`, {
                    method: 'DELETE',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to close account' };
                return { output: data };
            }
            case 'listSubscriptions': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.cursor) params.set('cursor', inputs.cursor);
                if (inputs.state) params.set('state', inputs.state);
                if (inputs.accountCode) {
                    const res = await fetch(`${baseUrl}/accounts/${inputs.accountCode}/subscriptions?${params}`, { headers });
                    const data = await res.json();
                    if (!res.ok) return { error: data.message || 'Failed to list subscriptions' };
                    return { output: data };
                }
                const res = await fetch(`${baseUrl}/subscriptions?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list subscriptions' };
                return { output: data };
            }
            case 'getSubscription': {
                const res = await fetch(`${baseUrl}/subscriptions/${inputs.subscriptionId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get subscription' };
                return { output: data };
            }
            case 'createSubscription': {
                const body: Record<string, any> = {
                    plan_code: inputs.planCode,
                    account: { code: inputs.accountCode },
                };
                if (inputs.currency) body.currency = inputs.currency;
                if (inputs.trialEndsAt) body.trial_ends_at = inputs.trialEndsAt;
                if (inputs.startsAt) body.starts_at = inputs.startsAt;
                const res = await fetch(`${baseUrl}/subscriptions`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create subscription' };
                return { output: data };
            }
            case 'updateSubscription': {
                const body: Record<string, any> = {};
                if (inputs.planCode) body.plan_code = inputs.planCode;
                if (inputs.quantity) body.quantity = inputs.quantity;
                if (inputs.unitAmount) body.unit_amount = inputs.unitAmount;
                if (inputs.timeframe) body.timeframe = inputs.timeframe;
                const res = await fetch(`${baseUrl}/subscriptions/${inputs.subscriptionId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to update subscription' };
                return { output: data };
            }
            case 'cancelSubscription': {
                const body: Record<string, any> = {};
                if (inputs.refund) body.refund = inputs.refund;
                const res = await fetch(`${baseUrl}/subscriptions/${inputs.subscriptionId}/cancel`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to cancel subscription' };
                return { output: data };
            }
            case 'listInvoices': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.cursor) params.set('cursor', inputs.cursor);
                if (inputs.state) params.set('state', inputs.state);
                if (inputs.accountCode) {
                    const res = await fetch(`${baseUrl}/accounts/${inputs.accountCode}/invoices?${params}`, { headers });
                    const data = await res.json();
                    if (!res.ok) return { error: data.message || 'Failed to list invoices' };
                    return { output: data };
                }
                const res = await fetch(`${baseUrl}/invoices?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list invoices' };
                return { output: data };
            }
            case 'getInvoice': {
                const res = await fetch(`${baseUrl}/invoices/${inputs.invoiceNumber}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get invoice' };
                return { output: data };
            }
            case 'collectInvoice': {
                const body: Record<string, any> = {};
                if (inputs.billingInfoId) body.billing_info_id = inputs.billingInfoId;
                const res = await fetch(`${baseUrl}/invoices/${inputs.invoiceNumber}/collect`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to collect invoice' };
                return { output: data };
            }
            case 'listPlans': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.cursor) params.set('cursor', inputs.cursor);
                if (inputs.state) params.set('state', inputs.state);
                const res = await fetch(`${baseUrl}/plans?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list plans' };
                return { output: data };
            }
            case 'getPlan': {
                const res = await fetch(`${baseUrl}/plans/${inputs.planCode}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get plan' };
                return { output: data };
            }
            default:
                return { error: `Unknown Recurly action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Recurly error: ${err.message}`);
        return { error: err.message || 'Unknown error in Recurly action' };
    }
}
