
'use server';

async function freshpingFetch(apiKey: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Freshping] ${method} ${path}`);
    const url = `https://api.freshping.io/v1${path}`;
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Token ${apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.detail || data?.message || `Freshping API error: ${res.status}`);
    }
    return data;
}

export async function executeFreshpingAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');
        const fp = (method: string, path: string, body?: any) => freshpingFetch(apiKey, method, path, body, logger);

        switch (actionName) {
            case 'listChecks': {
                const data = await fp('GET', '/checks/');
                return { output: { checks: data.results ?? data, count: data.count ?? (data.results ?? data).length } };
            }

            case 'getCheck': {
                const checkId = String(inputs.checkId ?? '').trim();
                if (!checkId) throw new Error('checkId is required.');
                const data = await fp('GET', `/checks/${checkId}/`);
                return { output: { id: String(data.id), name: data.name, url: data.url, status: data.status, paused: String(data.paused ?? false) } };
            }

            case 'createCheck': {
                const name = String(inputs.name ?? '').trim();
                const url = String(inputs.url ?? '').trim();
                if (!name || !url) throw new Error('name and url are required.');
                const body: any = { name, url, check_type: inputs.checkType ?? 'API', check_period: Number(inputs.checkPeriod ?? 1) };
                const data = await fp('POST', '/checks/', body);
                return { output: { id: String(data.id), name: data.name, url: data.url, status: data.status } };
            }

            case 'updateCheck': {
                const checkId = String(inputs.checkId ?? '').trim();
                if (!checkId) throw new Error('checkId is required.');
                const body: any = {};
                if (inputs.name) body.name = String(inputs.name);
                if (inputs.url) body.url = String(inputs.url);
                if (inputs.checkPeriod) body.check_period = Number(inputs.checkPeriod);
                const data = await fp('PATCH', `/checks/${checkId}/`, body);
                return { output: { id: String(data.id), name: data.name, status: data.status } };
            }

            case 'deleteCheck': {
                const checkId = String(inputs.checkId ?? '').trim();
                if (!checkId) throw new Error('checkId is required.');
                await fp('DELETE', `/checks/${checkId}/`);
                return { output: { deleted: 'true', checkId } };
            }

            case 'pauseCheck': {
                const checkId = String(inputs.checkId ?? '').trim();
                if (!checkId) throw new Error('checkId is required.');
                const data = await fp('PATCH', `/checks/${checkId}/`, { paused: true });
                return { output: { id: String(data.id), paused: 'true' } };
            }

            case 'resumeCheck': {
                const checkId = String(inputs.checkId ?? '').trim();
                if (!checkId) throw new Error('checkId is required.');
                const data = await fp('PATCH', `/checks/${checkId}/`, { paused: false });
                return { output: { id: String(data.id), paused: 'false' } };
            }

            case 'listReports': {
                const checkId = inputs.checkId ? `?check=${inputs.checkId}` : '';
                const data = await fp('GET', `/check-statistic-reports/${checkId}`);
                return { output: { reports: data.results ?? data, count: data.count ?? (data.results ?? data).length } };
            }

            case 'getReport': {
                const reportId = String(inputs.reportId ?? '').trim();
                if (!reportId) throw new Error('reportId is required.');
                const data = await fp('GET', `/check-statistic-reports/${reportId}/`);
                return { output: data };
            }

            case 'listAlerts': {
                const checkId = inputs.checkId ? `?check=${inputs.checkId}` : '';
                const data = await fp('GET', `/check-status-updates/${checkId}`);
                return { output: { alerts: data.results ?? data, count: data.count ?? (data.results ?? data).length } };
            }

            case 'getAlert': {
                const alertId = String(inputs.alertId ?? '').trim();
                if (!alertId) throw new Error('alertId is required.');
                const data = await fp('GET', `/check-status-updates/${alertId}/`);
                return { output: data };
            }

            case 'listIncidents': {
                const checkId = inputs.checkId ? `?check=${inputs.checkId}` : '';
                const data = await fp('GET', `/check-outages/${checkId}`);
                return { output: { incidents: data.results ?? data, count: data.count ?? (data.results ?? data).length } };
            }

            case 'getIncident': {
                const incidentId = String(inputs.incidentId ?? '').trim();
                if (!incidentId) throw new Error('incidentId is required.');
                const data = await fp('GET', `/check-outages/${incidentId}/`);
                return { output: data };
            }

            case 'getResponseTimeReport': {
                const checkId = String(inputs.checkId ?? '').trim();
                if (!checkId) throw new Error('checkId is required.');
                const from = inputs.from ? `&from=${inputs.from}` : '';
                const to = inputs.to ? `&to=${inputs.to}` : '';
                const data = await fp('GET', `/check-statistic-reports/?check=${checkId}&type=response_time${from}${to}`);
                return { output: { reports: data.results ?? data, count: data.count ?? (data.results ?? data).length } };
            }

            case 'getAvailabilityReport': {
                const checkId = String(inputs.checkId ?? '').trim();
                if (!checkId) throw new Error('checkId is required.');
                const from = inputs.from ? `&from=${inputs.from}` : '';
                const to = inputs.to ? `&to=${inputs.to}` : '';
                const data = await fp('GET', `/check-statistic-reports/?check=${checkId}&type=availability${from}${to}`);
                return { output: { reports: data.results ?? data, count: data.count ?? (data.results ?? data).length } };
            }

            default:
                return { error: `Freshping action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Freshping action failed.' };
    }
}
