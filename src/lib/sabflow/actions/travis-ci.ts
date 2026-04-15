'use server';

export async function executeTravisCiAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const baseUrl = 'https://api.travis-ci.com';
        const headers: Record<string, string> = {
            'Travis-API-Version': '3',
            'Authorization': `token ${inputs.apiToken}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listBuilds': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                if (inputs.repoSlug) {
                    const res = await fetch(`${baseUrl}/repo/${encodeURIComponent(inputs.repoSlug)}/builds?${params}`, { headers });
                    const data = await res.json();
                    return { output: data };
                }
                const res = await fetch(`${baseUrl}/builds?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'getBuild': {
                const res = await fetch(`${baseUrl}/build/${inputs.buildId}`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'restartBuild': {
                const res = await fetch(`${baseUrl}/build/${inputs.buildId}/restart`, {
                    method: 'POST',
                    headers,
                });
                const data = await res.json();
                return { output: data };
            }

            case 'cancelBuild': {
                const res = await fetch(`${baseUrl}/build/${inputs.buildId}/cancel`, {
                    method: 'POST',
                    headers,
                });
                const data = await res.json();
                return { output: data };
            }

            case 'listJobs': {
                const res = await fetch(`${baseUrl}/build/${inputs.buildId}/jobs`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'getJob': {
                const res = await fetch(`${baseUrl}/job/${inputs.jobId}`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'cancelJob': {
                const res = await fetch(`${baseUrl}/job/${inputs.jobId}/cancel`, {
                    method: 'POST',
                    headers,
                });
                const data = await res.json();
                return { output: data };
            }

            case 'listRepositories': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                const res = await fetch(`${baseUrl}/repos?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'getRepository': {
                const slug = encodeURIComponent(inputs.repoSlug);
                const res = await fetch(`${baseUrl}/repo/${slug}`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'listBranches': {
                const slug = encodeURIComponent(inputs.repoSlug);
                const res = await fetch(`${baseUrl}/repo/${slug}/branches`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'getBranch': {
                const slug = encodeURIComponent(inputs.repoSlug);
                const res = await fetch(`${baseUrl}/repo/${slug}/branch/${inputs.branchName}`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'listRequests': {
                const slug = encodeURIComponent(inputs.repoSlug);
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const res = await fetch(`${baseUrl}/repo/${slug}/requests?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'createRequest': {
                const slug = encodeURIComponent(inputs.repoSlug);
                const res = await fetch(`${baseUrl}/repo/${slug}/requests`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ request: { branch: inputs.branch, message: inputs.message } }),
                });
                const data = await res.json();
                return { output: data };
            }

            case 'getUser': {
                const res = await fetch(`${baseUrl}/user`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'listEnvVars': {
                const slug = encodeURIComponent(inputs.repoSlug);
                const res = await fetch(`${baseUrl}/repo/${slug}/env_vars`, { headers });
                const data = await res.json();
                return { output: data };
            }

            default:
                return { error: `Unknown Travis CI action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Travis CI action error: ${err.message}`);
        return { error: err.message };
    }
}
