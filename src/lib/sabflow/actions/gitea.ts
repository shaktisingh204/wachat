'use server';

export async function executeGiteaAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const baseUrl = (inputs.baseUrl || 'https://gitea.com').replace(/\/$/, '');
        const apiBase = `${baseUrl}/api/v1`;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (inputs.token) {
            headers['Authorization'] = `token ${inputs.token}`;
        } else if (inputs.username && inputs.password) {
            const credentials = Buffer.from(`${inputs.username}:${inputs.password}`).toString('base64');
            headers['Authorization'] = `Basic ${credentials}`;
        }

        const owner = inputs.owner;
        const repo = inputs.repo;

        switch (actionName) {
            case 'listRepositories': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.page) params.set('page', String(inputs.page));
                const res = await fetch(`${apiBase}/repos/search?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getRepository': {
                const res = await fetch(`${apiBase}/repos/${owner}/${repo}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'createRepository': {
                const res = await fetch(`${apiBase}/user/repos`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        name: inputs.name,
                        description: inputs.description,
                        private: inputs.private ?? true,
                        auto_init: inputs.autoInit ?? true,
                        default_branch: inputs.defaultBranch || 'main',
                    }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'listBranches': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.page) params.set('page', String(inputs.page));
                const res = await fetch(`${apiBase}/repos/${owner}/${repo}/branches?${params}`, { headers });
                const data = await res.json();
                return { output: { branches: data } };
            }
            case 'createBranch': {
                const res = await fetch(`${apiBase}/repos/${owner}/${repo}/branches`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        new_branch_name: inputs.branchName,
                        old_branch_name: inputs.fromBranch || 'main',
                    }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'listIssues': {
                const params = new URLSearchParams();
                if (inputs.state) params.set('state', inputs.state || 'open');
                if (inputs.type) params.set('type', inputs.type || 'issues');
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.page) params.set('page', String(inputs.page));
                const res = await fetch(`${apiBase}/repos/${owner}/${repo}/issues?${params}`, { headers });
                const data = await res.json();
                return { output: { issues: data } };
            }
            case 'createIssue': {
                const res = await fetch(`${apiBase}/repos/${owner}/${repo}/issues`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        title: inputs.title,
                        body: inputs.body,
                        assignees: inputs.assignees,
                        labels: inputs.labels,
                        milestone: inputs.milestone,
                        due_date: inputs.dueDate,
                    }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'updateIssue': {
                const issueIndex = inputs.issueIndex;
                const res = await fetch(`${apiBase}/repos/${owner}/${repo}/issues/${issueIndex}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify({
                        title: inputs.title,
                        body: inputs.body,
                        state: inputs.state,
                        assignees: inputs.assignees,
                    }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'listPullRequests': {
                const params = new URLSearchParams();
                if (inputs.state) params.set('state', inputs.state || 'open');
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.page) params.set('page', String(inputs.page));
                const res = await fetch(`${apiBase}/repos/${owner}/${repo}/pulls?${params}`, { headers });
                const data = await res.json();
                return { output: { pullRequests: data } };
            }
            case 'createPullRequest': {
                const res = await fetch(`${apiBase}/repos/${owner}/${repo}/pulls`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        title: inputs.title,
                        body: inputs.body,
                        head: inputs.head,
                        base: inputs.base || 'main',
                        assignees: inputs.assignees,
                        labels: inputs.labels,
                    }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'mergePR': {
                const prIndex = inputs.prIndex;
                const res = await fetch(`${apiBase}/repos/${owner}/${repo}/pulls/${prIndex}/merge`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        Do: inputs.mergeStyle || 'merge',
                        merge_message_field: inputs.message,
                        delete_branch_after_merge: inputs.deleteBranchAfterMerge ?? false,
                    }),
                });
                if (res.status === 204) return { output: { success: true, merged: true } };
                const data = await res.json();
                return { output: data };
            }
            case 'listReleases': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.page) params.set('page', String(inputs.page));
                const res = await fetch(`${apiBase}/repos/${owner}/${repo}/releases?${params}`, { headers });
                const data = await res.json();
                return { output: { releases: data } };
            }
            case 'createRelease': {
                const res = await fetch(`${apiBase}/repos/${owner}/${repo}/releases`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        tag_name: inputs.tagName,
                        name: inputs.name,
                        body: inputs.body,
                        target_commitish: inputs.targetCommitish || 'main',
                        draft: inputs.draft ?? false,
                        prerelease: inputs.prerelease ?? false,
                    }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'getFile': {
                const filePath = encodeURIComponent(inputs.filePath);
                const ref = inputs.ref || 'main';
                const res = await fetch(`${apiBase}/repos/${owner}/${repo}/contents/${filePath}?ref=${ref}`, { headers });
                const data = await res.json();
                if (data.content) {
                    data.decodedContent = Buffer.from(data.content, 'base64').toString('utf-8');
                }
                return { output: data };
            }
            case 'updateFile': {
                const filePath = encodeURIComponent(inputs.filePath);
                const res = await fetch(`${apiBase}/repos/${owner}/${repo}/contents/${filePath}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({
                        message: inputs.message,
                        content: Buffer.from(inputs.content || '').toString('base64'),
                        sha: inputs.sha,
                        branch: inputs.branch || 'main',
                    }),
                });
                const data = await res.json();
                return { output: data };
            }
            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Gitea action error: ${err.message}`);
        return { error: err.message };
    }
}
