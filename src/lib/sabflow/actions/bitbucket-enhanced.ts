'use server';

export async function executeBitbucketEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiBase = 'https://api.bitbucket.org/2.0';
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (inputs.accessToken) {
            headers['Authorization'] = `Bearer ${inputs.accessToken}`;
        } else if (inputs.username && inputs.appPassword) {
            const credentials = Buffer.from(`${inputs.username}:${inputs.appPassword}`).toString('base64');
            headers['Authorization'] = `Basic ${credentials}`;
        }

        const workspace = inputs.workspace;
        const repoSlug = inputs.repoSlug;

        switch (actionName) {
            case 'listRepositories': {
                const params = new URLSearchParams();
                if (inputs.pagelen) params.set('pagelen', String(inputs.pagelen));
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.q) params.set('q', inputs.q);
                const res = await fetch(`${apiBase}/repositories/${workspace}?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getRepository': {
                const res = await fetch(`${apiBase}/repositories/${workspace}/${repoSlug}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'createRepository': {
                const res = await fetch(`${apiBase}/repositories/${workspace}/${inputs.name}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        scm: inputs.scm || 'git',
                        is_private: inputs.isPrivate ?? true,
                        project: inputs.project ? { key: inputs.project } : undefined,
                        description: inputs.description,
                    }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'listBranches': {
                const params = new URLSearchParams();
                if (inputs.pagelen) params.set('pagelen', String(inputs.pagelen));
                if (inputs.page) params.set('page', String(inputs.page));
                const res = await fetch(`${apiBase}/repositories/${workspace}/${repoSlug}/refs/branches?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'createBranch': {
                const res = await fetch(`${apiBase}/repositories/${workspace}/${repoSlug}/refs/branches`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        name: inputs.branchName,
                        target: { hash: inputs.targetHash || inputs.targetBranch || 'main' },
                    }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'listPullRequests': {
                const params = new URLSearchParams();
                if (inputs.state) params.set('state', inputs.state);
                if (inputs.pagelen) params.set('pagelen', String(inputs.pagelen));
                if (inputs.page) params.set('page', String(inputs.page));
                const res = await fetch(`${apiBase}/repositories/${workspace}/${repoSlug}/pullrequests?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getPullRequest': {
                const prId = inputs.prId;
                const res = await fetch(`${apiBase}/repositories/${workspace}/${repoSlug}/pullrequests/${prId}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'createPullRequest': {
                const res = await fetch(`${apiBase}/repositories/${workspace}/${repoSlug}/pullrequests`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        title: inputs.title,
                        description: inputs.description,
                        source: { branch: { name: inputs.sourceBranch } },
                        destination: { branch: { name: inputs.destinationBranch || 'main' } },
                        reviewers: inputs.reviewers ? inputs.reviewers.map((r: string) => ({ uuid: r })) : [],
                        close_source_branch: inputs.closeSourceBranch ?? false,
                    }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'mergePullRequest': {
                const prId = inputs.prId;
                const res = await fetch(`${apiBase}/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/merge`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        type: 'pullrequest',
                        message: inputs.message,
                        merge_strategy: inputs.mergeStrategy || 'merge_commit',
                        close_source_branch: inputs.closeSourceBranch ?? false,
                    }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'declinePullRequest': {
                const prId = inputs.prId;
                const res = await fetch(`${apiBase}/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/decline`, {
                    method: 'POST',
                    headers,
                });
                const data = await res.json();
                return { output: data };
            }
            case 'listIssues': {
                const params = new URLSearchParams();
                if (inputs.status) params.set('status', inputs.status);
                if (inputs.pagelen) params.set('pagelen', String(inputs.pagelen));
                if (inputs.page) params.set('page', String(inputs.page));
                const res = await fetch(`${apiBase}/repositories/${workspace}/${repoSlug}/issues?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'createIssue': {
                const res = await fetch(`${apiBase}/repositories/${workspace}/${repoSlug}/issues`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        title: inputs.title,
                        content: inputs.content ? { raw: inputs.content } : undefined,
                        priority: inputs.priority || 'major',
                        kind: inputs.kind || 'bug',
                        assignee: inputs.assignee ? { uuid: inputs.assignee } : undefined,
                    }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'updateIssue': {
                const issueId = inputs.issueId;
                const res = await fetch(`${apiBase}/repositories/${workspace}/${repoSlug}/issues/${issueId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({
                        title: inputs.title,
                        content: inputs.content ? { raw: inputs.content } : undefined,
                        status: inputs.status,
                        priority: inputs.priority,
                        kind: inputs.kind,
                    }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'listPipelines': {
                const params = new URLSearchParams();
                if (inputs.pagelen) params.set('pagelen', String(inputs.pagelen));
                if (inputs.page) params.set('page', String(inputs.page));
                const res = await fetch(`${apiBase}/repositories/${workspace}/${repoSlug}/pipelines/?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'triggerPipeline': {
                const res = await fetch(`${apiBase}/repositories/${workspace}/${repoSlug}/pipelines/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        target: {
                            ref_type: inputs.refType || 'branch',
                            type: 'pipeline_ref_target',
                            ref_name: inputs.refName || 'main',
                        },
                        variables: inputs.variables,
                    }),
                });
                const data = await res.json();
                return { output: data };
            }
            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Bitbucket Enhanced action error: ${err.message}`);
        return { error: err.message };
    }
}
