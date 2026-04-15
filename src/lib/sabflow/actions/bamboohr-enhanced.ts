'use server';

export async function executeBamboohrEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    const { apiKey, companyDomain } = inputs;
    const BASE_URL = `https://api.bamboohr.com/api/gateway.php/${companyDomain}/v1`;
    const encoded = Buffer.from(`${apiKey}:x`).toString('base64');

    const headers: Record<string, string> = {
        'Authorization': `Basic ${encoded}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'getEmployee': {
                const fields = inputs.fields || 'firstName,lastName,email,department,jobTitle';
                const res = await fetch(`${BASE_URL}/employees/${inputs.employeeId}?fields=${fields}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { employee: data } };
            }
            case 'listEmployees': {
                const res = await fetch(`${BASE_URL}/employees/directory`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { employees: data.employees } };
            }
            case 'addEmployee': {
                const body = { firstName: inputs.firstName, lastName: inputs.lastName, ...inputs.fields };
                const res = await fetch(`${BASE_URL}/employees/`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) {
                    const text = await res.text();
                    return { error: text };
                }
                const location = res.headers.get('Location');
                return { output: { location, success: true } };
            }
            case 'updateEmployee': {
                const body = { ...inputs.fields };
                const res = await fetch(`${BASE_URL}/employees/${inputs.employeeId}`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) {
                    const text = await res.text();
                    return { error: text };
                }
                return { output: { success: true } };
            }
            case 'getEmployeeDirectory': {
                const res = await fetch(`${BASE_URL}/employees/directory`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { directory: data } };
            }
            case 'getEmployeeFiles': {
                const res = await fetch(`${BASE_URL}/employees/${inputs.employeeId}/files/view`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { files: data } };
            }
            case 'uploadFile': {
                const formHeaders = { 'Authorization': `Basic ${encoded}`, 'Accept': 'application/json' };
                const formData = new FormData();
                if (inputs.fileName) formData.append('fileName', inputs.fileName);
                if (inputs.category) formData.append('category', inputs.category);
                if (inputs.share !== undefined) formData.append('share', String(inputs.share));
                const res = await fetch(`${BASE_URL}/employees/${inputs.employeeId}/files`, { method: 'POST', headers: formHeaders, body: formData });
                if (!res.ok) {
                    const text = await res.text();
                    return { error: text };
                }
                return { output: { success: true } };
            }
            case 'getTimeOffRequests': {
                const params = new URLSearchParams({ start: inputs.start, end: inputs.end });
                const res = await fetch(`${BASE_URL}/time_off/requests/?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { requests: data } };
            }
            case 'addTimeOffRequest': {
                const body = {
                    status: { lastChanged: inputs.lastChanged, status: 'requested' },
                    employeeId: inputs.employeeId,
                    timeOffTypeId: inputs.timeOffTypeId,
                    start: inputs.start,
                    end: inputs.end,
                    ...inputs.fields,
                };
                const res = await fetch(`${BASE_URL}/time_off/requests/`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { request: data } };
            }
            case 'approveTimeOffRequest': {
                const body = { status: inputs.status || 'approved', note: inputs.note || '' };
                const res = await fetch(`${BASE_URL}/time_off/requests/${inputs.requestId}/status`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) {
                    const text = await res.text();
                    return { error: text };
                }
                return { output: { success: true } };
            }
            case 'getTimeOffTypes': {
                const res = await fetch(`${BASE_URL}/time_off/types`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { types: data } };
            }
            case 'getBenefitPlans': {
                const res = await fetch(`${BASE_URL}/benefits/plans`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { plans: data } };
            }
            case 'listJobOpenings': {
                const res = await fetch(`${BASE_URL}/applicant_tracking/jobs`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { jobs: data } };
            }
            case 'getOnboardingTemplates': {
                const res = await fetch(`${BASE_URL}/onboarding/templates`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { templates: data } };
            }
            case 'getCustomReport': {
                const body = { title: inputs.title || 'Custom Report', filters: inputs.filters || {}, fields: inputs.fields || [] };
                const res = await fetch(`${BASE_URL}/reports/custom`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { report: data } };
            }
            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        return { error: err.message || String(err) };
    }
}
