'use server';

export async function executeSentryEnhancedAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any,
): Promise<{ output?: any; error?: string }> {
    try {
        const authToken = String(inputs.authToken ?? '').trim();
        if (!authToken) throw new Error('authToken is required.');

        const base = 'https://sentry.io/api/0';

        async function sentryFetch(method: string, path: string, body?: any) {
            logger?.log(`[Sentry-Enhanced] ${method} ${path}`);
            const url = `${base}${path}`;
            const headers: Record<string, string> = {
                Authorization: `Bearer ${authToken}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            };
            const options: RequestInit = { method, headers };
            if (body !== undefined) options.body = JSON.stringify(body);
            const res = await fetch(url, options);
            if (res.status === 204) return {};
            const text = await res.text();
            let json: any;
            try { json = JSON.parse(text); } catch { json = { raw: text }; }
            if (!res.ok) throw new Error(json?.detail ?? json?.message ?? `HTTP ${res.status}: ${text}`);
            return json;
        }

        switch (actionName) {
            case 'listOrganizations': {
                const data = await sentryFetch('GET', '/organizations/');
                return { output: data };
            }

            case 'getOrganization': {
                const orgSlug = String(inputs.orgSlug ?? '').trim();
                if (!orgSlug) throw new Error('orgSlug is required.');
                const data = await sentryFetch('GET', `/organizations/${orgSlug}/`);
                return { output: data };
            }

            case 'listProjects': {
                const orgSlug = String(inputs.orgSlug ?? '').trim();
                if (!orgSlug) throw new Error('orgSlug is required.');
                const data = await sentryFetch('GET', `/organizations/${orgSlug}/projects/`);
                return { output: data };
            }

            case 'getProject': {
                const orgSlug = String(inputs.orgSlug ?? '').trim();
                const projectSlug = String(inputs.projectSlug ?? '').trim();
                if (!orgSlug) throw new Error('orgSlug is required.');
                if (!projectSlug) throw new Error('projectSlug is required.');
                const data = await sentryFetch('GET', `/projects/${orgSlug}/${projectSlug}/`);
                return { output: data };
            }

            case 'createProject': {
                const orgSlug = String(inputs.orgSlug ?? '').trim();
                const teamSlug = String(inputs.teamSlug ?? '').trim();
                if (!orgSlug) throw new Error('orgSlug is required.');
                if (!teamSlug) throw new Error('teamSlug is required.');
                const payload: Record<string, any> = {};
                if (inputs.name) payload.name = inputs.name;
                if (inputs.slug) payload.slug = inputs.slug;
                if (inputs.platform) payload.platform = inputs.platform;
                const data = await sentryFetch('POST', `/teams/${orgSlug}/${teamSlug}/projects/`, payload);
                return { output: data };
            }

            case 'listIssues': {
                const orgSlug = String(inputs.orgSlug ?? '').trim();
                const projectSlug = String(inputs.projectSlug ?? '').trim();
                if (!orgSlug) throw new Error('orgSlug is required.');
                if (!projectSlug) throw new Error('projectSlug is required.');
                const params = new URLSearchParams();
                if (inputs.query) params.set('query', inputs.query);
                if (inputs.cursor) params.set('cursor', inputs.cursor);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await sentryFetch('GET', `/projects/${orgSlug}/${projectSlug}/issues/${qs}`);
                return { output: data };
            }

            case 'getIssue': {
                const issueId = String(inputs.issueId ?? '').trim();
                if (!issueId) throw new Error('issueId is required.');
                const data = await sentryFetch('GET', `/issues/${issueId}/`);
                return { output: data };
            }

            case 'updateIssue': {
                const issueId = String(inputs.issueId ?? '').trim();
                if (!issueId) throw new Error('issueId is required.');
                const payload: Record<string, any> = {};
                if (inputs.status) payload.status = inputs.status;
                if (inputs.assignedTo) payload.assignedTo = inputs.assignedTo;
                if (inputs.hasSeen !== undefined) payload.hasSeen = inputs.hasSeen;
                if (inputs.isBookmarked !== undefined) payload.isBookmarked = inputs.isBookmarked;
                const data = await sentryFetch('PUT', `/issues/${issueId}/`, payload);
                return { output: data };
            }

            case 'deleteIssue': {
                const issueId = String(inputs.issueId ?? '').trim();
                if (!issueId) throw new Error('issueId is required.');
                await sentryFetch('DELETE', `/issues/${issueId}/`);
                return { output: { deleted: true, issueId } };
            }

            case 'listEvents': {
                const orgSlug = String(inputs.orgSlug ?? '').trim();
                const projectSlug = String(inputs.projectSlug ?? '').trim();
                if (!orgSlug) throw new Error('orgSlug is required.');
                if (!projectSlug) throw new Error('projectSlug is required.');
                const data = await sentryFetch('GET', `/projects/${orgSlug}/${projectSlug}/events/`);
                return { output: data };
            }

            case 'getEvent': {
                const orgSlug = String(inputs.orgSlug ?? '').trim();
                const projectSlug = String(inputs.projectSlug ?? '').trim();
                const eventId = String(inputs.eventId ?? '').trim();
                if (!orgSlug) throw new Error('orgSlug is required.');
                if (!projectSlug) throw new Error('projectSlug is required.');
                if (!eventId) throw new Error('eventId is required.');
                const data = await sentryFetch('GET', `/projects/${orgSlug}/${projectSlug}/events/${eventId}/`);
                return { output: data };
            }

            case 'listReleases': {
                const orgSlug = String(inputs.orgSlug ?? '').trim();
                if (!orgSlug) throw new Error('orgSlug is required.');
                const data = await sentryFetch('GET', `/organizations/${orgSlug}/releases/`);
                return { output: data };
            }

            case 'createRelease': {
                const orgSlug = String(inputs.orgSlug ?? '').trim();
                if (!orgSlug) throw new Error('orgSlug is required.');
                const payload: Record<string, any> = {};
                if (inputs.version) payload.version = inputs.version;
                if (inputs.projects) payload.projects = inputs.projects;
                if (inputs.ref) payload.ref = inputs.ref;
                if (inputs.url) payload.url = inputs.url;
                if (inputs.dateReleased) payload.dateReleased = inputs.dateReleased;
                const data = await sentryFetch('POST', `/organizations/${orgSlug}/releases/`, payload);
                return { output: data };
            }

            case 'listTeams': {
                const orgSlug = String(inputs.orgSlug ?? '').trim();
                if (!orgSlug) throw new Error('orgSlug is required.');
                const data = await sentryFetch('GET', `/organizations/${orgSlug}/teams/`);
                return { output: data };
            }

            case 'createTeam': {
                const orgSlug = String(inputs.orgSlug ?? '').trim();
                if (!orgSlug) throw new Error('orgSlug is required.');
                const payload: Record<string, any> = {};
                if (inputs.name) payload.name = inputs.name;
                if (inputs.slug) payload.slug = inputs.slug;
                const data = await sentryFetch('POST', `/organizations/${orgSlug}/teams/`, payload);
                return { output: data };
            }

            default:
                throw new Error(`Unknown Sentry-Enhanced action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.error?.(`[Sentry-Enhanced] Error: ${err.message}`);
        return { error: err.message ?? 'Unknown error' };
    }
}
