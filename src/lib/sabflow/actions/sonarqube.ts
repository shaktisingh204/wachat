'use server';

export async function executeSonarQubeAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const baseUrl = (inputs.baseUrl || 'https://sonarcloud.io').replace(/\/$/, '');
        const apiBase = `${baseUrl}/api`;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (inputs.bearerToken) {
            headers['Authorization'] = `Bearer ${inputs.bearerToken}`;
        } else if (inputs.token) {
            const credentials = Buffer.from(`${inputs.token}:`).toString('base64');
            headers['Authorization'] = `Basic ${credentials}`;
        }

        switch (actionName) {
            case 'searchProjects': {
                const params = new URLSearchParams();
                if (inputs.organization) params.set('organization', inputs.organization);
                if (inputs.q) params.set('q', inputs.q);
                if (inputs.ps) params.set('ps', String(inputs.ps));
                if (inputs.p) params.set('p', String(inputs.p));
                const res = await fetch(`${apiBase}/projects/search?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getProject': {
                const params = new URLSearchParams();
                params.set('component', inputs.projectKey);
                const res = await fetch(`${apiBase}/components/show?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'createProject': {
                const params = new URLSearchParams();
                params.set('name', inputs.name);
                params.set('project', inputs.projectKey);
                if (inputs.organization) params.set('organization', inputs.organization);
                if (inputs.visibility) params.set('visibility', inputs.visibility);
                const res = await fetch(`${apiBase}/projects/create`, {
                    method: 'POST',
                    headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: params.toString(),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'deleteProject': {
                const params = new URLSearchParams();
                params.set('project', inputs.projectKey);
                const res = await fetch(`${apiBase}/projects/delete`, {
                    method: 'POST',
                    headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: params.toString(),
                });
                if (res.status === 204) return { output: { success: true, deleted: true } };
                const data = await res.json();
                return { output: data };
            }
            case 'searchIssues': {
                const params = new URLSearchParams();
                if (inputs.componentKeys) params.set('componentKeys', inputs.componentKeys);
                if (inputs.types) params.set('types', inputs.types);
                if (inputs.severities) params.set('severities', inputs.severities);
                if (inputs.statuses) params.set('statuses', inputs.statuses);
                if (inputs.ps) params.set('ps', String(inputs.ps));
                if (inputs.p) params.set('p', String(inputs.p));
                const res = await fetch(`${apiBase}/issues/search?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getIssue': {
                const params = new URLSearchParams();
                params.set('issues', inputs.issueKey);
                const res = await fetch(`${apiBase}/issues/search?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getProjectMeasures': {
                const params = new URLSearchParams();
                params.set('component', inputs.projectKey);
                params.set('metricKeys', inputs.metricKeys || 'coverage,bugs,vulnerabilities,code_smells,duplicated_lines_density');
                const res = await fetch(`${apiBase}/measures/component?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getComponentMeasures': {
                const params = new URLSearchParams();
                params.set('component', inputs.component);
                params.set('metricKeys', inputs.metricKeys);
                if (inputs.branch) params.set('branch', inputs.branch);
                if (inputs.pullRequest) params.set('pullRequest', inputs.pullRequest);
                const res = await fetch(`${apiBase}/measures/component?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getQualityGate': {
                const params = new URLSearchParams();
                params.set('projectKey', inputs.projectKey);
                const res = await fetch(`${apiBase}/qualitygates/get_by_project?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'listQualityGates': {
                const res = await fetch(`${apiBase}/qualitygates/list`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'assignQualityGate': {
                const params = new URLSearchParams();
                params.set('gateId', String(inputs.gateId));
                params.set('projectKey', inputs.projectKey);
                const res = await fetch(`${apiBase}/qualitygates/select`, {
                    method: 'POST',
                    headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: params.toString(),
                });
                if (res.status === 204) return { output: { success: true } };
                const data = await res.json();
                return { output: data };
            }
            case 'searchUsers': {
                const params = new URLSearchParams();
                if (inputs.q) params.set('q', inputs.q);
                if (inputs.ps) params.set('ps', String(inputs.ps));
                if (inputs.p) params.set('p', String(inputs.p));
                const res = await fetch(`${apiBase}/users/search?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getUser': {
                const params = new URLSearchParams();
                params.set('login', inputs.login);
                const res = await fetch(`${apiBase}/users/search?${params}`, { headers });
                const data = await res.json();
                const userRecord = data.users?.find((u: any) => u.login === inputs.login);
                return { output: { user: userRecord || data } };
            }
            case 'listWebhooks': {
                const params = new URLSearchParams();
                if (inputs.project) params.set('project', inputs.project);
                if (inputs.organization) params.set('organization', inputs.organization);
                const res = await fetch(`${apiBase}/webhooks/list?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'createWebhook': {
                const params = new URLSearchParams();
                params.set('name', inputs.name);
                params.set('url', inputs.url);
                if (inputs.project) params.set('project', inputs.project);
                if (inputs.organization) params.set('organization', inputs.organization);
                if (inputs.secret) params.set('secret', inputs.secret);
                const res = await fetch(`${apiBase}/webhooks/create`, {
                    method: 'POST',
                    headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: params.toString(),
                });
                const data = await res.json();
                return { output: data };
            }
            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`SonarQube action error: ${err.message}`);
        return { error: err.message };
    }
}
