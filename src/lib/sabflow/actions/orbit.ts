
'use server';

const ORBIT_BASE = 'https://app.orbit.love/api/v1';

async function orbitFetch(apiKey: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Orbit] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${ORBIT_BASE}${path}`, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.error || data?.message || `Orbit API error: ${res.status}`);
    }
    return data;
}

export async function executeOrbitAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        const workspaceSlug = String(inputs.workspaceSlug ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');
        if (!workspaceSlug) throw new Error('workspaceSlug is required.');
        const orbit = (method: string, path: string, body?: any) => orbitFetch(apiKey, method, path, body, logger);

        switch (actionName) {
            case 'listMembers': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('items', String(inputs.perPage));
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await orbit('GET', `/${workspaceSlug}/members${query}`);
                return { output: { members: data.data ?? data } };
            }

            case 'getMember': {
                const memberId = String(inputs.memberId ?? '').trim();
                if (!memberId) throw new Error('memberId is required.');
                const data = await orbit('GET', `/${workspaceSlug}/members/${memberId}`);
                return { output: data.data ?? data };
            }

            case 'createMember': {
                const body: any = { member: {} };
                if (inputs.name) body.member.name = inputs.name;
                if (inputs.email) body.member.email = inputs.email;
                if (inputs.github) body.member.github = inputs.github;
                if (inputs.twitter) body.member.twitter = inputs.twitter;
                if (inputs.bio) body.member.bio = inputs.bio;
                if (inputs.tags) body.member.tags_to_add = Array.isArray(inputs.tags) ? inputs.tags.join(',') : inputs.tags;
                const data = await orbit('POST', `/${workspaceSlug}/members`, body);
                return { output: data.data ?? data };
            }

            case 'updateMember': {
                const memberId = String(inputs.memberId ?? '').trim();
                if (!memberId) throw new Error('memberId is required.');
                const body: any = { member: {} };
                if (inputs.name) body.member.name = inputs.name;
                if (inputs.email) body.member.email = inputs.email;
                if (inputs.bio) body.member.bio = inputs.bio;
                if (inputs.tags) body.member.tags_to_add = Array.isArray(inputs.tags) ? inputs.tags.join(',') : inputs.tags;
                const data = await orbit('PUT', `/${workspaceSlug}/members/${memberId}`, body);
                return { output: data.data ?? data };
            }

            case 'deleteMember': {
                const memberId = String(inputs.memberId ?? '').trim();
                if (!memberId) throw new Error('memberId is required.');
                await orbit('DELETE', `/${workspaceSlug}/members/${memberId}`);
                return { output: { deleted: true } };
            }

            case 'listActivities': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('items', String(inputs.perPage));
                if (inputs.activityType) params.set('activity_type', String(inputs.activityType));
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await orbit('GET', `/${workspaceSlug}/activities${query}`);
                return { output: { activities: data.data ?? data } };
            }

            case 'createActivity': {
                const memberId = String(inputs.memberId ?? '').trim();
                if (!memberId) throw new Error('memberId is required.');
                const body: any = {
                    activity: {
                        activity_type: inputs.activityType ?? 'custom:action',
                    },
                };
                if (inputs.title) body.activity.title = inputs.title;
                if (inputs.description) body.activity.description = inputs.description;
                if (inputs.link) body.activity.link = inputs.link;
                if (inputs.occurredAt) body.activity.occurred_at = inputs.occurredAt;
                if (inputs.weight) body.activity.weight = inputs.weight;
                const data = await orbit('POST', `/${workspaceSlug}/members/${memberId}/activities`, body);
                return { output: data.data ?? data };
            }

            case 'listNotes': {
                const memberId = String(inputs.memberId ?? '').trim();
                if (!memberId) throw new Error('memberId is required.');
                const data = await orbit('GET', `/${workspaceSlug}/members/${memberId}/notes`);
                return { output: { notes: data.data ?? data } };
            }

            case 'createNote': {
                const memberId = String(inputs.memberId ?? '').trim();
                const body_text = String(inputs.body ?? '').trim();
                if (!memberId || !body_text) throw new Error('memberId and body are required.');
                const data = await orbit('POST', `/${workspaceSlug}/members/${memberId}/notes`, { note: { body: body_text } });
                return { output: data.data ?? data };
            }

            case 'addTag': {
                const memberId = String(inputs.memberId ?? '').trim();
                const tag = String(inputs.tag ?? '').trim();
                if (!memberId || !tag) throw new Error('memberId and tag are required.');
                const data = await orbit('POST', `/${workspaceSlug}/members/${memberId}/tags`, { tags_to_add: tag });
                return { output: data.data ?? data };
            }

            case 'removeTag': {
                const memberId = String(inputs.memberId ?? '').trim();
                const tag = String(inputs.tag ?? '').trim();
                if (!memberId || !tag) throw new Error('memberId and tag are required.');
                const data = await orbit('DELETE', `/${workspaceSlug}/members/${memberId}/tags`, { tags_to_remove: tag });
                return { output: data.data ?? data };
            }

            case 'getMemberActivities': {
                const memberId = String(inputs.memberId ?? '').trim();
                if (!memberId) throw new Error('memberId is required.');
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('items', String(inputs.perPage));
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await orbit('GET', `/${workspaceSlug}/members/${memberId}/activities${query}`);
                return { output: { activities: data.data ?? data } };
            }

            case 'getOrbitStats': {
                const data = await orbit('GET', `/${workspaceSlug}`);
                return { output: data.data ?? data };
            }

            case 'listOpportunities': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('items', String(inputs.perPage));
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await orbit('GET', `/${workspaceSlug}/opportunities${query}`);
                return { output: { opportunities: data.data ?? data } };
            }

            case 'createOpportunity': {
                const memberId = String(inputs.memberId ?? '').trim();
                if (!memberId) throw new Error('memberId is required.');
                const body: any = { opportunity: {} };
                if (inputs.title) body.opportunity.title = inputs.title;
                if (inputs.description) body.opportunity.description = inputs.description;
                if (inputs.closeDate) body.opportunity.close_date = inputs.closeDate;
                if (inputs.value) body.opportunity.value = inputs.value;
                const data = await orbit('POST', `/${workspaceSlug}/members/${memberId}/opportunities`, body);
                return { output: data.data ?? data };
            }

            default:
                throw new Error(`Unknown Orbit action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.log(`[Orbit] Error in ${actionName}: ${err.message}`);
        return { error: err.message ?? 'Unknown Orbit error' };
    }
}
