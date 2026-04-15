
'use server';

const SENTRY_BASE = 'https://sentry.io/api/0';

export async function executeSentryEnhancedAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const authToken = String(inputs.authToken ?? '').trim();
        const org = String(inputs.organizationSlug ?? inputs.org ?? '').trim();
        if (!authToken) throw new Error('authToken is required.');
        if (!org) throw new Error('organizationSlug is required.');

        async function sentryFetch(method: string, path: string, body?: any) {
            logger?.log(`[SentryEnhanced] ${method} ${path}`);
            const options: RequestInit = {
                method,
                headers: {
                    Authorization: `Bearer ${authToken}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
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

        switch (actionName) {
            case 'listIssues': {
                const query = inputs.query ? `?query=${encodeURIComponent(inputs.query)}` : '';
                const data = await sentryFetch('GET', `/organizations/${org}/issues/${query}`);
                return { output: { issues: Array.isArray(data) ? data : [data] } };
            }
            case 'getIssue': {
                const issue = String(inputs.issueId ?? inputs.issue ?? '').trim();
                if (!issue) throw new Error('issueId is required.');
                const data = await sentryFetch('GET', `/organizations/${org}/issues/${issue}/`);
                return { output: { issue: data } };
            }
            case 'updateIssue': {
                const issue = String(inputs.issueId ?? inputs.issue ?? '').trim();
                if (!issue) throw new Error('issueId is required.');
                const body: Record<string, any> = {};
                if (inputs.status) body.status = inputs.status;
                if (inputs.assignedTo !== undefined) body.assignedTo = inputs.assignedTo;
                const data = await sentryFetch('PUT', `/organizations/${org}/issues/${issue}/`, body);
                return { output: { issue: data } };
            }
            case 'deleteIssue': {
                const issue = String(inputs.issueId ?? inputs.issue ?? '').trim();
                if (!issue) throw new Error('issueId is required.');
                await sentryFetch('DELETE', `/organizations/${org}/issues/${issue}/`);
                return { output: { deleted: true, issueId: issue } };
            }
            case 'listEvents': {
                const issue = String(inputs.issueId ?? inputs.issue ?? '').trim();
                if (!issue) throw new Error('issueId is required.');
                const data = await sentryFetch('GET', `/organizations/${org}/issues/${issue}/events/`);
                return { output: { events: Array.isArray(data) ? data : data?.data ?? [] } };
            }
            case 'getEvent': {
                const issue = String(inputs.issueId ?? inputs.issue ?? '').trim();
                const eventId = String(inputs.eventId ?? '').trim();
                if (!issue) throw new Error('issueId is required.');
                if (!eventId) throw new Error('eventId is required.');
                const data = await sentryFetch('GET', `/organizations/${org}/issues/${issue}/events/${eventId}/`);
                return { output: { event: data } };
            }
            case 'createIgnoreRule': {
                const issue = String(inputs.issueId ?? inputs.issue ?? '').trim();
                if (!issue) throw new Error('issueId is required.');
                const ignoreCount = inputs.ignoreCount ? Number(inputs.ignoreCount) : 1;
                const data = await sentryFetch('PUT', `/organizations/${org}/issues/${issue}/`, {
                    status: 'ignored',
                    statusDetails: { ignoreCount },
                });
                return { output: { issue: data } };
            }
            case 'listAlerts': {
                const data = await sentryFetch('GET', `/organizations/${org}/alert-rules/`);
                return { output: { alertRules: Array.isArray(data) ? data : [data] } };
            }
            case 'createAlert': {
                const body = {
                    name: inputs.name ?? 'New Alert',
                    dataset: inputs.dataset ?? 'events',
                    query: inputs.query ?? '',
                    aggregate: inputs.aggregate ?? 'count()',
                    timeWindow: inputs.timeWindow ?? 60,
                    triggers: inputs.triggers ?? [],
                    projects: inputs.projects ?? [],
                    ...(inputs.environment ? { environment: inputs.environment } : {}),
                };
                const data = await sentryFetch('POST', `/organizations/${org}/alert-rules/`, body);
                return { output: { alertRule: data } };
            }
            case 'listReleases': {
                const data = await sentryFetch('GET', `/organizations/${org}/releases/`);
                return { output: { releases: Array.isArray(data) ? data : [] } };
            }
            case 'createRelease': {
                const version = String(inputs.version ?? '').trim();
                if (!version) throw new Error('version is required.');
                const body = {
                    version,
                    projects: inputs.projects ?? [],
                    ...(inputs.ref ? { ref: inputs.ref } : {}),
                    ...(inputs.url ? { url: inputs.url } : {}),
                };
                const data = await sentryFetch('POST', `/organizations/${org}/releases/`, body);
                return { output: { release: data } };
            }
            case 'finalizeRelease': {
                const version = String(inputs.version ?? '').trim();
                if (!version) throw new Error('version is required.');
                const body: Record<string, any> = {};
                if (inputs.dateReleased) body.dateReleased = inputs.dateReleased;
                if (inputs.ref) body.ref = inputs.ref;
                const data = await sentryFetch('PUT', `/organizations/${org}/releases/${encodeURIComponent(version)}/`, body);
                return { output: { release: data } };
            }
            case 'listProjects': {
                const data = await sentryFetch('GET', `/organizations/${org}/projects/`);
                return { output: { projects: Array.isArray(data) ? data : [] } };
            }
            case 'listMembers': {
                const data = await sentryFetch('GET', `/organizations/${org}/members/`);
                return { output: { members: Array.isArray(data) ? data : [] } };
            }
            case 'getPerformance': {
                const query = inputs.query ? `&query=${encodeURIComponent(inputs.query)}` : '';
                const fields = inputs.fields ? encodeURIComponent(inputs.fields) : 'transaction%2Ccount()%2Cp95()';
                const data = await sentryFetch('GET', `/organizations/${org}/events/?field=${fields}${query}`);
                return { output: { performance: data } };
            }
            default:
                throw new Error(`Unknown action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.log(`[SentryEnhanced] Error: ${err.message}`);
        return { error: err.message ?? 'Unknown error' };
    }
}
