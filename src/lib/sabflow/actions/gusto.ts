'use server';

export async function executeGustoAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE_URL = 'https://api.gusto.com/v1';
    const { accessToken } = inputs;

    const headers: Record<string, string> = {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'listCompanies': {
                const res = await fetch(`${BASE_URL}/me`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { companies: data.roles?.payroll_admin?.companies || [] } };
            }
            case 'getCompany': {
                const res = await fetch(`${BASE_URL}/companies/${inputs.companyId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { company: data } };
            }
            case 'listEmployees': {
                const res = await fetch(`${BASE_URL}/companies/${inputs.companyId}/employees`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { employees: data } };
            }
            case 'getEmployee': {
                const res = await fetch(`${BASE_URL}/employees/${inputs.employeeId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { employee: data } };
            }
            case 'createEmployee': {
                const body = {
                    first_name: inputs.firstName,
                    last_name: inputs.lastName,
                    email: inputs.email,
                    ...inputs.fields,
                };
                const res = await fetch(`${BASE_URL}/companies/${inputs.companyId}/employees`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { employee: data } };
            }
            case 'updateEmployee': {
                const body = { ...inputs.fields };
                const res = await fetch(`${BASE_URL}/employees/${inputs.employeeId}`, { method: 'PUT', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { employee: data } };
            }
            case 'listPayrolls': {
                const res = await fetch(`${BASE_URL}/companies/${inputs.companyId}/payrolls`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { payrolls: data } };
            }
            case 'getPayroll': {
                const res = await fetch(`${BASE_URL}/companies/${inputs.companyId}/payrolls/${inputs.payrollId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { payroll: data } };
            }
            case 'listBenefits': {
                const res = await fetch(`${BASE_URL}/companies/${inputs.companyId}/company_benefits`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { benefits: data } };
            }
            case 'getPayrollReceipt': {
                const res = await fetch(`${BASE_URL}/payrolls/${inputs.payrollId}/receipt`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { receipt: data } };
            }
            case 'listLocations': {
                const res = await fetch(`${BASE_URL}/companies/${inputs.companyId}/locations`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { locations: data } };
            }
            case 'getLocation': {
                const res = await fetch(`${BASE_URL}/locations/${inputs.locationId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { location: data } };
            }
            case 'listPaySchedules': {
                const res = await fetch(`${BASE_URL}/companies/${inputs.companyId}/pay_schedules`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { paySchedules: data } };
            }
            case 'listDepartments': {
                const res = await fetch(`${BASE_URL}/companies/${inputs.companyId}/departments`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { departments: data } };
            }
            case 'getCompensation': {
                const res = await fetch(`${BASE_URL}/compensations/${inputs.compensationId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { compensation: data } };
            }
            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        return { error: err.message || String(err) };
    }
}
