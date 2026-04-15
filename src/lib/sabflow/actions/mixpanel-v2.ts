'use server';

export async function executeMixpanelV2Action(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const username = String(inputs.username ?? '').trim();
        const secret = String(inputs.secret ?? inputs.projectSecret ?? '').trim();
        const projectId = String(inputs.projectId ?? '').trim();
        const basicAuth = `Basic ${Buffer.from(`${username}:${secret}`).toString('base64')}`;
        const BASE = 'https://data.mixpanel.com/api/2.0';
        const API = 'https://api.mixpanel.com';

        switch (actionName) {
            case 'queryEvents': {
                const from = String(inputs.fromDate ?? '').trim();
                const to = String(inputs.toDate ?? '').trim();
                const event = inputs.event ? `&event=${encodeURIComponent(JSON.stringify(inputs.event))}` : '';
                const res = await fetch(
                    `${BASE}/events?project_id=${projectId}&from_date=${from}&to_date=${to}${event}`,
                    { headers: { 'Authorization': basicAuth } },
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { events: data } };
            }
            case 'getEventProperties': {
                const event = String(inputs.event ?? '').trim();
                const res = await fetch(
                    `${BASE}/events/properties?project_id=${projectId}&event=${encodeURIComponent(event)}`,
                    { headers: { 'Authorization': basicAuth } },
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { properties: data } };
            }
            case 'getUserProfiles': {
                const params = new URLSearchParams({ project_id: projectId });
                if (inputs.where) params.append('where', String(inputs.where));
                if (inputs.limit) params.append('limit', String(inputs.limit));
                const res = await fetch(`${BASE}/engage?${params.toString()}`, {
                    headers: { 'Authorization': basicAuth },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { profiles: data.results ?? data } };
            }
            case 'getUserProfile': {
                const distinctId = String(inputs.distinctId ?? '').trim();
                const res = await fetch(
                    `${BASE}/engage?project_id=${projectId}&distinct_id=${encodeURIComponent(distinctId)}`,
                    { headers: { 'Authorization': basicAuth } },
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { profile: data.results?.[0] ?? data } };
            }
            case 'updateUserProfile': {
                const payload = {
                    $token: inputs.projectToken ?? projectId,
                    $distinct_id: String(inputs.distinctId ?? '').trim(),
                    $set: inputs.properties ?? {},
                };
                const res = await fetch(`${API}/engage#profile-set`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                const text = await res.text();
                if (!res.ok) throw new Error(text || `API error: ${res.status}`);
                return { output: { status: text } };
            }
            case 'deleteUserProfile': {
                const payload = {
                    $token: inputs.projectToken ?? projectId,
                    $distinct_id: String(inputs.distinctId ?? '').trim(),
                    $delete: '',
                };
                const res = await fetch(`${API}/engage#profile-delete`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                const text = await res.text();
                if (!res.ok) throw new Error(text || `API error: ${res.status}`);
                return { output: { status: text } };
            }
            case 'trackEvent': {
                const payload = [{
                    event: String(inputs.event ?? '').trim(),
                    properties: { token: inputs.projectToken ?? projectId, distinct_id: inputs.distinctId, ...inputs.properties },
                }];
                const res = await fetch(`${API}/track`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                const text = await res.text();
                if (!res.ok) throw new Error(text || `API error: ${res.status}`);
                return { output: { status: text } };
            }
            case 'importEvents': {
                const events = inputs.events ?? [];
                const res = await fetch(`${API}/import?project_id=${projectId}&strict=1`, {
                    method: 'POST',
                    headers: { 'Authorization': basicAuth, 'Content-Type': 'application/json' },
                    body: JSON.stringify(events),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { importResult: data } };
            }
            case 'createCohort': {
                const body = { project_id: projectId, name: inputs.name, description: inputs.description ?? '', groups: inputs.groups ?? [] };
                const res = await fetch(`${API}/api/app/cohorts/create`, {
                    method: 'POST',
                    headers: { 'Authorization': basicAuth, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { cohort: data } };
            }
            case 'listCohorts': {
                const res = await fetch(`${API}/api/app/cohorts?project_id=${projectId}`, {
                    headers: { 'Authorization': basicAuth },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { cohorts: data.results ?? data } };
            }
            case 'getCohortMembers': {
                const cohortId = String(inputs.cohortId ?? '').trim();
                const res = await fetch(
                    `${BASE}/engage?project_id=${projectId}&filter_by_cohort=${encodeURIComponent(JSON.stringify({ id: Number(cohortId) }))}`,
                    { headers: { 'Authorization': basicAuth } },
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { members: data.results ?? data } };
            }
            case 'listReports': {
                const res = await fetch(`${API}/api/app/reports?project_id=${projectId}`, {
                    headers: { 'Authorization': basicAuth },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { reports: data.results ?? data } };
            }
            case 'getReport': {
                const reportId = String(inputs.reportId ?? '').trim();
                const res = await fetch(`${API}/api/app/reports/${reportId}?project_id=${projectId}`, {
                    headers: { 'Authorization': basicAuth },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { report: data } };
            }
            case 'listDashboards': {
                const res = await fetch(`${API}/api/app/dashboards?project_id=${projectId}`, {
                    headers: { 'Authorization': basicAuth },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { dashboards: data.results ?? data } };
            }
            case 'getDashboard': {
                const dashboardId = String(inputs.dashboardId ?? '').trim();
                const res = await fetch(`${API}/api/app/dashboards/${dashboardId}?project_id=${projectId}`, {
                    headers: { 'Authorization': basicAuth },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { dashboard: data } };
            }
            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
