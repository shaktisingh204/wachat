'use server';

export async function executeGustoEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE_URL = 'https://api.gusto.com/v1';
    const accessToken = inputs.accessToken;

    if (!accessToken) {
        return { error: 'Gusto Enhanced: accessToken is required.' };
    }

    const headers: Record<string, string> = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };

    try {
        switch (actionName) {
            case 'listCompanies': {
                const res = await fetch(`${BASE_URL}/companies`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { companies: Array.isArray(data) ? data : [data] } };
            }
            case 'getCompany': {
                const res = await fetch(`${BASE_URL}/companies/${inputs.companyId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { company: data } };
            }
            case 'listEmployees': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.per) params.set('per', String(inputs.per));
                if (inputs.terminated !== undefined) params.set('terminated', String(inputs.terminated));
                const url = `${BASE_URL}/companies/${inputs.companyId}/employees${params.toString() ? '?' + params.toString() : ''}`;
                const res = await fetch(url, { headers });
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
                    ...(inputs.startDate && { start_date: inputs.startDate }),
                    ...(inputs.jobTitle && { job_title: inputs.jobTitle }),
                    ...(inputs.dateOfBirth && { date_of_birth: inputs.dateOfBirth }),
                    ...(inputs.ssn && { ssn: inputs.ssn }),
                };
                const res = await fetch(`${BASE_URL}/companies/${inputs.companyId}/employees`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { employee: data } };
            }
            case 'updateEmployee': {
                const body = {
                    ...(inputs.firstName && { first_name: inputs.firstName }),
                    ...(inputs.lastName && { last_name: inputs.lastName }),
                    ...(inputs.email && { email: inputs.email }),
                    ...(inputs.jobTitle && { job_title: inputs.jobTitle }),
                    ...(inputs.startDate && { start_date: inputs.startDate }),
                };
                const res = await fetch(`${BASE_URL}/employees/${inputs.employeeId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { employee: data } };
            }
            case 'listPayrolls': {
                const params = new URLSearchParams();
                if (inputs.processed !== undefined) params.set('processed', String(inputs.processed));
                if (inputs.startDate) params.set('start_date', inputs.startDate);
                if (inputs.endDate) params.set('end_date', inputs.endDate);
                const url = `${BASE_URL}/companies/${inputs.companyId}/payrolls${params.toString() ? '?' + params.toString() : ''}`;
                const res = await fetch(url, { headers });
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
            case 'runPayroll': {
                const res = await fetch(`${BASE_URL}/companies/${inputs.companyId}/payrolls/${inputs.payrollId}/submit`, {
                    method: 'PUT',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { payroll: data } };
            }
            case 'listPaySchedules': {
                const res = await fetch(`${BASE_URL}/companies/${inputs.companyId}/pay_schedules`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { paySchedules: data } };
            }
            case 'getPaySchedule': {
                const res = await fetch(`${BASE_URL}/companies/${inputs.companyId}/pay_schedules/${inputs.payScheduleId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { paySchedule: data } };
            }
            case 'listBenefits': {
                const res = await fetch(`${BASE_URL}/companies/${inputs.companyId}/company_benefits`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { benefits: data } };
            }
            case 'listLocations': {
                const res = await fetch(`${BASE_URL}/companies/${inputs.companyId}/locations`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { locations: data } };
            }
            case 'createLocation': {
                const body = {
                    phone_number: inputs.phoneNumber,
                    street_1: inputs.street1,
                    city: inputs.city,
                    state: inputs.state,
                    zip: inputs.zip,
                    country: inputs.country || 'USA',
                    ...(inputs.street2 && { street_2: inputs.street2 }),
                    ...(inputs.mailing !== undefined && { mailing_address: inputs.mailing }),
                    ...(inputs.filing !== undefined && { filing_address: inputs.filing }),
                };
                const res = await fetch(`${BASE_URL}/companies/${inputs.companyId}/locations`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { location: data } };
            }
            case 'getSignatories': {
                const res = await fetch(`${BASE_URL}/companies/${inputs.companyId}/signatories`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { signatories: data } };
            }
            default:
                return { error: `Gusto Enhanced: Unknown action "${actionName}"` };
        }
    } catch (err: any) {
        return { error: err.message || String(err) };
    }
}
