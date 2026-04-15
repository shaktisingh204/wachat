'use server';

export async function executeStripeEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const secretKey = String(inputs.secretKey ?? '').trim();
        const authHeader = `Basic ${Buffer.from(secretKey + ':').toString('base64')}`;
        const BASE = 'https://api.stripe.com/v1';

        switch (actionName) {
            case 'createPaymentIntent': {
                const params = new URLSearchParams();
                params.append('amount', String(inputs.amount ?? 0));
                params.append('currency', String(inputs.currency ?? 'usd'));
                if (inputs.customer) params.append('customer', String(inputs.customer));
                if (inputs.description) params.append('description', String(inputs.description));
                if (inputs.payment_method) params.append('payment_method', String(inputs.payment_method));
                if (inputs.confirm) params.append('confirm', String(inputs.confirm));
                const res = await fetch(`${BASE}/payment_intents`, {
                    method: 'POST',
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: params.toString(),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { paymentIntent: data } };
            }

            case 'getPaymentIntent': {
                const id = String(inputs.paymentIntentId ?? '').trim();
                const res = await fetch(`${BASE}/payment_intents/${id}`, {
                    headers: { 'Authorization': authHeader },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { paymentIntent: data } };
            }

            case 'confirmPaymentIntent': {
                const id = String(inputs.paymentIntentId ?? '').trim();
                const params = new URLSearchParams();
                if (inputs.payment_method) params.append('payment_method', String(inputs.payment_method));
                if (inputs.return_url) params.append('return_url', String(inputs.return_url));
                const res = await fetch(`${BASE}/payment_intents/${id}/confirm`, {
                    method: 'POST',
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: params.toString(),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { paymentIntent: data } };
            }

            case 'cancelPaymentIntent': {
                const id = String(inputs.paymentIntentId ?? '').trim();
                const params = new URLSearchParams();
                if (inputs.cancellation_reason) params.append('cancellation_reason', String(inputs.cancellation_reason));
                const res = await fetch(`${BASE}/payment_intents/${id}/cancel`, {
                    method: 'POST',
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: params.toString(),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { paymentIntent: data } };
            }

            case 'createCustomer': {
                const params = new URLSearchParams();
                if (inputs.email) params.append('email', String(inputs.email));
                if (inputs.name) params.append('name', String(inputs.name));
                if (inputs.phone) params.append('phone', String(inputs.phone));
                if (inputs.description) params.append('description', String(inputs.description));
                const res = await fetch(`${BASE}/customers`, {
                    method: 'POST',
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: params.toString(),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { customer: data } };
            }

            case 'getCustomer': {
                const id = String(inputs.customerId ?? '').trim();
                const res = await fetch(`${BASE}/customers/${id}`, {
                    headers: { 'Authorization': authHeader },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { customer: data } };
            }

            case 'updateCustomer': {
                const id = String(inputs.customerId ?? '').trim();
                const params = new URLSearchParams();
                if (inputs.email) params.append('email', String(inputs.email));
                if (inputs.name) params.append('name', String(inputs.name));
                if (inputs.phone) params.append('phone', String(inputs.phone));
                if (inputs.description) params.append('description', String(inputs.description));
                const res = await fetch(`${BASE}/customers/${id}`, {
                    method: 'POST',
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: params.toString(),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { customer: data } };
            }

            case 'listCustomers': {
                const params = new URLSearchParams();
                if (inputs.limit) params.append('limit', String(inputs.limit));
                if (inputs.email) params.append('email', String(inputs.email));
                if (inputs.starting_after) params.append('starting_after', String(inputs.starting_after));
                const query = params.toString();
                const res = await fetch(`${BASE}/customers${query ? '?' + query : ''}`, {
                    headers: { 'Authorization': authHeader },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { customers: data } };
            }

            case 'createSubscription': {
                const params = new URLSearchParams();
                params.append('customer', String(inputs.customer ?? ''));
                if (inputs['items[0][price]']) params.append('items[0][price]', String(inputs['items[0][price]']));
                else if (inputs.price) params.append('items[0][price]', String(inputs.price));
                if (inputs.trial_period_days) params.append('trial_period_days', String(inputs.trial_period_days));
                if (inputs.payment_behavior) params.append('payment_behavior', String(inputs.payment_behavior));
                const res = await fetch(`${BASE}/subscriptions`, {
                    method: 'POST',
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: params.toString(),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { subscription: data } };
            }

            case 'getSubscription': {
                const id = String(inputs.subscriptionId ?? '').trim();
                const res = await fetch(`${BASE}/subscriptions/${id}`, {
                    headers: { 'Authorization': authHeader },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { subscription: data } };
            }

            case 'cancelSubscription': {
                const id = String(inputs.subscriptionId ?? '').trim();
                const params = new URLSearchParams();
                if (inputs.cancel_at_period_end !== undefined) params.append('cancel_at_period_end', String(inputs.cancel_at_period_end));
                const res = await fetch(`${BASE}/subscriptions/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: params.toString(),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { subscription: data } };
            }

            case 'createInvoice': {
                const params = new URLSearchParams();
                params.append('customer', String(inputs.customer ?? ''));
                if (inputs.auto_advance !== undefined) params.append('auto_advance', String(inputs.auto_advance));
                if (inputs.collection_method) params.append('collection_method', String(inputs.collection_method));
                if (inputs.description) params.append('description', String(inputs.description));
                if (inputs.due_date) params.append('due_date', String(inputs.due_date));
                const res = await fetch(`${BASE}/invoices`, {
                    method: 'POST',
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: params.toString(),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { invoice: data } };
            }

            case 'listInvoices': {
                const params = new URLSearchParams();
                if (inputs.customer) params.append('customer', String(inputs.customer));
                if (inputs.limit) params.append('limit', String(inputs.limit));
                if (inputs.status) params.append('status', String(inputs.status));
                if (inputs.starting_after) params.append('starting_after', String(inputs.starting_after));
                const query = params.toString();
                const res = await fetch(`${BASE}/invoices${query ? '?' + query : ''}`, {
                    headers: { 'Authorization': authHeader },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { invoices: data } };
            }

            case 'createRefund': {
                const params = new URLSearchParams();
                if (inputs.charge) params.append('charge', String(inputs.charge));
                if (inputs.payment_intent) params.append('payment_intent', String(inputs.payment_intent));
                if (inputs.amount) params.append('amount', String(inputs.amount));
                if (inputs.reason) params.append('reason', String(inputs.reason));
                const res = await fetch(`${BASE}/refunds`, {
                    method: 'POST',
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: params.toString(),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { refund: data } };
            }

            case 'listCharges': {
                const params = new URLSearchParams();
                if (inputs.customer) params.append('customer', String(inputs.customer));
                if (inputs.limit) params.append('limit', String(inputs.limit));
                if (inputs.payment_intent) params.append('payment_intent', String(inputs.payment_intent));
                if (inputs.starting_after) params.append('starting_after', String(inputs.starting_after));
                const query = params.toString();
                const res = await fetch(`${BASE}/charges${query ? '?' + query : ''}`, {
                    headers: { 'Authorization': authHeader },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { charges: data } };
            }

            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
