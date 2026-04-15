'use server';

export async function executeQuickBooksPaymentsAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
) {
    try {
        const accessToken = inputs.accessToken;
        const environment = inputs.environment === 'production' ? 'production' : 'sandbox';
        const baseUrl =
            environment === 'production'
                ? 'https://api.intuit.com/quickbooks/v4'
                : 'https://sandbox.api.intuit.com/quickbooks/v4';
        const companyId = inputs.companyId;

        const headers: Record<string, string> = {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'Request-Id': `sabflow-${Date.now()}`,
        };

        switch (actionName) {
            case 'getCard': {
                const cardId = inputs.cardId;
                const customerId = inputs.customerId;
                const res = await fetch(
                    `${baseUrl}/customers/${customerId}/cards/${cardId}`,
                    { method: 'GET', headers }
                );
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || JSON.stringify(data) };
                return { output: { card: data } };
            }

            case 'createCard': {
                const customerId = inputs.customerId;
                const body = {
                    number: inputs.cardNumber,
                    expMonth: inputs.expMonth,
                    expYear: inputs.expYear,
                    cvc: inputs.cvc,
                    name: inputs.cardholderName,
                    address: inputs.address,
                };
                const res = await fetch(`${baseUrl}/customers/${customerId}/cards`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || JSON.stringify(data) };
                return { output: { card: data } };
            }

            case 'deleteCard': {
                const customerId = inputs.customerId;
                const cardId = inputs.cardId;
                const res = await fetch(
                    `${baseUrl}/customers/${customerId}/cards/${cardId}`,
                    { method: 'DELETE', headers }
                );
                if (res.status === 204) return { output: { deleted: true } };
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || JSON.stringify(data) };
                return { output: { deleted: true, data } };
            }

            case 'listCards': {
                const customerId = inputs.customerId;
                const res = await fetch(
                    `${baseUrl}/customers/${customerId}/cards`,
                    { method: 'GET', headers }
                );
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || JSON.stringify(data) };
                return { output: { cards: data } };
            }

            case 'chargeCard': {
                const body = {
                    amount: inputs.amount,
                    currency: inputs.currency || 'USD',
                    card: {
                        token: inputs.cardToken,
                    },
                    capture: inputs.capture !== false,
                    context: {
                        mobile: inputs.mobile || false,
                        isEcommerce: inputs.isEcommerce !== false,
                    },
                };
                const res = await fetch(`${baseUrl}/payments/charges`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || JSON.stringify(data) };
                return { output: { charge: data } };
            }

            case 'voidTransaction': {
                const chargeId = inputs.chargeId;
                const res = await fetch(`${baseUrl}/payments/charges/${chargeId}/void`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || JSON.stringify(data) };
                return { output: { voided: data } };
            }

            case 'refundTransaction': {
                const chargeId = inputs.chargeId;
                const body = {
                    amount: inputs.amount,
                    description: inputs.description,
                };
                const res = await fetch(`${baseUrl}/payments/charges/${chargeId}/refunds`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || JSON.stringify(data) };
                return { output: { refund: data } };
            }

            case 'getTransaction': {
                const chargeId = inputs.chargeId;
                const res = await fetch(`${baseUrl}/payments/charges/${chargeId}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || JSON.stringify(data) };
                return { output: { transaction: data } };
            }

            case 'createBankAccount': {
                const customerId = inputs.customerId;
                const body = {
                    name: inputs.accountName,
                    routingNumber: inputs.routingNumber,
                    accountNumber: inputs.accountNumber,
                    accountType: inputs.accountType || 'PERSONAL_CHECKING',
                    phone: inputs.phone,
                };
                const res = await fetch(
                    `${baseUrl}/customers/${customerId}/bank-accounts`,
                    { method: 'POST', headers, body: JSON.stringify(body) }
                );
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || JSON.stringify(data) };
                return { output: { bankAccount: data } };
            }

            case 'deleteBankAccount': {
                const customerId = inputs.customerId;
                const bankAccountId = inputs.bankAccountId;
                const res = await fetch(
                    `${baseUrl}/customers/${customerId}/bank-accounts/${bankAccountId}`,
                    { method: 'DELETE', headers }
                );
                if (res.status === 204) return { output: { deleted: true } };
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || JSON.stringify(data) };
                return { output: { deleted: true, data } };
            }

            case 'chargeECheck': {
                const customerId = inputs.customerId;
                const bankAccountId = inputs.bankAccountId;
                const body = {
                    amount: inputs.amount,
                    bankAccount: { id: bankAccountId },
                    checkNumber: inputs.checkNumber,
                    paymentMode: inputs.paymentMode || 'WEB',
                };
                const res = await fetch(`${baseUrl}/payments/echecks`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || JSON.stringify(data) };
                return { output: { echeck: data } };
            }

            case 'getECheck': {
                const echeckId = inputs.echeckId;
                const res = await fetch(`${baseUrl}/payments/echecks/${echeckId}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || JSON.stringify(data) };
                return { output: { echeck: data } };
            }

            case 'listCharges': {
                const params = new URLSearchParams();
                if (inputs.startDate) params.set('startCreatedTime', inputs.startDate);
                if (inputs.endDate) params.set('endCreatedTime', inputs.endDate);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const res = await fetch(
                    `${baseUrl}/payments/charges?${params.toString()}`,
                    { method: 'GET', headers }
                );
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || JSON.stringify(data) };
                return { output: { charges: data } };
            }

            case 'getCharge': {
                const chargeId = inputs.chargeId;
                const res = await fetch(`${baseUrl}/payments/charges/${chargeId}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || JSON.stringify(data) };
                return { output: { charge: data } };
            }

            case 'captureCharge': {
                const chargeId = inputs.chargeId;
                const body = { amount: inputs.amount };
                const res = await fetch(`${baseUrl}/payments/charges/${chargeId}/capture`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || JSON.stringify(data) };
                return { output: { captured: data } };
            }

            default:
                return { error: `Unknown QuickBooks Payments action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`QuickBooks Payments action error: ${err.message}`);
        return { error: err.message || 'QuickBooks Payments action failed' };
    }
}
