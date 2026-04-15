'use server';

export async function executeCodecovAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiBase = 'https://api.codecov.io/api/v2';
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${inputs.token}`,
        };

        const service = inputs.service || 'github';
        const ownerUsername = inputs.ownerUsername;
        const repoName = inputs.repoName;

        switch (actionName) {
            case 'getOwner': {
                const res = await fetch(`${apiBase}/${service}/${ownerUsername}/`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'listRepositories': {
                const params = new URLSearchParams();
                if (inputs.active) params.set('active', 'true');
                if (inputs.names) params.set('names', inputs.names);
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.pageSize) params.set('page_size', String(inputs.pageSize));
                const res = await fetch(`${apiBase}/${service}/${ownerUsername}/repos/?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getRepository': {
                const res = await fetch(`${apiBase}/${service}/${ownerUsername}/repos/${repoName}/`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'listCommits': {
                const params = new URLSearchParams();
                if (inputs.branch) params.set('branch', inputs.branch);
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.pageSize) params.set('page_size', String(inputs.pageSize));
                const res = await fetch(`${apiBase}/${service}/${ownerUsername}/repos/${repoName}/commits/?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getCommit': {
                const commitId = inputs.commitId;
                const res = await fetch(`${apiBase}/${service}/${ownerUsername}/repos/${repoName}/commits/${commitId}/`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'listBranches': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.pageSize) params.set('page_size', String(inputs.pageSize));
                const res = await fetch(`${apiBase}/${service}/${ownerUsername}/repos/${repoName}/branches/?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getBranch': {
                const branchName = encodeURIComponent(inputs.branchName);
                const res = await fetch(`${apiBase}/${service}/${ownerUsername}/repos/${repoName}/branches/${branchName}/`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'listPullRequests': {
                const params = new URLSearchParams();
                if (inputs.state) params.set('state', inputs.state);
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.pageSize) params.set('page_size', String(inputs.pageSize));
                const res = await fetch(`${apiBase}/${service}/${ownerUsername}/repos/${repoName}/pulls/?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getPullRequest': {
                const pullId = inputs.pullId;
                const res = await fetch(`${apiBase}/${service}/${ownerUsername}/repos/${repoName}/pulls/${pullId}/`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'listFlags': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.pageSize) params.set('page_size', String(inputs.pageSize));
                const res = await fetch(`${apiBase}/${service}/${ownerUsername}/repos/${repoName}/flags/?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getFlag': {
                const flagName = inputs.flagName;
                const res = await fetch(`${apiBase}/${service}/${ownerUsername}/repos/${repoName}/flags/${flagName}/`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getComparisons': {
                const params = new URLSearchParams();
                params.set('pullid', String(inputs.pullId || ''));
                if (inputs.base) params.set('base', inputs.base);
                if (inputs.head) params.set('head', inputs.head);
                const res = await fetch(`${apiBase}/${service}/${ownerUsername}/repos/${repoName}/compare/?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getCoverage': {
                const params = new URLSearchParams();
                if (inputs.branch) params.set('branch', inputs.branch);
                if (inputs.start_date) params.set('start_date', inputs.start_date);
                if (inputs.end_date) params.set('end_date', inputs.end_date);
                const res = await fetch(`${apiBase}/${service}/${ownerUsername}/repos/${repoName}/coverage/?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'listComponents': {
                const params = new URLSearchParams();
                if (inputs.branch) params.set('branch', inputs.branch);
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.pageSize) params.set('page_size', String(inputs.pageSize));
                const res = await fetch(`${apiBase}/${service}/${ownerUsername}/repos/${repoName}/components/?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getComponent': {
                const componentId = inputs.componentId;
                const params = new URLSearchParams();
                if (inputs.branch) params.set('branch', inputs.branch);
                const res = await fetch(`${apiBase}/${service}/${ownerUsername}/repos/${repoName}/components/${componentId}/?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Codecov action error: ${err.message}`);
        return { error: err.message };
    }
}
