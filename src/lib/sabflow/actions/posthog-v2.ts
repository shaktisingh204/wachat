'use server';

export async function executePostHogV2Action(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const personalApiKey = String(inputs.personalApiKey ?? '').trim();
        const projectApiKey = String(inputs.projectApiKey ?? '').trim();
        const host = String(inputs.host ?? 'https://app.posthog.com').trim().replace(/\/$/, '');
        const projectId = String(inputs.projectId ?? '').trim();

        switch (actionName) {
            case 'captureEvent': {
                const res = await fetch(`${host}/capture/`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        api_key: projectApiKey,
                        event: inputs.event,
                        distinct_id: inputs.distinctId,
                        properties: inputs.properties ?? {},
                        timestamp: inputs.timestamp,
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.detail || data?.message || `API error: ${res.status}`);
                return { output: { result: data } };
            }

            case 'identifyUser': {
                const res = await fetch(`${host}/capture/`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        api_key: projectApiKey,
                        event: '$identify',
                        distinct_id: inputs.distinctId,
                        properties: {
                            $set: inputs.properties ?? {},
                            $set_once: inputs.propertiesSetOnce ?? {},
                        },
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.detail || data?.message || `API error: ${res.status}`);
                return { output: { result: data } };
            }

            case 'groupIdentify': {
                const res = await fetch(`${host}/capture/`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        api_key: projectApiKey,
                        event: '$groupidentify',
                        distinct_id: inputs.distinctId ?? `${inputs.groupType}_${inputs.groupKey}`,
                        properties: {
                            $group_type: inputs.groupType,
                            $group_key: inputs.groupKey,
                            $group_set: inputs.groupProperties ?? {},
                        },
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.detail || data?.message || `API error: ${res.status}`);
                return { output: { result: data } };
            }

            case 'captureAlias': {
                const res = await fetch(`${host}/capture/`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        api_key: projectApiKey,
                        event: '$create_alias',
                        distinct_id: inputs.distinctId,
                        properties: { alias: inputs.alias },
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.detail || data?.message || `API error: ${res.status}`);
                return { output: { result: data } };
            }

            case 'listProjects': {
                const res = await fetch(`${host}/api/projects/`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${personalApiKey}`,
                        'Content-Type': 'application/json',
                    },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.detail || data?.message || `API error: ${res.status}`);
                return { output: { projects: data.results ?? data } };
            }

            case 'getProject': {
                const res = await fetch(`${host}/api/projects/${projectId}/`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${personalApiKey}`,
                        'Content-Type': 'application/json',
                    },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.detail || data?.message || `API error: ${res.status}`);
                return { output: { project: data } };
            }

            case 'listDashboards': {
                const res = await fetch(`${host}/api/projects/${projectId}/dashboards/`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${personalApiKey}`,
                        'Content-Type': 'application/json',
                    },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.detail || data?.message || `API error: ${res.status}`);
                return { output: { dashboards: data.results ?? data } };
            }

            case 'getDashboard': {
                const dashboardId = String(inputs.dashboardId ?? '').trim();
                const res = await fetch(`${host}/api/projects/${projectId}/dashboards/${dashboardId}/`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${personalApiKey}`,
                        'Content-Type': 'application/json',
                    },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.detail || data?.message || `API error: ${res.status}`);
                return { output: { dashboard: data } };
            }

            case 'createDashboard': {
                const res = await fetch(`${host}/api/projects/${projectId}/dashboards/`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${personalApiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        name: inputs.name,
                        description: inputs.description,
                        pinned: inputs.pinned ?? false,
                        tags: inputs.tags ?? [],
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.detail || data?.message || `API error: ${res.status}`);
                return { output: { dashboard: data } };
            }

            case 'listInsights': {
                const res = await fetch(`${host}/api/projects/${projectId}/insights/`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${personalApiKey}`,
                        'Content-Type': 'application/json',
                    },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.detail || data?.message || `API error: ${res.status}`);
                return { output: { insights: data.results ?? data } };
            }

            case 'getInsight': {
                const insightId = String(inputs.insightId ?? '').trim();
                const res = await fetch(`${host}/api/projects/${projectId}/insights/${insightId}/`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${personalApiKey}`,
                        'Content-Type': 'application/json',
                    },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.detail || data?.message || `API error: ${res.status}`);
                return { output: { insight: data } };
            }

            case 'createInsight': {
                const res = await fetch(`${host}/api/projects/${projectId}/insights/`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${personalApiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        name: inputs.name,
                        description: inputs.description,
                        filters: inputs.filters ?? {},
                        query: inputs.query,
                        dashboards: inputs.dashboards ?? [],
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.detail || data?.message || `API error: ${res.status}`);
                return { output: { insight: data } };
            }

            case 'listFeatureFlags': {
                const res = await fetch(`${host}/api/projects/${projectId}/feature_flags/`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${personalApiKey}`,
                        'Content-Type': 'application/json',
                    },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.detail || data?.message || `API error: ${res.status}`);
                return { output: { featureFlags: data.results ?? data } };
            }

            case 'getFeatureFlag': {
                const flagId = String(inputs.flagId ?? '').trim();
                const res = await fetch(`${host}/api/projects/${projectId}/feature_flags/${flagId}/`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${personalApiKey}`,
                        'Content-Type': 'application/json',
                    },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.detail || data?.message || `API error: ${res.status}`);
                return { output: { featureFlag: data } };
            }

            case 'createFeatureFlag': {
                const res = await fetch(`${host}/api/projects/${projectId}/feature_flags/`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${personalApiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        key: inputs.key,
                        name: inputs.name,
                        active: inputs.active ?? true,
                        rollout_percentage: inputs.rolloutPercentage ?? 100,
                        filters: inputs.filters ?? { groups: [{ rollout_percentage: inputs.rolloutPercentage ?? 100 }] },
                        ensure_experience_continuity: inputs.ensureExperienceContinuity ?? false,
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.detail || data?.message || `API error: ${res.status}`);
                return { output: { featureFlag: data } };
            }

            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
