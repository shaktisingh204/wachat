
'use server';

const NR_GRAPHQL = 'https://api.newrelic.com/graphql';
const NR_REST = 'https://api.newrelic.com';
const NR_SYNTHETICS = 'https://synthetics.newrelic.com/synthetics/api/v3';

export async function executeNewRelicEnhancedAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        const accountId = inputs.accountId ? Number(inputs.accountId) : undefined;

        async function nrGraphql(query: string, variables?: Record<string, any>) {
            logger?.log(`[NewRelicEnhanced] GraphQL query`);
            const res = await fetch(NR_GRAPHQL, {
                method: 'POST',
                headers: {
                    'Api-Key': apiKey,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify({ query, variables }),
            });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) throw new Error(data?.errors?.[0]?.message || `New Relic GraphQL error: ${res.status}`);
            if (data?.errors?.length) throw new Error(data.errors[0].message);
            return data?.data;
        }

        async function nrRest(method: string, path: string, body?: any) {
            logger?.log(`[NewRelicEnhanced] ${method} ${path}`);
            const options: RequestInit = {
                method,
                headers: {
                    'Api-Key': apiKey,
                    'X-Api-Key': apiKey,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
            };
            if (body !== undefined) options.body = JSON.stringify(body);
            const res = await fetch(`${NR_REST}${path}`, options);
            if (res.status === 204) return {};
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) throw new Error(data?.error?.title || data?.message || `New Relic REST error: ${res.status}`);
            return data;
        }

        switch (actionName) {
            case 'runNrqlQuery': {
                if (!accountId) throw new Error('accountId is required.');
                const nrql = String(inputs.nrql ?? inputs.query ?? '').trim();
                if (!nrql) throw new Error('nrql is required.');
                const gqlQuery = `{ actor { account(id: ${accountId}) { nrql(query: "${nrql.replace(/"/g, '\\"')}") { results } } } }`;
                const data = await nrGraphql(gqlQuery);
                return { output: { results: data?.actor?.account?.nrql?.results ?? [] } };
            }
            case 'listApplications': {
                if (!accountId) throw new Error('accountId is required.');
                const gqlQuery = `{ actor { account(id: ${accountId}) { nrql(query: "SELECT appName, count(*) FROM Transaction FACET appName LIMIT 100") { results } } } }`;
                const data = await nrGraphql(gqlQuery);
                return { output: { applications: data?.actor?.account?.nrql?.results ?? [] } };
            }
            case 'createAlert': {
                const body = {
                    policy: {
                        name: inputs.name ?? 'New Alert Policy',
                        incident_preference: inputs.incidentPreference ?? 'PER_POLICY',
                    },
                };
                const data = await nrRest('POST', '/v2/alerts_policies.json', body);
                return { output: { policy: data?.policy ?? data } };
            }
            case 'getAlerts': {
                const data = await nrRest('GET', '/v2/alerts_policies.json');
                return { output: { policies: data?.policies ?? data } };
            }
            case 'createAlertCondition': {
                const policyId = String(inputs.policyId ?? '').trim();
                if (!policyId) throw new Error('policyId is required.');
                const body = {
                    condition: {
                        type: inputs.type ?? 'apm_app_metric',
                        name: inputs.name ?? 'New Condition',
                        enabled: inputs.enabled ?? true,
                        entities: inputs.entities ?? [],
                        metric: inputs.metric ?? 'error_percentage',
                        terms: inputs.terms ?? [],
                    },
                };
                const data = await nrRest('POST', `/v2/alerts_conditions.json?policy_id=${policyId}`, body);
                return { output: { condition: data?.condition ?? data } };
            }
            case 'listIncidents': {
                const data = await nrRest('GET', '/v2/alerts_incidents.json');
                return { output: { incidents: data?.incidents ?? data } };
            }
            case 'createDashboard': {
                const body = {
                    dashboard: {
                        title: inputs.title ?? 'New Dashboard',
                        visibility: inputs.visibility ?? 'all',
                        editable: inputs.editable ?? 'editable_by_all',
                        widgets: inputs.widgets ?? [],
                    },
                };
                const data = await nrRest('POST', '/v2/dashboards.json', body);
                return { output: { dashboard: data?.dashboard ?? data } };
            }
            case 'getDashboard': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await nrRest('GET', `/v2/dashboards/${id}.json`);
                return { output: { dashboard: data?.dashboard ?? data } };
            }
            case 'deleteDashboard': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                await nrRest('DELETE', `/v2/dashboards/${id}.json`);
                return { output: { deleted: true, id } };
            }
            case 'listWorkloads': {
                if (!accountId) throw new Error('accountId is required.');
                const gqlQuery = `{ actor { account(id: ${accountId}) { workloads { collections { guid name permalink } } } } }`;
                const data = await nrGraphql(gqlQuery);
                return { output: { workloads: data?.actor?.account?.workloads?.collections ?? [] } };
            }
            case 'createWorkload': {
                if (!accountId) throw new Error('accountId is required.');
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const entityGuids = inputs.entityGuids ?? [];
                const gqlQuery = `mutation { workloadCreate(accountId: ${accountId}, workload: { name: "${name}", entityGuids: ${JSON.stringify(entityGuids)} }) { guid name permalink } }`;
                const data = await nrGraphql(gqlQuery);
                return { output: { workload: data?.workloadCreate ?? data } };
            }
            case 'getEntity': {
                const guid = String(inputs.guid ?? '').trim();
                if (!guid) throw new Error('guid is required.');
                const gqlQuery = `{ actor { entity(guid: "${guid}") { name entityType guid reporting tags { key values } } } }`;
                const data = await nrGraphql(gqlQuery);
                return { output: { entity: data?.actor?.entity ?? data } };
            }
            case 'listEntities': {
                const query = String(inputs.query ?? "domain = 'APM' AND type = 'APPLICATION'").trim();
                const gqlQuery = `{ actor { entitySearch(query: "${query.replace(/"/g, '\\"')}") { results { entities { guid name entityType reporting } } } } }`;
                const data = await nrGraphql(gqlQuery);
                return { output: { entities: data?.actor?.entitySearch?.results?.entities ?? [] } };
            }
            case 'getGoldenMetrics': {
                const guid = String(inputs.guid ?? '').trim();
                if (!guid) throw new Error('guid is required.');
                const gqlQuery = `{ actor { entity(guid: "${guid}") { goldenMetrics { metrics { name title unit query } } } } }`;
                const data = await nrGraphql(gqlQuery);
                return { output: { goldenMetrics: data?.actor?.entity?.goldenMetrics?.metrics ?? [] } };
            }
            case 'getSyntheticMonitors': {
                logger?.log(`[NewRelicEnhanced] GET synthetics monitors`);
                const res = await fetch(`${NR_SYNTHETICS}/monitors`, {
                    method: 'GET',
                    headers: {
                        'Api-Key': apiKey,
                        'X-Api-Key': apiKey,
                        Accept: 'application/json',
                    },
                });
                const text = await res.text();
                let data: any;
                try { data = JSON.parse(text); } catch { data = { raw: text }; }
                if (!res.ok) throw new Error(data?.message || `New Relic Synthetics error: ${res.status}`);
                return { output: { monitors: data?.monitors ?? data } };
            }
            default:
                throw new Error(`Unknown action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.log(`[NewRelicEnhanced] Error: ${err.message}`);
        return { error: err.message ?? 'Unknown error' };
    }
}
