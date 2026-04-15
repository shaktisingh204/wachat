'use server';

export async function executeClockodoAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    const base = 'https://my.clockodo.com/api';
    const { email, apiKey } = inputs;

    if (!email) return { error: 'email is required' };
    if (!apiKey) return { error: 'apiKey is required' };

    const headers: Record<string, string> = {
        'X-ClockodoApiUser': email,
        'X-ClockodoApiKey': apiKey,
        'Content-Type': 'application/json',
        'X-Clockodo-External-Application': 'SabFlow;sabnode@sabnode.com',
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
            throw new Error(`Clockodo ${method} ${url} failed (${res.status}): ${text}`);
        }
        const text = await res.text();
        return text ? JSON.parse(text) : { success: true };
    }

    try {
        switch (actionName) {
            case 'getRunningEntry': {
                const data = await req('GET', `${base}/v2/clockinout/current`);
                return { output: data };
            }

            case 'clockIn': {
                const { customersId, projectsId, servicesId, billable } = inputs;
                if (!customersId) return { error: 'customersId is required' };
                const body: any = { customers_id: customersId };
                if (projectsId) body.projects_id = projectsId;
                if (servicesId) body.services_id = servicesId;
                if (billable !== undefined) body.billable = billable ? 1 : 0;
                const data = await req('POST', `${base}/v2/clockinout`, body);
                return { output: data };
            }

            case 'clockOut': {
                const data = await req('DELETE', `${base}/v2/clockinout`);
                return { output: data };
            }

            case 'listEntries': {
                const { timeSince, timeUntil, customersId, projectsId, usersId } = inputs;
                if (!timeSince || !timeUntil) return { error: 'timeSince and timeUntil are required' };
                const query: Record<string, string> = {
                    time_since: timeSince,
                    time_until: timeUntil,
                };
                if (customersId) query.customers_id = String(customersId);
                if (projectsId) query.projects_id = String(projectsId);
                if (usersId) query.users_id = String(usersId);
                const data = await req('GET', `${base}/v2/entries`, undefined, query);
                return { output: data };
            }

            case 'getEntry': {
                const { entryId } = inputs;
                if (!entryId) return { error: 'entryId is required' };
                const data = await req('GET', `${base}/v2/entries/${entryId}`);
                return { output: data };
            }

            case 'createEntry': {
                const { customersId, projectsId, servicesId, usersId, timeSince, timeUntil, billable, text } = inputs;
                if (!customersId || !usersId || !timeSince || !timeUntil) {
                    return { error: 'customersId, usersId, timeSince, and timeUntil are required' };
                }
                const body: any = {
                    customers_id: customersId,
                    users_id: usersId,
                    time_since: timeSince,
                    time_until: timeUntil,
                };
                if (projectsId) body.projects_id = projectsId;
                if (servicesId) body.services_id = servicesId;
                if (billable !== undefined) body.billable = billable ? 1 : 0;
                if (text) body.text = text;
                const data = await req('POST', `${base}/v2/entries`, body);
                return { output: data };
            }

            case 'updateEntry': {
                const { entryId, timeSince, timeUntil, text, billable } = inputs;
                if (!entryId) return { error: 'entryId is required' };
                const body: any = {};
                if (timeSince) body.time_since = timeSince;
                if (timeUntil) body.time_until = timeUntil;
                if (text) body.text = text;
                if (billable !== undefined) body.billable = billable ? 1 : 0;
                const data = await req('PUT', `${base}/v2/entries/${entryId}`, body);
                return { output: data };
            }

            case 'deleteEntry': {
                const { entryId } = inputs;
                if (!entryId) return { error: 'entryId is required' };
                const data = await req('DELETE', `${base}/v2/entries/${entryId}`);
                return { output: data };
            }

            case 'listCustomers': {
                const data = await req('GET', `${base}/v2/customers`);
                return { output: data };
            }

            case 'createCustomer': {
                const { name, number, active } = inputs;
                if (!name) return { error: 'name is required' };
                const body: any = { name };
                if (number) body.number = number;
                if (active !== undefined) body.active = active;
                const data = await req('POST', `${base}/v2/customers`, body);
                return { output: data };
            }

            case 'listProjects': {
                const { customersId, active } = inputs;
                const query: Record<string, string> = {};
                if (customersId) query.customers_id = String(customersId);
                if (active !== undefined) query.active = active ? 'true' : 'false';
                const data = await req('GET', `${base}/v2/projects`, undefined, Object.keys(query).length ? query : undefined);
                return { output: data };
            }

            case 'createProject': {
                const { name, customersId, active } = inputs;
                if (!name || !customersId) return { error: 'name and customersId are required' };
                const body: any = { name, customers_id: customersId };
                if (active !== undefined) body.active = active;
                const data = await req('POST', `${base}/v2/projects`, body);
                return { output: data };
            }

            case 'listServices': {
                const data = await req('GET', `${base}/v2/services`);
                return { output: data };
            }

            case 'listUsers': {
                const data = await req('GET', `${base}/v2/users`);
                return { output: data };
            }

            case 'getSummary': {
                const { year, type, usersId } = inputs;
                if (!year || !type) return { error: 'year and type are required' };
                const query: Record<string, string> = { year: String(year), type };
                if (usersId) query.users_id = String(usersId);
                const data = await req('GET', `${base}/v2/reports/summary`, undefined, query);
                return { output: data };
            }

            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        return { error: err.message ?? String(err) };
    }
}
