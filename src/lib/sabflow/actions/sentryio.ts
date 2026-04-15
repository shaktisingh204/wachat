
'use server';

const SENTRY_BASE = 'https://sentry.io/api/0';

async function sentryFetch(token: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Sentry] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${SENTRY_BASE}${path}`, options);
    if (res.status === 204) return {};
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) throw new Error(data?.detail || data?.message || `Sentry API error: ${res.status}`);
    return data;
}

export async function executeSentryioAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const authToken = String(inputs.authToken ?? '').trim();
        const orgSlug = String(inputs.organizationSlug ?? '').trim();
        if (!authToken) throw new Error('authToken is required.');
        if (!orgSlug) throw new Error('organizationSlug is required.');
        const sentry = (method: string, path: string, body?: any) => sentryFetch(authToken, method, path, body, logger);

        switch (actionName) {
            case 'listProjects': {
                const org = inputs.organizationSlug ? String(inputs.organizationSlug).trim() : orgSlug;
                const data = await sentry('GET', `/organizations/${org}/projects/`);
                return { output: { projects: Array.isArray(data) ? data : data.results ?? [] } };
            }

            case 'getProject': {
                const projectSlug = String(inputs.projectSlug ?? '').trim();
                if (!projectSlug) throw new Error('projectSlug is required.');
                const data = await sentry('GET', `/projects/${orgSlug}/${projectSlug}/`);
                return { output: { project: data } };
            }

            case 'listIssues': {
                const projectSlug = String(inputs.projectSlug ?? '').trim();
                if (!projectSlug) throw new Error('projectSlug is required.');
                const query = inputs.query ? String(inputs.query).trim() : '';
                const limit = Number(inputs.limit ?? 25);
                const params = new URLSearchParams({ limit: String(limit) });
                if (query) params.set('query', query);
                const data = await sentry('GET', `/projects/${orgSlug}/${projectSlug}/issues/?${params.toString()}`);
                return { output: { issues: Array.isArray(data) ? data : [] } };
            }

            case 'getIssue': {
                const issueId = String(inputs.issueId ?? '').trim();
                if (!issueId) throw new Error('issueId is required.');
                const data = await sentry('GET', `/issues/${issueId}/`);
                return { output: { issue: data } };
            }

            case 'updateIssue': {
                const issueId = String(inputs.issueId ?? '').trim();
                if (!issueId) throw new Error('issueId is required.');
                const body: any = {};
                if (inputs.status) body.status = String(inputs.status).trim();
                if (inputs.assignedTo) body.assignedTo = String(inputs.assignedTo).trim();
                const data = await sentry('PUT', `/issues/${issueId}/`, body);
                return { output: { id: data.id, status: data.status, assignedTo: data.assignedTo } };
            }

            case 'resolveIssue': {
                const issueId = String(inputs.issueId ?? '').trim();
                if (!issueId) throw new Error('issueId is required.');
                const data = await sentry('PUT', `/issues/${issueId}/`, { status: 'resolved' });
                return { output: { id: data.id, status: data.status } };
            }

            case 'ignoreIssue': {
                const issueId = String(inputs.issueId ?? '').trim();
                if (!issueId) throw new Error('issueId is required.');
                const data = await sentry('PUT', `/issues/${issueId}/`, { status: 'ignored' });
                return { output: { id: data.id, status: data.status } };
            }

            case 'deleteIssue': {
                const issueId = String(inputs.issueId ?? '').trim();
                if (!issueId) throw new Error('issueId is required.');
                await sentry('DELETE', `/issues/${issueId}/`);
                return { output: { success: true, issueId } };
            }

            case 'listEvents': {
                const issueId = String(inputs.issueId ?? '').trim();
                if (!issueId) throw new Error('issueId is required.');
                const limit = Number(inputs.limit ?? 25);
                const data = await sentry('GET', `/issues/${issueId}/events/?limit=${limit}`);
                return { output: { events: Array.isArray(data) ? data : data.results ?? [] } };
            }

            case 'getEvent': {
                const issueId = String(inputs.issueId ?? '').trim();
                const eventId = String(inputs.eventId ?? '').trim();
                if (!issueId || !eventId) throw new Error('issueId and eventId are required.');
                const data = await sentry('GET', `/issues/${issueId}/events/${eventId}/`);
                return { output: { event: data } };
            }

            case 'createRelease': {
                const version = String(inputs.version ?? '').trim();
                if (!version) throw new Error('version is required.');
                const projects = typeof inputs.projects === 'string' ? JSON.parse(inputs.projects) : inputs.projects;
                if (!Array.isArray(projects) || projects.length === 0) throw new Error('projects must be a non-empty array.');
                const body: any = { version, projects };
                if (inputs.url) body.url = String(inputs.url).trim();
                if (inputs.dateReleased) body.dateReleased = String(inputs.dateReleased).trim();
                const data = await sentry('POST', `/organizations/${orgSlug}/releases/`, body);
                return { output: { version: data.version, url: data.url, dateCreated: data.dateCreated } };
            }

            case 'listReleases': {
                const limit = Number(inputs.limit ?? 25);
                const query = inputs.query ? String(inputs.query).trim() : '';
                const params = new URLSearchParams({ limit: String(limit) });
                if (query) params.set('query', query);
                const data = await sentry('GET', `/organizations/${orgSlug}/releases/?${params.toString()}`);
                return { output: { releases: Array.isArray(data) ? data : data.results ?? [] } };
            }

            case 'getStats': {
                const projectSlug = String(inputs.projectSlug ?? '').trim();
                if (!projectSlug) throw new Error('projectSlug is required.');
                const stat = String(inputs.stat ?? 'received');
                const resolution = String(inputs.resolution ?? '1h');
                const params = new URLSearchParams({ stat, resolution });
                if (inputs.since) params.set('since', String(inputs.since));
                if (inputs.until) params.set('until', String(inputs.until));
                const data = await sentry('GET', `/projects/${orgSlug}/${projectSlug}/stats/?${params.toString()}`);
                return { output: { stats: Array.isArray(data) ? data : [] } };
            }

            case 'listTeams': {
                const data = await sentry('GET', `/organizations/${orgSlug}/teams/`);
                return { output: { teams: Array.isArray(data) ? data : data.results ?? [] } };
            }

            default:
                throw new Error(`Unknown Sentry action: ${actionName}`);
        }
    } catch (err: any) {
        return { error: err?.message ?? String(err) };
    }
}
