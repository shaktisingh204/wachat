'use server';

export async function executeGreenhouseAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        const BASE_URL = 'https://harvest.greenhouse.io/v1';
        const authHeader = `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`;

        const ghFetch = async (method: string, path: string, body?: any) => {
            logger?.log(`[Greenhouse] ${method} ${path}`);
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
            if (!res.ok) throw new Error(data?.message || data?.error || `Greenhouse API error: ${res.status}`);
            return data;
        };

        switch (actionName) {
            case 'listCandidates': {
                const perPage = Number(inputs.perPage ?? 100);
                const page = Number(inputs.page ?? 1);
                const data = await ghFetch('GET', `/candidates?per_page=${perPage}&page=${page}`);
                return { output: { candidates: data } };
            }
            case 'getCandidate': {
                const candidateId = String(inputs.candidateId ?? '').trim();
                if (!candidateId) throw new Error('candidateId is required.');
                const data = await ghFetch('GET', `/candidates/${candidateId}`);
                return { output: { candidate: data } };
            }
            case 'createCandidate': {
                const body = inputs.candidateData ?? {};
                const data = await ghFetch('POST', `/candidates`, body);
                return { output: { candidate: data } };
            }
            case 'updateCandidate': {
                const candidateId = String(inputs.candidateId ?? '').trim();
                if (!candidateId) throw new Error('candidateId is required.');
                const body = inputs.candidateData ?? {};
                const data = await ghFetch('PATCH', `/candidates/${candidateId}`, body);
                return { output: { candidate: data } };
            }
            case 'listApplications': {
                const perPage = Number(inputs.perPage ?? 100);
                const page = Number(inputs.page ?? 1);
                const data = await ghFetch('GET', `/applications?per_page=${perPage}&page=${page}`);
                return { output: { applications: data } };
            }
            case 'getApplication': {
                const applicationId = String(inputs.applicationId ?? '').trim();
                if (!applicationId) throw new Error('applicationId is required.');
                const data = await ghFetch('GET', `/applications/${applicationId}`);
                return { output: { application: data } };
            }
            case 'createApplication': {
                const candidateId = String(inputs.candidateId ?? '').trim();
                if (!candidateId) throw new Error('candidateId is required.');
                const body = inputs.applicationData ?? {};
                const data = await ghFetch('POST', `/candidates/${candidateId}/applications`, body);
                return { output: { application: data } };
            }
            case 'updateApplication': {
                const applicationId = String(inputs.applicationId ?? '').trim();
                if (!applicationId) throw new Error('applicationId is required.');
                const body = inputs.applicationData ?? {};
                const data = await ghFetch('PATCH', `/applications/${applicationId}`, body);
                return { output: { application: data } };
            }
            case 'listJobs': {
                const perPage = Number(inputs.perPage ?? 100);
                const page = Number(inputs.page ?? 1);
                const status = inputs.status ? `&status=${inputs.status}` : '';
                const data = await ghFetch('GET', `/jobs?per_page=${perPage}&page=${page}${status}`);
                return { output: { jobs: data } };
            }
            case 'getJob': {
                const jobId = String(inputs.jobId ?? '').trim();
                if (!jobId) throw new Error('jobId is required.');
                const data = await ghFetch('GET', `/jobs/${jobId}`);
                return { output: { job: data } };
            }
            case 'createJob': {
                const body = inputs.jobData ?? {};
                const data = await ghFetch('POST', `/jobs`, body);
                return { output: { job: data } };
            }
            case 'listOffers': {
                const perPage = Number(inputs.perPage ?? 100);
                const page = Number(inputs.page ?? 1);
                const data = await ghFetch('GET', `/offers?per_page=${perPage}&page=${page}`);
                return { output: { offers: data } };
            }
            case 'getOffer': {
                const offerId = String(inputs.offerId ?? '').trim();
                if (!offerId) throw new Error('offerId is required.');
                const data = await ghFetch('GET', `/offers/${offerId}`);
                return { output: { offer: data } };
            }
            case 'createOffer': {
                const applicationId = String(inputs.applicationId ?? '').trim();
                if (!applicationId) throw new Error('applicationId is required.');
                const body = inputs.offerData ?? {};
                const data = await ghFetch('POST', `/applications/${applicationId}/offers`, body);
                return { output: { offer: data } };
            }
            case 'listInterviews': {
                const perPage = Number(inputs.perPage ?? 100);
                const page = Number(inputs.page ?? 1);
                const data = await ghFetch('GET', `/scheduled_interviews?per_page=${perPage}&page=${page}`);
                return { output: { interviews: data } };
            }
            default:
                return { error: `Unknown Greenhouse action: ${actionName}` };
        }
    } catch (err: any) {
        logger?.log(`[Greenhouse] Error: ${err.message}`);
        return { error: err.message ?? 'Greenhouse action failed.' };
    }
}
