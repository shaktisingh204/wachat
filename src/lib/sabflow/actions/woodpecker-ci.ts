'use server';

export async function executeWoodpeckerCiAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const baseUrl = `${inputs.woodpeckerUrl?.replace(/\/$/, '')}/api`;
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${inputs.token}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listRepos': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('perPage', String(inputs.perPage));
                if (inputs.all) params.set('all', String(inputs.all));
                const res = await fetch(`${baseUrl}/repos?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'getRepo': {
                const res = await fetch(`${baseUrl}/repos/${inputs.owner}/${inputs.repo}`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'enableRepo': {
                const res = await fetch(`${baseUrl}/repos/${inputs.owner}/${inputs.repo}`, {
                    method: 'POST',
                    headers,
                });
                const data = await res.json();
                return { output: data };
            }

            case 'disableRepo': {
                const res = await fetch(`${baseUrl}/repos/${inputs.owner}/${inputs.repo}`, {
                    method: 'DELETE',
                    headers,
                });
                const text = await res.text();
                return { output: { success: res.ok, status: res.status, body: text } };
            }

            case 'repairRepo': {
                const res = await fetch(`${baseUrl}/repos/${inputs.owner}/${inputs.repo}/repair`, {
                    method: 'POST',
                    headers,
                });
                const text = await res.text();
                return { output: { success: res.ok, status: res.status, body: text } };
            }

            case 'listPipelines': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('perPage', String(inputs.perPage));
                const res = await fetch(`${baseUrl}/repos/${inputs.owner}/${inputs.repo}/pipelines?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'getPipeline': {
                const res = await fetch(`${baseUrl}/repos/${inputs.owner}/${inputs.repo}/pipelines/${inputs.pipelineNumber}`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'createPipeline': {
                const body: Record<string, any> = {};
                if (inputs.branch) body.branch = inputs.branch;
                if (inputs.commit) body.commit = inputs.commit;
                if (inputs.variables) body.variables = inputs.variables;
                const res = await fetch(`${baseUrl}/repos/${inputs.owner}/${inputs.repo}/pipelines`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: data };
            }

            case 'cancelPipeline': {
                const res = await fetch(`${baseUrl}/repos/${inputs.owner}/${inputs.repo}/pipelines/${inputs.pipelineNumber}/cancel`, {
                    method: 'POST',
                    headers,
                });
                const text = await res.text();
                return { output: { success: res.ok, status: res.status, body: text } };
            }

            case 'restartPipeline': {
                const res = await fetch(`${baseUrl}/repos/${inputs.owner}/${inputs.repo}/pipelines/${inputs.pipelineNumber}/restart`, {
                    method: 'POST',
                    headers,
                });
                const data = await res.json();
                return { output: data };
            }

            case 'listPipelineLogs': {
                const res = await fetch(`${baseUrl}/repos/${inputs.owner}/${inputs.repo}/pipelines/${inputs.pipelineNumber}/logs`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'listCrons': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                const res = await fetch(`${baseUrl}/repos/${inputs.owner}/${inputs.repo}/cron?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'createCron': {
                const body: Record<string, any> = {
                    name: inputs.name,
                    schedule: inputs.schedule,
                };
                if (inputs.branch) body.branch = inputs.branch;
                const res = await fetch(`${baseUrl}/repos/${inputs.owner}/${inputs.repo}/cron`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: data };
            }

            case 'deleteCron': {
                const res = await fetch(`${baseUrl}/repos/${inputs.owner}/${inputs.repo}/cron/${inputs.cronId}`, {
                    method: 'DELETE',
                    headers,
                });
                const text = await res.text();
                return { output: { success: res.ok, status: res.status, body: text } };
            }

            case 'getOrg': {
                const res = await fetch(`${baseUrl}/orgs/${inputs.orgName}`, { headers });
                const data = await res.json();
                return { output: data };
            }

            default:
                return { error: `Unknown Woodpecker CI action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Woodpecker CI action error: ${err.message}`);
        return { error: err.message };
    }
}
