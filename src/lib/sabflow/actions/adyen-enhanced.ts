'use server';

export async function executeAdyenEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    const apiKey = inputs.apiKey;
    const baseUrl = inputs.baseUrl || 'https://checkout-test.adyen.com/v71';
    const headers: Record<string, string> = {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'makePayment': {
                const body: any = {
                    amount: { currency: inputs.currency, value: inputs.amount },
                    reference: inputs.reference,
                    paymentMethod: inputs.paymentMethod,
                    returnUrl: inputs.returnUrl,
                    merchantAccount: inputs.merchantAccount,
                };
                if (inputs.shopperReference) body.shopperReference = inputs.shopperReference;
                const res = await fetch(`${baseUrl}/payments`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || 'makePayment failed' };
                return { output: data };
            }
            case 'getPaymentMethods': {
                const body: any = {
                    merchantAccount: inputs.merchantAccount,
                    countryCode: inputs.countryCode,
                    amount: inputs.amount ? { currency: inputs.currency, value: inputs.amount } : undefined,
                };
                const res = await fetch(`${baseUrl}/paymentMethods`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || 'getPaymentMethods failed' };
                return { output: data };
            }
            case 'createPaymentSession': {
                const body: any = {
                    merchantAccount: inputs.merchantAccount,
                    amount: { currency: inputs.currency, value: inputs.amount },
                    returnUrl: inputs.returnUrl,
                    reference: inputs.reference,
                    countryCode: inputs.countryCode,
                };
                const res = await fetch(`${baseUrl}/sessions`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || 'createPaymentSession failed' };
                return { output: data };
            }
            case 'submitAdditionalDetails': {
                const body: any = {
                    details: inputs.details,
                    paymentData: inputs.paymentData,
                };
                const res = await fetch(`${baseUrl}/payments/details`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || 'submitAdditionalDetails failed' };
                return { output: data };
            }
            case 'cancelPayment': {
                const body: any = {
                    merchantAccount: inputs.merchantAccount,
                    reference: inputs.reference,
                    paymentPspReference: inputs.paymentPspReference,
                };
                const res = await fetch(`${baseUrl}/cancels`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || 'cancelPayment failed' };
                return { output: data };
            }
            case 'capturePayment': {
                const body: any = {
                    merchantAccount: inputs.merchantAccount,
                    amount: { currency: inputs.currency, value: inputs.amount },
                    reference: inputs.reference,
                };
                const pspReference = inputs.paymentPspReference;
                const res = await fetch(`${baseUrl}/payments/${pspReference}/captures`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || 'capturePayment failed' };
                return { output: data };
            }
            case 'refundPayment': {
                const body: any = {
                    merchantAccount: inputs.merchantAccount,
                    amount: { currency: inputs.currency, value: inputs.amount },
                    reference: inputs.reference,
                };
                const pspReference = inputs.paymentPspReference;
                const res = await fetch(`${baseUrl}/payments/${pspReference}/refunds`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || 'refundPayment failed' };
                return { output: data };
            }
            case 'reversePayment': {
                const body: any = {
                    merchantAccount: inputs.merchantAccount,
                    reference: inputs.reference,
                };
                const pspReference = inputs.paymentPspReference;
                const res = await fetch(`${baseUrl}/payments/${pspReference}/reversals`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || 'reversePayment failed' };
                return { output: data };
            }
            case 'createToken': {
                const body: any = {
                    merchantAccount: inputs.merchantAccount,
                    shopperReference: inputs.shopperReference,
                    paymentMethod: inputs.paymentMethod,
                    reference: inputs.reference,
                    returnUrl: inputs.returnUrl,
                    amount: { currency: inputs.currency || 'USD', value: 0 },
                    storePaymentMethod: true,
                };
                const res = await fetch(`${baseUrl}/payments`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || 'createToken failed' };
                return { output: data };
            }
            case 'listStoredPaymentMethods': {
                const merchantAccount = inputs.merchantAccount;
                const shopperReference = inputs.shopperReference;
                const params = new URLSearchParams({ merchantAccount });
                if (shopperReference) params.append('shopperReference', shopperReference);
                const recurringUrl = (inputs.recurringBaseUrl || 'https://pal-test.adyen.com/pal/servlet/Recurring/v68');
                const body: any = {
                    merchantAccount,
                    shopperReference,
                };
                const res = await fetch(`${recurringUrl}/listRecurringDetails`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || 'listStoredPaymentMethods failed' };
                return { output: data };
            }
            case 'deleteStoredPaymentMethod': {
                const recurringUrl = (inputs.recurringBaseUrl || 'https://pal-test.adyen.com/pal/servlet/Recurring/v68');
                const body: any = {
                    merchantAccount: inputs.merchantAccount,
                    shopperReference: inputs.shopperReference,
                    recurringDetailReference: inputs.recurringDetailReference,
                };
                const res = await fetch(`${recurringUrl}/disable`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || 'deleteStoredPaymentMethod failed' };
                return { output: data };
            }
            case 'getPaymentDetails': {
                const body: any = { details: inputs.details };
                if (inputs.paymentData) body.paymentData = inputs.paymentData;
                const res = await fetch(`${baseUrl}/payments/details`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || 'getPaymentDetails failed' };
                return { output: data };
            }
            case 'createOrder': {
                const body: any = {
                    merchantAccount: inputs.merchantAccount,
                    amount: { currency: inputs.currency, value: inputs.amount },
                    reference: inputs.reference,
                };
                const res = await fetch(`${baseUrl}/orders`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || 'createOrder failed' };
                return { output: data };
            }
            case 'cancelOrder': {
                const body: any = {
                    merchantAccount: inputs.merchantAccount,
                    order: { orderData: inputs.orderData, pspReference: inputs.orderPspReference },
                };
                const res = await fetch(`${baseUrl}/orders/cancel`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || 'cancelOrder failed' };
                return { output: data };
            }
            case 'getBalance': {
                const body: any = {
                    merchantAccount: inputs.merchantAccount,
                    paymentMethod: inputs.paymentMethod,
                };
                const res = await fetch(`${baseUrl}/paymentMethods/balance`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || 'getBalance failed' };
                return { output: data };
            }
            default:
                return { error: `Unknown adyen-enhanced action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`adyen-enhanced error: ${err.message}`);
        return { error: err.message || 'adyen-enhanced action failed' };
    }
}
