'use server';

export async function executeRipplingAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE_URL = 'https://app.rippling.com/api/platform/api';

    try {
        let accessToken = inputs.accessToken;

        // If no access token but client credentials provided, fetch one via OAuth2
        if (!accessToken && inputs.clientId && inputs.clientSecret) {
            const tokenRes = await fetch('https://app.rippling.com/api/o/token/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    grant_type: 'client_credentials',
                    client_id: inputs.clientId,
                    client_secret: inputs.clientSecret,
                }).toString(),
            });
            if (!tokenRes.ok) {
                const err = await tokenRes.text();
                return { error: `Rippling token fetch failed: ${err}` };
            }
            const tokenData = await tokenRes.json();
            accessToken = tokenData.access_token;
        }

        if (!accessToken) {
            return { error: 'Rippling: accessToken or clientId/clientSecret required.' };
        }

        const headers: Record<string, string> = {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listEmployees': {
                const res = await fetch(`${BASE_URL}/employees/`, { headers });
                const data = await res.json();
                return { output: { employees: data } };
            }
            case 'getEmployee': {
                const res = await fetch(`${BASE_URL}/employees/${inputs.employeeId}/`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'createEmployee': {
                const res = await fetch(`${BASE_URL}/employees/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.employee || inputs),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'updateEmployee': {
                const res = await fetch(`${BASE_URL}/employees/${inputs.employeeId}/`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify(inputs.updates || {}),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'terminateEmployee': {
                const res = await fetch(`${BASE_URL}/employees/${inputs.employeeId}/terminate/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        termination_date: inputs.terminationDate,
                        termination_reason: inputs.reason,
                    }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'listDepartments': {
                const res = await fetch(`${BASE_URL}/departments/`, { headers });
                const data = await res.json();
                return { output: { departments: data } };
            }
            case 'getDepartment': {
                const res = await fetch(`${BASE_URL}/departments/${inputs.departmentId}/`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'listLeaveRequests': {
                const params = new URLSearchParams();
                if (inputs.employeeId) params.set('employee', inputs.employeeId);
                if (inputs.status) params.set('status', inputs.status);
                const res = await fetch(`${BASE_URL}/leave_requests/?${params.toString()}`, { headers });
                const data = await res.json();
                return { output: { leaveRequests: data } };
            }
            case 'approveLeaveRequest': {
                const res = await fetch(`${BASE_URL}/leave_requests/${inputs.leaveRequestId}/approve/`, {
                    method: 'POST',
                    headers,
                });
                const data = await res.json();
                return { output: data };
            }
            case 'listPayruns': {
                const res = await fetch(`${BASE_URL}/payruns/`, { headers });
                const data = await res.json();
                return { output: { payruns: data } };
            }
            case 'getPayrun': {
                const res = await fetch(`${BASE_URL}/payruns/${inputs.payrunId}/`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'listCompensations': {
                const params = new URLSearchParams();
                if (inputs.employeeId) params.set('employee', inputs.employeeId);
                const res = await fetch(`${BASE_URL}/compensations/?${params.toString()}`, { headers });
                const data = await res.json();
                return { output: { compensations: data } };
            }
            case 'getCompensation': {
                const res = await fetch(`${BASE_URL}/compensations/${inputs.compensationId}/`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'listRoles': {
                const res = await fetch(`${BASE_URL}/roles/`, { headers });
                const data = await res.json();
                return { output: { roles: data } };
            }
            case 'assignRole': {
                const res = await fetch(`${BASE_URL}/employees/${inputs.employeeId}/roles/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ role: inputs.roleId }),
                });
                const data = await res.json();
                return { output: data };
            }
            default:
                return { error: `Rippling: unknown action "${actionName}"` };
        }
    } catch (err: any) {
        logger.log(`Rippling action error: ${err.message}`);
        return { error: err.message };
    }
}
