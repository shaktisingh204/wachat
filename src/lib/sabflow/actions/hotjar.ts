'use server';

export async function executeHotjarAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any,
): Promise<{ output?: any; error?: string }> {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');

        const base = 'https://api.hotjar.com/v1';

        async function hotjarFetch(method: string, path: string, body?: any) {
            logger?.log(`[Hotjar] ${method} ${path}`);
            const url = `${base}${path}`;
            const headers: Record<string, string> = {
                Authorization: `Bearer ${accessToken}`,
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
            case 'listSites': {
                const page = inputs.page ?? 1;
                const perPage = inputs.perPage ?? 20;
                const data = await hotjarFetch('GET', `/sites?page=${page}&per_page=${perPage}`);
                return { output: data };
            }

            case 'getSite': {
                const siteId = String(inputs.siteId ?? '').trim();
                if (!siteId) throw new Error('siteId is required.');
                const data = await hotjarFetch('GET', `/sites/${siteId}`);
                return { output: data };
            }

            case 'createSite': {
                const payload: Record<string, any> = {};
                if (inputs.name) payload.name = inputs.name;
                if (inputs.site_url) payload.site_url = inputs.site_url;
                if (inputs.type) payload.type = inputs.type;
                const data = await hotjarFetch('POST', '/sites', payload);
                return { output: data };
            }

            case 'updateSite': {
                const siteId = String(inputs.siteId ?? '').trim();
                if (!siteId) throw new Error('siteId is required.');
                const payload: Record<string, any> = {};
                if (inputs.name) payload.name = inputs.name;
                if (inputs.site_url) payload.site_url = inputs.site_url;
                const data = await hotjarFetch('PATCH', `/sites/${siteId}`, payload);
                return { output: data };
            }

            case 'listHeatmaps': {
                const siteId = String(inputs.siteId ?? '').trim();
                if (!siteId) throw new Error('siteId is required.');
                const page = inputs.page ?? 1;
                const perPage = inputs.perPage ?? 20;
                const data = await hotjarFetch('GET', `/sites/${siteId}/heatmaps?page=${page}&per_page=${perPage}`);
                return { output: data };
            }

            case 'getHeatmap': {
                const siteId = String(inputs.siteId ?? '').trim();
                const heatmapId = String(inputs.heatmapId ?? '').trim();
                if (!siteId) throw new Error('siteId is required.');
                if (!heatmapId) throw new Error('heatmapId is required.');
                const data = await hotjarFetch('GET', `/sites/${siteId}/heatmaps/${heatmapId}`);
                return { output: data };
            }

            case 'listRecordings': {
                const siteId = String(inputs.siteId ?? '').trim();
                if (!siteId) throw new Error('siteId is required.');
                const page = inputs.page ?? 1;
                const perPage = inputs.perPage ?? 20;
                const data = await hotjarFetch('GET', `/sites/${siteId}/recordings?page=${page}&per_page=${perPage}`);
                return { output: data };
            }

            case 'getRecording': {
                const siteId = String(inputs.siteId ?? '').trim();
                const recordingId = String(inputs.recordingId ?? '').trim();
                if (!siteId) throw new Error('siteId is required.');
                if (!recordingId) throw new Error('recordingId is required.');
                const data = await hotjarFetch('GET', `/sites/${siteId}/recordings/${recordingId}`);
                return { output: data };
            }

            case 'listFunnels': {
                const siteId = String(inputs.siteId ?? '').trim();
                if (!siteId) throw new Error('siteId is required.');
                const data = await hotjarFetch('GET', `/sites/${siteId}/funnels`);
                return { output: data };
            }

            case 'getFunnel': {
                const siteId = String(inputs.siteId ?? '').trim();
                const funnelId = String(inputs.funnelId ?? '').trim();
                if (!siteId) throw new Error('siteId is required.');
                if (!funnelId) throw new Error('funnelId is required.');
                const data = await hotjarFetch('GET', `/sites/${siteId}/funnels/${funnelId}`);
                return { output: data };
            }

            case 'listForms': {
                const siteId = String(inputs.siteId ?? '').trim();
                if (!siteId) throw new Error('siteId is required.');
                const page = inputs.page ?? 1;
                const perPage = inputs.perPage ?? 20;
                const data = await hotjarFetch('GET', `/sites/${siteId}/forms?page=${page}&per_page=${perPage}`);
                return { output: data };
            }

            case 'getForm': {
                const siteId = String(inputs.siteId ?? '').trim();
                const formId = String(inputs.formId ?? '').trim();
                if (!siteId) throw new Error('siteId is required.');
                if (!formId) throw new Error('formId is required.');
                const data = await hotjarFetch('GET', `/sites/${siteId}/forms/${formId}`);
                return { output: data };
            }

            case 'getSurveys': {
                const siteId = String(inputs.siteId ?? '').trim();
                if (!siteId) throw new Error('siteId is required.');
                const page = inputs.page ?? 1;
                const perPage = inputs.perPage ?? 20;
                const data = await hotjarFetch('GET', `/sites/${siteId}/surveys?page=${page}&per_page=${perPage}`);
                return { output: data };
            }

            case 'getSurveyResponses': {
                const siteId = String(inputs.siteId ?? '').trim();
                const surveyId = String(inputs.surveyId ?? '').trim();
                if (!siteId) throw new Error('siteId is required.');
                if (!surveyId) throw new Error('surveyId is required.');
                const page = inputs.page ?? 1;
                const perPage = inputs.perPage ?? 20;
                const data = await hotjarFetch('GET', `/sites/${siteId}/surveys/${surveyId}/responses?page=${page}&per_page=${perPage}`);
                return { output: data };
            }

            case 'getFormAnalytics': {
                const siteId = String(inputs.siteId ?? '').trim();
                const formId = String(inputs.formId ?? '').trim();
                if (!siteId) throw new Error('siteId is required.');
                if (!formId) throw new Error('formId is required.');
                const data = await hotjarFetch('GET', `/sites/${siteId}/forms/${formId}/analytics`);
                return { output: data };
            }

            default:
                throw new Error(`Unknown Hotjar action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.error?.(`[Hotjar] Error: ${err.message}`);
        return { error: err.message ?? 'Unknown error' };
    }
}
