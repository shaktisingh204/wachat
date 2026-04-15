'use server';

export async function executeIcimsAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const username = String(inputs.username ?? '').trim();
        const password = String(inputs.password ?? '').trim();
        const customerId = String(inputs.customerId ?? '').trim();

        if (!username) throw new Error('username is required.');
        if (!password) throw new Error('password is required.');
        if (!customerId) throw new Error('customerId is required.');

        const BASE_URL = `https://api.icims.com/customers/${customerId}`;
        const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;

        const icimsFetch = async (method: string, path: string, body?: any) => {
            logger?.log(`[iCIMS] ${method} ${path}`);
            const options: RequestInit = {
                method,
                headers: {
                    Authorization: authHeader,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
            };
            if (body !== undefined) options.body = JSON.stringify(body);
            const res = await fetch(`${BASE_URL}${path}`, options);
            if (res.status === 204) return {};
            const data = await res.json();
            if (!res.ok) throw new Error(data?.errors?.[0]?.message || data?.message || `iCIMS API error: ${res.status}`);
            return data;
        };

        switch (actionName) {
            case 'listApplicants': {
                const limit = Number(inputs.limit ?? 20);
                const offset = Number(inputs.offset ?? 0);
                const data = await icimsFetch('GET', `/applicants?limit=${limit}&offset=${offset}`);
                return { output: { applicants: data.items ?? data, total: data.totalCount ?? null } };
            }
            case 'getApplicant': {
                const applicantId = String(inputs.applicantId ?? '').trim();
                if (!applicantId) throw new Error('applicantId is required.');
                const data = await icimsFetch('GET', `/applicants/${applicantId}`);
                return { output: { applicant: data } };
            }
            case 'createApplicant': {
                const body = inputs.applicantData ?? {};
                const data = await icimsFetch('POST', `/applicants`, body);
                return { output: { applicant: data } };
            }
            case 'updateApplicant': {
                const applicantId = String(inputs.applicantId ?? '').trim();
                if (!applicantId) throw new Error('applicantId is required.');
                const body = inputs.applicantData ?? {};
                const data = await icimsFetch('PATCH', `/applicants/${applicantId}`, body);
                return { output: { applicant: data } };
            }
            case 'listJobs': {
                const limit = Number(inputs.limit ?? 20);
                const offset = Number(inputs.offset ?? 0);
                const data = await icimsFetch('GET', `/jobs?limit=${limit}&offset=${offset}`);
                return { output: { jobs: data.items ?? data, total: data.totalCount ?? null } };
            }
            case 'getJob': {
                const jobId = String(inputs.jobId ?? '').trim();
                if (!jobId) throw new Error('jobId is required.');
                const data = await icimsFetch('GET', `/jobs/${jobId}`);
                return { output: { job: data } };
            }
            case 'createJob': {
                const body = inputs.jobData ?? {};
                const data = await icimsFetch('POST', `/jobs`, body);
                return { output: { job: data } };
            }
            case 'updateJob': {
                const jobId = String(inputs.jobId ?? '').trim();
                if (!jobId) throw new Error('jobId is required.');
                const body = inputs.jobData ?? {};
                const data = await icimsFetch('PATCH', `/jobs/${jobId}`, body);
                return { output: { job: data } };
            }
            case 'listWorkflows': {
                const limit = Number(inputs.limit ?? 20);
                const offset = Number(inputs.offset ?? 0);
                const data = await icimsFetch('GET', `/applicantworkflows?limit=${limit}&offset=${offset}`);
                return { output: { workflows: data.items ?? data, total: data.totalCount ?? null } };
            }
            case 'getWorkflow': {
                const workflowId = String(inputs.workflowId ?? '').trim();
                if (!workflowId) throw new Error('workflowId is required.');
                const data = await icimsFetch('GET', `/applicantworkflows/${workflowId}`);
                return { output: { workflow: data } };
            }
            case 'listOffers': {
                const limit = Number(inputs.limit ?? 20);
                const offset = Number(inputs.offset ?? 0);
                const data = await icimsFetch('GET', `/offers?limit=${limit}&offset=${offset}`);
                return { output: { offers: data.items ?? data, total: data.totalCount ?? null } };
            }
            case 'createOffer': {
                const body = inputs.offerData ?? {};
                const data = await icimsFetch('POST', `/offers`, body);
                return { output: { offer: data } };
            }
            case 'updateOffer': {
                const offerId = String(inputs.offerId ?? '').trim();
                if (!offerId) throw new Error('offerId is required.');
                const body = inputs.offerData ?? {};
                const data = await icimsFetch('PATCH', `/offers/${offerId}`, body);
                return { output: { offer: data } };
            }
            case 'listFolders': {
                const limit = Number(inputs.limit ?? 20);
                const offset = Number(inputs.offset ?? 0);
                const data = await icimsFetch('GET', `/folders?limit=${limit}&offset=${offset}`);
                return { output: { folders: data.items ?? data, total: data.totalCount ?? null } };
            }
            case 'getFolder': {
                const folderId = String(inputs.folderId ?? '').trim();
                if (!folderId) throw new Error('folderId is required.');
                const data = await icimsFetch('GET', `/folders/${folderId}`);
                return { output: { folder: data } };
            }
            default:
                return { error: `Unknown iCIMS action: ${actionName}` };
        }
    } catch (err: any) {
        logger?.log(`[iCIMS] Error: ${err.message}`);
        return { error: err.message ?? 'iCIMS action failed.' };
    }
}
