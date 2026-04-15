'use server';

export async function executeGreenhouseEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        const BASE_URL = 'https://harvest.greenhouse.io/v1';
        const encoded = Buffer.from(`${apiKey}:`).toString('base64');
        const headers: Record<string, string> = {
            Authorization: `Basic ${encoded}`,
            'Content-Type': 'application/json',
        };
        if (inputs.onBehalfOf) headers['On-Behalf-Of'] = String(inputs.onBehalfOf);

        switch (actionName) {
            case 'listCandidates': {
                const params = new URLSearchParams();
                if (inputs.email) params.set('email', inputs.email);
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.page) params.set('page', String(inputs.page));
                const res = await fetch(`${BASE_URL}/candidates?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Greenhouse API error: ${res.status}`);
                return { output: { candidates: data } };
            }
            case 'getCandidate': {
                const candidateId = String(inputs.candidateId ?? '').trim();
                if (!candidateId) throw new Error('candidateId is required.');
                const res = await fetch(`${BASE_URL}/candidates/${candidateId}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Greenhouse API error: ${res.status}`);
                return { output: { candidate: data } };
            }
            case 'createCandidate': {
                const body = JSON.stringify({
                    first_name: inputs.firstName,
                    last_name: inputs.lastName,
                    email_addresses: inputs.emailAddresses ?? [],
                    phone_numbers: inputs.phoneNumbers ?? [],
                    addresses: inputs.addresses ?? [],
                    external_id: inputs.externalId,
                    social_media_addresses: inputs.socialMediaAddresses ?? [],
                    website_addresses: inputs.websiteAddresses ?? [],
                    tags: inputs.tags ?? [],
                });
                const res = await fetch(`${BASE_URL}/candidates`, { method: 'POST', headers, body });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Greenhouse API error: ${res.status}`);
                return { output: { candidate: data } };
            }
            case 'updateCandidate': {
                const candidateId = String(inputs.candidateId ?? '').trim();
                if (!candidateId) throw new Error('candidateId is required.');
                const body = JSON.stringify({
                    first_name: inputs.firstName,
                    last_name: inputs.lastName,
                    email_addresses: inputs.emailAddresses,
                    phone_numbers: inputs.phoneNumbers,
                    tags: inputs.tags,
                });
                const res = await fetch(`${BASE_URL}/candidates/${candidateId}`, { method: 'PATCH', headers, body });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Greenhouse API error: ${res.status}`);
                return { output: { candidate: data } };
            }
            case 'listApplications': {
                const params = new URLSearchParams();
                if (inputs.jobId) params.set('job_id', String(inputs.jobId));
                if (inputs.status) params.set('status', inputs.status);
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.page) params.set('page', String(inputs.page));
                const res = await fetch(`${BASE_URL}/applications?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Greenhouse API error: ${res.status}`);
                return { output: { applications: data } };
            }
            case 'getApplication': {
                const applicationId = String(inputs.applicationId ?? '').trim();
                if (!applicationId) throw new Error('applicationId is required.');
                const res = await fetch(`${BASE_URL}/applications/${applicationId}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Greenhouse API error: ${res.status}`);
                return { output: { application: data } };
            }
            case 'listJobs': {
                const params = new URLSearchParams();
                if (inputs.status) params.set('status', inputs.status);
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.page) params.set('page', String(inputs.page));
                const res = await fetch(`${BASE_URL}/jobs?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Greenhouse API error: ${res.status}`);
                return { output: { jobs: data } };
            }
            case 'getJob': {
                const jobId = String(inputs.jobId ?? '').trim();
                if (!jobId) throw new Error('jobId is required.');
                const res = await fetch(`${BASE_URL}/jobs/${jobId}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Greenhouse API error: ${res.status}`);
                return { output: { job: data } };
            }
            case 'createJob': {
                const body = JSON.stringify({
                    template_job_id: inputs.templateJobId,
                    number_of_openings: inputs.numberOfOpenings ?? 1,
                    job_post_name: inputs.jobPostName,
                    job_name: inputs.jobName,
                    department_id: inputs.departmentId,
                    office_ids: inputs.officeIds ?? [],
                    requisition_id: inputs.requisitionId,
                    opening_ids: inputs.openingIds ?? [],
                });
                const res = await fetch(`${BASE_URL}/jobs`, { method: 'POST', headers, body });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Greenhouse API error: ${res.status}`);
                return { output: { job: data } };
            }
            case 'listJobStages': {
                const jobId = String(inputs.jobId ?? '').trim();
                if (!jobId) throw new Error('jobId is required.');
                const res = await fetch(`${BASE_URL}/jobs/${jobId}/stages`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Greenhouse API error: ${res.status}`);
                return { output: { stages: data } };
            }
            case 'getJobStage': {
                const jobId = String(inputs.jobId ?? '').trim();
                const stageId = String(inputs.stageId ?? '').trim();
                if (!jobId) throw new Error('jobId is required.');
                if (!stageId) throw new Error('stageId is required.');
                const res = await fetch(`${BASE_URL}/jobs/${jobId}/stages/${stageId}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Greenhouse API error: ${res.status}`);
                return { output: { stage: data } };
            }
            case 'listOffers': {
                const applicationId = String(inputs.applicationId ?? '').trim();
                if (!applicationId) throw new Error('applicationId is required.');
                const res = await fetch(`${BASE_URL}/applications/${applicationId}/offers`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Greenhouse API error: ${res.status}`);
                return { output: { offers: data } };
            }
            case 'getOffer': {
                const applicationId = String(inputs.applicationId ?? '').trim();
                const offerId = String(inputs.offerId ?? '').trim();
                if (!applicationId) throw new Error('applicationId is required.');
                if (!offerId) throw new Error('offerId is required.');
                const res = await fetch(`${BASE_URL}/applications/${applicationId}/offers/${offerId}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Greenhouse API error: ${res.status}`);
                return { output: { offer: data } };
            }
            case 'createOffer': {
                const applicationId = String(inputs.applicationId ?? '').trim();
                if (!applicationId) throw new Error('applicationId is required.');
                const body = JSON.stringify(inputs.offerData ?? {});
                const res = await fetch(`${BASE_URL}/applications/${applicationId}/offers`, {
                    method: 'POST',
                    headers,
                    body,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Greenhouse API error: ${res.status}`);
                return { output: { offer: data } };
            }
            case 'listScorecards': {
                const applicationId = String(inputs.applicationId ?? '').trim();
                if (!applicationId) throw new Error('applicationId is required.');
                const res = await fetch(`${BASE_URL}/applications/${applicationId}/scorecards`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Greenhouse API error: ${res.status}`);
                return { output: { scorecards: data } };
            }
            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        logger?.log(`[GreenhouseEnhanced] Error: ${e.message}`);
        return { error: e.message || 'Action failed.' };
    }
}
