
'use server';

const LINKEDIN_BASE = 'https://api.linkedin.com/v2';

async function linkedinFetch(
    accessToken: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
) {
    logger?.log(`[LinkedIn] ${method} ${path}`);
    const url = path.startsWith('http') ? path : `${LINKEDIN_BASE}${path}`;
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || data?.serviceErrorCode?.toString() || `LinkedIn API error: ${res.status}`);
    }
    return data;
}

export async function executeLinkedinAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');

        const li = (method: string, path: string, body?: any) =>
            linkedinFetch(accessToken, method, path, body, logger);

        switch (actionName) {
            case 'getProfile': {
                const data = await li('GET', '/me?projection=(id,firstName,lastName,emailAddress,profilePicture)');
                return {
                    output: {
                        id: data.id ?? '',
                        firstName: data.firstName?.localized?.en_US ?? '',
                        lastName: data.lastName?.localized?.en_US ?? '',
                        profilePicture: data.profilePicture?.['displayImage~']?.elements?.[0]?.identifiers?.[0]?.identifier ?? '',
                    },
                };
            }

            case 'getOrganization': {
                const organizationId = String(inputs.organizationId ?? '').trim();
                if (!organizationId) throw new Error('organizationId is required.');
                const data = await li('GET', `/organizations/${organizationId}`);
                return { output: { id: data.id ?? '', name: data.localizedName ?? '', vanityName: data.vanityName ?? '' } };
            }

            case 'sharePost': {
                const text = String(inputs.text ?? '').trim();
                const visibility = String(inputs.visibility ?? 'PUBLIC').trim();
                if (!text) throw new Error('text is required.');
                const personUrn = String(inputs.personUrn ?? '').trim();
                const personId = String(inputs.personId ?? '').trim();
                const authorUrn = personUrn || (personId ? `urn:li:person:${personId}` : '');
                if (!authorUrn) throw new Error('personUrn or personId is required.');
                const body = {
                    author: authorUrn,
                    lifecycleState: 'PUBLISHED',
                    specificContent: {
                        'com.linkedin.ugc.ShareContent': {
                            shareCommentary: { text },
                            shareMediaCategory: 'NONE',
                        },
                    },
                    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': visibility },
                };
                const data = await li('POST', '/ugcPosts', body);
                return { output: { id: data.id ?? '', created: 'true' } };
            }

            case 'shareOrganizationPost': {
                const organizationId = String(inputs.organizationId ?? '').trim();
                const text = String(inputs.text ?? '').trim();
                const visibility = String(inputs.visibility ?? 'PUBLIC').trim();
                if (!organizationId) throw new Error('organizationId is required.');
                if (!text) throw new Error('text is required.');
                const body = {
                    author: `urn:li:organization:${organizationId}`,
                    lifecycleState: 'PUBLISHED',
                    specificContent: {
                        'com.linkedin.ugc.ShareContent': {
                            shareCommentary: { text },
                            shareMediaCategory: 'NONE',
                        },
                    },
                    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': visibility },
                };
                const data = await li('POST', '/ugcPosts', body);
                return { output: { id: data.id ?? '', created: 'true' } };
            }

            case 'createTextPost': {
                const text = String(inputs.text ?? '').trim();
                if (!text) throw new Error('text is required.');
                const personId = String(inputs.personId ?? '').trim();
                const personUrn = String(inputs.personUrn ?? '').trim();
                const authorUrn = personUrn || (personId ? `urn:li:person:${personId}` : '');
                if (!authorUrn) throw new Error('personUrn or personId is required.');
                const body = {
                    author: authorUrn,
                    lifecycleState: 'PUBLISHED',
                    specificContent: {
                        'com.linkedin.ugc.ShareContent': {
                            shareCommentary: { text },
                            shareMediaCategory: 'NONE',
                        },
                    },
                    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
                };
                const data = await li('POST', '/ugcPosts', body);
                return { output: { id: data.id ?? '', created: 'true' } };
            }

            case 'getConnections': {
                const data = await li('GET', '/connections?q=viewer');
                const elements = data.elements ?? [];
                return { output: { connections: elements, count: String(elements.length) } };
            }

            case 'searchPeople': {
                const keywords = String(inputs.keywords ?? '').trim();
                const limit = Number(inputs.limit ?? 10);
                if (!keywords) throw new Error('keywords is required.');
                const data = await li('GET', `/people-search?keywords=${encodeURIComponent(keywords)}&count=${limit}`);
                const elements = data.elements ?? [];
                return { output: { people: elements, count: String(elements.length) } };
            }

            case 'getJobPostings': {
                const organizationId = String(inputs.organizationId ?? '').trim();
                if (!organizationId) throw new Error('organizationId is required.');
                const data = await li('GET', `/jobPostings?q=organization&organization=${encodeURIComponent(`urn:li:organization:${organizationId}`)}`);
                const elements = data.elements ?? [];
                return { output: { jobs: elements, count: String(elements.length) } };
            }

            case 'createJobPosting': {
                const organizationId = String(inputs.organizationId ?? '').trim();
                const title = String(inputs.title ?? '').trim();
                const description = String(inputs.description ?? '').trim();
                const location = String(inputs.location ?? '').trim();
                const employmentStatus = String(inputs.employmentStatus ?? 'FULL_TIME').trim();
                if (!organizationId || !title || !description || !location) {
                    throw new Error('organizationId, title, description, and location are required.');
                }
                const body: any = {
                    companyApplyUrl: inputs.applyUrl ?? undefined,
                    description: { text: description },
                    employmentStatus,
                    listedAt: Date.now(),
                    location,
                    title,
                    hiringOrganization: { companyUrn: `urn:li:organization:${organizationId}` },
                };
                const data = await li('POST', '/jobPostings', body);
                return { output: { id: data.id ?? '', created: 'true' } };
            }

            case 'getAnalytics': {
                const organizationId = String(inputs.organizationId ?? '').trim();
                if (!organizationId) throw new Error('organizationId is required.');
                const timeRange = inputs.timeRange ?? {};
                let path = `/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${encodeURIComponent(`urn:li:organization:${organizationId}`)}`;
                if (timeRange.start) path += `&timeIntervals.timeRange.start=${timeRange.start}`;
                if (timeRange.end) path += `&timeIntervals.timeRange.end=${timeRange.end}`;
                const data = await li('GET', path);
                const elements = data.elements ?? [];
                return { output: { stats: elements, count: String(elements.length) } };
            }

            default:
                return { error: `LinkedIn action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'LinkedIn action failed.' };
    }
}
