'use server';

export async function executeBambooHREnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        const companyDomain = String(inputs.companyDomain ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');
        if (!companyDomain) throw new Error('companyDomain is required.');

        const BASE_URL = `https://api.bamboohr.com/api/gateway.php/${companyDomain}/v1`;
        const encoded = Buffer.from(`${apiKey}:x`).toString('base64');
        const headers: Record<string, string> = {
            Authorization: `Basic ${encoded}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listEmployees': {
                const res = await fetch(`${BASE_URL}/employees/directory`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || `BambooHR API error: ${res.status}`);
                return { output: { employees: data.employees ?? data } };
            }
            case 'getEmployee': {
                const employeeId = String(inputs.employeeId ?? '').trim();
                if (!employeeId) throw new Error('employeeId is required.');
                const fields = String(inputs.fields ?? 'firstName,lastName,email,department,jobTitle');
                const res = await fetch(`${BASE_URL}/employees/${employeeId}?fields=${fields}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || `BambooHR API error: ${res.status}`);
                return { output: { employee: data } };
            }
            case 'addEmployee': {
                const body = {
                    firstName: inputs.firstName,
                    lastName: inputs.lastName,
                    ...(inputs.fields ?? {}),
                };
                const res = await fetch(`${BASE_URL}/employees/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) {
                    const text = await res.text();
                    throw new Error(text || `BambooHR API error: ${res.status}`);
                }
                const location = res.headers.get('Location');
                return { output: { location, success: true } };
            }
            case 'updateEmployee': {
                const employeeId = String(inputs.employeeId ?? '').trim();
                if (!employeeId) throw new Error('employeeId is required.');
                const body = inputs.fields ?? {};
                const res = await fetch(`${BASE_URL}/employees/${employeeId}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) {
                    const text = await res.text();
                    throw new Error(text || `BambooHR API error: ${res.status}`);
                }
                return { output: { success: true } };
            }
            case 'listFields': {
                const res = await fetch(`${BASE_URL}/meta/fields`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || `BambooHR API error: ${res.status}`);
                return { output: { fields: data } };
            }
            case 'getEmployeeFiles': {
                const employeeId = String(inputs.employeeId ?? '').trim();
                if (!employeeId) throw new Error('employeeId is required.');
                const res = await fetch(`${BASE_URL}/employees/${employeeId}/files/view`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || `BambooHR API error: ${res.status}`);
                return { output: { files: data } };
            }
            case 'uploadFile': {
                const employeeId = String(inputs.employeeId ?? '').trim();
                if (!employeeId) throw new Error('employeeId is required.');
                const formHeaders = { Authorization: `Basic ${encoded}`, Accept: 'application/json' };
                const formData = new FormData();
                if (inputs.fileName) formData.append('fileName', inputs.fileName);
                if (inputs.category) formData.append('category', inputs.category);
                if (inputs.share !== undefined) formData.append('share', String(inputs.share));
                const res = await fetch(`${BASE_URL}/employees/${employeeId}/files`, {
                    method: 'POST',
                    headers: formHeaders,
                    body: formData,
                });
                if (!res.ok) {
                    const text = await res.text();
                    throw new Error(text || `BambooHR API error: ${res.status}`);
                }
                return { output: { success: true } };
            }
            case 'getTimeOffTypes': {
                const res = await fetch(`${BASE_URL}/time_off/types`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || `BambooHR API error: ${res.status}`);
                return { output: { types: data } };
            }
            case 'listTimeOffRequests': {
                const params = new URLSearchParams({
                    start: String(inputs.start ?? ''),
                    end: String(inputs.end ?? ''),
                });
                if (inputs.employeeId) params.set('employeeId', String(inputs.employeeId));
                const res = await fetch(`${BASE_URL}/time_off/requests/?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || `BambooHR API error: ${res.status}`);
                return { output: { requests: data } };
            }
            case 'addTimeOffRequest': {
                const body = {
                    status: { lastChanged: inputs.lastChanged, status: 'requested' },
                    employeeId: inputs.employeeId,
                    timeOffTypeId: inputs.timeOffTypeId,
                    start: inputs.start,
                    end: inputs.end,
                    ...(inputs.fields ?? {}),
                };
                const res = await fetch(`${BASE_URL}/time_off/requests/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || `BambooHR API error: ${res.status}`);
                return { output: { request: data } };
            }
            case 'approveTimeOffRequest': {
                const requestId = String(inputs.requestId ?? '').trim();
                if (!requestId) throw new Error('requestId is required.');
                const body = { status: inputs.status ?? 'approved', note: inputs.note ?? '' };
                const res = await fetch(`${BASE_URL}/time_off/requests/${requestId}/status`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) {
                    const text = await res.text();
                    throw new Error(text || `BambooHR API error: ${res.status}`);
                }
                return { output: { success: true } };
            }
            case 'listHolidays': {
                const year = String(inputs.year ?? new Date().getFullYear());
                const res = await fetch(`${BASE_URL}/meta/time_off/holidays/?year=${year}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || `BambooHR API error: ${res.status}`);
                return { output: { holidays: data } };
            }
            case 'getReport': {
                const reportId = String(inputs.reportId ?? '').trim();
                if (!reportId) throw new Error('reportId is required.');
                const format = String(inputs.format ?? 'json');
                const res = await fetch(`${BASE_URL}/reports/${reportId}?format=${format}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || `BambooHR API error: ${res.status}`);
                return { output: { report: data } };
            }
            case 'listJobOpenings': {
                const res = await fetch(`${BASE_URL}/applicant_tracking/jobs`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || `BambooHR API error: ${res.status}`);
                return { output: { jobs: data } };
            }
            case 'getJobOpening': {
                const jobId = String(inputs.jobId ?? '').trim();
                if (!jobId) throw new Error('jobId is required.');
                const res = await fetch(`${BASE_URL}/applicant_tracking/jobs/${jobId}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || `BambooHR API error: ${res.status}`);
                return { output: { job: data } };
            }
            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
