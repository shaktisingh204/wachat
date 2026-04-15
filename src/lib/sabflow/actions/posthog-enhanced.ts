'use server';

export async function executePosthogEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    const apiBase = 'https://app.posthog.com/api';
    const captureBase = 'https://app.posthog.com/capture';

    try {
        const apiHeaders = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${inputs.personalApiKey || ''}`,
        };

        switch (actionName) {
            case 'captureEvent': {
                const body = {
                    api_key: inputs.projectApiKey,
                    event: inputs.event,
                    distinct_id: inputs.distinctId,
                    properties: inputs.properties || {},
                    timestamp: inputs.timestamp,
                };
                const res = await fetch(captureBase, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'captureBatch': {
                const body = {
                    api_key: inputs.projectApiKey,
                    batch: inputs.batch || [],
                };
                const res = await fetch(`${captureBase}/batch`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'identifyPerson': {
                const body = {
                    api_key: inputs.projectApiKey,
                    event: '$identify',
                    distinct_id: inputs.distinctId,
                    properties: {
                        $set: inputs.properties || {},
                    },
                };
                const res = await fetch(captureBase, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'aliasUser': {
                const body = {
                    api_key: inputs.projectApiKey,
                    event: '$create_alias',
                    distinct_id: inputs.distinctId,
                    properties: {
                        alias: inputs.alias,
                    },
                };
                const res = await fetch(captureBase, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'setPersonProperties': {
                const body = {
                    api_key: inputs.projectApiKey,
                    event: '$set',
                    distinct_id: inputs.distinctId,
                    properties: {
                        $set: inputs.properties || {},
                    },
                };
                const res = await fetch(captureBase, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'listProjects': {
                const res = await fetch(`${apiBase}/projects/`, {
                    method: 'GET',
                    headers: apiHeaders,
                });
                const data = await res.json();
                return { output: data };
            }
            case 'getProject': {
                const res = await fetch(`${apiBase}/projects/${inputs.projectId}/`, {
                    method: 'GET',
                    headers: apiHeaders,
                });
                const data = await res.json();
                return { output: data };
            }
            case 'listFeatureFlags': {
                const res = await fetch(`${apiBase}/projects/${inputs.projectId}/feature_flags/`, {
                    method: 'GET',
                    headers: apiHeaders,
                });
                const data = await res.json();
                return { output: data };
            }
            case 'getFeatureFlag': {
                const res = await fetch(`${apiBase}/projects/${inputs.projectId}/feature_flags/${inputs.flagId}/`, {
                    method: 'GET',
                    headers: apiHeaders,
                });
                const data = await res.json();
                return { output: data };
            }
            case 'createFeatureFlag': {
                const body = {
                    key: inputs.key,
                    name: inputs.name,
                    active: inputs.active !== undefined ? inputs.active : true,
                    filters: inputs.filters || {},
                };
                const res = await fetch(`${apiBase}/projects/${inputs.projectId}/feature_flags/`, {
                    method: 'POST',
                    headers: apiHeaders,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'updateFeatureFlag': {
                const body: any = {};
                if (inputs.name !== undefined) body.name = inputs.name;
                if (inputs.active !== undefined) body.active = inputs.active;
                if (inputs.filters !== undefined) body.filters = inputs.filters;
                const res = await fetch(`${apiBase}/projects/${inputs.projectId}/feature_flags/${inputs.flagId}/`, {
                    method: 'PATCH',
                    headers: apiHeaders,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'evaluateFeatureFlag': {
                const body = {
                    distinct_id: inputs.distinctId,
                    groups: inputs.groups || {},
                    person_properties: inputs.personProperties || {},
                    group_properties: inputs.groupProperties || {},
                };
                const res = await fetch(`${apiBase}/projects/${inputs.projectId}/feature_flags/${inputs.flagKey}/evaluation/`, {
                    method: 'POST',
                    headers: apiHeaders,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'listInsights': {
                const params = new URLSearchParams();
                if (inputs.saved) params.set('saved', String(inputs.saved));
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const res = await fetch(`${apiBase}/projects/${inputs.projectId}/insights/?${params.toString()}`, {
                    method: 'GET',
                    headers: apiHeaders,
                });
                const data = await res.json();
                return { output: data };
            }
            case 'getInsight': {
                const res = await fetch(`${apiBase}/projects/${inputs.projectId}/insights/${inputs.insightId}/`, {
                    method: 'GET',
                    headers: apiHeaders,
                });
                const data = await res.json();
                return { output: data };
            }
            case 'createInsight': {
                const body = {
                    name: inputs.name,
                    filters: inputs.filters || {},
                    saved: inputs.saved !== undefined ? inputs.saved : true,
                };
                const res = await fetch(`${apiBase}/projects/${inputs.projectId}/insights/`, {
                    method: 'POST',
                    headers: apiHeaders,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: data };
            }
            default:
                return { error: `Unknown PostHog action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`PostHog enhanced action error: ${err.message}`);
        return { error: err.message || 'PostHog enhanced action failed' };
    }
}
