'use server';

export async function executeMixpanelEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    const ingestionBase = 'https://api.mixpanel.com';
    const exportBase = 'https://data.mixpanel.com/api/2.0';

    try {
        const serviceAccountBase64 = Buffer.from(
            `${inputs.serviceAccount || ''}:${inputs.serviceAccountSecret || ''}`
        ).toString('base64');

        const ingestionHeaders = {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${serviceAccountBase64}`,
        };
        const exportHeaders = {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${serviceAccountBase64}`,
        };

        switch (actionName) {
            case 'trackEvent': {
                const events = [{
                    event: inputs.event,
                    properties: {
                        token: inputs.token || inputs.projectToken,
                        distinct_id: inputs.distinctId,
                        time: inputs.time || Math.floor(Date.now() / 1000),
                        ...(inputs.properties || {}),
                    },
                }];
                const res = await fetch(`${ingestionBase}/track`, {
                    method: 'POST',
                    headers: ingestionHeaders,
                    body: JSON.stringify(events),
                });
                const data = await res.json().catch(() => ({ status: res.status }));
                return { output: data };
            }
            case 'trackBatch': {
                const events = (inputs.events || []).map((e: any) => ({
                    event: e.event,
                    properties: {
                        token: inputs.token || inputs.projectToken,
                        distinct_id: e.distinctId,
                        time: e.time || Math.floor(Date.now() / 1000),
                        ...(e.properties || {}),
                    },
                }));
                const res = await fetch(`${ingestionBase}/track`, {
                    method: 'POST',
                    headers: ingestionHeaders,
                    body: JSON.stringify(events),
                });
                const data = await res.json().catch(() => ({ status: res.status }));
                return { output: data };
            }
            case 'setUserProperties': {
                const body = [{
                    $token: inputs.token || inputs.projectToken,
                    $distinct_id: inputs.distinctId,
                    $set: inputs.properties || {},
                }];
                const res = await fetch(`${ingestionBase}/engage#profile-set`, {
                    method: 'POST',
                    headers: ingestionHeaders,
                    body: JSON.stringify(body),
                });
                const data = await res.json().catch(() => ({ status: res.status }));
                return { output: data };
            }
            case 'incrementUserProperty': {
                const body = [{
                    $token: inputs.token || inputs.projectToken,
                    $distinct_id: inputs.distinctId,
                    $add: inputs.properties || {},
                }];
                const res = await fetch(`${ingestionBase}/engage#profile-numerical-add`, {
                    method: 'POST',
                    headers: ingestionHeaders,
                    body: JSON.stringify(body),
                });
                const data = await res.json().catch(() => ({ status: res.status }));
                return { output: data };
            }
            case 'appendToUserProperty': {
                const body = [{
                    $token: inputs.token || inputs.projectToken,
                    $distinct_id: inputs.distinctId,
                    $append: inputs.properties || {},
                }];
                const res = await fetch(`${ingestionBase}/engage#profile-list-append`, {
                    method: 'POST',
                    headers: ingestionHeaders,
                    body: JSON.stringify(body),
                });
                const data = await res.json().catch(() => ({ status: res.status }));
                return { output: data };
            }
            case 'createAlias': {
                const body = {
                    event: '$create_alias',
                    properties: {
                        token: inputs.token || inputs.projectToken,
                        distinct_id: inputs.distinctId,
                        alias: inputs.alias,
                    },
                };
                const res = await fetch(`${ingestionBase}/track`, {
                    method: 'POST',
                    headers: ingestionHeaders,
                    body: JSON.stringify([body]),
                });
                const data = await res.json().catch(() => ({ status: res.status }));
                return { output: data };
            }
            case 'exportEvents': {
                const params = new URLSearchParams({
                    project_id: inputs.projectId,
                    from_date: inputs.fromDate,
                    to_date: inputs.toDate,
                });
                if (inputs.event) params.set('event', JSON.stringify([inputs.event]));
                if (inputs.where) params.set('where', inputs.where);
                const res = await fetch(`${exportBase}/export?${params.toString()}`, {
                    method: 'GET',
                    headers: exportHeaders,
                });
                const text = await res.text();
                const lines = text.trim().split('\n').filter(Boolean).map((l: string) => JSON.parse(l));
                return { output: { events: lines } };
            }
            case 'querySegmentation': {
                const params = new URLSearchParams({
                    project_id: inputs.projectId,
                    event: inputs.event,
                    from_date: inputs.fromDate,
                    to_date: inputs.toDate,
                    type: inputs.type || 'general',
                });
                if (inputs.on) params.set('on', inputs.on);
                if (inputs.unit) params.set('unit', inputs.unit);
                const res = await fetch(`${exportBase}/segmentation?${params.toString()}`, {
                    method: 'GET',
                    headers: exportHeaders,
                });
                const data = await res.json();
                return { output: data };
            }
            case 'queryFunnel': {
                const params = new URLSearchParams({
                    project_id: inputs.projectId,
                    funnel_id: inputs.funnelId,
                    from_date: inputs.fromDate,
                    to_date: inputs.toDate,
                });
                if (inputs.unit) params.set('unit', inputs.unit);
                const res = await fetch(`${exportBase}/funnels?${params.toString()}`, {
                    method: 'GET',
                    headers: exportHeaders,
                });
                const data = await res.json();
                return { output: data };
            }
            case 'queryRetention': {
                const params = new URLSearchParams({
                    project_id: inputs.projectId,
                    from_date: inputs.fromDate,
                    to_date: inputs.toDate,
                });
                if (inputs.retentionType) params.set('retention_type', inputs.retentionType);
                if (inputs.unit) params.set('unit', inputs.unit);
                const res = await fetch(`${exportBase}/retention?${params.toString()}`, {
                    method: 'GET',
                    headers: exportHeaders,
                });
                const data = await res.json();
                return { output: data };
            }
            case 'queryEngagement': {
                const params = new URLSearchParams({
                    project_id: inputs.projectId,
                    from_date: inputs.fromDate,
                    to_date: inputs.toDate,
                    type: inputs.type || 'general',
                });
                if (inputs.event) params.set('event', inputs.event);
                if (inputs.unit) params.set('unit', inputs.unit);
                const res = await fetch(`${exportBase}/engage?${params.toString()}`, {
                    method: 'GET',
                    headers: exportHeaders,
                });
                const data = await res.json();
                return { output: data };
            }
            case 'listCohorts': {
                const params = new URLSearchParams({ project_id: inputs.projectId });
                const res = await fetch(`${exportBase}/cohorts/list?${params.toString()}`, {
                    method: 'GET',
                    headers: exportHeaders,
                });
                const data = await res.json();
                return { output: data };
            }
            case 'getCohort': {
                const params = new URLSearchParams({
                    project_id: inputs.projectId,
                    cohort_id: inputs.cohortId,
                });
                const res = await fetch(`${exportBase}/cohorts/list?${params.toString()}`, {
                    method: 'GET',
                    headers: exportHeaders,
                });
                const data = await res.json();
                return { output: data };
            }
            case 'createCohort': {
                const body = {
                    project_id: inputs.projectId,
                    name: inputs.name,
                    description: inputs.description || '',
                    groups: inputs.groups || [],
                };
                const res = await fetch(`${exportBase}/cohorts/create`, {
                    method: 'POST',
                    headers: exportHeaders,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'listJQLReports': {
                const params = new URLSearchParams({ project_id: inputs.projectId });
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const res = await fetch(`${exportBase}/jql/list?${params.toString()}`, {
                    method: 'GET',
                    headers: exportHeaders,
                });
                const data = await res.json();
                return { output: data };
            }
            default:
                return { error: `Unknown Mixpanel action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Mixpanel enhanced action error: ${err.message}`);
        return { error: err.message || 'Mixpanel enhanced action failed' };
    }
}
