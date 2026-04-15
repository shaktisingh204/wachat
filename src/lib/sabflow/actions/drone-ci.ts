'use server';

export async function executeDroneCiAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const baseUrl = inputs.droneUrl?.replace(/\/$/, '');
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${inputs.token}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listRepos': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.per_page) params.set('per_page', String(inputs.per_page));
                const res = await fetch(`${baseUrl}/api/user/repos?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'getRepo': {
                const res = await fetch(`${baseUrl}/api/repos/${inputs.owner}/${inputs.repo}`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'enableRepo': {
                const res = await fetch(`${baseUrl}/api/repos/${inputs.owner}/${inputs.repo}`, {
                    method: 'POST',
                    headers,
                });
                const data = await res.json();
                return { output: data };
            }

            case 'disableRepo': {
                const res = await fetch(`${baseUrl}/api/repos/${inputs.owner}/${inputs.repo}`, {
                    method: 'DELETE',
                    headers,
                });
                const text = await res.text();
                return { output: { success: res.ok, status: res.status, body: text } };
            }

            case 'listBuilds': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.per_page) params.set('per_page', String(inputs.per_page));
                const res = await fetch(`${baseUrl}/api/repos/${inputs.owner}/${inputs.repo}/builds?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'getBuild': {
                const res = await fetch(`${baseUrl}/api/repos/${inputs.owner}/${inputs.repo}/builds/${inputs.buildNumber}`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'createBuild': {
                const params = new URLSearchParams();
                if (inputs.branch) params.set('branch', inputs.branch);
                if (inputs.commit) params.set('commit', inputs.commit);
                const res = await fetch(`${baseUrl}/api/repos/${inputs.owner}/${inputs.repo}/builds?${params}`, {
                    method: 'POST',
                    headers,
                });
                const data = await res.json();
                return { output: data };
            }

            case 'cancelBuild': {
                const res = await fetch(`${baseUrl}/api/repos/${inputs.owner}/${inputs.repo}/builds/${inputs.buildNumber}`, {
                    method: 'DELETE',
                    headers,
                });
                const text = await res.text();
                return { output: { success: res.ok, status: res.status, body: text } };
            }

            case 'restartBuild': {
                const res = await fetch(`${baseUrl}/api/repos/${inputs.owner}/${inputs.repo}/builds/${inputs.buildNumber}`, {
                    method: 'POST',
                    headers,
                });
                const data = await res.json();
                return { output: data };
            }

            case 'listBuildLogs': {
                const res = await fetch(`${baseUrl}/api/repos/${inputs.owner}/${inputs.repo}/builds/${inputs.buildNumber}/logs`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'listCrons': {
                const res = await fetch(`${baseUrl}/api/repos/${inputs.owner}/${inputs.repo}/cron`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'getCron': {
                const res = await fetch(`${baseUrl}/api/repos/${inputs.owner}/${inputs.repo}/cron/${inputs.cronName}`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'createCron': {
                const body: Record<string, any> = {
                    name: inputs.name,
                    expr: inputs.expr,
                };
                if (inputs.branch) body.branch = inputs.branch;
                const res = await fetch(`${baseUrl}/api/repos/${inputs.owner}/${inputs.repo}/cron`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: data };
            }

            case 'updateCron': {
                const body: Record<string, any> = {};
                if (inputs.expr) body.expr = inputs.expr;
                if (inputs.branch) body.branch = inputs.branch;
                const res = await fetch(`${baseUrl}/api/repos/${inputs.owner}/${inputs.repo}/cron/${inputs.cronName}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: data };
            }

            case 'deleteCron': {
                const res = await fetch(`${baseUrl}/api/repos/${inputs.owner}/${inputs.repo}/cron/${inputs.cronName}`, {
                    method: 'DELETE',
                    headers,
                });
                const text = await res.text();
                return { output: { success: res.ok, status: res.status, body: text } };
            }

            default:
                return { error: `Unknown Drone CI action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Drone CI action error: ${err.message}`);
        return { error: err.message };
    }
}
