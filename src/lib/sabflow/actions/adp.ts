'use server';

export async function executeAdpAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE_URL = 'https://api.adp.com';

    try {
        // Fetch token using Basic auth (client_credentials)
        const getToken = async (): Promise<string> => {
            const credentials = Buffer.from(`${inputs.clientId}:${inputs.clientSecret}`).toString('base64');
            const res = await fetch(`${BASE_URL}/auth/oauth/v2/token`, {
                method: 'POST',
                headers: {
                    Authorization: `Basic ${credentials}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: 'grant_type=client_credentials',
            });
            if (!res.ok) {
                const err = await res.text();
                throw new Error(`ADP token fetch failed: ${err}`);
            }
            const data = await res.json();
            return data.access_token;
        };

        if (actionName === 'getToken') {
            const token = await getToken();
            return { output: { access_token: token } };
        }

        const accessToken = inputs.accessToken || (await getToken());
        const headers: Record<string, string> = {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listWorkers': {
                const params = new URLSearchParams();
                if (inputs.top) params.set('$top', inputs.top);
                if (inputs.skip) params.set('$skip', inputs.skip);
                const res = await fetch(`${BASE_URL}/hr/v2/workers?${params.toString()}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getWorker': {
                const res = await fetch(`${BASE_URL}/hr/v2/workers/${inputs.aoid}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'listPayStatements': {
                const params = new URLSearchParams();
                if (inputs.aoid) params.set('$filter', `worker/associateOID eq '${inputs.aoid}'`);
                const res = await fetch(`${BASE_URL}/payroll/v1/pay-statements?${params.toString()}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getPayStatement': {
                const res = await fetch(`${BASE_URL}/payroll/v1/pay-statements/${inputs.payStatementId}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'listPositions': {
                const res = await fetch(`${BASE_URL}/hr/v2/workers/${inputs.aoid}/work-assignments`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getPosition': {
                const res = await fetch(`${BASE_URL}/hr/v2/workers/${inputs.aoid}/work-assignments/${inputs.itemId}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'listOrganizations': {
                const res = await fetch(`${BASE_URL}/core/v1/organization-departments`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getOrganization': {
                const res = await fetch(`${BASE_URL}/core/v1/organization-departments/${inputs.departmentId}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'listDepartments': {
                const res = await fetch(`${BASE_URL}/core/v1/organization-departments`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'listTimeOff': {
                const params = new URLSearchParams();
                if (inputs.aoid) params.set('workerID', inputs.aoid);
                const res = await fetch(`${BASE_URL}/time/v2/workers/${inputs.aoid}/time-off-requests?${params.toString()}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getTimeOff': {
                const res = await fetch(`${BASE_URL}/time/v2/workers/${inputs.aoid}/time-off-requests/${inputs.requestId}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'listPayRates': {
                const res = await fetch(`${BASE_URL}/hr/v2/workers/${inputs.aoid}/work-assignments/${inputs.itemId}/pay-grade-rates`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getPayRate': {
                const res = await fetch(`${BASE_URL}/hr/v2/workers/${inputs.aoid}/work-assignments/${inputs.itemId}/pay-grade-rates/${inputs.rateId}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'listDirectDeposits': {
                const res = await fetch(`${BASE_URL}/payroll/v1/workers/${inputs.aoid}/direct-deposits`, { headers });
                const data = await res.json();
                return { output: data };
            }
            default:
                return { error: `ADP: unknown action "${actionName}"` };
        }
    } catch (err: any) {
        logger.log(`ADP action error: ${err.message}`);
        return { error: err.message };
    }
}
