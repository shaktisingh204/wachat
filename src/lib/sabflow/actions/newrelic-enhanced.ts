'use server';

export async function executeNewRelicEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        const baseUrl = 'https://api.newrelic.com/v2';
        const graphqlUrl = 'https://api.newrelic.com/graphql';

        async function nrFetch(method: string, path: string, body?: any) {
            logger?.log(`[NewRelicEnhanced] ${method} ${baseUrl}${path}`);
            const options: RequestInit = {
                method,
                headers: {
                    'Api-Key': apiKey,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
            };
            if (body !== undefined) options.body = JSON.stringify(body);
            const res = await fetch(`${baseUrl}${path}`, options);
            if (res.status === 204) return {};
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) throw new Error(data?.error?.title || data?.message || `New Relic API error: ${res.status}`);
            return data;
        }

        async function nrGraphql(query: string, variables?: Record<string, any>) {
            logger?.log(`[NewRelicEnhanced] GraphQL query`);
            const res = await fetch(graphqlUrl, {
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

        switch (actionName) {
            case 'listApplications': {
                const data = await nrFetch('GET', '/applications.json');
                return { output: { applications: data?.applications ?? [] } };
            }

            case 'getApplication': {
                const appId = String(inputs.applicationId ?? '').trim();
                if (!appId) throw new Error('applicationId is required.');
                const data = await nrFetch('GET', `/applications/${encodeURIComponent(appId)}.json`);
                return { output: { application: data?.application ?? data } };
            }

            case 'getAppMetrics': {
                const appId = String(inputs.applicationId ?? '').trim();
                if (!appId) throw new Error('applicationId is required.');
                const params = new URLSearchParams();
                if (inputs.names) {
                    const names = Array.isArray(inputs.names) ? inputs.names : [inputs.names];
                    names.forEach((n: string) => params.append('names[]', n));
                }
                if (inputs.from) params.set('from', String(inputs.from));
                if (inputs.to) params.set('to', String(inputs.to));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await nrFetch('GET', `/applications/${encodeURIComponent(appId)}/metrics/data.json${qs}`);
                return { output: { metricData: data?.metric_data ?? data } };
            }

            case 'queryNrql': {
                const accountId = String(inputs.accountId ?? '').trim();
                const nrql = String(inputs.nrql ?? '').trim();
                if (!accountId) throw new Error('accountId is required.');
                if (!nrql) throw new Error('nrql is required.');
                const query = `{
                    actor {
                        account(id: ${accountId}) {
                            nrql(query: "${nrql.replace(/"/g, '\\"')}") {
                                results
                            }
                        }
                    }
                }`;
                const data = await nrGraphql(query);
                return { output: { results: data?.actor?.account?.nrql?.results ?? [] } };
            }

            case 'listAlertPolicies': {
                const data = await nrFetch('GET', '/alerts_policies.json');
                return { output: { policies: data?.policies ?? [] } };
            }

            case 'getAlertPolicy': {
                const policyId = String(inputs.policyId ?? '').trim();
                if (!policyId) throw new Error('policyId is required.');
                const data = await nrFetch('GET', `/alerts_policies/${encodeURIComponent(policyId)}.json`);
                return { output: { policy: data?.policy ?? data } };
            }

            case 'createAlertPolicy': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const body = {
                    policy: {
                        name,
                        incident_preference: inputs.incidentPreference ?? 'PER_POLICY',
                    },
                };
                const data = await nrFetch('POST', '/alerts_policies.json', body);
                return { output: { policy: data?.policy ?? data } };
            }

            case 'listAlertConditions': {
                const policyId = String(inputs.policyId ?? '').trim();
                if (!policyId) throw new Error('policyId is required.');
                const data = await nrFetch('GET', `/alerts_conditions.json?policy_id=${encodeURIComponent(policyId)}`);
                return { output: { conditions: data?.conditions ?? [] } };
            }

            case 'createAlertCondition': {
                const policyId = String(inputs.policyId ?? '').trim();
                const name = String(inputs.name ?? '').trim();
                if (!policyId) throw new Error('policyId is required.');
                if (!name) throw new Error('name is required.');
                const body = {
                    condition: {
                        type: inputs.type ?? 'apm_app_metric',
                        name,
                        enabled: inputs.enabled !== false,
                        entities: inputs.entities ?? [],
                        metric: inputs.metric ?? 'apdex',
                        terms: inputs.terms ?? [],
                    },
                };
                const data = await nrFetch('POST', `/alerts_conditions/policies/${encodeURIComponent(policyId)}.json`, body);
                return { output: { condition: data?.condition ?? data } };
            }

            case 'listDashboards': {
                const data = await nrGraphql(`{
                    actor {
                        entitySearch(query: "type = 'DASHBOARD'") {
                            results {
                                entities {
                                    guid
                                    name
                                    ... on DashboardEntityOutline { dashboardParentGuid }
                                }
                            }
                        }
                    }
                }`);
                return { output: { dashboards: data?.actor?.entitySearch?.results?.entities ?? [] } };
            }

            case 'getDashboard': {
                const guid = String(inputs.guid ?? '').trim();
                if (!guid) throw new Error('guid is required.');
                const data = await nrGraphql(`{
                    actor {
                        entity(guid: "${guid}") {
                            guid
                            name
                            ... on DashboardEntity {
                                pages {
                                    name
                                    widgets { id title }
                                }
                            }
                        }
                    }
                }`);
                return { output: { dashboard: data?.actor?.entity ?? {} } };
            }

            case 'createDashboard': {
                const accountId = String(inputs.accountId ?? '').trim();
                const name = String(inputs.name ?? '').trim();
                if (!accountId) throw new Error('accountId is required.');
                if (!name) throw new Error('name is required.');
                const query = `mutation CreateDashboard($accountId: Int!, $dashboard: DashboardInput!) {
                    dashboardCreate(accountId: $accountId, dashboard: $dashboard) {
                        entityResult { guid name }
                        errors { description }
                    }
                }`;
                const dashboard = {
                    name,
                    permissions: inputs.permissions ?? 'PUBLIC_READ_WRITE',
                    pages: inputs.pages ?? [],
                };
                const data = await nrGraphql(query, { accountId: Number(accountId), dashboard });
                return { output: { result: data?.dashboardCreate ?? data } };
            }

            case 'listDeployments': {
                const appId = String(inputs.applicationId ?? '').trim();
                if (!appId) throw new Error('applicationId is required.');
                const data = await nrFetch('GET', `/applications/${encodeURIComponent(appId)}/deployments.json`);
                return { output: { deployments: data?.deployments ?? [] } };
            }

            case 'createDeployment': {
                const appId = String(inputs.applicationId ?? '').trim();
                const revision = String(inputs.revision ?? '').trim();
                if (!appId) throw new Error('applicationId is required.');
                if (!revision) throw new Error('revision is required.');
                const body = {
                    deployment: {
                        revision,
                        description: inputs.description ?? '',
                        user: inputs.user ?? (user?.email ?? 'sabflow'),
                        changelog: inputs.changelog ?? '',
                    },
                };
                const data = await nrFetch('POST', `/applications/${encodeURIComponent(appId)}/deployments.json`, body);
                return { output: { deployment: data?.deployment ?? data } };
            }

            case 'getAccountSummary': {
                const accountId = String(inputs.accountId ?? '').trim();
                if (!accountId) throw new Error('accountId is required.');
                const data = await nrGraphql(`{
                    actor {
                        account(id: ${accountId}) {
                            name
                            id
                            nrql(query: "SELECT count(*) FROM Transaction SINCE 1 hour ago") {
                                results
                            }
                        }
                    }
                }`);
                return { output: { account: data?.actor?.account ?? {} } };
            }

            default:
                return { error: `New Relic Enhanced action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'New Relic Enhanced action failed.' };
    }
}
