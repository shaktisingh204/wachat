'use server';

async function getPayPalAccessToken(clientId: string, clientSecret: string, sandbox: boolean): Promise<string> {
    const baseUrl = sandbox ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
    });
    const data = await res.json();
    if (!data.access_token) throw new Error(data.error_description || 'Failed to get PayPal access token');
    return data.access_token;
}

export async function executePaypalEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const { clientId, clientSecret, sandbox } = inputs;
        const baseUrl = sandbox ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';

        if (actionName === 'getAccessToken') {
            const token = await getPayPalAccessToken(clientId, clientSecret, !!sandbox);
            return { output: { access_token: token } };
        }

        const accessToken = inputs.accessToken || (await getPayPalAccessToken(clientId, clientSecret, !!sandbox));
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
        };

        switch (actionName) {
            case 'createOrder': {
                const body = {
                    intent: inputs.intent || 'CAPTURE',
                    purchase_units: inputs.purchaseUnits || [{ amount: { currency_code: inputs.currency || 'USD', value: inputs.amount } }],
                };
                const res = await fetch(`${baseUrl}/v2/checkout/orders`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: data };
            }
            case 'captureOrder': {
                const res = await fetch(`${baseUrl}/v2/checkout/orders/${inputs.orderId}/capture`, { method: 'POST', headers, body: '{}' });
                const data = await res.json();
                return { output: data };
            }
            case 'getOrder': {
                const res = await fetch(`${baseUrl}/v2/checkout/orders/${inputs.orderId}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'refundCapture': {
                const body: any = {};
                if (inputs.amount) body.amount = { value: inputs.amount, currency_code: inputs.currency || 'USD' };
                if (inputs.noteToPayer) body.note_to_payer = inputs.noteToPayer;
                const res = await fetch(`${baseUrl}/v2/payments/captures/${inputs.captureId}/refund`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: data };
            }
            case 'createSubscription': {
                const body = {
                    plan_id: inputs.planId,
                    subscriber: inputs.subscriber || { name: { given_name: inputs.givenName, surname: inputs.surname }, email_address: inputs.email },
                    application_context: inputs.applicationContext,
                };
                const res = await fetch(`${baseUrl}/v1/billing/subscriptions`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: data };
            }
            case 'getSubscription': {
                const res = await fetch(`${baseUrl}/v1/billing/subscriptions/${inputs.subscriptionId}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'cancelSubscription': {
                const body = { reason: inputs.reason || 'Cancelled by user' };
                const res = await fetch(`${baseUrl}/v1/billing/subscriptions/${inputs.subscriptionId}/cancel`, { method: 'POST', headers, body: JSON.stringify(body) });
                return { output: { success: res.ok, status: res.status } };
            }
            case 'createPayout': {
                const body = {
                    sender_batch_header: { sender_batch_id: inputs.senderBatchId || Date.now().toString(), email_subject: inputs.emailSubject },
                    items: inputs.items || [{ recipient_type: 'EMAIL', amount: { value: inputs.amount, currency: inputs.currency || 'USD' }, receiver: inputs.receiver, note: inputs.note }],
                };
                const res = await fetch(`${baseUrl}/v1/payments/payouts`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: data };
            }
            case 'getPayoutBatch': {
                const res = await fetch(`${baseUrl}/v1/payments/payouts/${inputs.payoutBatchId}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'createInvoice': {
                const body = inputs.invoice || { detail: { invoice_number: inputs.invoiceNumber, currency_code: inputs.currency || 'USD' }, invoicer: inputs.invoicer, primary_recipients: inputs.primaryRecipients, items: inputs.items };
                const res = await fetch(`${baseUrl}/v2/invoicing/invoices`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: data };
            }
            case 'sendInvoice': {
                const body = inputs.sendConfig || {};
                const res = await fetch(`${baseUrl}/v2/invoicing/invoices/${inputs.invoiceId}/send`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: data };
            }
            case 'getInvoice': {
                const res = await fetch(`${baseUrl}/v2/invoicing/invoices/${inputs.invoiceId}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'listTransactions': {
                const params = new URLSearchParams();
                if (inputs.startDate) params.set('start_date', inputs.startDate);
                if (inputs.endDate) params.set('end_date', inputs.endDate);
                if (inputs.transactionStatus) params.set('transaction_status', inputs.transactionStatus);
                const res = await fetch(`${baseUrl}/v1/reporting/transactions?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'createWebhook': {
                const body = { url: inputs.url, event_types: inputs.eventTypes || [{ name: '*' }] };
                const res = await fetch(`${baseUrl}/v1/notifications/webhooks`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: data };
            }
            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`executePaypalEnhancedAction error: ${err.message}`);
        return { error: err.message || 'Unknown error' };
    }
}
