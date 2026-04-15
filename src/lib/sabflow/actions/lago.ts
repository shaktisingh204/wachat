'use server';

export async function executeLagoAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = inputs.apiKey;
        const baseUrl = `${inputs.baseUrl || 'https://api.getlago.com'}/api/v1`;

        const headers: Record<string, string> = {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };

        switch (actionName) {
            case 'listCustomers': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                const res = await fetch(`${baseUrl}/customers?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.status || 'Failed to list customers' };
                return { output: data };
            }
            case 'getCustomer': {
                const res = await fetch(`${baseUrl}/customers/${inputs.externalCustomerId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.status || 'Failed to get customer' };
                return { output: data };
            }
            case 'createCustomer': {
                const body: Record<string, any> = {
                    customer: {
                        external_id: inputs.externalId,
                        name: inputs.name,
                        email: inputs.email,
                    },
                };
                if (inputs.phone) body.customer.phone = inputs.phone;
                if (inputs.legalName) body.customer.legal_name = inputs.legalName;
                if (inputs.legalNumber) body.customer.legal_number = inputs.legalNumber;
                if (inputs.currency) body.customer.currency = inputs.currency;
                if (inputs.timezone) body.customer.timezone = inputs.timezone;
                if (inputs.billingConfiguration) body.customer.billing_configuration = inputs.billingConfiguration;
                const res = await fetch(`${baseUrl}/customers`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.status || 'Failed to create customer' };
                return { output: data };
            }
            case 'updateCustomer': {
                const body: Record<string, any> = { customer: {} };
                if (inputs.name) body.customer.name = inputs.name;
                if (inputs.email) body.customer.email = inputs.email;
                if (inputs.phone) body.customer.phone = inputs.phone;
                if (inputs.currency) body.customer.currency = inputs.currency;
                if (inputs.timezone) body.customer.timezone = inputs.timezone;
                if (inputs.billingConfiguration) body.customer.billing_configuration = inputs.billingConfiguration;
                const res = await fetch(`${baseUrl}/customers/${inputs.externalCustomerId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.status || 'Failed to update customer' };
                return { output: data };
            }
            case 'deleteCustomer': {
                const res = await fetch(`${baseUrl}/customers/${inputs.externalCustomerId}`, {
                    method: 'DELETE',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.status || 'Failed to delete customer' };
                return { output: data };
            }
            case 'listPlans': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                const res = await fetch(`${baseUrl}/plans?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.status || 'Failed to list plans' };
                return { output: data };
            }
            case 'getPlan': {
                const res = await fetch(`${baseUrl}/plans/${inputs.planCode}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.status || 'Failed to get plan' };
                return { output: data };
            }
            case 'createPlan': {
                const body = {
                    plan: {
                        name: inputs.name,
                        code: inputs.code,
                        interval: inputs.interval || 'monthly',
                        amount_cents: inputs.amountCents,
                        amount_currency: inputs.amountCurrency || 'USD',
                        pay_in_advance: inputs.payInAdvance || false,
                        bill_charges_monthly: inputs.billChargesMonthly,
                        charges: inputs.charges || [],
                    },
                };
                const res = await fetch(`${baseUrl}/plans`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.status || 'Failed to create plan' };
                return { output: data };
            }
            case 'updatePlan': {
                const body: Record<string, any> = { plan: {} };
                if (inputs.name) body.plan.name = inputs.name;
                if (inputs.amountCents !== undefined) body.plan.amount_cents = inputs.amountCents;
                if (inputs.amountCurrency) body.plan.amount_currency = inputs.amountCurrency;
                if (inputs.interval) body.plan.interval = inputs.interval;
                if (inputs.charges) body.plan.charges = inputs.charges;
                const res = await fetch(`${baseUrl}/plans/${inputs.planCode}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.status || 'Failed to update plan' };
                return { output: data };
            }
            case 'deletePlan': {
                const res = await fetch(`${baseUrl}/plans/${inputs.planCode}`, {
                    method: 'DELETE',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.status || 'Failed to delete plan' };
                return { output: data };
            }
            case 'listSubscriptions': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.externalCustomerId) params.set('external_customer_id', inputs.externalCustomerId);
                if (inputs.planCode) params.set('plan_code', inputs.planCode);
                if (inputs.status) params.set('status', inputs.status);
                const res = await fetch(`${baseUrl}/subscriptions?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.status || 'Failed to list subscriptions' };
                return { output: data };
            }
            case 'getSubscription': {
                const res = await fetch(`${baseUrl}/subscriptions/${inputs.externalId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.status || 'Failed to get subscription' };
                return { output: data };
            }
            case 'createSubscription': {
                const body = {
                    subscription: {
                        external_customer_id: inputs.externalCustomerId,
                        plan_code: inputs.planCode,
                        name: inputs.name,
                        external_id: inputs.externalId,
                        billing_time: inputs.billingTime || 'calendar',
                        subscription_at: inputs.subscriptionAt,
                        ending_at: inputs.endingAt,
                    },
                };
                const res = await fetch(`${baseUrl}/subscriptions`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.status || 'Failed to create subscription' };
                return { output: data };
            }
            case 'terminateSubscription': {
                const res = await fetch(`${baseUrl}/subscriptions/${inputs.externalId}`, {
                    method: 'DELETE',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.status || 'Failed to terminate subscription' };
                return { output: data };
            }
            case 'createWallet': {
                const body = {
                    wallet: {
                        external_customer_id: inputs.externalCustomerId,
                        rate_amount: String(inputs.rateAmount || '1.0'),
                        name: inputs.name,
                        paid_credits: String(inputs.paidCredits || '0'),
                        granted_credits: String(inputs.grantedCredits || '0'),
                        currency: inputs.currency || 'USD',
                        expiration_at: inputs.expirationAt,
                    },
                };
                const res = await fetch(`${baseUrl}/wallets`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.status || 'Failed to create wallet' };
                return { output: data };
            }
            default:
                return { error: `Unknown Lago action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Lago error: ${err.message}`);
        return { error: err.message || 'Unknown error in Lago action' };
    }
}
