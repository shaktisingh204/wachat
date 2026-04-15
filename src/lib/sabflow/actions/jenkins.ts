
'use server';

async function jenkinsFetch(
    serverUrl: string,
    basicAuth: string,
    method: string,
    path: string,
    body?: string,
    contentType?: string,
    logger?: any,
) {
    logger?.log(`[Jenkins] ${method} ${path}`);
    const headers: Record<string, string> = {
        Authorization: `Basic ${basicAuth}`,
        Accept: 'application/json',
    };
    if (contentType) headers['Content-Type'] = contentType;

    const options: RequestInit = { method, headers };
    if (body !== undefined) options.body = body;

    const url = `${serverUrl.replace(/\/$/, '')}${path}`;
    const res = await fetch(url, options);

    if (res.status === 201 || res.status === 204) return {};

    const text = await res.text();
    if (!res.ok) throw new Error(`Jenkins API error ${res.status}: ${text.slice(0, 300)}`);

    if (!text) return {};
    try { return JSON.parse(text); } catch { return { raw: text }; }
}

export async function executeJenkinsAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const serverUrl = String(inputs.serverUrl ?? '').trim().replace(/\/$/, '');
        const username = String(inputs.username ?? '').trim();
        const apiToken = String(inputs.apiToken ?? '').trim();
        if (!serverUrl) throw new Error('serverUrl is required.');
        if (!username) throw new Error('username is required.');
        if (!apiToken) throw new Error('apiToken is required.');

        const basicAuth = Buffer.from(`${username}:${apiToken}`).toString('base64');
        const jk = (method: string, path: string, body?: string, contentType?: string) =>
            jenkinsFetch(serverUrl, basicAuth, method, path, body, contentType, logger);

        switch (actionName) {
            case 'getServerInfo': {
                const data = await jk('GET', '/api/json');
                return { output: { nodeName: data.nodeName, mode: data.mode, numExecutors: data.numExecutors } };
            }

            case 'listJobs': {
                const data = await jk('GET', '/api/json?tree=jobs[name,url,color]');
                return { output: { jobs: data.jobs ?? [] } };
            }

            case 'getJob': {
                const jobName = String(inputs.jobName ?? '').trim();
                if (!jobName) throw new Error('jobName is required.');
                const data = await jk('GET', `/job/${encodeURIComponent(jobName)}/api/json`);
                return { output: { name: data.name, url: data.url, builds: data.builds ?? [], lastBuild: data.lastBuild ?? null } };
            }

            case 'buildJob': {
                const jobName = String(inputs.jobName ?? '').trim();
                if (!jobName) throw new Error('jobName is required.');
                const parameters = inputs.parameters;
                let endpoint: string;
                let body: string | undefined;
                let contentType: string | undefined;
                if (parameters && typeof parameters === 'object' && Object.keys(parameters).length > 0) {
                    endpoint = `/job/${encodeURIComponent(jobName)}/buildWithParameters`;
                    const params = new URLSearchParams();
                    for (const [k, v] of Object.entries(parameters)) params.append(k, String(v));
                    body = params.toString();
                    contentType = 'application/x-www-form-urlencoded';
                } else {
                    endpoint = `/job/${encodeURIComponent(jobName)}/build`;
                }
                const res = await fetch(`${serverUrl}${endpoint}`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Basic ${basicAuth}`,
                        ...(contentType ? { 'Content-Type': contentType } : {}),
                    },
                    ...(body !== undefined ? { body } : {}),
                });
                const locationHeader = res.headers.get('Location') ?? '';
                const queueMatch = locationHeader.match(/\/queue\/item\/(\d+)/);
                const queueId = queueMatch ? queueMatch[1] : null;
                if (!res.ok && res.status !== 201) {
                    const text = await res.text();
                    throw new Error(`Jenkins build trigger error ${res.status}: ${text.slice(0, 300)}`);
                }
                return { output: { queued: true, queueId: queueId ?? '' } };
            }

            case 'getBuild': {
                const jobName = String(inputs.jobName ?? '').trim();
                const buildNumber = String(inputs.buildNumber ?? '').trim();
                if (!jobName || !buildNumber) throw new Error('jobName and buildNumber are required.');
                const data = await jk('GET', `/job/${encodeURIComponent(jobName)}/${buildNumber}/api/json`);
                return { output: { number: data.number, result: data.result, duration: data.duration, url: data.url } };
            }

            case 'getLastBuild': {
                const jobName = String(inputs.jobName ?? '').trim();
                if (!jobName) throw new Error('jobName is required.');
                const data = await jk('GET', `/job/${encodeURIComponent(jobName)}/lastBuild/api/json`);
                return { output: { number: data.number, result: data.result, duration: data.duration } };
            }

            case 'stopBuild': {
                const jobName = String(inputs.jobName ?? '').trim();
                const buildNumber = String(inputs.buildNumber ?? '').trim();
                if (!jobName || !buildNumber) throw new Error('jobName and buildNumber are required.');
                await jk('POST', `/job/${encodeURIComponent(jobName)}/${buildNumber}/stop`);
                return { output: { stopped: true } };
            }

            case 'getBuildLog': {
                const jobName = String(inputs.jobName ?? '').trim();
                const buildNumber = String(inputs.buildNumber ?? '').trim();
                if (!jobName || !buildNumber) throw new Error('jobName and buildNumber are required.');
                const url = `${serverUrl}/job/${encodeURIComponent(jobName)}/${buildNumber}/consoleText`;
                const res = await fetch(url, {
                    headers: { Authorization: `Basic ${basicAuth}` },
                });
                if (!res.ok) throw new Error(`Jenkins console log error ${res.status}`);
                const log = await res.text();
                return { output: { log } };
            }

            case 'createJob': {
                const jobName = String(inputs.jobName ?? '').trim();
                const xmlConfig = String(inputs.xmlConfig ?? '').trim();
                if (!jobName || !xmlConfig) throw new Error('jobName and xmlConfig are required.');
                await jk('POST', `/createItem?name=${encodeURIComponent(jobName)}`, xmlConfig, 'application/xml');
                return { output: { created: true } };
            }

            case 'deleteJob': {
                const jobName = String(inputs.jobName ?? '').trim();
                if (!jobName) throw new Error('jobName is required.');
                await jk('POST', `/job/${encodeURIComponent(jobName)}/doDelete`);
                return { output: { deleted: true } };
            }

            case 'enableJob': {
                const jobName = String(inputs.jobName ?? '').trim();
                if (!jobName) throw new Error('jobName is required.');
                await jk('POST', `/job/${encodeURIComponent(jobName)}/enable`);
                return { output: { enabled: true } };
            }

            case 'disableJob': {
                const jobName = String(inputs.jobName ?? '').trim();
                if (!jobName) throw new Error('jobName is required.');
                await jk('POST', `/job/${encodeURIComponent(jobName)}/disable`);
                return { output: { disabled: true } };
            }

            case 'listNodes': {
                const data = await jk('GET', '/computer/api/json');
                return { output: { computers: data.computer ?? [] } };
            }

            case 'getQueueItems': {
                const data = await jk('GET', '/queue/api/json');
                return { output: { items: data.items ?? [] } };
            }

            case 'buildWithParams': {
                const jobName = String(inputs.jobName ?? '').trim();
                if (!jobName) throw new Error('jobName is required.');
                const params = new URLSearchParams();
                for (const [k, v] of Object.entries(inputs.parameters || {})) params.append(k, String(v));
                const res = await fetch(`${serverUrl}/job/${encodeURIComponent(jobName)}/buildWithParameters`, {
                    method: 'POST',
                    headers: { Authorization: `Basic ${basicAuth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: params.toString(),
                });
                const location = res.headers.get('Location') ?? '';
                const queueMatch = location.match(/\/queue\/item\/(\d+)/);
                return { output: { queued: res.ok, queueId: queueMatch ? queueMatch[1] : null } };
            }

            case 'getQueueItem': {
                const itemId = String(inputs.itemId ?? '').trim();
                if (!itemId) throw new Error('itemId is required.');
                const data = await jk('GET', `/queue/item/${itemId}/api/json`);
                return { output: data };
            }

            case 'cancelQueueItem': {
                const itemId = String(inputs.itemId ?? '').trim();
                if (!itemId) throw new Error('itemId is required.');
                await jk('POST', `/queue/cancelItem?id=${itemId}`);
                return { output: { cancelled: true } };
            }

            case 'getSystemInfo': {
                const data = await jk('GET', '/api/json');
                return { output: data };
            }

            case 'listPlugins': {
                const data = await jk('GET', '/pluginManager/api/json?depth=1');
                return { output: { plugins: data.plugins ?? [] } };
            }

            case 'updateJob': {
                const jobName = String(inputs.jobName ?? '').trim();
                const xmlConfig = String(inputs.xmlConfig ?? '').trim();
                if (!jobName || !xmlConfig) throw new Error('jobName and xmlConfig are required.');
                await jk('POST', `/job/${encodeURIComponent(jobName)}/config.xml`, xmlConfig, 'application/xml');
                return { output: { updated: true } };
            }

            case 'copyJob': {
                const fromJobName = String(inputs.fromJobName ?? '').trim();
                const newJobName = String(inputs.newJobName ?? '').trim();
                if (!fromJobName || !newJobName) throw new Error('fromJobName and newJobName are required.');
                const res = await fetch(
                    `${serverUrl}/createItem?name=${encodeURIComponent(newJobName)}&mode=copy&from=${encodeURIComponent(fromJobName)}`,
                    { method: 'POST', headers: { Authorization: `Basic ${basicAuth}` } }
                );
                return { output: { copied: res.ok, status: res.status } };
            }

            default:
                return { error: `Jenkins action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Jenkins action failed.' };
    }
}
