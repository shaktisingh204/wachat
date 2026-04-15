'use server';

async function bambooFetch(
    apiKey: string,
    subdomain: string,
    method: string,
    path: string,
    body?: any,
    isMultipart?: boolean,
    logger?: any
) {
    logger?.log(`[BambooHR] ${method} ${path}`);
    const url = `https://api.bamboohr.com/api/gateway.php/${encodeURIComponent(subdomain)}/v1${path}`;
    const authHeader = `Basic ${Buffer.from(`${apiKey}:x`).toString('base64')}`;

    const headers: Record<string, string> = {
        Authorization: authHeader,
        Accept: 'application/json',
    };

    const options: RequestInit = { method, headers };

    if (body !== undefined && !isMultipart) {
        headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    } else if (isMultipart && body) {
        // body is already a FormData instance
        options.body = body;
    }

    const res = await fetch(url, options);

    if (res.status === 204) return {};

    // BambooHR sometimes returns plain text on errors
    const contentType = res.headers.get('content-type') ?? '';
    if (!res.ok) {
        const text = await res.text();
        let errMsg = `BambooHR API error: ${res.status}`;
        try {
            const json = JSON.parse(text);
            errMsg = json?.errors?.[0]?.error ?? json?.message ?? errMsg;
        } catch {
            if (text) errMsg = text;
        }
        throw new Error(errMsg);
    }

    if (contentType.includes('application/json')) {
        return res.json();
    }
    const text = await res.text();
    try { return JSON.parse(text); } catch { return { raw: text }; }
}

export async function executeBamboohrAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        const subdomain = String(inputs.subdomain ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');
        if (!subdomain) throw new Error('subdomain is required.');

        const bhr = (method: string, path: string, body?: any, isMultipart?: boolean) =>
            bambooFetch(apiKey, subdomain, method, path, body, isMultipart, logger);

        switch (actionName) {
            case 'getEmployee': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const fields = String(inputs.fields ?? 'firstName,lastName,email,department,jobTitle,hireDate,location');
                const data = await bhr('GET', `/employees/${id}?fields=${encodeURIComponent(fields)}`);
                return {
                    output: {
                        id: String(data.id ?? id),
                        firstName: data.firstName ?? '',
                        lastName: data.lastName ?? '',
                        email: data.email ?? '',
                        department: data.department ?? '',
                        jobTitle: data.jobTitle ?? '',
                        hireDate: data.hireDate ?? '',
                    },
                };
            }

            case 'getEmployeeList': {
                const fields = inputs.fields ? `?fields=${encodeURIComponent(String(inputs.fields))}` : '';
                const data = await bhr('GET', `/employees/directory${fields}`);
                const employees = (data.employees ?? []).map((e: any) => ({
                    id: String(e.id ?? ''),
                    firstName: e.firstName ?? '',
                    lastName: e.lastName ?? '',
                    email: e.email ?? '',
                    department: e.department ?? '',
                }));
                return { output: { employees } };
            }

            case 'updateEmployee': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                if (!inputs.data || typeof inputs.data !== 'object') throw new Error('data (object) is required.');
                await bhr('POST', `/employees/${id}`, inputs.data);
                return { output: { updated: true } };
            }

            case 'getTimeOff': {
                const employeeId = String(inputs.employeeId ?? '').trim();
                const start = String(inputs.start ?? '').trim();
                const end = String(inputs.end ?? '').trim();
                if (!employeeId) throw new Error('employeeId is required.');
                if (!start) throw new Error('start is required.');
                if (!end) throw new Error('end is required.');
                const data = await bhr(
                    'GET',
                    `/time_off/requests?employeeId=${encodeURIComponent(employeeId)}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
                );
                return { output: { requests: Array.isArray(data) ? data : (data.requests ?? []) } };
            }

            case 'requestTimeOff': {
                const employeeId = String(inputs.employeeId ?? '').trim();
                const timeOffTypeId = String(inputs.timeOffTypeId ?? '').trim();
                const start = String(inputs.start ?? '').trim();
                const end = String(inputs.end ?? '').trim();
                if (!employeeId) throw new Error('employeeId is required.');
                if (!timeOffTypeId) throw new Error('timeOffTypeId is required.');
                if (!start) throw new Error('start is required.');
                if (!end) throw new Error('end is required.');
                const body: Record<string, any> = {
                    status: 'requested',
                    employeeId: Number(employeeId),
                    timeOffTypeId: Number(timeOffTypeId),
                    dates: [
                        { ymd: start, amount: 'all_day' },
                        { ymd: end, amount: 'all_day' },
                    ],
                };
                if (inputs.note) body.note = String(inputs.note);
                const data = await bhr('POST', '/time_off/requests', body);
                return { output: { id: String(data.id ?? ''), status: data.status ?? 'requested' } };
            }

            case 'approveTimeOff': {
                const requestId = String(inputs.requestId ?? '').trim();
                if (!requestId) throw new Error('requestId is required.');
                await bhr('PUT', `/time_off/requests/${requestId}/status`, { status: 'approved' });
                return { output: { status: 'approved' } };
            }

            case 'getTimeOffTypes': {
                const data = await bhr('GET', '/time_off/types');
                return { output: { timeOffTypes: Array.isArray(data) ? data : (data.timeOffTypes ?? []) } };
            }

            case 'getReport': {
                const reportId = String(inputs.reportId ?? '').trim();
                if (!reportId) throw new Error('reportId is required.');
                const format = String(inputs.format ?? 'JSON');
                const data = await bhr('GET', `/reports/${reportId}?format=${encodeURIComponent(format)}`);
                return { output: { report: data } };
            }

            case 'getCustomReport': {
                if (!inputs.fields) throw new Error('fields is required.');
                const fields = Array.isArray(inputs.fields) ? inputs.fields : String(inputs.fields).split(',').map((f: string) => f.trim());
                const body: Record<string, any> = {
                    title: 'Custom Report',
                    fields,
                    filters: Array.isArray(inputs.filters) ? inputs.filters : [],
                };
                const data = await bhr('POST', '/reports/custom?format=JSON', body);
                return {
                    output: {
                        fields: data.fields ?? fields,
                        employees: data.employees ?? [],
                    },
                };
            }

            case 'listDepartments': {
                const data = await bhr('GET', '/meta/lists/department');
                return { output: { options: data.options ?? [] } };
            }

            case 'getJobInfo': {
                const employeeId = String(inputs.employeeId ?? '').trim();
                if (!employeeId) throw new Error('employeeId is required.');
                const data = await bhr('GET', `/employees/${employeeId}/tables/jobInfo`);
                return { output: { rows: data.rows ?? [] } };
            }

            case 'getCompensation': {
                const employeeId = String(inputs.employeeId ?? '').trim();
                if (!employeeId) throw new Error('employeeId is required.');
                const data = await bhr('GET', `/employees/${employeeId}/tables/compensation`);
                return { output: { rows: data.rows ?? [] } };
            }

            case 'createEmployee': {
                const firstName = String(inputs.firstName ?? '').trim();
                const lastName = String(inputs.lastName ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                const hireDate = String(inputs.hireDate ?? '').trim();
                if (!firstName) throw new Error('firstName is required.');
                if (!lastName) throw new Error('lastName is required.');
                if (!email) throw new Error('email is required.');
                if (!hireDate) throw new Error('hireDate is required.');
                const body: Record<string, any> = {
                    firstName,
                    lastName,
                    workEmail: email,
                    hireDate,
                };
                if (inputs.department) body.department = String(inputs.department);
                // BambooHR returns the new employee URL in the Location header
                const url = `https://api.bamboohr.com/api/gateway.php/${encodeURIComponent(subdomain)}/v1/employees`;
                const authHeader = `Basic ${Buffer.from(`${apiKey}:x`).toString('base64')}`;
                const res = await fetch(url, {
                    method: 'POST',
                    headers: {
                        Authorization: authHeader,
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(body),
                });
                if (!res.ok) {
                    const text = await res.text();
                    throw new Error(`BambooHR API error: ${res.status} ${text}`);
                }
                const location = res.headers.get('Location') ?? '';
                const idMatch = location.match(/\/employees\/(\d+)/);
                const id = idMatch ? idMatch[1] : '';
                return { output: { id, location } };
            }

            case 'uploadDocument': {
                const employeeId = String(inputs.employeeId ?? '').trim();
                const category = String(inputs.category ?? '').trim();
                const filename = String(inputs.filename ?? '').trim();
                const fileContent = inputs.fileContent;
                if (!employeeId) throw new Error('employeeId is required.');
                if (!category) throw new Error('category is required.');
                if (!filename) throw new Error('filename is required.');
                if (!fileContent) throw new Error('fileContent is required.');

                const form = new FormData();
                form.append('category', category);
                // fileContent can be a base64 string or Buffer
                let blob: Blob;
                if (typeof fileContent === 'string') {
                    const buffer = Buffer.from(fileContent, 'base64');
                    blob = new Blob([buffer]);
                } else {
                    blob = new Blob([fileContent]);
                }
                form.append('file', blob, filename);

                const uploadUrl = `https://api.bamboohr.com/api/gateway.php/${encodeURIComponent(subdomain)}/v1/employees/${employeeId}/files`;
                const authHeader = `Basic ${Buffer.from(`${apiKey}:x`).toString('base64')}`;
                const res = await fetch(uploadUrl, {
                    method: 'POST',
                    headers: { Authorization: authHeader, Accept: 'application/json' },
                    body: form,
                });
                if (!res.ok) {
                    const text = await res.text();
                    throw new Error(`BambooHR upload error: ${res.status} ${text}`);
                }
                const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
                return { output: { id: String(data.id ?? '') } };
            }

            default:
                return { error: `BambooHR action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        logger?.log(`[BambooHR] Error in ${actionName}: ${e.message}`);
        return { error: e.message || 'BambooHR action failed.' };
    }
}
