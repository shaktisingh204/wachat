'use server';

export async function executeFlutterwaveAction(actionName: string, inputs: any, user: any, logger: any) {
    const secretKey = inputs.secretKey;
    const baseUrl = 'https://api.flutterwave.com/v3';
    const headers: Record<string, string> = {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'initiatePayment': {
                const body: any = {
                    tx_ref: inputs.txRef,
                    amount: inputs.amount,
                    currency: inputs.currency,
                    redirect_url: inputs.redirectUrl,
                    customer: {
                        email: inputs.customerEmail,
                        name: inputs.customerName,
                        phonenumber: inputs.customerPhone,
                    },
                };
                if (inputs.paymentOptions) body.payment_options = inputs.paymentOptions;
                if (inputs.customizations) body.customizations = inputs.customizations;
                if (inputs.meta) body.meta = inputs.meta;
                const res = await fetch(`${baseUrl}/payments`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok || data.status !== 'success') return { error: data?.message || 'initiatePayment failed' };
                return { output: data.data };
            }
            case 'verifyPayment': {
                const transactionId = inputs.transactionId;
                const res = await fetch(`${baseUrl}/transactions/${transactionId}/verify`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok || data.status !== 'success') return { error: data?.message || 'verifyPayment failed' };
                return { output: data.data };
            }
            case 'listTransactions': {
                const params = new URLSearchParams();
                if (inputs.page) params.append('page', inputs.page);
                if (inputs.perPage) params.append('per_page', inputs.perPage);
                if (inputs.status) params.append('status', inputs.status);
                if (inputs.currency) params.append('currency', inputs.currency);
                const res = await fetch(`${baseUrl}/transactions?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok || data.status !== 'success') return { error: data?.message || 'listTransactions failed' };
                return { output: data.data };
            }
            case 'getTransaction': {
                const transactionId = inputs.transactionId;
                const res = await fetch(`${baseUrl}/transactions/${transactionId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok || data.status !== 'success') return { error: data?.message || 'getTransaction failed' };
                return { output: data.data };
            }
            case 'initiateTransfer': {
                const body: any = {
                    account_bank: inputs.accountBank,
                    account_number: inputs.accountNumber,
                    amount: inputs.amount,
                    currency: inputs.currency,
                    narration: inputs.narration,
                    reference: inputs.reference,
                };
                if (inputs.beneficiaryName) body.beneficiary_name = inputs.beneficiaryName;
                if (inputs.meta) body.meta = inputs.meta;
                const res = await fetch(`${baseUrl}/transfers`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok || data.status !== 'success') return { error: data?.message || 'initiateTransfer failed' };
                return { output: data.data };
            }
            case 'getTransfer': {
                const transferId = inputs.transferId;
                const res = await fetch(`${baseUrl}/transfers/${transferId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok || data.status !== 'success') return { error: data?.message || 'getTransfer failed' };
                return { output: data.data };
            }
            case 'listTransfers': {
                const params = new URLSearchParams();
                if (inputs.page) params.append('page', inputs.page);
                if (inputs.perPage) params.append('per_page', inputs.perPage);
                if (inputs.status) params.append('status', inputs.status);
                const res = await fetch(`${baseUrl}/transfers?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok || data.status !== 'success') return { error: data?.message || 'listTransfers failed' };
                return { output: data.data };
            }
            case 'createVirtualAccount': {
                const body: any = {
                    email: inputs.email,
                    is_permanent: inputs.isPermanent !== undefined ? inputs.isPermanent : true,
                    bvn: inputs.bvn,
                    tx_ref: inputs.txRef,
                    amount: inputs.amount,
                    currency: inputs.currency || 'NGN',
                    narration: inputs.narration,
                    phonenumber: inputs.phonenumber,
                    firstname: inputs.firstName,
                    lastname: inputs.lastName,
                };
                const res = await fetch(`${baseUrl}/virtual-account-numbers`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok || data.status !== 'success') return { error: data?.message || 'createVirtualAccount failed' };
                return { output: data.data };
            }
            case 'getVirtualAccount': {
                const orderRef = inputs.orderRef;
                const res = await fetch(`${baseUrl}/virtual-account-numbers/${orderRef}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok || data.status !== 'success') return { error: data?.message || 'getVirtualAccount failed' };
                return { output: data.data };
            }
            case 'listBanks': {
                const country = inputs.country || 'NG';
                const res = await fetch(`${baseUrl}/banks/${country}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok || data.status !== 'success') return { error: data?.message || 'listBanks failed' };
                return { output: data.data };
            }
            case 'getBankBranches': {
                const bankId = inputs.bankId;
                const res = await fetch(`${baseUrl}/banks/${bankId}/branches`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok || data.status !== 'success') return { error: data?.message || 'getBankBranches failed' };
                return { output: data.data };
            }
            case 'generatePaymentLink': {
                const body: any = {
                    tx_ref: inputs.txRef,
                    amount: inputs.amount,
                    currency: inputs.currency,
                    redirect_url: inputs.redirectUrl,
                    customer: {
                        email: inputs.customerEmail,
                        name: inputs.customerName,
                    },
                };
                if (inputs.customizations) body.customizations = inputs.customizations;
                if (inputs.expiryDate) body.expiry = inputs.expiryDate;
                const res = await fetch(`${baseUrl}/payments`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok || data.status !== 'success') return { error: data?.message || 'generatePaymentLink failed' };
                return { output: data.data };
            }
            case 'createPaymentPlan': {
                const body: any = {
                    amount: inputs.amount,
                    name: inputs.name,
                    interval: inputs.interval,
                };
                if (inputs.duration) body.duration = inputs.duration;
                if (inputs.currency) body.currency = inputs.currency;
                const res = await fetch(`${baseUrl}/payment-plans`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok || data.status !== 'success') return { error: data?.message || 'createPaymentPlan failed' };
                return { output: data.data };
            }
            case 'listPaymentPlans': {
                const params = new URLSearchParams();
                if (inputs.page) params.append('page', inputs.page);
                if (inputs.perPage) params.append('per_page', inputs.perPage);
                if (inputs.status) params.append('status', inputs.status);
                const res = await fetch(`${baseUrl}/payment-plans?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok || data.status !== 'success') return { error: data?.message || 'listPaymentPlans failed' };
                return { output: data.data };
            }
            case 'subscribeToPaymentPlan': {
                const body: any = {
                    name: inputs.name,
                    email: inputs.email,
                    phone: inputs.phone,
                    plan_id: inputs.planId,
                };
                if (inputs.token) body.token = inputs.token;
                const res = await fetch(`${baseUrl}/subscriptions`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok || data.status !== 'success') return { error: data?.message || 'subscribeToPaymentPlan failed' };
                return { output: data.data };
            }
            default:
                return { error: `Unknown flutterwave action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`flutterwave error: ${err.message}`);
        return { error: err.message || 'flutterwave action failed' };
    }
}
