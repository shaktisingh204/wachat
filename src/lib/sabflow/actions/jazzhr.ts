'use server';

export async function executeJazzHRAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const baseUrl = 'https://api.resumatorapi.com/v1';
        const apiKey = inputs.apiKey;

        const authParam = `apikey=${encodeURIComponent(apiKey)}`;

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        let url = '';
        let method = 'GET';
        let body: any = undefined;

        switch (actionName) {
            case 'listJobs': {
                const params = new URLSearchParams({ apikey: apiKey });
                if (inputs.status) params.set('status', inputs.status);
                if (inputs.page) params.set('page', String(inputs.page));
                url = `${baseUrl}/jobs?${params.toString()}`;
                break;
            }
            case 'getJob': {
                url = `${baseUrl}/jobs/${inputs.jobId}?${authParam}`;
                break;
            }
            case 'createJob': {
                method = 'POST';
                url = `${baseUrl}/jobs?${authParam}`;
                body = JSON.stringify({
                    title: inputs.title,
                    description: inputs.description,
                    department: inputs.department,
                    city: inputs.city,
                    state: inputs.state,
                    country: inputs.country,
                    employment_type: inputs.employmentType,
                });
                break;
            }
            case 'listApplicants': {
                const params = new URLSearchParams({ apikey: apiKey });
                if (inputs.jobId) params.set('job_id', inputs.jobId);
                if (inputs.page) params.set('page', String(inputs.page));
                url = `${baseUrl}/applicants?${params.toString()}`;
                break;
            }
            case 'getApplicant': {
                url = `${baseUrl}/applicants/${inputs.applicantId}?${authParam}`;
                break;
            }
            case 'createApplicant': {
                method = 'POST';
                url = `${baseUrl}/applicants?${authParam}`;
                body = JSON.stringify({
                    first_name: inputs.firstName,
                    last_name: inputs.lastName,
                    email: inputs.email,
                    phone: inputs.phone,
                    job_id: inputs.jobId,
                    resume: inputs.resume,
                    cover_letter: inputs.coverLetter,
                });
                break;
            }
            case 'listActivities': {
                const params = new URLSearchParams({ apikey: apiKey });
                if (inputs.applicantId) params.set('applicant_id', inputs.applicantId);
                url = `${baseUrl}/activities?${params.toString()}`;
                break;
            }
            case 'getActivity': {
                url = `${baseUrl}/activities/${inputs.activityId}?${authParam}`;
                break;
            }
            case 'listUsers': {
                url = `${baseUrl}/users?${authParam}`;
                break;
            }
            case 'getUser': {
                url = `${baseUrl}/users/${inputs.userId}?${authParam}`;
                break;
            }
            case 'listNotes': {
                const params = new URLSearchParams({ apikey: apiKey });
                if (inputs.applicantId) params.set('applicant_id', inputs.applicantId);
                url = `${baseUrl}/notes?${params.toString()}`;
                break;
            }
            case 'addNote': {
                method = 'POST';
                url = `${baseUrl}/notes?${authParam}`;
                body = JSON.stringify({
                    applicant_id: inputs.applicantId,
                    contents: inputs.contents,
                    user_id: inputs.userId,
                });
                break;
            }
            case 'listStatuses': {
                url = `${baseUrl}/applicants/statuses?${authParam}`;
                break;
            }
            case 'listSources': {
                url = `${baseUrl}/applicants/sources?${authParam}`;
                break;
            }
            case 'listDepartments': {
                url = `${baseUrl}/departments?${authParam}`;
                break;
            }
            default:
                return { error: `Unknown JazzHR action: ${actionName}` };
        }

        const fetchOptions: RequestInit = { method, headers };
        if (body !== undefined) fetchOptions.body = body;

        const response = await fetch(url, fetchOptions);
        const text = await response.text();
        let data: any;
        try { data = JSON.parse(text); } catch { data = { raw: text }; }

        if (!response.ok) {
            return { error: `JazzHR API error ${response.status}: ${text}` };
        }

        return { output: data };
    } catch (err: any) {
        logger.log(`JazzHR action error: ${err.message}`);
        return { error: err.message || 'Unknown error in JazzHR action' };
    }
}
