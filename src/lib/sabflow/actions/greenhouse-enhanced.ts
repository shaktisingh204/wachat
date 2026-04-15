'use server';

export async function executeGreenhouseEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const baseUrl = 'https://harvest.greenhouse.io/v1';
        const encoded = Buffer.from(inputs.apiKey + ':').toString('base64');

        const headers: Record<string, string> = {
            'Authorization': `Basic ${encoded}`,
            'Content-Type': 'application/json',
            'On-Behalf-Of': inputs.onBehalfOf || '',
        };

        if (!inputs.onBehalfOf) {
            delete headers['On-Behalf-Of'];
        }

        let url = '';
        let method = 'GET';
        let body: any = undefined;

        switch (actionName) {
            case 'listJobs': {
                const params = new URLSearchParams();
                if (inputs.status) params.set('status', inputs.status);
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.page) params.set('page', String(inputs.page));
                url = `${baseUrl}/jobs?${params.toString()}`;
                break;
            }
            case 'getJob': {
                url = `${baseUrl}/jobs/${inputs.jobId}`;
                break;
            }
            case 'createJob': {
                method = 'POST';
                url = `${baseUrl}/jobs`;
                body = JSON.stringify({
                    template_job_id: inputs.templateJobId,
                    number_of_openings: inputs.numberOfOpenings || 1,
                    job_post_name: inputs.jobPostName,
                    job_name: inputs.jobName,
                    department_id: inputs.departmentId,
                    office_ids: inputs.officeIds || [],
                    requisition_id: inputs.requisitionId,
                    opening_ids: inputs.openingIds || [],
                });
                break;
            }
            case 'listApplications': {
                const params = new URLSearchParams();
                if (inputs.jobId) params.set('job_id', String(inputs.jobId));
                if (inputs.status) params.set('status', inputs.status);
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.page) params.set('page', String(inputs.page));
                url = `${baseUrl}/applications?${params.toString()}`;
                break;
            }
            case 'getApplication': {
                url = `${baseUrl}/applications/${inputs.applicationId}`;
                break;
            }
            case 'advanceApplication': {
                method = 'POST';
                url = `${baseUrl}/applications/${inputs.applicationId}/advance`;
                body = JSON.stringify({
                    from_stage_id: inputs.fromStageId,
                });
                break;
            }
            case 'rejectApplication': {
                method = 'POST';
                url = `${baseUrl}/applications/${inputs.applicationId}/reject`;
                body = JSON.stringify({
                    rejection_reason_id: inputs.rejectionReasonId,
                    rejection_email: inputs.rejectionEmail || null,
                    notes: inputs.notes,
                });
                break;
            }
            case 'listCandidates': {
                const params = new URLSearchParams();
                if (inputs.email) params.set('email', inputs.email);
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.page) params.set('page', String(inputs.page));
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
                    first_name: inputs.firstName,
                    last_name: inputs.lastName,
                    email_addresses: inputs.emailAddresses || [],
                    phone_numbers: inputs.phoneNumbers || [],
                    addresses: inputs.addresses || [],
                    external_id: inputs.externalId,
                    social_media_addresses: inputs.socialMediaAddresses || [],
                    website_addresses: inputs.websiteAddresses || [],
                    tags: inputs.tags || [],
                });
                break;
            }
            case 'updateCandidate': {
                method = 'PATCH';
                url = `${baseUrl}/candidates/${inputs.candidateId}`;
                body = JSON.stringify({
                    first_name: inputs.firstName,
                    last_name: inputs.lastName,
                    email_addresses: inputs.emailAddresses,
                    phone_numbers: inputs.phoneNumbers,
                    tags: inputs.tags,
                });
                break;
            }
            case 'listInterviews': {
                const params = new URLSearchParams();
                if (inputs.jobId) params.set('job_id', String(inputs.jobId));
                url = `${baseUrl}/scheduled_interviews?${params.toString()}`;
                break;
            }
            case 'scheduleInterview': {
                method = 'POST';
                url = `${baseUrl}/applications/${inputs.applicationId}/interviews`;
                body = JSON.stringify({
                    interview_id: inputs.interviewId,
                    interviewers: inputs.interviewers || [],
                    start: inputs.start,
                    end: inputs.end,
                    location: inputs.location,
                    video_conferencing_url: inputs.videoConferencingUrl,
                });
                break;
            }
            case 'listOffers': {
                url = `${baseUrl}/applications/${inputs.applicationId}/offers`;
                break;
            }
            case 'getOffer': {
                url = `${baseUrl}/applications/${inputs.applicationId}/offers/${inputs.offerId}`;
                break;
            }
            default:
                return { error: `Unknown Greenhouse Enhanced action: ${actionName}` };
        }

        const fetchOptions: RequestInit = { method, headers };
        if (body !== undefined) fetchOptions.body = body;

        const response = await fetch(url, fetchOptions);
        const text = await response.text();
        let data: any;
        try { data = JSON.parse(text); } catch { data = { raw: text }; }

        if (!response.ok) {
            return { error: `Greenhouse API error ${response.status}: ${text}` };
        }

        return { output: data };
    } catch (err: any) {
        logger.log(`Greenhouse Enhanced action error: ${err.message}`);
        return { error: err.message || 'Unknown error in Greenhouse Enhanced action' };
    }
}
