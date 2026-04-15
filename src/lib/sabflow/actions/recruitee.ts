'use server';

export async function executeRecruiteeAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const baseUrl = `https://${inputs.companySlug}.recruitee.com/api`;
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${inputs.apiKey}`,
            'Content-Type': 'application/json',
        };

        let url = '';
        let method = 'GET';
        let body: any = undefined;

        switch (actionName) {
            case 'listCandidates': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                if (inputs.query) params.set('query', inputs.query);
                url = `${baseUrl}/candidates?${params.toString()}`;
                break;
            }
            case 'getCandidate': {
                url = `${baseUrl}/candidates/${inputs.candidateId}`;
                break;
            }
            case 'createCandidate': {
                method = 'POST';
                url = `${baseUrl}/candidates`;
                body = JSON.stringify({
                    candidate: {
                        name: inputs.name,
                        emails: inputs.emails || [],
                        phones: inputs.phones || [],
                        cover_letter: inputs.coverLetter,
                        social_links: inputs.socialLinks || [],
                    },
                });
                break;
            }
            case 'updateCandidate': {
                method = 'PATCH';
                url = `${baseUrl}/candidates/${inputs.candidateId}`;
                body = JSON.stringify({
                    candidate: {
                        name: inputs.name,
                        emails: inputs.emails,
                        phones: inputs.phones,
                        cover_letter: inputs.coverLetter,
                    },
                });
                break;
            }
            case 'deleteCandidate': {
                method = 'DELETE';
                url = `${baseUrl}/candidates/${inputs.candidateId}`;
                break;
            }
            case 'listJobs': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                if (inputs.status) params.set('status', inputs.status);
                url = `${baseUrl}/offers?${params.toString()}`;
                break;
            }
            case 'getJob': {
                url = `${baseUrl}/offers/${inputs.jobId}`;
                break;
            }
            case 'createJob': {
                method = 'POST';
                url = `${baseUrl}/offers`;
                body = JSON.stringify({
                    offer: {
                        title: inputs.title,
                        description: inputs.description,
                        department: inputs.department,
                        location: inputs.location,
                        employment_type: inputs.employmentType || 'full_time',
                        status: inputs.status || 'published',
                    },
                });
                break;
            }
            case 'updateJob': {
                method = 'PATCH';
                url = `${baseUrl}/offers/${inputs.jobId}`;
                body = JSON.stringify({
                    offer: {
                        title: inputs.title,
                        description: inputs.description,
                        department: inputs.department,
                        location: inputs.location,
                        status: inputs.status,
                    },
                });
                break;
            }
            case 'deleteJob': {
                method = 'DELETE';
                url = `${baseUrl}/offers/${inputs.jobId}`;
                break;
            }
            case 'listApplications': {
                const params = new URLSearchParams();
                if (inputs.jobId) params.set('offer_id', String(inputs.jobId));
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                url = `${baseUrl}/applications?${params.toString()}`;
                break;
            }
            case 'getApplication': {
                url = `${baseUrl}/applications/${inputs.applicationId}`;
                break;
            }
            case 'addCandidateNote': {
                method = 'POST';
                url = `${baseUrl}/candidates/${inputs.candidateId}/notes`;
                body = JSON.stringify({
                    note: {
                        body: inputs.body,
                        visibility: inputs.visibility || 'everyone',
                    },
                });
                break;
            }
            case 'listStages': {
                url = `${baseUrl}/pipeline_stages`;
                break;
            }
            case 'moveApplication': {
                method = 'PATCH';
                url = `${baseUrl}/applications/${inputs.applicationId}`;
                body = JSON.stringify({
                    application: {
                        stage_id: inputs.stageId,
                    },
                });
                break;
            }
            default:
                return { error: `Unknown Recruitee action: ${actionName}` };
        }

        const fetchOptions: RequestInit = { method, headers };
        if (body !== undefined) fetchOptions.body = body;

        const response = await fetch(url, fetchOptions);
        const text = await response.text();
        let data: any;
        try { data = JSON.parse(text); } catch { data = { raw: text }; }

        if (!response.ok) {
            return { error: `Recruitee API error ${response.status}: ${text}` };
        }

        return { output: data };
    } catch (err: any) {
        logger.log(`Recruitee action error: ${err.message}`);
        return { error: err.message || 'Unknown error in Recruitee action' };
    }
}
