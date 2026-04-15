'use server';

export async function executeMonoAfricaAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const baseUrl = 'https://api.mono.co/v2';
        const headers: Record<string, string> = {
            'mono-sec-key': inputs.secretKey as string,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };

        switch (actionName) {
            case 'getAccount': {
                const res = await fetch(`${baseUrl}/accounts/${inputs.accountId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: `getAccount failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            case 'getAccountStatement': {
                const params = new URLSearchParams();
                if (inputs.period) params.set('period', inputs.period);
                if (inputs.output) params.set('output', inputs.output);
                const res = await fetch(`${baseUrl}/accounts/${inputs.accountId}/statement?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: `getAccountStatement failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            case 'getAccountTransactions': {
                const params = new URLSearchParams();
                if (inputs.start) params.set('start', inputs.start);
                if (inputs.end) params.set('end', inputs.end);
                if (inputs.narration) params.set('narration', inputs.narration);
                if (inputs.type) params.set('type', inputs.type);
                if (inputs.paginate !== undefined) params.set('paginate', String(inputs.paginate));
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const res = await fetch(`${baseUrl}/accounts/${inputs.accountId}/transactions?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: `getAccountTransactions failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            case 'getAccountIdentity': {
                const res = await fetch(`${baseUrl}/accounts/${inputs.accountId}/identity`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: `getAccountIdentity failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            case 'getAccountHoldings': {
                const res = await fetch(`${baseUrl}/accounts/${inputs.accountId}/assets`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: `getAccountHoldings failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            case 'getAccountEarnings': {
                const params = new URLSearchParams();
                if (inputs.type) params.set('type', inputs.type);
                const res = await fetch(`${baseUrl}/accounts/${inputs.accountId}/income?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: `getAccountEarnings failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            case 'syncAccount': {
                const res = await fetch(`${baseUrl}/accounts/${inputs.accountId}/sync`, {
                    method: 'POST',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: `syncAccount failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            case 'getAllAccounts': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const res = await fetch(`${baseUrl}/accounts?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: `getAllAccounts failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            case 'getInstitutions': {
                const params = new URLSearchParams();
                if (inputs.name) params.set('name', inputs.name);
                const res = await fetch(`${baseUrl}/institutions?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: `getInstitutions failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            case 'getInstitution': {
                const res = await fetch(`${baseUrl}/institutions/${inputs.institutionId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: `getInstitution failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            case 'initiatePayment': {
                const res = await fetch(`${baseUrl}/payments`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        amount: inputs.amount,
                        type: inputs.type,
                        description: inputs.description,
                        reference: inputs.reference,
                        redirect_url: inputs.redirectUrl,
                        customer: inputs.customer,
                        meta: inputs.meta,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: `initiatePayment failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            case 'verifyPayment': {
                const res = await fetch(`${baseUrl}/payments/${inputs.paymentId}/verify`, {
                    method: 'POST',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: `verifyPayment failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            case 'getPaymentLink': {
                const res = await fetch(`${baseUrl}/payments/${inputs.paymentId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: `getPaymentLink failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            case 'listPayments': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.status) params.set('status', inputs.status);
                const res = await fetch(`${baseUrl}/payments?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: `listPayments failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            case 'getPayment': {
                const res = await fetch(`${baseUrl}/payments/${inputs.paymentId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: `getPayment failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            default:
                return { error: `Unknown Mono Africa action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Mono Africa action error: ${err?.message}`);
        return { error: err?.message ?? 'Unknown error in executeMonoAfricaAction' };
    }
}
