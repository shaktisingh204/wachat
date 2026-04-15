'use server';

export async function executeMXTechnologiesAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const baseUrl = inputs.environment === 'production' ? 'https://api.mx.com' : 'https://int-api.mx.com';
        const credentials = Buffer.from(`${inputs.clientId}:${inputs.apiKey}`).toString('base64');

        const headers: Record<string, string> = {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/vnd.mx.api.v1+json',
            'Accept': 'application/vnd.mx.api.v1+json',
        };

        switch (actionName) {
            case 'listUsers': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.recordsPerPage) params.set('records_per_page', String(inputs.recordsPerPage));
                const res = await fetch(`${baseUrl}/users?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: `listUsers failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            case 'getUser': {
                const res = await fetch(`${baseUrl}/users/${inputs.userGuid}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: `getUser failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            case 'createUser': {
                const res = await fetch(`${baseUrl}/users`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        user: {
                            id: inputs.id,
                            email: inputs.email,
                            is_disabled: inputs.isDisabled ?? false,
                            metadata: inputs.metadata,
                        },
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: `createUser failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            case 'updateUser': {
                const res = await fetch(`${baseUrl}/users/${inputs.userGuid}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({
                        user: {
                            email: inputs.email,
                            is_disabled: inputs.isDisabled,
                            metadata: inputs.metadata,
                        },
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: `updateUser failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            case 'deleteUser': {
                const res = await fetch(`${baseUrl}/users/${inputs.userGuid}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) {
                    const errText = await res.text();
                    return { error: `deleteUser failed: ${res.status} ${errText}` };
                }
                return { output: { success: true, userGuid: inputs.userGuid } };
            }

            case 'listMembers': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.recordsPerPage) params.set('records_per_page', String(inputs.recordsPerPage));
                const res = await fetch(`${baseUrl}/users/${inputs.userGuid}/members?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: `listMembers failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            case 'getMember': {
                const res = await fetch(`${baseUrl}/users/${inputs.userGuid}/members/${inputs.memberGuid}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: `getMember failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            case 'createMember': {
                const res = await fetch(`${baseUrl}/users/${inputs.userGuid}/members`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        member: {
                            institution_code: inputs.institutionCode,
                            credentials: inputs.credentials,
                            metadata: inputs.metadata,
                        },
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: `createMember failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            case 'listAccounts': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.recordsPerPage) params.set('records_per_page', String(inputs.recordsPerPage));
                const res = await fetch(`${baseUrl}/users/${inputs.userGuid}/accounts?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: `listAccounts failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            case 'getAccount': {
                const res = await fetch(`${baseUrl}/users/${inputs.userGuid}/accounts/${inputs.accountGuid}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: `getAccount failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            case 'listTransactions': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.recordsPerPage) params.set('records_per_page', String(inputs.recordsPerPage));
                if (inputs.fromDate) params.set('from_date', inputs.fromDate);
                if (inputs.toDate) params.set('to_date', inputs.toDate);
                const res = await fetch(`${baseUrl}/users/${inputs.userGuid}/transactions?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: `listTransactions failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            case 'getTransaction': {
                const res = await fetch(`${baseUrl}/users/${inputs.userGuid}/transactions/${inputs.transactionGuid}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: `getTransaction failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            case 'listStatements': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.recordsPerPage) params.set('records_per_page', String(inputs.recordsPerPage));
                const res = await fetch(`${baseUrl}/users/${inputs.userGuid}/members/${inputs.memberGuid}/statements?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: `listStatements failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            case 'identifyAccount': {
                const res = await fetch(`${baseUrl}/users/${inputs.userGuid}/members/${inputs.memberGuid}/identify`, {
                    method: 'POST',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: `identifyAccount failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            case 'listHoldings': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.recordsPerPage) params.set('records_per_page', String(inputs.recordsPerPage));
                if (inputs.fromDate) params.set('from_date', inputs.fromDate);
                if (inputs.toDate) params.set('to_date', inputs.toDate);
                const res = await fetch(`${baseUrl}/users/${inputs.userGuid}/holdings?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: `listHoldings failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            default:
                return { error: `Unknown MX Technologies action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`MX Technologies action error: ${err?.message}`);
        return { error: err?.message ?? 'Unknown error in executeMXTechnologiesAction' };
    }
}
