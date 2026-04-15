
'use server';

async function workableRequest(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    subdomain: string,
    path: string,
    apiKey: string,
    body?: any,
    queryParams?: Record<string, string | number | undefined>
): Promise<any> {
    const base = `https://${subdomain}.workable.com/spi/v3`;
    let url = `${base}${path}`;

    if (queryParams) {
        const filtered = Object.entries(queryParams).filter(
            ([, v]) => v !== undefined && v !== null && v !== ''
        );
        if (filtered.length > 0) {
            url += '?' + filtered.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
        }
    }

    const res = await fetch(url, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
        let errMsg = `Workable API error ${res.status}`;
        try {
            const errBody = await res.json();
            errMsg = errBody.error?.message || errBody.message || JSON.stringify(errBody) || errMsg;
        } catch {
            errMsg = (await res.text()) || errMsg;
        }
        throw new Error(errMsg);
    }

    if (res.status === 204) return {};
    return res.json();
}

export async function executeWorkableAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
) {
    try {
        const subdomain = String(inputs.subdomain ?? '').trim();
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!subdomain) throw new Error('subdomain is required.');
        if (!apiKey) throw new Error('apiKey is required.');

        switch (actionName) {
            case 'listJobs': {
                const params: Record<string, string | number | undefined> = {
                    state: inputs.state ?? 'published',
                    limit: inputs.limit ?? 50,
                };
                if (inputs.since) params.since = String(inputs.since);
                const data = await workableRequest('GET', subdomain, '/jobs', apiKey, undefined, params);
                return {
                    output: {
                        jobs: (data.jobs ?? []).map((j: any) => ({
                            id: j.id,
                            title: j.title,
                            shortcode: j.shortcode,
                            state: j.state,
                            applicationUrl: j.application_url,
                        })),
                        paging: data.paging ?? {},
                    },
                };
            }

            case 'getJob': {
                const shortcode = String(inputs.shortcode ?? '').trim();
                if (!shortcode) throw new Error('shortcode is required.');
                const data = await workableRequest('GET', subdomain, `/jobs/${shortcode}`, apiKey);
                return {
                    output: {
                        id: data.id,
                        title: data.title,
                        shortcode: data.shortcode,
                        description: data.description,
                        requirements: data.requirements,
                        benefits: data.benefits,
                        state: data.state,
                        location: data.location ?? {},
                    },
                };
            }

            case 'listCandidates': {
                const params: Record<string, string | number | undefined> = {
                    limit: inputs.limit ?? 50,
                };
                if (inputs.jobShortcode) params.shortcode = String(inputs.jobShortcode);
                if (inputs.stage) params.stage = String(inputs.stage);
                if (inputs.since) params.since = String(inputs.since);
                const data = await workableRequest('GET', subdomain, '/candidates', apiKey, undefined, params);
                return {
                    output: {
                        candidates: (data.candidates ?? []).map((c: any) => ({
                            id: c.id,
                            name: c.name,
                            email: c.email,
                            stage: c.stage,
                            phone: c.phone,
                        })),
                        paging: data.paging ?? {},
                    },
                };
            }

            case 'getCandidate': {
                const candidateId = String(inputs.candidateId ?? '').trim();
                if (!candidateId) throw new Error('candidateId is required.');
                const data = await workableRequest('GET', subdomain, `/candidates/${candidateId}`, apiKey);
                return {
                    output: {
                        id: data.id,
                        name: data.name,
                        firstname: data.firstname,
                        lastname: data.lastname,
                        email: data.email,
                        phone: data.phone,
                        stage: data.stage,
                        coverLetter: data.cover_letter,
                        resumeUrl: data.resume_url,
                    },
                };
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
                const data = await workableRequest('POST', subdomain, `/jobs/${jobShortcode}/candidates`, apiKey, {
                    candidate: candidateBody,
                });
                logger.log(`[Workable] Created candidate ${data.candidate?.id}`);
                return { output: { candidate: data.candidate ?? {} } };
            }

            case 'updateCandidateStage': {
                const candidateId = String(inputs.candidateId ?? '').trim();
                const jobShortcode = String(inputs.jobShortcode ?? '').trim();
                const stage = String(inputs.stage ?? '').trim();
                if (!candidateId) throw new Error('candidateId is required.');
                if (!jobShortcode) throw new Error('jobShortcode is required.');
                if (!stage) throw new Error('stage is required.');
                const data = await workableRequest(
                    'POST',
                    subdomain,
                    `/jobs/${jobShortcode}/candidates/${candidateId}/move`,
                    apiKey,
                    { stage }
                );
                return { output: { stage: data.stage } };
            }

            case 'addCommentToCandidate': {
                const candidateId = String(inputs.candidateId ?? '').trim();
                const jobShortcode = String(inputs.jobShortcode ?? '').trim();
                const body = String(inputs.body ?? '').trim();
                const memberId = String(inputs.memberId ?? '').trim();
                if (!candidateId) throw new Error('candidateId is required.');
                if (!jobShortcode) throw new Error('jobShortcode is required.');
                if (!body) throw new Error('body is required.');
                if (!memberId) throw new Error('memberId is required.');
                const data = await workableRequest(
                    'POST',
                    subdomain,
                    `/jobs/${jobShortcode}/candidates/${candidateId}/comments`,
                    apiKey,
                    {
                        member_id: memberId,
                        policy: inputs.policy ?? 'simple',
                        body,
                    }
                );
                return { output: { id: data.id, body: data.body, createdAt: data.created_at } };
            }

            case 'disqualifyCandidate': {
                const candidateId = String(inputs.candidateId ?? '').trim();
                const jobShortcode = String(inputs.jobShortcode ?? '').trim();
                if (!candidateId) throw new Error('candidateId is required.');
                if (!jobShortcode) throw new Error('jobShortcode is required.');
                const data = await workableRequest(
                    'POST',
                    subdomain,
                    `/jobs/${jobShortcode}/candidates/${candidateId}/disqualify`,
                    apiKey,
                    { disqualification_reason: inputs.disqualificationReason ?? 'other' }
                );
                return { output: { stage: data.stage } };
            }

            case 'listMembers': {
                const data = await workableRequest('GET', subdomain, '/members', apiKey);
                const members = (data.members ?? []).map((m: any) => ({
                    id: m.id,
                    name: m.name,
                    email: m.email,
                    role: m.role,
                }));
                return { output: { members } };
            }

            case 'listStages': {
                const jobShortcode = String(inputs.jobShortcode ?? '').trim();
                if (!jobShortcode) throw new Error('jobShortcode is required.');
                const data = await workableRequest('GET', subdomain, `/jobs/${jobShortcode}/stages`, apiKey);
                const stages = (data.stages ?? []).map((s: any) => ({
                    slug: s.slug,
                    name: s.name,
                    position: s.position,
                    pipeline: s.pipeline,
                }));
                return { output: { stages } };
            }

            case 'getAccount': {
                const data = await workableRequest('GET', subdomain, '/accounts', apiKey);
                return {
                    output: {
                        id: data.id,
                        name: data.name,
                        subdomain: data.subdomain,
                    },
                };
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
                const data = await workableRequest('POST', subdomain, '/jobs', apiKey, { job: jobBody });
                logger.log(`[Workable] Created job ${data.shortcode}`);
                return { output: { shortcode: data.shortcode, title: data.title, state: data.state } };
            }

            default:
                return { error: `Workable action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        logger.log(`[Workable] Error in action "${actionName}": ${e.message}`);
        return { error: e.message || 'Workable action failed.' };
    }
}
