'use server';

export async function executeFinicityAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const baseUrl = 'https://api.finicity.com';
        const appKey = inputs.appKey as string;
        const partnerId = inputs.partnerId as string;
        const partnerSecret = inputs.partnerSecret as string;

        // Get access token
        const tokenRes = await fetch(`${baseUrl}/aggregation/v2/partners/authentication`, {
            method: 'POST',
            headers: {
                'Finicity-App-Key': appKey,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({ partnerId, partnerSecret }),
        });
        if (!tokenRes.ok) {
            const errText = await tokenRes.text();
            return { error: `Finicity auth failed: ${tokenRes.status} ${errText}` };
        }
        const tokenData = await tokenRes.json();
        const accessToken: string = tokenData.token;

        const headers: Record<string, string> = {
            'Finicity-App-Key': appKey,
            'Finicity-App-Token': accessToken,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };

        switch (actionName) {
            case 'addCustomer': {
                const res = await fetch(`${baseUrl}/aggregation/v2/customers/active`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        username: inputs.username,
                        firstName: inputs.firstName,
                        lastName: inputs.lastName,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: `addCustomer failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            case 'getCustomer': {
                const res = await fetch(`${baseUrl}/aggregation/v1/customers/${inputs.customerId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: `getCustomer failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            case 'listCustomers': {
                const params = new URLSearchParams();
                if (inputs.username) params.set('username', inputs.username);
                if (inputs.start) params.set('start', String(inputs.start));
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const res = await fetch(`${baseUrl}/aggregation/v1/customers?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: `listCustomers failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            case 'deleteCustomer': {
                const res = await fetch(`${baseUrl}/aggregation/v1/customers/${inputs.customerId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) {
                    const errText = await res.text();
                    return { error: `deleteCustomer failed: ${res.status} ${errText}` };
                }
                return { output: { success: true, customerId: inputs.customerId } };
            }

            case 'addAccount': {
                const res = await fetch(`${baseUrl}/aggregation/v1/customers/${inputs.customerId}/accounts`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        institutionId: inputs.institutionId,
                        credentials: inputs.credentials,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: `addAccount failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            case 'getAccount': {
                const res = await fetch(`${baseUrl}/aggregation/v1/customers/${inputs.customerId}/accounts/${inputs.accountId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: `getAccount failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            case 'listAccounts': {
                const res = await fetch(`${baseUrl}/aggregation/v1/customers/${inputs.customerId}/accounts`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: `listAccounts failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            case 'refreshAccounts': {
                const res = await fetch(`${baseUrl}/aggregation/v1/customers/${inputs.customerId}/accounts`, {
                    method: 'PUT',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: `refreshAccounts failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            case 'getTransactions': {
                const params = new URLSearchParams();
                if (inputs.fromDate) params.set('fromDate', String(inputs.fromDate));
                if (inputs.toDate) params.set('toDate', String(inputs.toDate));
                if (inputs.start) params.set('start', String(inputs.start));
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const res = await fetch(
                    `${baseUrl}/aggregation/v3/customers/${inputs.customerId}/accounts/${inputs.accountId}/transactions?${params.toString()}`,
                    { headers }
                );
                const data = await res.json();
                if (!res.ok) return { error: `getTransactions failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            case 'listTransactions': {
                const params = new URLSearchParams();
                if (inputs.fromDate) params.set('fromDate', String(inputs.fromDate));
                if (inputs.toDate) params.set('toDate', String(inputs.toDate));
                if (inputs.start) params.set('start', String(inputs.start));
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const res = await fetch(
                    `${baseUrl}/aggregation/v3/customers/${inputs.customerId}/transactions?${params.toString()}`,
                    { headers }
                );
                const data = await res.json();
                if (!res.ok) return { error: `listTransactions failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            case 'getReport': {
                const res = await fetch(`${baseUrl}/decisioning/v2/customers/${inputs.customerId}/reports/${inputs.reportId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: `getReport failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            case 'generateVOAReport': {
                const res = await fetch(`${baseUrl}/decisioning/v2/customers/${inputs.customerId}/voa`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        accountIds: inputs.accountIds,
                        callbackUrl: inputs.callbackUrl,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: `generateVOAReport failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            case 'generateVOIReport': {
                const res = await fetch(`${baseUrl}/decisioning/v2/customers/${inputs.customerId}/voi`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        accountIds: inputs.accountIds,
                        callbackUrl: inputs.callbackUrl,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: `generateVOIReport failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            case 'getAsset': {
                const res = await fetch(`${baseUrl}/aggregation/v1/customers/${inputs.customerId}/assets/${inputs.assetId}`, { headers });
                if (!res.ok) {
                    const errText = await res.text();
                    return { error: `getAsset failed: ${res.status} ${errText}` };
                }
                const buffer = await res.arrayBuffer();
                const base64 = Buffer.from(buffer).toString('base64');
                return { output: { assetId: inputs.assetId, base64Data: base64, contentType: res.headers.get('content-type') } };
            }

            case 'getStatement': {
                const res = await fetch(
                    `${baseUrl}/aggregation/v1/customers/${inputs.customerId}/accounts/${inputs.accountId}/statement`,
                    { headers }
                );
                if (!res.ok) {
                    const errText = await res.text();
                    return { error: `getStatement failed: ${res.status} ${errText}` };
                }
                const buffer = await res.arrayBuffer();
                const base64 = Buffer.from(buffer).toString('base64');
                return { output: { accountId: inputs.accountId, base64Statement: base64, contentType: res.headers.get('content-type') } };
            }

            default:
                return { error: `Unknown Finicity action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Finicity action error: ${err?.message}`);
        return { error: err?.message ?? 'Unknown error in executeFinicityAction' };
    }
}
