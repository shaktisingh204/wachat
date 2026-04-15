'use server';

export async function executePaychexAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE_URL = 'https://api.paychex.com';

    try {
        const fetchToken = async (): Promise<string> => {
            const res = await fetch(`${BASE_URL}/auth/oauth/v2/token`, {
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
                throw new Error(`Paychex token fetch failed: ${err}`);
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
            case 'listCompanies': {
                const res = await fetch(`${BASE_URL}/companies`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getCompany': {
                const res = await fetch(`${BASE_URL}/companies/${inputs.companyId}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'listWorkers': {
                const params = new URLSearchParams();
                if (inputs.offset) params.set('offset', inputs.offset);
                if (inputs.limit) params.set('limit', inputs.limit);
                const res = await fetch(`${BASE_URL}/companies/${inputs.companyId}/workers?${params.toString()}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getWorker': {
                const res = await fetch(`${BASE_URL}/workers/${inputs.workerId}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'createWorker': {
                const res = await fetch(`${BASE_URL}/companies/${inputs.companyId}/workers`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.worker || {}),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'updateWorker': {
                const res = await fetch(`${BASE_URL}/workers/${inputs.workerId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify(inputs.updates || {}),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'listPayPeriods': {
                const params = new URLSearchParams();
                if (inputs.startDate) params.set('startDate', inputs.startDate);
                if (inputs.endDate) params.set('endDate', inputs.endDate);
                const res = await fetch(`${BASE_URL}/companies/${inputs.companyId}/payperiods?${params.toString()}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getPayPeriod': {
                const res = await fetch(`${BASE_URL}/companies/${inputs.companyId}/payperiods/${inputs.payPeriodId}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'listEarnings': {
                const res = await fetch(`${BASE_URL}/workers/${inputs.workerId}/earnings`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getEarning': {
                const res = await fetch(`${BASE_URL}/workers/${inputs.workerId}/earnings/${inputs.earningId}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'listDeductions': {
                const res = await fetch(`${BASE_URL}/workers/${inputs.workerId}/deductions`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getDeduction': {
                const res = await fetch(`${BASE_URL}/workers/${inputs.workerId}/deductions/${inputs.deductionId}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'listTimeAndAttendance': {
                const params = new URLSearchParams();
                if (inputs.startDate) params.set('startDate', inputs.startDate);
                if (inputs.endDate) params.set('endDate', inputs.endDate);
                const res = await fetch(`${BASE_URL}/companies/${inputs.companyId}/time?${params.toString()}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getTimeOffRequests': {
                const params = new URLSearchParams();
                if (inputs.startDate) params.set('startDate', inputs.startDate);
                if (inputs.endDate) params.set('endDate', inputs.endDate);
                const res = await fetch(`${BASE_URL}/workers/${inputs.workerId}/timeoffrequests?${params.toString()}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            default:
                return { error: `Paychex: unknown action "${actionName}"` };
        }
    } catch (err: any) {
        logger.log(`Paychex action error: ${err.message}`);
        return { error: err.message };
    }
}
