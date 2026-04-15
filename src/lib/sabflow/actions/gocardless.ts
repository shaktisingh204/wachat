'use server';

export async function executeGoCardlessAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = inputs.accessToken;
        const baseUrl = 'https://api.gocardless.com';

        const headers: Record<string, string> = {
            'Authorization': `Bearer ${accessToken}`,
            'GoCardless-Version': '2015-07-06',
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listCustomers': {
                const params = new URLSearchParams();
                if (inputs.after) params.set('after', inputs.after);
                if (inputs.before) params.set('before', inputs.before);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.email) params.set('email', inputs.email);
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
                const body: Record<string, any> = {
                    customers: {
                        email: inputs.email,
                        given_name: inputs.givenName,
                        family_name: inputs.familyName,
                        address_line1: inputs.addressLine1,
                        city: inputs.city,
                        postal_code: inputs.postalCode,
                        country_code: inputs.countryCode,
                    },
                };
                if (inputs.phoneNumber) body.customers.phone_number = inputs.phoneNumber;
                if (inputs.metadata) body.customers.metadata = inputs.metadata;
                const res = await fetch(`${baseUrl}/customers`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `createCustomer failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'updateCustomer': {
                const body: Record<string, any> = { customers: {} };
                if (inputs.email) body.customers.email = inputs.email;
                if (inputs.givenName) body.customers.given_name = inputs.givenName;
                if (inputs.familyName) body.customers.family_name = inputs.familyName;
                if (inputs.phoneNumber) body.customers.phone_number = inputs.phoneNumber;
                if (inputs.metadata) body.customers.metadata = inputs.metadata;
                const res = await fetch(`${baseUrl}/customers/${inputs.customerId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `updateCustomer failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'deleteCustomer': {
                const res = await fetch(`${baseUrl}/customers/${inputs.customerId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) return { error: `deleteCustomer failed: ${res.status} ${await res.text()}` };
                return { output: { success: true, customerId: inputs.customerId } };
            }

            case 'listMandates': {
                const params = new URLSearchParams();
                if (inputs.after) params.set('after', inputs.after);
                if (inputs.before) params.set('before', inputs.before);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.customerId) params.set('customer', inputs.customerId);
                const res = await fetch(`${baseUrl}/mandates?${params}`, { headers });
                if (!res.ok) return { error: `listMandates failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getMandate': {
                const res = await fetch(`${baseUrl}/mandates/${inputs.mandateId}`, { headers });
                if (!res.ok) return { error: `getMandate failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'createMandate': {
                const body: Record<string, any> = {
                    mandates: {
                        scheme: inputs.scheme || 'bacs',
                        links: {
                            customer_bank_account: inputs.customerBankAccountId,
                        },
                    },
                };
                if (inputs.reference) body.mandates.reference = inputs.reference;
                if (inputs.metadata) body.mandates.metadata = inputs.metadata;
                const res = await fetch(`${baseUrl}/mandates`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `createMandate failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'cancelMandate': {
                const res = await fetch(`${baseUrl}/mandates/${inputs.mandateId}/actions/cancel`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ data: {} }),
                });
                if (!res.ok) return { error: `cancelMandate failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'listPayments': {
                const params = new URLSearchParams();
                if (inputs.after) params.set('after', inputs.after);
                if (inputs.before) params.set('before', inputs.before);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.mandateId) params.set('mandate', inputs.mandateId);
                if (inputs.status) params.set('status', inputs.status);
                const res = await fetch(`${baseUrl}/payments?${params}`, { headers });
                if (!res.ok) return { error: `listPayments failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getPayment': {
                const res = await fetch(`${baseUrl}/payments/${inputs.paymentId}`, { headers });
                if (!res.ok) return { error: `getPayment failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'createPayment': {
                const body: Record<string, any> = {
                    payments: {
                        amount: inputs.amount,
                        currency: inputs.currency,
                        charge_date: inputs.chargeDate,
                        links: {
                            mandate: inputs.mandateId,
                        },
                    },
                };
                if (inputs.description) body.payments.description = inputs.description;
                if (inputs.reference) body.payments.reference = inputs.reference;
                if (inputs.metadata) body.payments.metadata = inputs.metadata;
                const res = await fetch(`${baseUrl}/payments`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `createPayment failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'cancelPayment': {
                const res = await fetch(`${baseUrl}/payments/${inputs.paymentId}/actions/cancel`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ data: {} }),
                });
                if (!res.ok) return { error: `cancelPayment failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'listSubscriptions': {
                const params = new URLSearchParams();
                if (inputs.after) params.set('after', inputs.after);
                if (inputs.before) params.set('before', inputs.before);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.mandateId) params.set('mandate', inputs.mandateId);
                const res = await fetch(`${baseUrl}/subscriptions?${params}`, { headers });
                if (!res.ok) return { error: `listSubscriptions failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'createSubscription': {
                const body: Record<string, any> = {
                    subscriptions: {
                        amount: inputs.amount,
                        currency: inputs.currency,
                        interval_unit: inputs.intervalUnit,
                        interval: inputs.interval || 1,
                        day_of_month: inputs.dayOfMonth,
                        links: {
                            mandate: inputs.mandateId,
                        },
                    },
                };
                if (inputs.name) body.subscriptions.name = inputs.name;
                if (inputs.startDate) body.subscriptions.start_date = inputs.startDate;
                if (inputs.endDate) body.subscriptions.end_date = inputs.endDate;
                if (inputs.count) body.subscriptions.count = inputs.count;
                if (inputs.metadata) body.subscriptions.metadata = inputs.metadata;
                const res = await fetch(`${baseUrl}/subscriptions`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `createSubscription failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            default:
                return { error: `Unknown GoCardless action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`GoCardless action error: ${err.message}`);
        return { error: err.message || 'GoCardless action failed' };
    }
}
