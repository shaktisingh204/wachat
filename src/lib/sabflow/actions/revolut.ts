'use server';

export async function executeRevolutAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = inputs.accessToken;
        const baseUrl = 'https://b2b.revolut.com/api/1.0';

        const headers: Record<string, string> = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listAccounts': {
                const res = await fetch(`${baseUrl}/accounts`, { headers });
                if (!res.ok) return { error: `listAccounts failed: ${res.status} ${await res.text()}` };
                return { output: { accounts: await res.json() } };
            }

            case 'getAccount': {
                const res = await fetch(`${baseUrl}/accounts/${inputs.accountId}`, { headers });
                if (!res.ok) return { error: `getAccount failed: ${res.status} ${await res.text()}` };
                return { output: { account: await res.json() } };
            }

            case 'getAccountDetails': {
                const res = await fetch(`${baseUrl}/accounts/${inputs.accountId}/bank-details`, { headers });
                if (!res.ok) return { error: `getAccountDetails failed: ${res.status} ${await res.text()}` };
                return { output: { details: await res.json() } };
            }

            case 'createPayment': {
                const body: Record<string, any> = {
                    request_id: inputs.requestId,
                    account_id: inputs.accountId,
                    receiver: inputs.receiver,
                    amount: inputs.amount,
                    currency: inputs.currency,
                };
                if (inputs.reference) body.reference = inputs.reference;
                if (inputs.scheduleFor) body.schedule_for = inputs.scheduleFor;
                const res = await fetch(`${baseUrl}/pay`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `createPayment failed: ${res.status} ${await res.text()}` };
                return { output: { payment: await res.json() } };
            }

            case 'getPayment': {
                const res = await fetch(`${baseUrl}/transactions/${inputs.paymentId}`, { headers });
                if (!res.ok) return { error: `getPayment failed: ${res.status} ${await res.text()}` };
                return { output: { payment: await res.json() } };
            }

            case 'cancelPayment': {
                const res = await fetch(`${baseUrl}/transactions/${inputs.paymentId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) return { error: `cancelPayment failed: ${res.status} ${await res.text()}` };
                return { output: { success: true, paymentId: inputs.paymentId } };
            }

            case 'listPayments': {
                const params = new URLSearchParams();
                if (inputs.from) params.set('from', inputs.from);
                if (inputs.to) params.set('to', inputs.to);
                if (inputs.count) params.set('count', String(inputs.count));
                if (inputs.type) params.set('type', inputs.type);
                const res = await fetch(`${baseUrl}/transactions?${params}`, { headers });
                if (!res.ok) return { error: `listPayments failed: ${res.status} ${await res.text()}` };
                return { output: { payments: await res.json() } };
            }

            case 'createCounterparty': {
                const body: Record<string, any> = {
                    name: inputs.name,
                    account_no: inputs.accountNo,
                    sort_code: inputs.sortCode,
                    bank_country: inputs.bankCountry,
                    currency: inputs.currency,
                };
                if (inputs.email) body.email = inputs.email;
                const res = await fetch(`${baseUrl}/counterparty`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `createCounterparty failed: ${res.status} ${await res.text()}` };
                return { output: { counterparty: await res.json() } };
            }

            case 'getCounterparty': {
                const res = await fetch(`${baseUrl}/counterparty/${inputs.counterpartyId}`, { headers });
                if (!res.ok) return { error: `getCounterparty failed: ${res.status} ${await res.text()}` };
                return { output: { counterparty: await res.json() } };
            }

            case 'deleteCounterparty': {
                const res = await fetch(`${baseUrl}/counterparty/${inputs.counterpartyId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) return { error: `deleteCounterparty failed: ${res.status} ${await res.text()}` };
                return { output: { success: true, counterpartyId: inputs.counterpartyId } };
            }

            case 'listCounterparties': {
                const res = await fetch(`${baseUrl}/counterparties`, { headers });
                if (!res.ok) return { error: `listCounterparties failed: ${res.status} ${await res.text()}` };
                return { output: { counterparties: await res.json() } };
            }

            case 'listTransactions': {
                const params = new URLSearchParams();
                if (inputs.from) params.set('from', inputs.from);
                if (inputs.to) params.set('to', inputs.to);
                if (inputs.count) params.set('count', String(inputs.count));
                if (inputs.accountId) params.set('account', inputs.accountId);
                const res = await fetch(`${baseUrl}/transactions?${params}`, { headers });
                if (!res.ok) return { error: `listTransactions failed: ${res.status} ${await res.text()}` };
                return { output: { transactions: await res.json() } };
            }

            case 'getTransaction': {
                const res = await fetch(`${baseUrl}/transactions/${inputs.transactionId}`, { headers });
                if (!res.ok) return { error: `getTransaction failed: ${res.status} ${await res.text()}` };
                return { output: { transaction: await res.json() } };
            }

            case 'getExchangeRate': {
                const params = new URLSearchParams({
                    from: inputs.from,
                    to: inputs.to,
                    amount: String(inputs.amount || 1),
                });
                const res = await fetch(`${baseUrl}/rate?${params}`, { headers });
                if (!res.ok) return { error: `getExchangeRate failed: ${res.status} ${await res.text()}` };
                return { output: { rate: await res.json() } };
            }

            case 'exchangeMoney': {
                const body: Record<string, any> = {
                    request_id: inputs.requestId,
                    from_account: inputs.fromAccount,
                    to_account: inputs.toAccount,
                    amount: inputs.amount,
                    currency: inputs.currency,
                };
                if (inputs.reference) body.reference = inputs.reference;
                const res = await fetch(`${baseUrl}/exchange`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `exchangeMoney failed: ${res.status} ${await res.text()}` };
                return { output: { exchange: await res.json() } };
            }

            default:
                return { error: `Unknown Revolut action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Revolut action error: ${err.message}`);
        return { error: err.message || 'Revolut action failed' };
    }
}
