'use server';

export async function executeArgoCdAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const baseUrl = `${inputs.argoUrl?.replace(/\/$/, '')}/api/v1`;
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${inputs.token}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listApplications': {
                const params = new URLSearchParams();
                if (inputs.project) params.set('project', inputs.project);
                if (inputs.namespace) params.set('appNamespace', inputs.namespace);
                if (inputs.repo) params.set('repo', inputs.repo);
                const res = await fetch(`${baseUrl}/applications?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'getApplication': {
                const params = new URLSearchParams();
                if (inputs.namespace) params.set('appNamespace', inputs.namespace);
                const res = await fetch(`${baseUrl}/applications/${inputs.appName}?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'createApplication': {
                const res = await fetch(`${baseUrl}/applications`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.application),
                });
                const data = await res.json();
                return { output: data };
            }

            case 'updateApplication': {
                const res = await fetch(`${baseUrl}/applications/${inputs.appName}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(inputs.application),
                });
                const data = await res.json();
                return { output: data };
            }

            case 'deleteApplication': {
                const params = new URLSearchParams();
                if (inputs.cascade !== undefined) params.set('cascade', String(inputs.cascade));
                if (inputs.namespace) params.set('appNamespace', inputs.namespace);
                const res = await fetch(`${baseUrl}/applications/${inputs.appName}?${params}`, {
                    method: 'DELETE',
                    headers,
                });
                const text = await res.text();
                return { output: { success: res.ok, status: res.status, body: text } };
            }

            case 'syncApplication': {
                const body: Record<string, any> = {};
                if (inputs.revision) body.revision = inputs.revision;
                if (inputs.resources) body.resources = inputs.resources;
                if (inputs.dryRun) body.dryRun = inputs.dryRun;
                if (inputs.prune) body.prune = inputs.prune;
                const res = await fetch(`${baseUrl}/applications/${inputs.appName}/sync`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: data };
            }

            case 'getApplicationStatus': {
                const params = new URLSearchParams();
                if (inputs.namespace) params.set('appNamespace', inputs.namespace);
                const res = await fetch(`${baseUrl}/applications/${inputs.appName}/resource-tree?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'rollbackApplication': {
                const body: Record<string, any> = {
                    id: inputs.historyId,
                };
                if (inputs.dryRun) body.dryRun = inputs.dryRun;
                if (inputs.prune) body.prune = inputs.prune;
                const res = await fetch(`${baseUrl}/applications/${inputs.appName}/rollback`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: data };
            }

            case 'listRepositories': {
                const params = new URLSearchParams();
                if (inputs.repo) params.set('repo', inputs.repo);
                const res = await fetch(`${baseUrl}/repositories?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'getRepository': {
                const encodedRepo = encodeURIComponent(inputs.repoUrl);
                const res = await fetch(`${baseUrl}/repositories/${encodedRepo}`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'createRepository': {
                const res = await fetch(`${baseUrl}/repositories`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        repo: inputs.repoUrl,
                        type: inputs.type ?? 'git',
                        name: inputs.name,
                        username: inputs.username,
                        password: inputs.password,
                        sshPrivateKey: inputs.sshPrivateKey,
                        insecure: inputs.insecure ?? false,
                    }),
                });
                const data = await res.json();
                return { output: data };
            }

            case 'deleteRepository': {
                const encodedRepo = encodeURIComponent(inputs.repoUrl);
                const res = await fetch(`${baseUrl}/repositories/${encodedRepo}`, {
                    method: 'DELETE',
                    headers,
                });
                const text = await res.text();
                return { output: { success: res.ok, status: res.status, body: text } };
            }

            case 'listClusters': {
                const params = new URLSearchParams();
                if (inputs.server) params.set('server', inputs.server);
                const res = await fetch(`${baseUrl}/clusters?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'getCluster': {
                const encodedServer = encodeURIComponent(inputs.server);
                const res = await fetch(`${baseUrl}/clusters/${encodedServer}`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'listProjects': {
                const params = new URLSearchParams();
                if (inputs.name) params.set('name', inputs.name);
                const res = await fetch(`${baseUrl}/projects?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }

            default:
                return { error: `Unknown Argo CD action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Argo CD action error: ${err.message}`);
        return { error: err.message };
    }
}
