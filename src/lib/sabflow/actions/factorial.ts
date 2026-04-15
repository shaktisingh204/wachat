'use server';

export async function executeFactorialAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    const base = 'https://api.factorialhr.com/api/v1';
    const { accessToken } = inputs;

    if (!accessToken) return { error: 'accessToken is required' };

    const headers: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        accept: 'application/json',
    };

    async function req(method: string, url: string, body?: any, query?: Record<string, string>) {
        let fullUrl = url;
        if (query) fullUrl += `?${new URLSearchParams(query).toString()}`;
        const res = await fetch(fullUrl, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Factorial ${method} ${url} failed (${res.status}): ${text}`);
        }
        const text = await res.text();
        return text ? JSON.parse(text) : { success: true };
    }

    try {
        switch (actionName) {
            case 'listEmployees': {
                const { page, perPage } = inputs;
                const query: Record<string, string> = {};
                if (page) query.page = String(page);
                if (perPage) query.per_page = String(perPage);
                const data = await req('GET', `${base}/employees`, undefined, Object.keys(query).length ? query : undefined);
                return { output: data };
            }

            case 'getEmployee': {
                const { employeeId } = inputs;
                if (!employeeId) return { error: 'employeeId is required' };
                const data = await req('GET', `${base}/employees/${employeeId}`);
                return { output: data };
            }

            case 'createEmployee': {
                const { firstName, lastName, email, birthday, role, managerIds, teamIds } = inputs;
                if (!firstName || !lastName || !email) {
                    return { error: 'firstName, lastName, and email are required' };
                }
                const body: any = { first_name: firstName, last_name: lastName, email };
                if (birthday) body.birthday_on = birthday;
                if (role) body.role = role;
                if (managerIds) body.manager_ids = Array.isArray(managerIds) ? managerIds : [managerIds];
                if (teamIds) body.team_ids = Array.isArray(teamIds) ? teamIds : [teamIds];
                const data = await req('POST', `${base}/employees`, body);
                return { output: data };
            }

            case 'updateEmployee': {
                const { employeeId, firstName, lastName, email, birthday } = inputs;
                if (!employeeId) return { error: 'employeeId is required' };
                const body: any = {};
                if (firstName) body.first_name = firstName;
                if (lastName) body.last_name = lastName;
                if (email) body.email = email;
                if (birthday) body.birthday_on = birthday;
                const data = await req('PUT', `${base}/employees/${employeeId}`, body);
                return { output: data };
            }

            case 'listLeaves': {
                const { employeeId, year } = inputs;
                const query: Record<string, string> = {};
                if (employeeId) query.employee_id = String(employeeId);
                if (year) query.year = String(year);
                const data = await req('GET', `${base}/leaves`, undefined, Object.keys(query).length ? query : undefined);
                return { output: data };
            }

            case 'getLeave': {
                const { leaveId } = inputs;
                if (!leaveId) return { error: 'leaveId is required' };
                const data = await req('GET', `${base}/leaves/${leaveId}`);
                return { output: data };
            }

            case 'createLeave': {
                const { employeeId, leaveTypeId, startOn, finishOn, halfDay, description } = inputs;
                if (!employeeId || !leaveTypeId || !startOn || !finishOn) {
                    return { error: 'employeeId, leaveTypeId, startOn, and finishOn are required' };
                }
                const body: any = {
                    employee_id: employeeId,
                    leave_type_id: leaveTypeId,
                    start_on: startOn,
                    finish_on: finishOn,
                };
                if (halfDay !== undefined) body.half_day = halfDay;
                if (description) body.description = description;
                const data = await req('POST', `${base}/leaves`, body);
                return { output: data };
            }

            case 'approveLeave': {
                const { leaveId } = inputs;
                if (!leaveId) return { error: 'leaveId is required' };
                const data = await req('POST', `${base}/leaves/${leaveId}/approve`);
                return { output: data };
            }

            case 'deleteLeave': {
                const { leaveId } = inputs;
                if (!leaveId) return { error: 'leaveId is required' };
                const data = await req('DELETE', `${base}/leaves/${leaveId}`);
                return { output: data };
            }

            case 'listShifts': {
                const { employeeId, startDate, endDate } = inputs;
                const query: Record<string, string> = {};
                if (employeeId) query.employee_id = String(employeeId);
                if (startDate) query.start_at_gte = startDate;
                if (endDate) query.start_at_lte = endDate;
                const data = await req('GET', `${base}/shifts`, undefined, Object.keys(query).length ? query : undefined);
                return { output: data };
            }

            case 'createShift': {
                const { employeeId, shiftLocationId, startAt, endAt, notes } = inputs;
                if (!employeeId || !startAt || !endAt) {
                    return { error: 'employeeId, startAt, and endAt are required' };
                }
                const body: any = { employee_id: employeeId, start_at: startAt, end_at: endAt };
                if (shiftLocationId) body.shift_location_id = shiftLocationId;
                if (notes) body.notes = notes;
                const data = await req('POST', `${base}/shifts`, body);
                return { output: data };
            }

            case 'updateShift': {
                const { shiftId, startAt, endAt, notes } = inputs;
                if (!shiftId) return { error: 'shiftId is required' };
                const body: any = {};
                if (startAt) body.start_at = startAt;
                if (endAt) body.end_at = endAt;
                if (notes) body.notes = notes;
                const data = await req('PUT', `${base}/shifts/${shiftId}`, body);
                return { output: data };
            }

            case 'deleteShift': {
                const { shiftId } = inputs;
                if (!shiftId) return { error: 'shiftId is required' };
                const data = await req('DELETE', `${base}/shifts/${shiftId}`);
                return { output: data };
            }

            case 'listPayslips': {
                const { employeeId, year, month } = inputs;
                const query: Record<string, string> = {};
                if (employeeId) query.employee_id = String(employeeId);
                if (year) query.year = String(year);
                if (month) query.month = String(month);
                const data = await req('GET', `${base}/payslips`, undefined, Object.keys(query).length ? query : undefined);
                return { output: data };
            }

            case 'getPayslip': {
                const { payslipId } = inputs;
                if (!payslipId) return { error: 'payslipId is required' };
                const data = await req('GET', `${base}/payslips/${payslipId}`);
                return { output: data };
            }

            case 'listDocuments': {
                const { employeeId } = inputs;
                const query: Record<string, string> = {};
                if (employeeId) query.employee_id = String(employeeId);
                const data = await req('GET', `${base}/documents`, undefined, Object.keys(query).length ? query : undefined);
                return { output: data };
            }

            case 'uploadDocument': {
                const { employeeId, filename, fileUrl } = inputs;
                if (!employeeId || !filename) return { error: 'employeeId and filename are required' };
                const body: any = { employee_id: employeeId, filename };
                if (fileUrl) body.file_url = fileUrl;
                const data = await req('POST', `${base}/documents`, body);
                return { output: data };
            }

            case 'listLocations': {
                const data = await req('GET', `${base}/locations`);
                return { output: data };
            }

            case 'getLocation': {
                const { locationId } = inputs;
                if (!locationId) return { error: 'locationId is required' };
                const data = await req('GET', `${base}/locations/${locationId}`);
                return { output: data };
            }

            case 'listTeams': {
                const data = await req('GET', `${base}/teams`);
                return { output: data };
            }

            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        return { error: err.message ?? String(err) };
    }
}
