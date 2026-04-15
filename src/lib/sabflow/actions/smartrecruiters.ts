'use server';

export async function executeSmartRecruitersAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');

        const BASE_URL = 'https://api.smartrecruiters.com';

        const srFetch = async (method: string, path: string, body?: any) => {
            logger?.log(`[SmartRecruiters] ${method} ${path}`);
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
            if (!res.ok) throw new Error(data?.message || data?.error || `SmartRecruiters API error: ${res.status}`);
            return data;
        };

        switch (actionName) {
            case 'listJobs': {
                const limit = Number(inputs.limit ?? 10);
                const offset = Number(inputs.offset ?? 0);
                const status = inputs.status ? `&status=${inputs.status}` : '';
                const data = await srFetch('GET', `/jobs?limit=${limit}&offset=${offset}${status}`);
                return { output: { jobs: data.content ?? data, total: data.totalFound ?? null } };
            }
            case 'getJob': {
                const jobId = String(inputs.jobId ?? '').trim();
                if (!jobId) throw new Error('jobId is required.');
                const data = await srFetch('GET', `/jobs/${jobId}`);
                return { output: { job: data } };
            }
            case 'createJob': {
                const body = inputs.jobData ?? {};
                const data = await srFetch('POST', `/jobs`, body);
                return { output: { job: data } };
            }
            case 'updateJob': {
                const jobId = String(inputs.jobId ?? '').trim();
                if (!jobId) throw new Error('jobId is required.');
                const body = inputs.jobData ?? {};
                const data = await srFetch('PUT', `/jobs/${jobId}`, body);
                return { output: { job: data } };
            }
            case 'publishJob': {
                const jobId = String(inputs.jobId ?? '').trim();
                if (!jobId) throw new Error('jobId is required.');
                const data = await srFetch('POST', `/jobs/${jobId}/publication`);
                return { output: { result: data } };
            }
            case 'listCandidates': {
                const limit = Number(inputs.limit ?? 10);
                const offset = Number(inputs.offset ?? 0);
                const query = inputs.query ? `&q=${encodeURIComponent(inputs.query)}` : '';
                const data = await srFetch('GET', `/candidates?limit=${limit}&offset=${offset}${query}`);
                return { output: { candidates: data.content ?? data, total: data.totalFound ?? null } };
            }
            case 'getCandidate': {
                const candidateId = String(inputs.candidateId ?? '').trim();
                if (!candidateId) throw new Error('candidateId is required.');
                const data = await srFetch('GET', `/candidates/${candidateId}`);
                return { output: { candidate: data } };
            }
            case 'createCandidate': {
                const body = inputs.candidateData ?? {};
                const data = await srFetch('POST', `/candidates`, body);
                return { output: { candidate: data } };
            }
            case 'updateCandidate': {
                const candidateId = String(inputs.candidateId ?? '').trim();
                if (!candidateId) throw new Error('candidateId is required.');
                const body = inputs.candidateData ?? {};
                const data = await srFetch('PUT', `/candidates/${candidateId}`, body);
                return { output: { candidate: data } };
            }
            case 'listApplications': {
                const jobId = String(inputs.jobId ?? '').trim();
                if (!jobId) throw new Error('jobId is required.');
                const limit = Number(inputs.limit ?? 10);
                const offset = Number(inputs.offset ?? 0);
                const data = await srFetch('GET', `/jobs/${jobId}/applications?limit=${limit}&offset=${offset}`);
                return { output: { applications: data.content ?? data, total: data.totalFound ?? null } };
            }
            case 'getApplication': {
                const jobId = String(inputs.jobId ?? '').trim();
                const applicationId = String(inputs.applicationId ?? '').trim();
                if (!jobId) throw new Error('jobId is required.');
                if (!applicationId) throw new Error('applicationId is required.');
                const data = await srFetch('GET', `/jobs/${jobId}/applications/${applicationId}`);
                return { output: { application: data } };
            }
            case 'updateApplicationStatus': {
                const jobId = String(inputs.jobId ?? '').trim();
                const applicationId = String(inputs.applicationId ?? '').trim();
                const status = String(inputs.status ?? '').trim();
                if (!jobId) throw new Error('jobId is required.');
                if (!applicationId) throw new Error('applicationId is required.');
                if (!status) throw new Error('status is required.');
                const data = await srFetch('POST', `/jobs/${jobId}/applications/${applicationId}/interviews`, { status });
                return { output: { result: data } };
            }
            case 'scheduleInterview': {
                const jobId = String(inputs.jobId ?? '').trim();
                const applicationId = String(inputs.applicationId ?? '').trim();
                if (!jobId) throw new Error('jobId is required.');
                if (!applicationId) throw new Error('applicationId is required.');
                const body = inputs.interviewData ?? {};
                const data = await srFetch('POST', `/jobs/${jobId}/applications/${applicationId}/interviews`, body);
                return { output: { interview: data } };
            }
            case 'listInterviews': {
                const jobId = String(inputs.jobId ?? '').trim();
                const applicationId = String(inputs.applicationId ?? '').trim();
                if (!jobId) throw new Error('jobId is required.');
                if (!applicationId) throw new Error('applicationId is required.');
                const data = await srFetch('GET', `/jobs/${jobId}/applications/${applicationId}/interviews`);
                return { output: { interviews: data.content ?? data } };
            }
            case 'getInterview': {
                const jobId = String(inputs.jobId ?? '').trim();
                const applicationId = String(inputs.applicationId ?? '').trim();
                const interviewId = String(inputs.interviewId ?? '').trim();
                if (!jobId) throw new Error('jobId is required.');
                if (!applicationId) throw new Error('applicationId is required.');
                if (!interviewId) throw new Error('interviewId is required.');
                const data = await srFetch('GET', `/jobs/${jobId}/applications/${applicationId}/interviews/${interviewId}`);
                return { output: { interview: data } };
            }
            default:
                return { error: `Unknown SmartRecruiters action: ${actionName}` };
        }
    } catch (err: any) {
        logger?.log(`[SmartRecruiters] Error: ${err.message}`);
        return { error: err.message ?? 'SmartRecruiters action failed.' };
    }
}
