
'use server';

const PENDO_BASE = 'https://app.pendo.io/api/v1';

export async function executePendoAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        const req = async (method: string, path: string, body?: any) => {
            logger?.log(`[Pendo] ${method} ${PENDO_BASE}${path}`);
            const opts: RequestInit = {
                method,
                headers: {
                    'x-pendo-integration-key': apiKey,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
            };
            if (body !== undefined) opts.body = JSON.stringify(body);
            const res = await fetch(`${PENDO_BASE}${path}`, opts);
            if (res.status === 204) return {};
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.message || `Pendo API error: ${res.status}`);
            return data;
        };

        switch (actionName) {
            case 'trackEvent': {
                const type = String(inputs.type ?? 'track').trim();
                const event = String(inputs.event ?? '').trim();
                if (!event) throw new Error('event is required.');
                const body: any = {
                    type,
                    event,
                    accountId: inputs.accountId ?? '',
                    visitorId: inputs.visitorId ?? '',
                    properties: typeof inputs.properties === 'object' ? inputs.properties : {},
                };
                const data = await req('POST', '/track', body);
                return { output: { success: true, result: data } };
            }

            case 'identifyVisitor': {
                const visitorId = String(inputs.visitorId ?? '').trim();
                if (!visitorId) throw new Error('visitorId is required.');
                const body: any = {
                    visitor: { id: visitorId, ...(typeof inputs.visitorData === 'object' ? inputs.visitorData : {}) },
                };
                if (inputs.accountId) body.account = { id: String(inputs.accountId) };
                const data = await req('POST', '/visitor', body);
                return { output: { success: true, visitor: data } };
            }

            case 'updateVisitor': {
                const visitorId = String(inputs.visitorId ?? '').trim();
                if (!visitorId) throw new Error('visitorId is required.');
                const payload = typeof inputs.payload === 'object' ? inputs.payload : {};
                const data = await req('POST', '/visitor', { visitor: { id: visitorId, ...payload } });
                return { output: { success: true, visitor: data } };
            }

            case 'getVisitor': {
                const visitorId = String(inputs.visitorId ?? '').trim();
                if (!visitorId) throw new Error('visitorId is required.');
                const data = await req('GET', `/visitor/${encodeURIComponent(visitorId)}`);
                return { output: { visitor: data } };
            }

            case 'listVisitors': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await req('GET', `/visitor${qs}`);
                return { output: { visitors: Array.isArray(data) ? data : data?.results ?? [] } };
            }

            case 'identifyAccount': {
                const accountId = String(inputs.accountId ?? '').trim();
                if (!accountId) throw new Error('accountId is required.');
                const body = { account: { id: accountId, ...(typeof inputs.accountData === 'object' ? inputs.accountData : {}) } };
                const data = await req('POST', '/account', body);
                return { output: { success: true, account: data } };
            }

            case 'updateAccount': {
                const accountId = String(inputs.accountId ?? '').trim();
                if (!accountId) throw new Error('accountId is required.');
                const payload = typeof inputs.payload === 'object' ? inputs.payload : {};
                const data = await req('POST', '/account', { account: { id: accountId, ...payload } });
                return { output: { success: true, account: data } };
            }

            case 'getAccount': {
                const accountId = String(inputs.accountId ?? '').trim();
                if (!accountId) throw new Error('accountId is required.');
                const data = await req('GET', `/account/${encodeURIComponent(accountId)}`);
                return { output: { account: data } };
            }

            case 'listAccounts': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await req('GET', `/account${qs}`);
                return { output: { accounts: Array.isArray(data) ? data : data?.results ?? [] } };
            }

            case 'listFeatures': {
                const data = await req('GET', '/feature');
                return { output: { features: Array.isArray(data) ? data : data?.results ?? [] } };
            }

            case 'getFeature': {
                const featureId = String(inputs.featureId ?? '').trim();
                if (!featureId) throw new Error('featureId is required.');
                const data = await req('GET', `/feature/${encodeURIComponent(featureId)}`);
                return { output: { feature: data } };
            }

            case 'listPages': {
                const data = await req('GET', '/page');
                return { output: { pages: Array.isArray(data) ? data : data?.results ?? [] } };
            }

            case 'getPage': {
                const pageId = String(inputs.pageId ?? '').trim();
                if (!pageId) throw new Error('pageId is required.');
                const data = await req('GET', `/page/${encodeURIComponent(pageId)}`);
                return { output: { page: data } };
            }

            case 'listGuides': {
                const data = await req('GET', '/guide');
                return { output: { guides: Array.isArray(data) ? data : data?.results ?? [] } };
            }

            case 'getGuide': {
                const guideId = String(inputs.guideId ?? '').trim();
                if (!guideId) throw new Error('guideId is required.');
                const data = await req('GET', `/guide/${encodeURIComponent(guideId)}`);
                return { output: { guide: data } };
            }

            case 'getApplicationUsage': {
                const params = new URLSearchParams();
                if (inputs.appId) params.set('appId', String(inputs.appId));
                if (inputs.startTime) params.set('startTime', String(inputs.startTime));
                if (inputs.endTime) params.set('endTime', String(inputs.endTime));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await req('GET', `/aggregation${qs}`);
                return { output: { usage: data } };
            }

            case 'listReports': {
                const data = await req('GET', '/report');
                return { output: { reports: Array.isArray(data) ? data : data?.results ?? [] } };
            }

            default:
                return { error: `Pendo action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Pendo action failed.' };
    }
}
