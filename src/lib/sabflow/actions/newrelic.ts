
'use server';

function getNewRelicBase(inputs: any): string {
    return inputs.region === 'EU' ? 'https://api.eu.newrelic.com/v2' : 'https://api.newrelic.com/v2';
}

function getNewRelicGraphQL(inputs: any): string {
    return inputs.region === 'EU' ? 'https://api.eu.newrelic.com/graphql' : 'https://api.newrelic.com/graphql';
}

async function nrFetch(
    apiKey: string,
    method: string,
    url: string,
    body?: any,
    extraHeaders?: Record<string, string>,
    logger?: any,
) {
    logger?.log(`[NewRelic] ${method} ${url}`);
    const headers: Record<string, string> = {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...extraHeaders,
    };
    const options: RequestInit = { method, headers };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) {
        const msg = data?.error?.title || data?.detail || `New Relic API error: ${res.status}`;
        throw new Error(msg);
    }
    return data;
}

export async function executeNewrelicAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        const base = getNewRelicBase(inputs);
        const graphqlUrl = getNewRelicGraphQL(inputs);
        const nr = (method: string, path: string, body?: any, extraHeaders?: Record<string, string>) =>
            nrFetch(apiKey, method, `${base}${path}`, body, extraHeaders, logger);

        switch (actionName) {
            case 'nrqlQuery': {
                const accountId = Number(inputs.accountId);
                const nrqlQueryStr = String(inputs.nrqlQuery ?? '').trim();
                if (!accountId) throw new Error('accountId is required.');
                if (!nrqlQueryStr) throw new Error('nrqlQuery is required.');
                const gqlQuery = {
                    query: `{ actor { account(id: ${accountId}) { nrql(query: "${nrqlQueryStr.replace(/"/g, '\\"')}") { results } } } }`,
                };
                const data = await nrFetch(apiKey, 'POST', graphqlUrl, gqlQuery, undefined, logger);
                const results = data?.data?.actor?.account?.nrql?.results ?? [];
                return { output: { results } };
            }

            case 'listApplications': {
                const data = await nr('GET', '/applications.json?page=1');
                const applications = (data.applications ?? []).map((a: any) => ({
                    id: a.id,
                    name: a.name,
                    language: a.language,
                    health_status: a.health_status,
                    summary: {
                        response_time: a.application_summary?.response_time,
                        throughput: a.application_summary?.throughput,
                        error_rate: a.application_summary?.error_rate,
                    },
                }));
                return { output: { applications } };
            }

            case 'getApplication': {
                const appId = String(inputs.appId ?? '').trim();
                if (!appId) throw new Error('appId is required.');
                const data = await nr('GET', `/applications/${appId}.json`);
                return { output: { application: data.application ?? data } };
            }

            case 'getApplicationMetrics': {
                const appId = String(inputs.appId ?? '').trim();
                const names = inputs.names;
                if (!appId) throw new Error('appId is required.');
                if (!names) throw new Error('names is required.');
                const nameList = Array.isArray(names) ? names : String(names).split(',').map((n: string) => n.trim());
                const qs = nameList.map((n: string) => `names[]=${encodeURIComponent(n)}`).join('&');
                const data = await nr('GET', `/applications/${appId}/metrics/data.json?${qs}`);
                return { output: { metric_data: data.metric_data ?? {} } };
            }

            case 'listAlertPolicies': {
                const data = await nr('GET', '/alerts_policies.json');
                return { output: { policies: data.policies ?? [] } };
            }

            case 'createAlertPolicy': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const incident_preference = String(inputs.incidentPreference ?? 'PER_POLICY');
                const data = await nr('POST', '/alerts_policies.json', { policy: { name, incident_preference } });
                return { output: { policy: { id: data.policy?.id, name: data.policy?.name } } };
            }

            case 'listAlertConditions': {
                const policyId = String(inputs.policyId ?? '').trim();
                if (!policyId) throw new Error('policyId is required.');
                const data = await nr('GET', `/alerts_conditions.json?policy_id=${policyId}`);
                return { output: { conditions: data.conditions ?? [] } };
            }

            case 'createAlertCondition': {
                const policyId = String(inputs.policyId ?? '').trim();
                const name = String(inputs.name ?? '').trim();
                const type = String(inputs.type ?? '').trim();
                const entities = inputs.entities;
                const metric = String(inputs.metric ?? '').trim();
                const conditionScope = String(inputs.conditionScope ?? '').trim();
                if (!policyId || !name || !type || !metric || !conditionScope) {
                    throw new Error('policyId, name, type, entities, metric, and conditionScope are required.');
                }
                const entitiesList = Array.isArray(entities) ? entities : [entities];
                const data = await nr('POST', `/alerts_conditions.json?policy_id=${policyId}`, {
                    condition: { name, type, entities: entitiesList, metric, condition_scope: conditionScope },
                });
                return { output: { condition: { id: data.condition?.id } } };
            }

            case 'listDeployments': {
                const appId = String(inputs.appId ?? '').trim();
                if (!appId) throw new Error('appId is required.');
                const data = await nr('GET', `/applications/${appId}/deployments.json`);
                const deployments = (data.deployments ?? []).map((d: any) => ({
                    id: d.id,
                    revision: d.revision,
                    description: d.description,
                    timestamp: d.timestamp,
                }));
                return { output: { deployments } };
            }

            case 'createDeployment': {
                const appId = String(inputs.appId ?? '').trim();
                const revision = String(inputs.revision ?? '').trim();
                if (!appId || !revision) throw new Error('appId and revision are required.');
                const deployment: any = { revision };
                if (inputs.description) deployment.description = String(inputs.description).trim();
                if (inputs.user) deployment.user = String(inputs.user).trim();
                if (inputs.changelog) deployment.changelog = String(inputs.changelog).trim();
                const data = await nr('POST', `/applications/${appId}/deployments.json`, { deployment });
                return { output: { deployment: { id: data.deployment?.id } } };
            }

            case 'listHosts': {
                const data = await nr('GET', '/servers.json');
                const servers = (data.servers ?? []).map((s: any) => ({
                    id: s.id,
                    name: s.name,
                    operating_system: s.operating_system,
                    health_status: s.health_status,
                }));
                return { output: { servers } };
            }

            case 'getInsightsData': {
                const accountId = String(inputs.accountId ?? '').trim();
                const nrql = String(inputs.nrql ?? '').trim();
                const queryKey = String(inputs.queryKey ?? '').trim();
                if (!accountId || !nrql) throw new Error('accountId and nrql are required.');
                if (!queryKey) throw new Error('queryKey is required for Insights API.');
                const insightsUrl = `https://insights-api.newrelic.com/v1/accounts/${accountId}/query?nrql=${encodeURIComponent(nrql)}`;
                const data = await nrFetch(apiKey, 'GET', insightsUrl, undefined, { 'X-Query-Key': queryKey }, logger);
                return { output: { results: data.results ?? [] } };
            }

            default:
                return { error: `New Relic action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'New Relic action failed.' };
    }
}
