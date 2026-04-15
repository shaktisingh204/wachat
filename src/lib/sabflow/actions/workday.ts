'use server';

export async function executeWorkdayAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        const tenant = String(inputs.tenant ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');
        if (!tenant) throw new Error('tenant is required.');

        const BASE_URL = `https://${tenant}.workday.com/api/v1`;

        const wdFetch = async (method: string, path: string, body?: any) => {
            logger?.log(`[Workday] ${method} ${path}`);
            const options: RequestInit = {
                method,
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
            };
            if (body !== undefined) options.body = JSON.stringify(body);
            const res = await fetch(`${BASE_URL}${path}`, options);
            if (res.status === 204) return {};
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error?.message || data?.message || `Workday API error: ${res.status}`);
            return data;
        };

        switch (actionName) {
            case 'listWorkers': {
                const limit = Number(inputs.limit ?? 100);
                const offset = Number(inputs.offset ?? 0);
                const data = await wdFetch('GET', `/workers?limit=${limit}&offset=${offset}`);
                return { output: { workers: data.data ?? data, total: data.total ?? null } };
            }
            case 'getWorker': {
                const workerId = String(inputs.workerId ?? '').trim();
                if (!workerId) throw new Error('workerId is required.');
                const data = await wdFetch('GET', `/workers/${workerId}`);
                return { output: { worker: data } };
            }
            case 'createWorker': {
                const body = inputs.workerData ?? {};
                const data = await wdFetch('POST', `/workers`, body);
                return { output: { worker: data } };
            }
            case 'updateWorker': {
                const workerId = String(inputs.workerId ?? '').trim();
                if (!workerId) throw new Error('workerId is required.');
                const body = inputs.workerData ?? {};
                const data = await wdFetch('PUT', `/workers/${workerId}`, body);
                return { output: { worker: data } };
            }
            case 'listJobs': {
                const limit = Number(inputs.limit ?? 100);
                const offset = Number(inputs.offset ?? 0);
                const data = await wdFetch('GET', `/jobs?limit=${limit}&offset=${offset}`);
                return { output: { jobs: data.data ?? data, total: data.total ?? null } };
            }
            case 'getJob': {
                const jobId = String(inputs.jobId ?? '').trim();
                if (!jobId) throw new Error('jobId is required.');
                const data = await wdFetch('GET', `/jobs/${jobId}`);
                return { output: { job: data } };
            }
            case 'createJob': {
                const body = inputs.jobData ?? {};
                const data = await wdFetch('POST', `/jobs`, body);
                return { output: { job: data } };
            }
            case 'listOrganizations': {
                const limit = Number(inputs.limit ?? 100);
                const offset = Number(inputs.offset ?? 0);
                const data = await wdFetch('GET', `/organizations?limit=${limit}&offset=${offset}`);
                return { output: { organizations: data.data ?? data, total: data.total ?? null } };
            }
            case 'getOrganization': {
                const organizationId = String(inputs.organizationId ?? '').trim();
                if (!organizationId) throw new Error('organizationId is required.');
                const data = await wdFetch('GET', `/organizations/${organizationId}`);
                return { output: { organization: data } };
            }
            case 'listPayGroups': {
                const limit = Number(inputs.limit ?? 100);
                const offset = Number(inputs.offset ?? 0);
                const data = await wdFetch('GET', `/payGroups?limit=${limit}&offset=${offset}`);
                return { output: { payGroups: data.data ?? data, total: data.total ?? null } };
            }
            case 'getPayGroup': {
                const payGroupId = String(inputs.payGroupId ?? '').trim();
                if (!payGroupId) throw new Error('payGroupId is required.');
                const data = await wdFetch('GET', `/payGroups/${payGroupId}`);
                return { output: { payGroup: data } };
            }
            case 'listLeaveRequests': {
                const workerId = String(inputs.workerId ?? '').trim();
                const limit = Number(inputs.limit ?? 100);
                const offset = Number(inputs.offset ?? 0);
                const path = workerId
                    ? `/workers/${workerId}/leaveRequests?limit=${limit}&offset=${offset}`
                    : `/leaveRequests?limit=${limit}&offset=${offset}`;
                const data = await wdFetch('GET', path);
                return { output: { leaveRequests: data.data ?? data, total: data.total ?? null } };
            }
            case 'createLeaveRequest': {
                const workerId = String(inputs.workerId ?? '').trim();
                if (!workerId) throw new Error('workerId is required.');
                const body = inputs.leaveRequestData ?? {};
                const data = await wdFetch('POST', `/workers/${workerId}/leaveRequests`, body);
                return { output: { leaveRequest: data } };
            }
            case 'listTimeOffRequests': {
                const workerId = String(inputs.workerId ?? '').trim();
                const limit = Number(inputs.limit ?? 100);
                const offset = Number(inputs.offset ?? 0);
                const path = workerId
                    ? `/workers/${workerId}/timeOffRequests?limit=${limit}&offset=${offset}`
                    : `/timeOffRequests?limit=${limit}&offset=${offset}`;
                const data = await wdFetch('GET', path);
                return { output: { timeOffRequests: data.data ?? data, total: data.total ?? null } };
            }
            case 'getTimeOffBalance': {
                const workerId = String(inputs.workerId ?? '').trim();
                if (!workerId) throw new Error('workerId is required.');
                const data = await wdFetch('GET', `/workers/${workerId}/timeOffBalance`);
                return { output: { balance: data } };
            }
            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        logger?.log(`[Workday] Error: ${e.message}`);
        return { error: e.message || 'Action failed.' };
    }
}
