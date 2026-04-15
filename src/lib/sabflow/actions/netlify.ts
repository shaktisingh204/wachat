
'use server';

const NETLIFY_BASE = 'https://api.netlify.com/api/v1';

async function netlifyFetch(
    accessToken: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
): Promise<any> {
    const url = `${NETLIFY_BASE}${path}`;
    logger?.log(`[Netlify] ${method} ${path}`);

    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);

    const res = await fetch(url, options);
    if (res.status === 204) return { success: true };

    const text = await res.text();
    let data: any;
    try {
        data = JSON.parse(text);
    } catch {
        data = text;
    }

    if (!res.ok) {
        throw new Error(data?.message || data?.error || `Netlify API error: ${res.status}`);
    }
    return data;
}

export async function executeNetlifyAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');

        const nl = (method: string, path: string, body?: any) =>
            netlifyFetch(accessToken, method, path, body, logger);

        switch (actionName) {
            case 'listSites': {
                const data = await nl('GET', '/sites?per_page=100');
                const sites = Array.isArray(data) ? data : [];
                return { output: { sites, count: sites.length } };
            }

            case 'getSite': {
                const siteId = String(inputs.siteId ?? '').trim();
                if (!siteId) throw new Error('siteId is required.');

                const data = await nl('GET', `/sites/${siteId}`);
                return {
                    output: {
                        id: data.id,
                        name: data.name,
                        url: data.url,
                        deployUrl: data.deploy_url ?? '',
                        customDomain: data.custom_domain ?? '',
                        state: data.state ?? '',
                    },
                };
            }

            case 'createSite': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');

                const data = await nl('POST', '/sites', { name });
                return { output: { id: data.id, name: data.name, url: data.url ?? '' } };
            }

            case 'triggerDeploy': {
                const siteId = String(inputs.siteId ?? '').trim();
                if (!siteId) throw new Error('siteId is required.');

                const data = await nl('POST', `/sites/${siteId}/deploys`, {});
                return {
                    output: {
                        id: data.id,
                        state: data.state,
                        deployUrl: data.deploy_url ?? data.ssl_url ?? '',
                        createdAt: data.created_at ?? '',
                    },
                };
            }

            case 'listDeploys': {
                const siteId = String(inputs.siteId ?? '').trim();
                if (!siteId) throw new Error('siteId is required.');

                const data = await nl('GET', `/sites/${siteId}/deploys?per_page=100`);
                const deploys = Array.isArray(data) ? data : [];
                return { output: { deploys, count: deploys.length } };
            }

            case 'getDeploy': {
                const deployId = String(inputs.deployId ?? '').trim();
                if (!deployId) throw new Error('deployId is required.');

                const data = await nl('GET', `/deploys/${deployId}`);
                return {
                    output: {
                        id: data.id,
                        state: data.state,
                        deployUrl: data.deploy_url ?? data.ssl_url ?? '',
                        createdAt: data.created_at ?? '',
                        errorMessage: data.error_message ?? '',
                    },
                };
            }

            case 'cancelDeploy': {
                const deployId = String(inputs.deployId ?? '').trim();
                if (!deployId) throw new Error('deployId is required.');

                const data = await nl('POST', `/deploys/${deployId}/cancel`, {});
                return { output: { state: data.state ?? 'cancelled', deployId } };
            }

            case 'listFunctions': {
                const siteId = String(inputs.siteId ?? '').trim();
                if (!siteId) throw new Error('siteId is required.');

                const data = await nl('GET', `/sites/${siteId}/functions`);
                const functions = Array.isArray(data) ? data : (data?.functions ?? []);
                return { output: { functions, count: functions.length } };
            }

            case 'setEnvironmentVariable': {
                const siteId = String(inputs.siteId ?? '').trim();
                const key = String(inputs.key ?? '').trim();
                const value = String(inputs.value ?? '');
                if (!siteId) throw new Error('siteId is required.');
                if (!key) throw new Error('key is required.');

                const context = inputs.context ? String(inputs.context).trim() : 'all';
                // Netlify env var API: PATCH /sites/{site_id}/env/{key}
                await nl('PUT', `/sites/${siteId}/env/${encodeURIComponent(key)}`, {
                    values: [{ value, context }],
                });
                return { output: { key, context } };
            }

            case 'deleteEnvironmentVariable': {
                const siteId = String(inputs.siteId ?? '').trim();
                const key = String(inputs.key ?? '').trim();
                if (!siteId) throw new Error('siteId is required.');
                if (!key) throw new Error('key is required.');

                await nl('DELETE', `/sites/${siteId}/env/${encodeURIComponent(key)}`);
                return { output: { deleted: true, key } };
            }

            case 'listForms': {
                const siteId = String(inputs.siteId ?? '').trim();
                if (!siteId) throw new Error('siteId is required.');

                const data = await nl('GET', `/sites/${siteId}/forms`);
                const forms = Array.isArray(data) ? data : [];
                return { output: { forms, count: forms.length } };
            }

            case 'listSubmissions': {
                const formId = String(inputs.formId ?? '').trim();
                if (!formId) throw new Error('formId is required.');

                const data = await nl('GET', `/forms/${formId}/submissions?per_page=100`);
                const submissions = Array.isArray(data) ? data : [];
                return { output: { submissions, count: submissions.length } };
            }

            case 'createHook': {
                const siteId = String(inputs.siteId ?? '').trim();
                const type = String(inputs.type ?? '').trim();
                const event = String(inputs.event ?? '').trim();
                if (!siteId) throw new Error('siteId is required.');
                if (!type) throw new Error('type is required.');
                if (!event) throw new Error('event is required.');

                const hookData: any = inputs.data ?? {};
                const data = await nl('POST', `/hooks`, {
                    site_id: siteId,
                    type,
                    event,
                    data: hookData,
                });
                return { output: { id: data.id, type: data.type, event: data.event } };
            }

            default:
                return { error: `Netlify action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Netlify action failed.' };
    }
}
