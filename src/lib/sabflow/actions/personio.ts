'use server';

export async function executePersonioAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    const base = 'https://api.personio.de/v1';

    async function getToken(): Promise<string> {
        if (inputs.accessToken) return inputs.accessToken;
        const { clientId, clientSecret } = inputs;
        if (!clientId || !clientSecret) {
            throw new Error('accessToken or clientId+clientSecret are required');
        }
        const res = await fetch(`${base}/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Personio auth failed (${res.status}): ${text}`);
        }
        const data = await res.json();
        return data.data?.token ?? data.token;
    }

    async function req(method: string, url: string, body?: any, query?: Record<string, string>) {
        const token = await getToken();
        let fullUrl = url;
        if (query) fullUrl += `?${new URLSearchParams(query).toString()}`;
        const res = await fetch(fullUrl, {
            method,
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: body ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Personio ${method} ${url} failed (${res.status}): ${text}`);
        }
        const text = await res.text();
        return text ? JSON.parse(text) : { success: true };
    }

    try {
        switch (actionName) {
            case 'listEmployees': {
                const { limit, offset } = inputs;
                const query: Record<string, string> = {};
                if (limit) query.limit = String(limit);
                if (offset) query.offset = String(offset);
                const data = await req('GET', `${base}/company/employees`, undefined, Object.keys(query).length ? query : undefined);
                return { output: data };
            }

            case 'getEmployee': {
                const { employeeId } = inputs;
                if (!employeeId) return { error: 'employeeId is required' };
                const data = await req('GET', `${base}/company/employees/${employeeId}`);
                return { output: data };
            }

            case 'createEmployee': {
                const { firstName, lastName, email, gender, position, department, hireDate } = inputs;
                if (!firstName || !lastName || !email) {
                    return { error: 'firstName, lastName, and email are required' };
                }
                const body: any = { first_name: { value: firstName }, last_name: { value: lastName }, email: { value: email } };
                if (gender) body.gender = { value: gender };
                if (position) body.position = { value: position };
                if (department) body.department = { value: department };
                if (hireDate) body.hire_date = { value: hireDate };
                const data = await req('POST', `${base}/company/employees`, { employee: body });
                return { output: data };
            }

            case 'updateEmployee': {
                const { employeeId, ...rest } = inputs;
                if (!employeeId) return { error: 'employeeId is required' };
                const body: any = {};
                const fieldMap: Record<string, string> = {
                    firstName: 'first_name', lastName: 'last_name', email: 'email',
                    gender: 'gender', position: 'position', department: 'department',
                };
                for (const [k, v] of Object.entries(fieldMap)) {
                    if (rest[k]) body[v] = { value: rest[k] };
                }
                const data = await req('PATCH', `${base}/company/employees/${employeeId}`, body);
                return { output: data };
            }

            case 'listAttendances': {
                const { startDate, endDate, employeeId, limit, offset } = inputs;
                const query: Record<string, string> = {};
                if (startDate) query.start_date = startDate;
                if (endDate) query.end_date = endDate;
                if (employeeId) query['employees[]'] = String(employeeId);
                if (limit) query.limit = String(limit);
                if (offset) query.offset = String(offset);
                const data = await req('GET', `${base}/company/attendances`, undefined, query);
                return { output: data };
            }

            case 'createAttendance': {
                const { employeeId, date, startTime, endTime, breakDuration, comment } = inputs;
                if (!employeeId || !date || !startTime || !endTime) {
                    return { error: 'employeeId, date, startTime, and endTime are required' };
                }
                const body: any = {
                    employee: employeeId,
                    date,
                    start_time: startTime,
                    end_time: endTime,
                };
                if (breakDuration !== undefined) body.break = breakDuration;
                if (comment) body.comment = comment;
                const data = await req('POST', `${base}/company/attendances`, { attendances: [body] });
                return { output: data };
            }

            case 'updateAttendance': {
                const { attendanceId, date, startTime, endTime, breakDuration, comment } = inputs;
                if (!attendanceId) return { error: 'attendanceId is required' };
                const body: any = {};
                if (date) body.date = date;
                if (startTime) body.start_time = startTime;
                if (endTime) body.end_time = endTime;
                if (breakDuration !== undefined) body.break = breakDuration;
                if (comment) body.comment = comment;
                const data = await req('PATCH', `${base}/company/attendances/${attendanceId}`, body);
                return { output: data };
            }

            case 'deleteAttendance': {
                const { attendanceId } = inputs;
                if (!attendanceId) return { error: 'attendanceId is required' };
                const data = await req('DELETE', `${base}/company/attendances/${attendanceId}`);
                return { output: data };
            }

            case 'listTimeOffTypes': {
                const data = await req('GET', `${base}/company/time-off-types`);
                return { output: data };
            }

            case 'listTimeOffPeriods': {
                const { startDate, endDate, employeeId } = inputs;
                const query: Record<string, string> = {};
                if (startDate) query.start_date = startDate;
                if (endDate) query.end_date = endDate;
                if (employeeId) query['employees[]'] = String(employeeId);
                const data = await req('GET', `${base}/company/time-offs`, undefined, query);
                return { output: data };
            }

            case 'createTimeOffPeriod': {
                const { employeeId, timeOffTypeId, startDate, endDate, halfDayStart, halfDayEnd, comment } = inputs;
                if (!employeeId || !timeOffTypeId || !startDate || !endDate) {
                    return { error: 'employeeId, timeOffTypeId, startDate, and endDate are required' };
                }
                const body: any = {
                    employee_id: employeeId,
                    time_off_type_id: timeOffTypeId,
                    start_date: startDate,
                    end_date: endDate,
                };
                if (halfDayStart !== undefined) body.half_day_start = halfDayStart;
                if (halfDayEnd !== undefined) body.half_day_end = halfDayEnd;
                if (comment) body.comment = comment;
                const data = await req('POST', `${base}/company/time-offs`, body);
                return { output: data };
            }

            case 'approveTimeOff': {
                const { timeOffId } = inputs;
                if (!timeOffId) return { error: 'timeOffId is required' };
                const data = await req('PATCH', `${base}/company/time-offs/${timeOffId}/approve`);
                return { output: data };
            }

            case 'rejectTimeOff': {
                const { timeOffId } = inputs;
                if (!timeOffId) return { error: 'timeOffId is required' };
                const data = await req('PATCH', `${base}/company/time-offs/${timeOffId}/reject`);
                return { output: data };
            }

            case 'listProjects': {
                const data = await req('GET', `${base}/company/projects`);
                return { output: data };
            }

            case 'listDepartments': {
                const data = await req('GET', `${base}/company/departments`);
                return { output: data };
            }

            case 'listOffices': {
                const data = await req('GET', `${base}/company/offices`);
                return { output: data };
            }

            case 'getCompany': {
                const data = await req('GET', `${base}/company`);
                return { output: data };
            }

            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        return { error: err.message ?? String(err) };
    }
}
