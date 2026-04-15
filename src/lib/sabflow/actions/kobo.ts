
'use server';

const KOBO_DEFAULT_BASE = 'https://kf.kobotoolbox.org';

async function koboFetch(baseUrl: string, apiToken: string, method: string, path: string, body?: any, logger?: any): Promise<any> {
    logger?.log(`[KoBoToolbox] ${method} ${path}`);
    const url = path.startsWith('http') ? path : `${baseUrl}${path}`;
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Token ${apiToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    let data: any;
    try {
        data = await res.json();
    } catch {
        if (!res.ok) throw new Error(`KoBoToolbox API error: ${res.status}`);
        return {};
    }
    if (!res.ok) {
        throw new Error(data?.detail || data?.message || `KoBoToolbox API error: ${res.status}`);
    }
    return data;
}

async function pollUntilComplete(baseUrl: string, apiToken: string, pollUrl: string, maxAttempts = 30, intervalMs = 3000, logger?: any): Promise<any> {
    for (let i = 0; i < maxAttempts; i++) {
        const result = await koboFetch(baseUrl, apiToken, 'GET', pollUrl, undefined, logger);
        if (result.status === 'complete' || result.download_url) return result;
        if (result.status === 'error') throw new Error(`KoBoToolbox export failed: ${result.error ?? 'unknown error'}`);
        await new Promise(r => setTimeout(r, intervalMs));
    }
    throw new Error('KoBoToolbox export timed out.');
}

export async function executeKoboAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiToken = String(inputs.apiToken ?? '').trim();
        if (!apiToken) return { error: 'apiToken is required.' };
        const baseUrl = String(inputs.serverUrl ?? KOBO_DEFAULT_BASE).trim().replace(/\/$/, '');

        const kobo = (method: string, path: string, body?: any) =>
            koboFetch(baseUrl, apiToken, method, path, body, logger);

        switch (actionName) {
            case 'listForms': {
                const limit = inputs.limit ?? 25;
                const offset = inputs.offset ?? 0;
                const data = await kobo('GET', `/api/v2/assets/?asset_type=survey&limit=${limit}&offset=${offset}`);
                return {
                    output: {
                        count: data.count,
                        next: data.next,
                        results: (data.results ?? []).map((f: any) => ({
                            uid: f.uid,
                            name: f.name,
                            deployment_active: f.deployment_active,
                            deployment__submission_count: f.deployment__submission_count,
                        })),
                    },
                };
            }

            case 'getForm': {
                const uid = String(inputs.uid ?? '').trim();
                if (!uid) return { error: 'uid is required.' };
                const data = await kobo('GET', `/api/v2/assets/${uid}/`);
                return {
                    output: {
                        uid: data.uid,
                        name: data.name,
                        deployment_active: data.deployment_active,
                        deployment__submission_count: data.deployment__submission_count,
                        content: data.content,
                    },
                };
            }

            case 'deployForm': {
                const uid = String(inputs.uid ?? '').trim();
                if (!uid) return { error: 'uid is required.' };
                const data = await kobo('POST', `/api/v2/assets/${uid}/deployment/`, { active: true });
                return { output: { deployment: data.deployment ?? data } };
            }

            case 'getSubmissions': {
                const uid = String(inputs.uid ?? '').trim();
                if (!uid) return { error: 'uid is required.' };
                const limit = inputs.limit ?? 25;
                const offset = inputs.offset ?? 0;
                const query = inputs.query ?? '{}';
                const data = await kobo('GET', `/api/v2/assets/${uid}/data/?limit=${limit}&offset=${offset}&query=${encodeURIComponent(query)}&format=json`);
                return {
                    output: {
                        count: data.count,
                        next: data.next,
                        results: data.results ?? [],
                    },
                };
            }

            case 'getSubmission': {
                const uid = String(inputs.uid ?? '').trim();
                const submissionId = String(inputs.submissionId ?? '').trim();
                if (!uid || !submissionId) return { error: 'uid and submissionId are required.' };
                const data = await kobo('GET', `/api/v2/assets/${uid}/data/${submissionId}/?format=json`);
                return { output: data };
            }

            case 'deleteSubmission': {
                const uid = String(inputs.uid ?? '').trim();
                const submissionId = String(inputs.submissionId ?? '').trim();
                if (!uid || !submissionId) return { error: 'uid and submissionId are required.' };
                await kobo('DELETE', `/api/v2/assets/${uid}/data/${submissionId}/`);
                return { output: { deleted: true } };
            }

            case 'bulkDeleteSubmissions': {
                const uid = String(inputs.uid ?? '').trim();
                const submissionIds = inputs.submissionIds;
                if (!uid || !submissionIds) return { error: 'uid and submissionIds are required.' };
                const data = await kobo('DELETE', `/api/v2/assets/${uid}/data/bulk/`, { submission_ids: submissionIds });
                return { output: { detail: data.detail ?? data } };
            }

            case 'editSubmission': {
                const uid = String(inputs.uid ?? '').trim();
                const submissionId = String(inputs.submissionId ?? '').trim();
                const editData = inputs.data;
                if (!uid || !submissionId || !editData) return { error: 'uid, submissionId, and data are required.' };
                const data = await kobo('PATCH', `/api/v2/assets/${uid}/data/${submissionId}/`, editData);
                return { output: { detail: data.detail ?? data } };
            }

            case 'getAttachments': {
                const uid = String(inputs.uid ?? '').trim();
                const submissionId = String(inputs.submissionId ?? '').trim();
                if (!uid || !submissionId) return { error: 'uid and submissionId are required.' };
                const data = await kobo('GET', `/api/v2/assets/${uid}/data/${submissionId}/attachments/`);
                return {
                    output: {
                        count: data.count,
                        results: (data.results ?? []).map((a: any) => ({
                            filename: a.filename,
                            download_url: a.download_url,
                            mimetype: a.mimetype,
                        })),
                    },
                };
            }

            case 'exportData': {
                const uid = String(inputs.uid ?? '').trim();
                if (!uid) return { error: 'uid is required.' };
                const exportBody = {
                    type: inputs.type ?? 'xlsx',
                    lang: '_default',
                    hierarchy_in_labels: false,
                    multiple_select: 'both',
                    group_sep: '/',
                    include_media_url: true,
                };
                const created = await kobo('POST', `/api/v2/assets/${uid}/exports/`, exportBody);
                const pollUrl = created.url ?? `${baseUrl}/api/v2/assets/${uid}/exports/${created.uid}/`;
                const result = await pollUntilComplete(baseUrl, apiToken, pollUrl, 30, 3000, logger);
                return { output: { download_url: result.download_url ?? result.result } };
            }

            case 'listHooks': {
                const uid = String(inputs.uid ?? '').trim();
                if (!uid) return { error: 'uid is required.' };
                const data = await kobo('GET', `/api/v2/assets/${uid}/hooks/`);
                return {
                    output: {
                        count: data.count,
                        results: (data.results ?? []).map((h: any) => ({
                            uid: h.uid,
                            name: h.name,
                            endpoint: h.endpoint,
                            active: h.active,
                        })),
                    },
                };
            }

            case 'createHook': {
                const uid = String(inputs.uid ?? '').trim();
                const name = String(inputs.name ?? '').trim();
                const endpoint = String(inputs.endpoint ?? '').trim();
                if (!uid || !name || !endpoint) return { error: 'uid, name, and endpoint are required.' };
                const body = {
                    name,
                    endpoint,
                    active: true,
                    payload_template: inputs.payloadTemplate ?? '',
                };
                const data = await kobo('POST', `/api/v2/assets/${uid}/hooks/`, body);
                return { output: { uid: data.uid, name: data.name, endpoint: data.endpoint } };
            }

            default:
                return { error: `Unknown KoBoToolbox action: ${actionName}` };
        }
    } catch (err: any) {
        logger?.log(`[KoBoToolbox] Error in ${actionName}: ${err.message}`);
        return { error: err.message ?? 'Unknown KoBoToolbox error.' };
    }
}
