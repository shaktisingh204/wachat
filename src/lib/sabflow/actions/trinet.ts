'use server';

export async function executeTrinetAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE_URL = 'https://api.trinet.com/v2';

    try {
        const fetchToken = async (): Promise<string> => {
            const res = await fetch('https://api.trinet.com/oauth/accesstoken', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    grant_type: 'client_credentials',
                    client_id: inputs.clientId,
                    client_secret: inputs.clientSecret,
                }).toString(),
            });
            if (!res.ok) {
                const err = await res.text();
                throw new Error(`TriNet token fetch failed: ${err}`);
            }
            const data = await res.json();
            return data.access_token;
        };

        if (actionName === 'getToken') {
            const token = await fetchToken();
            return { output: { access_token: token } };
        }

        const accessToken = inputs.accessToken || (await fetchToken());
        const headers: Record<string, string> = {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listEmployees': {
                const params = new URLSearchParams();
                if (inputs.companyId) params.set('companyId', inputs.companyId);
                if (inputs.status) params.set('status', inputs.status);
                const res = await fetch(`${BASE_URL}/employees?${params.toString()}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getEmployee': {
                const res = await fetch(`${BASE_URL}/employees/${inputs.employeeId}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'updateEmployee': {
                const res = await fetch(`${BASE_URL}/employees/${inputs.employeeId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify(inputs.updates || {}),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'listBenefits': {
                const params = new URLSearchParams();
                if (inputs.employeeId) params.set('employeeId', inputs.employeeId);
                const res = await fetch(`${BASE_URL}/benefits?${params.toString()}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getBenefit': {
                const res = await fetch(`${BASE_URL}/benefits/${inputs.benefitId}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'listPayStubs': {
                const params = new URLSearchParams();
                if (inputs.employeeId) params.set('employeeId', inputs.employeeId);
                if (inputs.startDate) params.set('startDate', inputs.startDate);
                if (inputs.endDate) params.set('endDate', inputs.endDate);
                const res = await fetch(`${BASE_URL}/paystubs?${params.toString()}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getPayStub': {
                const res = await fetch(`${BASE_URL}/paystubs/${inputs.payStubId}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'listTimeOffRequests': {
                const params = new URLSearchParams();
                if (inputs.employeeId) params.set('employeeId', inputs.employeeId);
                if (inputs.status) params.set('status', inputs.status);
                const res = await fetch(`${BASE_URL}/timeoff/requests?${params.toString()}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getTimeOffRequest': {
                const res = await fetch(`${BASE_URL}/timeoff/requests/${inputs.requestId}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'submitTimeOffRequest': {
                const res = await fetch(`${BASE_URL}/timeoff/requests`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        employeeId: inputs.employeeId,
                        startDate: inputs.startDate,
                        endDate: inputs.endDate,
                        type: inputs.type,
                        notes: inputs.notes,
                    }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'approveTimeOffRequest': {
                const res = await fetch(`${BASE_URL}/timeoff/requests/${inputs.requestId}/approve`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ notes: inputs.notes }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'listCompanyInfo': {
                const res = await fetch(`${BASE_URL}/companies`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getCompanyInfo': {
                const res = await fetch(`${BASE_URL}/companies/${inputs.companyId}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'listLocations': {
                const params = new URLSearchParams();
                if (inputs.companyId) params.set('companyId', inputs.companyId);
                const res = await fetch(`${BASE_URL}/locations?${params.toString()}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            default:
                return { error: `TriNet: unknown action "${actionName}"` };
        }
    } catch (err: any) {
        logger.log(`TriNet action error: ${err.message}`);
        return { error: err.message };
    }
}
