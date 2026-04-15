
'use server';

export async function executeBugsnagAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any,
): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        const base = 'https://api.bugsnag.com';

        async function bugsnagFetch(method: string, url: string, body?: any) {
            logger?.log(`[Bugsnag] ${method} ${url}`);
            const headers: Record<string, string> = {
                Authorization: `token ${apiKey}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            };
            const options: RequestInit = { method, headers };
            if (body !== undefined) options.body = JSON.stringify(body);
            const res = await fetch(url, options);
            if (res.status === 204) return {};
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) {
                const msg = data?.errors?.[0] || data?.message || `Bugsnag API error: ${res.status}`;
                throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
            }
            return data;
        }

        switch (actionName) {
            case 'listOrganizations': {
                const data = await bugsnagFetch('GET', `${base}/user/organizations`);
                return { output: { organizations: Array.isArray(data) ? data : [] } };
            }

            case 'listProjects': {
                const orgId = String(inputs.orgId ?? '').trim();
                if (!orgId) throw new Error('orgId is required.');
                const params = new URLSearchParams();
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.page) params.set('offset', String(inputs.page));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await bugsnagFetch('GET', `${base}/organizations/${orgId}/projects${qs}`);
                return { output: { projects: Array.isArray(data) ? data : [] } };
            }

            case 'getProject': {
                const projectId = String(inputs.projectId ?? '').trim();
                if (!projectId) throw new Error('projectId is required.');
                const data = await bugsnagFetch('GET', `${base}/projects/${projectId}`);
                return { output: { project: data } };
            }

            case 'listErrorGroups': {
                const projectId = String(inputs.projectId ?? '').trim();
                if (!projectId) throw new Error('projectId is required.');
                const params = new URLSearchParams();
                if (inputs.status) params.set('status', String(inputs.status));
                if (inputs.errorClass) params.set('error_class', String(inputs.errorClass));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await bugsnagFetch('GET', `${base}/projects/${projectId}/errors${qs}`);
                return { output: { errors: Array.isArray(data) ? data : [] } };
            }

            case 'getErrorGroup': {
                const projectId = String(inputs.projectId ?? '').trim();
                const errorId = String(inputs.errorId ?? '').trim();
                if (!projectId) throw new Error('projectId is required.');
                if (!errorId) throw new Error('errorId is required.');
                const data = await bugsnagFetch('GET', `${base}/projects/${projectId}/errors/${errorId}`);
                return { output: { error: data } };
            }

            case 'updateErrorGroup': {
                const projectId = String(inputs.projectId ?? '').trim();
                const errorId = String(inputs.errorId ?? '').trim();
                const status = String(inputs.status ?? '').trim();
                if (!projectId) throw new Error('projectId is required.');
                if (!errorId) throw new Error('errorId is required.');
                if (!status) throw new Error('status is required.');
                const data = await bugsnagFetch('PATCH', `${base}/projects/${projectId}/errors/${errorId}`, { status });
                return { output: { error: data } };
            }

            case 'listEvents': {
                const projectId = String(inputs.projectId ?? '').trim();
                const errorId = String(inputs.errorId ?? '').trim();
                if (!projectId) throw new Error('projectId is required.');
                if (!errorId) throw new Error('errorId is required.');
                const params = new URLSearchParams();
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await bugsnagFetch('GET', `${base}/projects/${projectId}/errors/${errorId}/events${qs}`);
                return { output: { events: Array.isArray(data) ? data : [] } };
            }

            case 'getEvent': {
                const projectId = String(inputs.projectId ?? '').trim();
                const eventId = String(inputs.eventId ?? '').trim();
                if (!projectId) throw new Error('projectId is required.');
                if (!eventId) throw new Error('eventId is required.');
                const data = await bugsnagFetch('GET', `${base}/projects/${projectId}/events/${eventId}`);
                return { output: { event: data } };
            }

            case 'listRelatedErrors': {
                const projectId = String(inputs.projectId ?? '').trim();
                const errorId = String(inputs.errorId ?? '').trim();
                if (!projectId) throw new Error('projectId is required.');
                if (!errorId) throw new Error('errorId is required.');
                const data = await bugsnagFetch('GET', `${base}/projects/${projectId}/errors/${errorId}/latest_event`);
                return { output: { event: data } };
            }

            case 'sendTelemetry': {
                const notifyApiKey = String(inputs.notifyApiKey ?? apiKey).trim();
                const errorClass = String(inputs.errorClass ?? 'Error').trim();
                const message = String(inputs.message ?? '').trim();
                const severity = String(inputs.severity ?? 'error').trim();
                const context = inputs.context ? String(inputs.context) : undefined;
                if (!message) throw new Error('message is required.');
                const payload: any = {
                    apiKey: notifyApiKey,
                    events: [{
                        exceptions: [{ errorClass, message }],
                        severity,
                        ...(context ? { context } : {}),
                        app: inputs.app || {},
                    }],
                };
                const res = await fetch('https://notify.bugsnag.com/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                const text = await res.text();
                return { output: { status: res.status, response: text } };
            }

            case 'createComment': {
                const projectId = String(inputs.projectId ?? '').trim();
                const errorId = String(inputs.errorId ?? '').trim();
                const message = String(inputs.message ?? '').trim();
                if (!projectId) throw new Error('projectId is required.');
                if (!errorId) throw new Error('errorId is required.');
                if (!message) throw new Error('message is required.');
                const data = await bugsnagFetch('POST', `${base}/projects/${projectId}/errors/${errorId}/comments`, { message });
                return { output: { comment: data } };
            }

            case 'getRelease': {
                const projectId = String(inputs.projectId ?? '').trim();
                if (!projectId) throw new Error('projectId is required.');
                const params = new URLSearchParams();
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await bugsnagFetch('GET', `${base}/projects/${projectId}/builds/${qs}`);
                return { output: { builds: Array.isArray(data) ? data : [] } };
            }

            case 'createRelease': {
                const projectId = String(inputs.projectId ?? '').trim();
                if (!projectId) throw new Error('projectId is required.');
                const body: any = {};
                if (inputs.appVersion) body.app_version = String(inputs.appVersion);
                if (inputs.appVersionCode) body.app_version_code = String(inputs.appVersionCode);
                if (inputs.appBundleVersion) body.app_bundle_version = String(inputs.appBundleVersion);
                if (inputs.releaseStage) body.release_stage = String(inputs.releaseStage);
                if (inputs.sourceControl) body.source_control = inputs.sourceControl;
                if (inputs.builderName) body.builder_name = String(inputs.builderName);
                const data = await bugsnagFetch('POST', `${base}/projects/${projectId}/builds/`, body);
                return { output: { build: data } };
            }

            default:
                return { error: `Bugsnag action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Bugsnag action failed.' };
    }
}
