'use server';

export async function executePaystackAction(actionName: string, inputs: any, user: any, logger: any) {
    const secretKey = inputs.secretKey;
    const baseUrl = 'https://api.paystack.co';
    const headers: Record<string, string> = {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'initializeTransaction': {
                const body: any = {
                    email: inputs.email,
                    amount: inputs.amount,
                };
                if (inputs.currency) body.currency = inputs.currency;
                if (inputs.reference) body.reference = inputs.reference;
                if (inputs.callbackUrl) body.callback_url = inputs.callbackUrl;
                if (inputs.metadata) body.metadata = inputs.metadata;
                const res = await fetch(`${baseUrl}/transaction/initialize`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok || !data.status) return { error: data?.message || 'initializeTransaction failed' };
                return { output: data.data };
            }
            case 'verifyTransaction': {
                const reference = inputs.reference;
                const res = await fetch(`${baseUrl}/transaction/verify/${encodeURIComponent(reference)}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok || !data.status) return { error: data?.message || 'verifyTransaction failed' };
                return { output: data.data };
            }
            case 'listTransactions': {
                const params = new URLSearchParams();
                if (inputs.perPage) params.append('perPage', inputs.perPage);
                if (inputs.page) params.append('page', inputs.page);
                if (inputs.customer) params.append('customer', inputs.customer);
                if (inputs.status) params.append('status', inputs.status);
                const res = await fetch(`${baseUrl}/transaction?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok || !data.status) return { error: data?.message || 'listTransactions failed' };
                return { output: data.data };
            }
            case 'getTransaction': {
                const transactionId = inputs.transactionId;
                const res = await fetch(`${baseUrl}/transaction/${transactionId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok || !data.status) return { error: data?.message || 'getTransaction failed' };
                return { output: data.data };
            }
            case 'chargeAuthorization': {
                const body: any = {
                    email: inputs.email,
                    amount: inputs.amount,
                    authorization_code: inputs.authorizationCode,
                };
                if (inputs.currency) body.currency = inputs.currency;
                if (inputs.reference) body.reference = inputs.reference;
                if (inputs.metadata) body.metadata = inputs.metadata;
                const res = await fetch(`${baseUrl}/transaction/charge_authorization`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok || !data.status) return { error: data?.message || 'chargeAuthorization failed' };
                return { output: data.data };
            }
            case 'createCustomer': {
                const body: any = {
                    email: inputs.email,
                    first_name: inputs.firstName,
                    last_name: inputs.lastName,
                };
                if (inputs.phone) body.phone = inputs.phone;
                if (inputs.metadata) body.metadata = inputs.metadata;
                const res = await fetch(`${baseUrl}/customer`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok || !data.status) return { error: data?.message || 'createCustomer failed' };
                return { output: data.data };
            }
            case 'getCustomer': {
                const emailOrCode = inputs.emailOrCode;
                const res = await fetch(`${baseUrl}/customer/${encodeURIComponent(emailOrCode)}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok || !data.status) return { error: data?.message || 'getCustomer failed' };
                return { output: data.data };
            }
            case 'listCustomers': {
                const params = new URLSearchParams();
                if (inputs.perPage) params.append('perPage', inputs.perPage);
                if (inputs.page) params.append('page', inputs.page);
                const res = await fetch(`${baseUrl}/customer?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok || !data.status) return { error: data?.message || 'listCustomers failed' };
                return { output: data.data };
            }
            case 'updateCustomer': {
                const customerCode = inputs.customerCode;
                const body: any = {};
                if (inputs.firstName) body.first_name = inputs.firstName;
                if (inputs.lastName) body.last_name = inputs.lastName;
                if (inputs.phone) body.phone = inputs.phone;
                if (inputs.metadata) body.metadata = inputs.metadata;
                const res = await fetch(`${baseUrl}/customer/${customerCode}`, { method: 'PUT', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok || !data.status) return { error: data?.message || 'updateCustomer failed' };
                return { output: data.data };
            }
            case 'createPlan': {
                const body: any = {
                    name: inputs.name,
                    interval: inputs.interval,
                    amount: inputs.amount,
                };
                if (inputs.currency) body.currency = inputs.currency;
                if (inputs.description) body.description = inputs.description;
                if (inputs.invoiceLimit) body.invoice_limit = inputs.invoiceLimit;
                const res = await fetch(`${baseUrl}/plan`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok || !data.status) return { error: data?.message || 'createPlan failed' };
                return { output: data.data };
            }
            case 'getPlan': {
                const planIdOrCode = inputs.planIdOrCode;
                const res = await fetch(`${baseUrl}/plan/${encodeURIComponent(planIdOrCode)}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok || !data.status) return { error: data?.message || 'getPlan failed' };
                return { output: data.data };
            }
            case 'listPlans': {
                const params = new URLSearchParams();
                if (inputs.perPage) params.append('perPage', inputs.perPage);
                if (inputs.page) params.append('page', inputs.page);
                const res = await fetch(`${baseUrl}/plan?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok || !data.status) return { error: data?.message || 'listPlans failed' };
                return { output: data.data };
            }
            case 'createSubscription': {
                const body: any = {
                    customer: inputs.customer,
                    plan: inputs.plan,
                };
                if (inputs.authorization) body.authorization = inputs.authorization;
                if (inputs.startDate) body.start_date = inputs.startDate;
                const res = await fetch(`${baseUrl}/subscription`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok || !data.status) return { error: data?.message || 'createSubscription failed' };
                return { output: data.data };
            }
            case 'getSubscription': {
                const idOrCode = inputs.idOrCode;
                const res = await fetch(`${baseUrl}/subscription/${encodeURIComponent(idOrCode)}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok || !data.status) return { error: data?.message || 'getSubscription failed' };
                return { output: data.data };
            }
            case 'listSubscriptions': {
                const params = new URLSearchParams();
                if (inputs.perPage) params.append('perPage', inputs.perPage);
                if (inputs.page) params.append('page', inputs.page);
                if (inputs.customer) params.append('customer', inputs.customer);
                if (inputs.plan) params.append('plan', inputs.plan);
                const res = await fetch(`${baseUrl}/subscription?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok || !data.status) return { error: data?.message || 'listSubscriptions failed' };
                return { output: data.data };
            }
            default:
                return { error: `Unknown paystack action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`paystack error: ${err.message}`);
        return { error: err.message || 'paystack action failed' };
    }
}
