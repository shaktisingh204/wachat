'use server';

export async function executeChargebeeEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = inputs.apiKey;
        const site = inputs.site;
        const credentials = Buffer.from(`${apiKey}:`).toString('base64');
        const baseUrl = `https://${site}.chargebee.com/api/v2`;

        const headers: Record<string, string> = {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        };

        const jsonHeaders: Record<string, string> = {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/json',
        };

        function toFormBody(obj: Record<string, any>): string {
            const params = new URLSearchParams();
            for (const [key, value] of Object.entries(obj)) {
                if (value !== undefined && value !== null) {
                    params.set(key, String(value));
                }
            }
            return params.toString();
        }

        switch (actionName) {
            case 'listSubscriptions': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', inputs.offset);
                if (inputs.customerId) params.set('customer_id[is]', inputs.customerId);
                if (inputs.status) params.set('status[is]', inputs.status);
                const res = await fetch(`${baseUrl}/subscriptions?${params}`, { headers });
                if (!res.ok) return { error: `listSubscriptions failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getSubscription': {
                const res = await fetch(`${baseUrl}/subscriptions/${inputs.subscriptionId}`, { headers });
                if (!res.ok) return { error: `getSubscription failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'createSubscription': {
                const body: Record<string, any> = {};
                if (inputs.planId) body['plan_id'] = inputs.planId;
                if (inputs.customerId) body['customer[id]'] = inputs.customerId;
                if (inputs.customerEmail) body['customer[email]'] = inputs.customerEmail;
                if (inputs.customerFirstName) body['customer[first_name]'] = inputs.customerFirstName;
                if (inputs.customerLastName) body['customer[last_name]'] = inputs.customerLastName;
                if (inputs.billingCycles) body['billing_cycles'] = inputs.billingCycles;
                if (inputs.startDate) body['start_date'] = inputs.startDate;
                const res = await fetch(`${baseUrl}/subscriptions`, {
                    method: 'POST',
                    headers,
                    body: toFormBody(body),
                });
                if (!res.ok) return { error: `createSubscription failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'updateSubscription': {
                const body: Record<string, any> = {};
                if (inputs.planId) body['plan_id'] = inputs.planId;
                if (inputs.planQuantity) body['plan_quantity'] = inputs.planQuantity;
                if (inputs.billingCycles) body['billing_cycles'] = inputs.billingCycles;
                if (inputs.invoiceNow !== undefined) body['invoice_now'] = inputs.invoiceNow;
                if (inputs.prorate !== undefined) body['prorate'] = inputs.prorate;
                const res = await fetch(`${baseUrl}/subscriptions/${inputs.subscriptionId}`, {
                    method: 'POST',
                    headers,
                    body: toFormBody(body),
                });
                if (!res.ok) return { error: `updateSubscription failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'cancelSubscription': {
                const body: Record<string, any> = {};
                if (inputs.endOfTerm !== undefined) body['end_of_term'] = inputs.endOfTerm;
                if (inputs.cancelAt) body['cancel_at'] = inputs.cancelAt;
                if (inputs.creditOptionForCurrentTermCharges) body['credit_option_for_current_term_charges'] = inputs.creditOptionForCurrentTermCharges;
                const res = await fetch(`${baseUrl}/subscriptions/${inputs.subscriptionId}/cancel`, {
                    method: 'POST',
                    headers,
                    body: toFormBody(body),
                });
                if (!res.ok) return { error: `cancelSubscription failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'listCustomers': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', inputs.offset);
                if (inputs.email) params.set('email[is]', inputs.email);
                const res = await fetch(`${baseUrl}/customers?${params}`, { headers });
                if (!res.ok) return { error: `listCustomers failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getCustomer': {
                const res = await fetch(`${baseUrl}/customers/${inputs.customerId}`, { headers });
                if (!res.ok) return { error: `getCustomer failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'createCustomer': {
                const body: Record<string, any> = {};
                if (inputs.email) body['email'] = inputs.email;
                if (inputs.firstName) body['first_name'] = inputs.firstName;
                if (inputs.lastName) body['last_name'] = inputs.lastName;
                if (inputs.phone) body['phone'] = inputs.phone;
                if (inputs.company) body['company'] = inputs.company;
                if (inputs.locale) body['locale'] = inputs.locale;
                const res = await fetch(`${baseUrl}/customers`, {
                    method: 'POST',
                    headers,
                    body: toFormBody(body),
                });
                if (!res.ok) return { error: `createCustomer failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'updateCustomer': {
                const body: Record<string, any> = {};
                if (inputs.email) body['email'] = inputs.email;
                if (inputs.firstName) body['first_name'] = inputs.firstName;
                if (inputs.lastName) body['last_name'] = inputs.lastName;
                if (inputs.phone) body['phone'] = inputs.phone;
                if (inputs.company) body['company'] = inputs.company;
                const res = await fetch(`${baseUrl}/customers/${inputs.customerId}`, {
                    method: 'POST',
                    headers,
                    body: toFormBody(body),
                });
                if (!res.ok) return { error: `updateCustomer failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'listInvoices': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', inputs.offset);
                if (inputs.customerId) params.set('customer_id[is]', inputs.customerId);
                if (inputs.subscriptionId) params.set('subscription_id[is]', inputs.subscriptionId);
                if (inputs.status) params.set('status[is]', inputs.status);
                const res = await fetch(`${baseUrl}/invoices?${params}`, { headers });
                if (!res.ok) return { error: `listInvoices failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getInvoice': {
                const res = await fetch(`${baseUrl}/invoices/${inputs.invoiceId}`, { headers });
                if (!res.ok) return { error: `getInvoice failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'createInvoice': {
                const body: Record<string, any> = {};
                if (inputs.customerId) body['customer_id'] = inputs.customerId;
                if (inputs.subscriptionId) body['subscription_id'] = inputs.subscriptionId;
                if (inputs.currencyCode) body['currency_code'] = inputs.currencyCode;
                if (inputs.itemPriceId) body['item_prices[item_price_id][0]'] = inputs.itemPriceId;
                if (inputs.itemPriceQuantity) body['item_prices[quantity][0]'] = inputs.itemPriceQuantity;
                const res = await fetch(`${baseUrl}/invoices`, {
                    method: 'POST',
                    headers,
                    body: toFormBody(body),
                });
                if (!res.ok) return { error: `createInvoice failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'listPlans': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', inputs.offset);
                if (inputs.status) params.set('status[is]', inputs.status);
                const res = await fetch(`${baseUrl}/plans?${params}`, { headers });
                if (!res.ok) return { error: `listPlans failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getPlan': {
                const res = await fetch(`${baseUrl}/plans/${inputs.planId}`, { headers });
                if (!res.ok) return { error: `getPlan failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'createPlan': {
                const body: Record<string, any> = {
                    id: inputs.id,
                    name: inputs.name,
                    invoice_name: inputs.invoiceName || inputs.name,
                    price: inputs.price,
                    period: inputs.period || 1,
                    period_unit: inputs.periodUnit || 'month',
                    currency_code: inputs.currencyCode,
                };
                if (inputs.trialPeriod) body['trial_period'] = inputs.trialPeriod;
                if (inputs.trialPeriodUnit) body['trial_period_unit'] = inputs.trialPeriodUnit;
                if (inputs.description) body['description'] = inputs.description;
                const res = await fetch(`${baseUrl}/plans`, {
                    method: 'POST',
                    headers,
                    body: toFormBody(body),
                });
                if (!res.ok) return { error: `createPlan failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            default:
                return { error: `Unknown Chargebee Enhanced action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Chargebee Enhanced action error: ${err.message}`);
        return { error: err.message || 'Chargebee Enhanced action failed' };
    }
}
