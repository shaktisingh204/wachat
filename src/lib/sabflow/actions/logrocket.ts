
'use server';

export async function executeLogRocketAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any,
): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        const base = 'https://api.logrocket.com/v1';

        async function logrocketFetch(method: string, url: string, body?: any) {
            logger?.log(`[LogRocket] ${method} ${url}`);
            const headers: Record<string, string> = {
                Authorization: `Token ${apiKey}`,
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
                const msg = data?.detail || data?.message || data?.error || `LogRocket API error: ${res.status}`;
                throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
            }
            return data;
        }

        switch (actionName) {
            case 'getSessions': {
                const org = String(inputs.org ?? '').trim();
                if (!org) throw new Error('org is required.');
                const params = new URLSearchParams({ organization: org });
                if (inputs.appId) params.set('app', String(inputs.appId));
                if (inputs.start) params.set('start', String(inputs.start));
                if (inputs.end) params.set('end', String(inputs.end));
                const data = await logrocketFetch('GET', `${base}/sessions/?${params.toString()}`);
                return { output: { sessions: data?.results ?? data ?? [] } };
            }

            case 'getSession': {
                const sessionId = String(inputs.sessionId ?? '').trim();
                if (!sessionId) throw new Error('sessionId is required.');
                const data = await logrocketFetch('GET', `${base}/sessions/${sessionId}/`);
                return { output: { session: data } };
            }

            case 'getUserSessions': {
                const userId = String(inputs.userId ?? '').trim();
                if (!userId) throw new Error('userId is required.');
                const params = new URLSearchParams({ userIdentifier: userId });
                if (inputs.org) params.set('organization', String(inputs.org));
                const data = await logrocketFetch('GET', `${base}/sessions/?${params.toString()}`);
                return { output: { sessions: data?.results ?? data ?? [] } };
            }

            case 'listApps': {
                const data = await logrocketFetch('GET', `${base}/apps/`);
                return { output: { apps: data?.results ?? data ?? [] } };
            }

            case 'getApp': {
                const appId = String(inputs.appId ?? '').trim();
                if (!appId) throw new Error('appId is required.');
                const data = await logrocketFetch('GET', `${base}/apps/${appId}/`);
                return { output: { app: data } };
            }

            case 'listIssues': {
                const org = String(inputs.org ?? '').trim();
                if (!org) throw new Error('org is required.');
                const params = new URLSearchParams({ organization: org });
                if (inputs.status) params.set('status', String(inputs.status));
                if (inputs.appId) params.set('app', String(inputs.appId));
                const data = await logrocketFetch('GET', `${base}/issues/?${params.toString()}`);
                return { output: { issues: data?.results ?? data ?? [] } };
            }

            case 'getIssue': {
                const issueId = String(inputs.issueId ?? '').trim();
                if (!issueId) throw new Error('issueId is required.');
                const data = await logrocketFetch('GET', `${base}/issues/${issueId}/`);
                return { output: { issue: data } };
            }

            case 'resolveIssue': {
                const issueId = String(inputs.issueId ?? '').trim();
                if (!issueId) throw new Error('issueId is required.');
                const data = await logrocketFetch('PATCH', `${base}/issues/${issueId}/`, { status: 'resolved' });
                return { output: { issue: data } };
            }

            case 'listErrors': {
                const org = String(inputs.org ?? '').trim();
                if (!org) throw new Error('org is required.');
                const params = new URLSearchParams({ organization: org });
                if (inputs.appId) params.set('app', String(inputs.appId));
                const data = await logrocketFetch('GET', `${base}/errors/?${params.toString()}`);
                return { output: { errors: data?.results ?? data ?? [] } };
            }

            case 'getError': {
                const errorId = String(inputs.errorId ?? '').trim();
                if (!errorId) throw new Error('errorId is required.');
                const data = await logrocketFetch('GET', `${base}/errors/${errorId}/`);
                return { output: { error: data } };
            }

            case 'sendLog': {
                const serverId = String(inputs.serverId ?? '').trim();
                const sessionId = String(inputs.sessionId ?? '').trim();
                const type = String(inputs.type ?? 'log').trim();
                const message = String(inputs.message ?? '').trim();
                if (!serverId) throw new Error('serverId is required.');
                if (!message) throw new Error('message is required.');
                const payload = {
                    r: [{ i: serverId, s: sessionId || undefined, t: type, v: { message } }],
                };
                const res = await fetch('https://r.lr-in.com/i', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                const text = await res.text();
                return { output: { status: res.status, response: text } };
            }

            case 'identifyUser': {
                const serverId = String(inputs.serverId ?? '').trim();
                const uid = String(inputs.uid ?? '').trim();
                if (!serverId) throw new Error('serverId is required.');
                if (!uid) throw new Error('uid is required.');
                const traits: any = { uid };
                if (inputs.email) traits.email = String(inputs.email);
                if (inputs.name) traits.name = String(inputs.name);
                if (inputs.traits && typeof inputs.traits === 'object') Object.assign(traits, inputs.traits);
                const payload = {
                    r: [{ i: serverId, t: 'identify', v: traits }],
                };
                const res = await fetch('https://r.lr-in.com/i', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                const text = await res.text();
                return { output: { status: res.status, response: text } };
            }

            default:
                return { error: `LogRocket action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'LogRocket action failed.' };
    }
}
