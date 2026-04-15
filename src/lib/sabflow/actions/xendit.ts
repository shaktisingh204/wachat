'use server';

export async function executeXenditAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE_URL = 'https://api.xendit.co';
    const secretKey = inputs.secretKey;

    if (!secretKey) return { error: 'Missing inputs.secretKey' };

    const credentials = Buffer.from(`${secretKey}:`).toString('base64');

    const headers: Record<string, string> = {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
    };

    try {
        switch (actionName) {
            case 'createInvoice': {
                const body = {
                    external_id: inputs.externalId ?? `INV-${Date.now()}`,
                    amount: inputs.amount,
                    payer_email: inputs.payerEmail,
                    description: inputs.description,
                    invoice_duration: inputs.invoiceDuration,
                    callback_virtual_account_id: inputs.callbackVirtualAccountId,
                    should_send_email: inputs.shouldSendEmail,
                    success_redirect_url: inputs.successRedirectUrl,
                    failure_redirect_url: inputs.failureRedirectUrl,
                    currency: inputs.currency ?? 'IDR',
                    items: inputs.items,
                    customer: inputs.customer,
                };
                if (!body.amount) return { error: 'Missing inputs.amount' };
                const res = await fetch(`${BASE_URL}/v2/invoices`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? `Xendit error: ${res.status}` };
                return { output: data };
            }

            case 'getInvoice': {
                const invoiceId = inputs.invoiceId;
                if (!invoiceId) return { error: 'Missing inputs.invoiceId' };
                const res = await fetch(`${BASE_URL}/v2/invoices/${invoiceId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? `Xendit error: ${res.status}` };
                return { output: data };
            }

            case 'expireInvoice': {
                const invoiceId = inputs.invoiceId;
                if (!invoiceId) return { error: 'Missing inputs.invoiceId' };
                const res = await fetch(`${BASE_URL}/invoices/${invoiceId}/expire!`, {
                    method: 'POST',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? `Xendit error: ${res.status}` };
                return { output: data };
            }

            case 'listInvoices': {
                const params = new URLSearchParams();
                if (inputs.status) params.set('status', inputs.status);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.created_after) params.set('created_after', inputs.created_after);
                if (inputs.created_before) params.set('created_before', inputs.created_before);
                if (inputs.last_invoice_id) params.set('last_invoice_id', inputs.last_invoice_id);
                const res = await fetch(`${BASE_URL}/v2/invoices?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? `Xendit error: ${res.status}` };
                return { output: data };
            }

            case 'createDisbursement': {
                const body = {
                    external_id: inputs.externalId ?? `DISB-${Date.now()}`,
                    bank_code: inputs.bankCode,
                    account_holder_name: inputs.accountHolderName,
                    account_number: inputs.accountNumber,
                    description: inputs.description,
                    amount: inputs.amount,
                    email_to: inputs.emailTo,
                };
                if (!body.bank_code) return { error: 'Missing inputs.bankCode' };
                if (!body.account_number) return { error: 'Missing inputs.accountNumber' };
                if (!body.amount) return { error: 'Missing inputs.amount' };
                const res = await fetch(`${BASE_URL}/disbursements`, {
                    method: 'POST',
                    headers: {
                        ...headers,
                        'X-IDEMPOTENCY-KEY': inputs.idempotencyKey ?? `${Date.now()}`,
                    },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? `Xendit error: ${res.status}` };
                return { output: data };
            }

            case 'getDisbursement': {
                const disbursementId = inputs.disbursementId;
                if (!disbursementId) return { error: 'Missing inputs.disbursementId' };
                const res = await fetch(`${BASE_URL}/disbursements/${disbursementId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? `Xendit error: ${res.status}` };
                return { output: data };
            }

            case 'listDisbursements': {
                const externalId = inputs.externalId;
                if (!externalId) return { error: 'Missing inputs.externalId' };
                const res = await fetch(`${BASE_URL}/disbursements?external_id=${externalId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? `Xendit error: ${res.status}` };
                return { output: data };
            }

            case 'createVirtualAccount': {
                const body = {
                    external_id: inputs.externalId ?? `VA-${Date.now()}`,
                    bank_code: inputs.bankCode,
                    name: inputs.name,
                    virtual_account_number: inputs.virtualAccountNumber,
                    is_closed: inputs.isClosed ?? false,
                    is_single_use: inputs.isSingleUse ?? false,
                    expected_amount: inputs.expectedAmount,
                    expiration_date: inputs.expirationDate,
                    description: inputs.description,
                };
                if (!body.bank_code) return { error: 'Missing inputs.bankCode' };
                if (!body.name) return { error: 'Missing inputs.name' };
                const res = await fetch(`${BASE_URL}/callback_virtual_accounts`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? `Xendit error: ${res.status}` };
                return { output: data };
            }

            case 'getVirtualAccount': {
                const vaId = inputs.vaId;
                if (!vaId) return { error: 'Missing inputs.vaId' };
                const res = await fetch(`${BASE_URL}/callback_virtual_accounts/${vaId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? `Xendit error: ${res.status}` };
                return { output: data };
            }

            case 'listVirtualAccounts': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.after_id) params.set('after_id', inputs.after_id);
                if (inputs.before_id) params.set('before_id', inputs.before_id);
                const res = await fetch(`${BASE_URL}/callback_virtual_accounts?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? `Xendit error: ${res.status}` };
                return { output: data };
            }

            case 'createPaymentRequest': {
                const body = {
                    currency: inputs.currency ?? 'IDR',
                    amount: inputs.amount,
                    payment_method: inputs.paymentMethod,
                    reference_id: inputs.referenceId ?? `PR-${Date.now()}`,
                    customer_id: inputs.customerId,
                    description: inputs.description,
                    metadata: inputs.metadata,
                };
                if (!body.amount) return { error: 'Missing inputs.amount' };
                if (!body.payment_method) return { error: 'Missing inputs.paymentMethod' };
                const res = await fetch(`${BASE_URL}/payment_requests`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? `Xendit error: ${res.status}` };
                return { output: data };
            }

            case 'getPaymentRequest': {
                const paymentRequestId = inputs.paymentRequestId;
                if (!paymentRequestId) return { error: 'Missing inputs.paymentRequestId' };
                const res = await fetch(`${BASE_URL}/payment_requests/${paymentRequestId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? `Xendit error: ${res.status}` };
                return { output: data };
            }

            case 'createRefund': {
                const body = {
                    payment_request_id: inputs.paymentRequestId,
                    invoice_id: inputs.invoiceId,
                    reason: inputs.reason,
                    amount: inputs.amount,
                    currency: inputs.currency ?? 'IDR',
                    reference_id: inputs.referenceId ?? `REFUND-${Date.now()}`,
                };
                if (!body.payment_request_id && !body.invoice_id) {
                    return { error: 'Missing inputs.paymentRequestId or inputs.invoiceId' };
                }
                const res = await fetch(`${BASE_URL}/refunds`, {
                    method: 'POST',
                    headers: {
                        ...headers,
                        'idempotency-key': inputs.idempotencyKey ?? `${Date.now()}`,
                    },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? `Xendit error: ${res.status}` };
                return { output: data };
            }

            case 'getRefund': {
                const refundId = inputs.refundId;
                if (!refundId) return { error: 'Missing inputs.refundId' };
                const res = await fetch(`${BASE_URL}/refunds/${refundId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? `Xendit error: ${res.status}` };
                return { output: data };
            }

            case 'createEWalletCharge': {
                const body = {
                    reference_id: inputs.referenceId ?? `EW-${Date.now()}`,
                    currency: inputs.currency ?? 'IDR',
                    amount: inputs.amount,
                    checkout_method: inputs.checkoutMethod ?? 'ONE_TIME_PAYMENT',
                    channel_code: inputs.channelCode,
                    channel_properties: inputs.channelProperties,
                    customer: inputs.customer,
                    metadata: inputs.metadata,
                    basket: inputs.basket,
                };
                if (!body.amount) return { error: 'Missing inputs.amount' };
                if (!body.channel_code) return { error: 'Missing inputs.channelCode' };
                const res = await fetch(`${BASE_URL}/ewallets/charges`, {
                    method: 'POST',
                    headers: {
                        ...headers,
                        'idempotency-key': inputs.idempotencyKey ?? `${Date.now()}`,
                    },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? `Xendit error: ${res.status}` };
                return { output: data };
            }

            default:
                return { error: `Unknown Xendit action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Xendit action error: ${err.message}`);
        return { error: err.message ?? 'Unknown error in executeXenditAction' };
    }
}
