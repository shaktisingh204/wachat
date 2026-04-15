'use server';

export async function executeWorkableAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        const subdomain = String(inputs.subdomain ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');
        if (!subdomain) throw new Error('subdomain is required.');

        const BASE_URL = `https://${subdomain}.workable.com/spi/v3`;

        const wFetch = async (method: string, path: string, body?: any, params?: Record<string, string | number>) => {
            logger?.log(`[Workable] ${method} ${path}`);
            let url = `${BASE_URL}${path}`;
            if (params) {
                const qs = Object.entries(params)
                    .filter(([, v]) => v !== undefined && v !== null && v !== '')
                    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
                    .join('&');
                if (qs) url += `?${qs}`;
            }
            const options: RequestInit = {
                method,
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            };
            if (body !== undefined) options.body = JSON.stringify(body);
            const res = await fetch(url, options);
            if (res.status === 204) return {};
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error?.message || data?.message || `Workable API error: ${res.status}`);
            return data;
        };

        switch (actionName) {
            case 'listJobs': {
                const params: Record<string, string | number> = { state: inputs.state ?? 'published', limit: Number(inputs.limit ?? 50) };
                if (inputs.since) params.since = String(inputs.since);
                const data = await wFetch('GET', '/jobs', undefined, params);
                return { output: { jobs: data.jobs ?? data, paging: data.paging ?? {} } };
            }
            case 'getJob': {
                const shortcode = String(inputs.shortcode ?? '').trim();
                if (!shortcode) throw new Error('shortcode is required.');
                const data = await wFetch('GET', `/jobs/${shortcode}`);
                return { output: { job: data } };
            }
            case 'createJob': {
                const title = String(inputs.title ?? '').trim();
                const description = String(inputs.description ?? '').trim();
                if (!title) throw new Error('title is required.');
                if (!description) throw new Error('description is required.');
                const jobBody: Record<string, any> = {
                    title,
                    description,
                    full_description: description,
                    employment_type: inputs.employmentType ?? 'full-time',
                    remote: inputs.remote ?? false,
                };
                if (inputs.requirements) jobBody.requirements = String(inputs.requirements);
                if (inputs.benefits) jobBody.benefits = String(inputs.benefits);
                if (inputs.locationId) jobBody.location_id = inputs.locationId;
                const data = await wFetch('POST', '/jobs', { job: jobBody });
                return { output: { shortcode: data.shortcode, title: data.title, state: data.state } };
            }
            case 'archiveJob': {
                const shortcode = String(inputs.shortcode ?? '').trim();
                if (!shortcode) throw new Error('shortcode is required.');
                const data = await wFetch('POST', `/jobs/${shortcode}/archive`);
                return { output: { result: data } };
            }
            case 'listCandidates': {
                const params: Record<string, string | number> = { limit: Number(inputs.limit ?? 50) };
                if (inputs.jobShortcode) params.shortcode = String(inputs.jobShortcode);
                if (inputs.stage) params.stage = String(inputs.stage);
                if (inputs.since) params.since = String(inputs.since);
                const data = await wFetch('GET', '/candidates', undefined, params);
                return { output: { candidates: data.candidates ?? data, paging: data.paging ?? {} } };
            }
            case 'getCandidate': {
                const candidateId = String(inputs.candidateId ?? '').trim();
                if (!candidateId) throw new Error('candidateId is required.');
                const data = await wFetch('GET', `/candidates/${candidateId}`);
                return { output: { candidate: data } };
            }
            case 'createCandidate': {
                const jobShortcode = String(inputs.jobShortcode ?? '').trim();
                const firstName = String(inputs.firstName ?? '').trim();
                const lastName = String(inputs.lastName ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                if (!jobShortcode) throw new Error('jobShortcode is required.');
                if (!firstName) throw new Error('firstName is required.');
                if (!lastName) throw new Error('lastName is required.');
                if (!email) throw new Error('email is required.');
                const candidateBody: Record<string, any> = {
                    firstname: firstName,
                    lastname: lastName,
                    email,
                    domain: 'applied',
                    stage: inputs.stage ?? 'applied',
                };
                if (inputs.phone) candidateBody.phone = String(inputs.phone);
                if (inputs.resumeUrl) candidateBody.resume_url = String(inputs.resumeUrl);
                if (inputs.coverLetter) candidateBody.cover_letter = String(inputs.coverLetter);
                const data = await wFetch('POST', `/jobs/${jobShortcode}/candidates`, { candidate: candidateBody });
                return { output: { candidate: data.candidate ?? data } };
            }
            case 'updateCandidate': {
                const candidateId = String(inputs.candidateId ?? '').trim();
                if (!candidateId) throw new Error('candidateId is required.');
                const body = inputs.candidateData ?? {};
                const data = await wFetch('PATCH', `/candidates/${candidateId}`, body);
                return { output: { candidate: data } };
            }
            case 'listStages': {
                const jobShortcode = String(inputs.jobShortcode ?? '').trim();
                if (!jobShortcode) throw new Error('jobShortcode is required.');
                const data = await wFetch('GET', `/jobs/${jobShortcode}/stages`);
                return { output: { stages: data.stages ?? data } };
            }
            case 'moveCandidate': {
                const candidateId = String(inputs.candidateId ?? '').trim();
                const jobShortcode = String(inputs.jobShortcode ?? '').trim();
                const stage = String(inputs.stage ?? '').trim();
                if (!candidateId) throw new Error('candidateId is required.');
                if (!jobShortcode) throw new Error('jobShortcode is required.');
                if (!stage) throw new Error('stage is required.');
                const data = await wFetch('POST', `/jobs/${jobShortcode}/candidates/${candidateId}/move`, { stage });
                return { output: { stage: data.stage ?? data } };
            }
            case 'listMembers': {
                const data = await wFetch('GET', '/members');
                return { output: { members: data.members ?? data } };
            }
            case 'getMember': {
                const memberId = String(inputs.memberId ?? '').trim();
                if (!memberId) throw new Error('memberId is required.');
                const data = await wFetch('GET', `/members/${memberId}`);
                return { output: { member: data } };
            }
            case 'listActivities': {
                const params: Record<string, string | number> = { limit: Number(inputs.limit ?? 50) };
                if (inputs.since) params.since = String(inputs.since);
                const data = await wFetch('GET', '/activities', undefined, params);
                return { output: { activities: data.activities ?? data, paging: data.paging ?? {} } };
            }
            case 'getActivity': {
                const activityId = String(inputs.activityId ?? '').trim();
                if (!activityId) throw new Error('activityId is required.');
                const data = await wFetch('GET', `/activities/${activityId}`);
                return { output: { activity: data } };
            }
            case 'listOffers': {
                const candidateId = String(inputs.candidateId ?? '').trim();
                if (!candidateId) throw new Error('candidateId is required.');
                const data = await wFetch('GET', `/candidates/${candidateId}/offers`);
                return { output: { offers: data.offers ?? data } };
            }
            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        logger?.log(`[Workable] Error: ${e.message}`);
        return { error: e.message || 'Action failed.' };
    }
}
