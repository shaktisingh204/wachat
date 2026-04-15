'use server';

export async function executeRaygunAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any,
): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        const base = 'https://api.raygun.com/v3';

        async function raygunFetch(method: string, path: string, body?: any) {
            logger?.log(`[Raygun] ${method} ${path}`);
            const url = `${base}${path}`;
            const headers: Record<string, string> = {
                'X-ApiKey': apiKey,
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
            if (!res.ok) throw new Error(json?.message ?? json?.error ?? `HTTP ${res.status}: ${text}`);
            return json;
        }

        switch (actionName) {
            case 'listApplications': {
                const data = await raygunFetch('GET', '/applications');
                return { output: data };
            }

            case 'getApplication': {
                const appId = String(inputs.appId ?? '').trim();
                if (!appId) throw new Error('appId is required.');
                const data = await raygunFetch('GET', `/applications/${appId}`);
                return { output: data };
            }

            case 'listCrashReportingGroups': {
                const appId = String(inputs.appId ?? '').trim();
                if (!appId) throw new Error('appId is required.');
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.pageSize) params.set('pageSize', String(inputs.pageSize));
                if (inputs.status) params.set('status', inputs.status);
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await raygunFetch('GET', `/applications/${appId}/crash-reporting/groups${qs}`);
                return { output: data };
            }

            case 'getCrashReportingGroup': {
                const appId = String(inputs.appId ?? '').trim();
                const groupId = String(inputs.groupId ?? '').trim();
                if (!appId) throw new Error('appId is required.');
                if (!groupId) throw new Error('groupId is required.');
                const data = await raygunFetch('GET', `/applications/${appId}/crash-reporting/groups/${groupId}`);
                return { output: data };
            }

            case 'updateCrashReportingGroup': {
                const appId = String(inputs.appId ?? '').trim();
                const groupId = String(inputs.groupId ?? '').trim();
                if (!appId) throw new Error('appId is required.');
                if (!groupId) throw new Error('groupId is required.');
                const payload: Record<string, any> = {};
                if (inputs.status) payload.status = inputs.status;
                if (inputs.assignedTo) payload.assignedTo = inputs.assignedTo;
                const data = await raygunFetch('PATCH', `/applications/${appId}/crash-reporting/groups/${groupId}`, payload);
                return { output: data };
            }

            case 'listCrashReportingErrors': {
                const appId = String(inputs.appId ?? '').trim();
                if (!appId) throw new Error('appId is required.');
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.pageSize) params.set('pageSize', String(inputs.pageSize));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await raygunFetch('GET', `/applications/${appId}/crash-reporting/errors${qs}`);
                return { output: data };
            }

            case 'getCrashReportingError': {
                const appId = String(inputs.appId ?? '').trim();
                const errorId = String(inputs.errorId ?? '').trim();
                if (!appId) throw new Error('appId is required.');
                if (!errorId) throw new Error('errorId is required.');
                const data = await raygunFetch('GET', `/applications/${appId}/crash-reporting/errors/${errorId}`);
                return { output: data };
            }

            case 'listDeployments': {
                const appId = String(inputs.appId ?? '').trim();
                if (!appId) throw new Error('appId is required.');
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.pageSize) params.set('pageSize', String(inputs.pageSize));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await raygunFetch('GET', `/applications/${appId}/deployments${qs}`);
                return { output: data };
            }

            case 'createDeployment': {
                const appId = String(inputs.appId ?? '').trim();
                if (!appId) throw new Error('appId is required.');
                const payload: Record<string, any> = {};
                if (inputs.version) payload.version = inputs.version;
                if (inputs.ownerName) payload.ownerName = inputs.ownerName;
                if (inputs.email) payload.email = inputs.email;
                if (inputs.comment) payload.comment = inputs.comment;
                if (inputs.scmIdentifier) payload.scmIdentifier = inputs.scmIdentifier;
                if (inputs.scmType) payload.scmType = inputs.scmType;
                const data = await raygunFetch('POST', `/applications/${appId}/deployments`, payload);
                return { output: data };
            }

            case 'getDeployment': {
                const appId = String(inputs.appId ?? '').trim();
                const deploymentId = String(inputs.deploymentId ?? '').trim();
                if (!appId) throw new Error('appId is required.');
                if (!deploymentId) throw new Error('deploymentId is required.');
                const data = await raygunFetch('GET', `/applications/${appId}/deployments/${deploymentId}`);
                return { output: data };
            }

            case 'listRUMData': {
                const appId = String(inputs.appId ?? '').trim();
                if (!appId) throw new Error('appId is required.');
                const params = new URLSearchParams();
                if (inputs.start) params.set('start', inputs.start);
                if (inputs.end) params.set('end', inputs.end);
                if (inputs.granularity) params.set('granularity', inputs.granularity);
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await raygunFetch('GET', `/applications/${appId}/real-user-monitoring/v2/timeseries${qs}`);
                return { output: data };
            }

            case 'listUsers': {
                const appId = String(inputs.appId ?? '').trim();
                if (!appId) throw new Error('appId is required.');
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.pageSize) params.set('pageSize', String(inputs.pageSize));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await raygunFetch('GET', `/applications/${appId}/users${qs}`);
                return { output: data };
            }

            case 'getUser': {
                const appId = String(inputs.appId ?? '').trim();
                const userId = String(inputs.userId ?? '').trim();
                if (!appId) throw new Error('appId is required.');
                if (!userId) throw new Error('userId is required.');
                const data = await raygunFetch('GET', `/applications/${appId}/users/${encodeURIComponent(userId)}`);
                return { output: data };
            }

            case 'listAlerts': {
                const appId = String(inputs.appId ?? '').trim();
                if (!appId) throw new Error('appId is required.');
                const data = await raygunFetch('GET', `/applications/${appId}/alerts`);
                return { output: data };
            }

            case 'createAlert': {
                const appId = String(inputs.appId ?? '').trim();
                if (!appId) throw new Error('appId is required.');
                const payload: Record<string, any> = {};
                if (inputs.name) payload.name = inputs.name;
                if (inputs.triggerType) payload.triggerType = inputs.triggerType;
                if (inputs.threshold) payload.threshold = inputs.threshold;
                if (inputs.notificationTargets) payload.notificationTargets = inputs.notificationTargets;
                const data = await raygunFetch('POST', `/applications/${appId}/alerts`, payload);
                return { output: data };
            }

            default:
                throw new Error(`Unknown Raygun action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.error?.(`[Raygun] Error: ${err.message}`);
        return { error: err.message ?? 'Unknown error' };
    }
}
