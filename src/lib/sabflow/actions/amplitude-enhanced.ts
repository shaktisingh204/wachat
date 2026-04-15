'use server';

export async function executeAmplitudeEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const baseUrl = 'https://amplitude.com/api/2';
        const basicAuth = Buffer.from(inputs.apiKey + ':' + inputs.secretKey).toString('base64');

        const authHeaders: Record<string, string> = {
            'Authorization': `Basic ${basicAuth}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'getProjectInfo': {
                const res = await fetch(`${baseUrl}/project`, { headers: authHeaders });
                if (!res.ok) return { error: `Failed to get project info: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'listUsers': {
                const params = new URLSearchParams({ api_key: inputs.apiKey });
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                const res = await fetch(`${baseUrl}/users?${params}`, { headers: authHeaders });
                if (!res.ok) return { error: `Failed to list users: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getUserActivity': {
                const params = new URLSearchParams({ api_key: inputs.apiKey, user: inputs.userId });
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                const res = await fetch(`${baseUrl}/useractivity?${params}`, { headers: authHeaders });
                if (!res.ok) return { error: `Failed to get user activity: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'lookupUser': {
                const params = new URLSearchParams({ api_key: inputs.apiKey, user: inputs.userId });
                const res = await fetch(`${baseUrl}/usersearch?${params}`, { headers: authHeaders });
                if (!res.ok) return { error: `Failed to lookup user: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'exportEvents': {
                const params = new URLSearchParams({
                    start: inputs.start,
                    end: inputs.end,
                });
                if (inputs.events) params.set('e', JSON.stringify(inputs.events));
                const res = await fetch(`https://data.amplitude.com/api/2/export?${params}`, { headers: authHeaders });
                if (!res.ok) return { error: `Failed to export events: ${res.status} ${await res.text()}` };
                const text = await res.text();
                return { output: { data: text } };
            }

            case 'listCohorts': {
                const res = await fetch(`${baseUrl}/cohorts`, { headers: authHeaders });
                if (!res.ok) return { error: `Failed to list cohorts: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getCohort': {
                const res = await fetch(`${baseUrl}/cohorts/${inputs.cohortId}`, { headers: authHeaders });
                if (!res.ok) return { error: `Failed to get cohort: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'listAnnotations': {
                const params = new URLSearchParams({ api_key: inputs.apiKey });
                const res = await fetch(`${baseUrl}/annotations?${params}`, { headers: authHeaders });
                if (!res.ok) return { error: `Failed to list annotations: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'createAnnotation': {
                const body: Record<string, any> = {
                    date: inputs.date,
                    label: inputs.label,
                };
                if (inputs.details) body.details = inputs.details;
                if (inputs.eventType) body.event_type = inputs.eventType;
                const res = await fetch(`${baseUrl}/annotations`, {
                    method: 'POST',
                    headers: authHeaders,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `Failed to create annotation: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'listDashboards': {
                const res = await fetch(`${baseUrl}/dashboards`, { headers: authHeaders });
                if (!res.ok) return { error: `Failed to list dashboards: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getDashboard': {
                const res = await fetch(`${baseUrl}/dashboards/${inputs.dashboardId}`, { headers: authHeaders });
                if (!res.ok) return { error: `Failed to get dashboard: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'queryRevenueData': {
                const params = new URLSearchParams({
                    api_key: inputs.apiKey,
                    start: inputs.start,
                    end: inputs.end,
                });
                if (inputs.m) params.set('m', inputs.m);
                if (inputs.i) params.set('i', String(inputs.i));
                if (inputs.s) params.set('s', JSON.stringify(inputs.s));
                if (inputs.g) params.set('g', inputs.g);
                const res = await fetch(`${baseUrl}/revenue?${params}`, { headers: authHeaders });
                if (!res.ok) return { error: `Failed to query revenue data: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'queryActiveUsers': {
                const params = new URLSearchParams({
                    api_key: inputs.apiKey,
                    start: inputs.start,
                    end: inputs.end,
                });
                if (inputs.m) params.set('m', inputs.m);
                if (inputs.i) params.set('i', String(inputs.i));
                if (inputs.s) params.set('s', JSON.stringify(inputs.s));
                if (inputs.g) params.set('g', inputs.g);
                const res = await fetch(`${baseUrl}/users?${params}`, { headers: authHeaders });
                if (!res.ok) return { error: `Failed to query active users: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'queryRetention': {
                const params = new URLSearchParams({
                    api_key: inputs.apiKey,
                    se: JSON.stringify(inputs.startEvent),
                    re: JSON.stringify(inputs.returnEvent),
                    startDate: inputs.startDate,
                    endDate: inputs.endDate,
                });
                if (inputs.retentionType) params.set('retention_type', inputs.retentionType);
                if (inputs.i) params.set('i', String(inputs.i));
                const res = await fetch(`${baseUrl}/retention?${params}`, { headers: authHeaders });
                if (!res.ok) return { error: `Failed to query retention: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'queryFunnel': {
                const params = new URLSearchParams({
                    api_key: inputs.apiKey,
                    e: JSON.stringify(inputs.events),
                    startDate: inputs.startDate,
                    endDate: inputs.endDate,
                });
                if (inputs.mode) params.set('mode', inputs.mode);
                if (inputs.i) params.set('i', String(inputs.i));
                if (inputs.s) params.set('s', JSON.stringify(inputs.s));
                if (inputs.g) params.set('g', inputs.g);
                const res = await fetch(`${baseUrl}/funnel?${params}`, { headers: authHeaders });
                if (!res.ok) return { error: `Failed to query funnel: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            default:
                return { error: `Unknown Amplitude action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Amplitude Enhanced Action error: ${err.message}`);
        return { error: err.message || 'Amplitude Enhanced Action failed' };
    }
}
