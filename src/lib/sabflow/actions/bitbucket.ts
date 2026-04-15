'use server';

async function bitbucketFetch(
    bbUsername: string,
    appPassword: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
) {
    logger?.log(`[Bitbucket] ${method} ${path}`);
    const base64Auth = Buffer.from(`${bbUsername}:${appPassword}`).toString('base64');
    const url = `https://api.bitbucket.org/2.0${path}`;
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Basic ${base64Auth}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.error?.message || data?.message || `Bitbucket API error: ${res.status}`);
    }
    return data;
}

export async function executeBitbucketAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const bbUsername = String(inputs.username ?? '').trim();
        const appPassword = String(inputs.appPassword ?? '').trim();
        const workspace = String(inputs.workspace ?? '').trim();
        if (!bbUsername) throw new Error('username is required.');
        if (!appPassword) throw new Error('appPassword is required.');
        if (!workspace) throw new Error('workspace is required.');

        const bb = (method: string, path: string, body?: any) =>
            bitbucketFetch(bbUsername, appPassword, method, path, body, logger);

        switch (actionName) {
            case 'listRepos': {
                const data = await bb('GET', `/repositories/${workspace}`);
                const repos = data.values ?? [];
                return { output: { repos } };
            }

            case 'getRepo': {
                const repoSlug = String(inputs.repoSlug ?? '').trim();
                if (!repoSlug) throw new Error('repoSlug is required.');
                const data = await bb('GET', `/repositories/${workspace}/${repoSlug}`);
                return {
                    output: {
                        slug: data.slug ?? repoSlug,
                        name: data.name ?? '',
                        isPrivate: String(data.is_private ?? false),
                    },
                };
            }

            case 'createRepo': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const body: Record<string, any> = {
                    name,
                    is_private: inputs.isPrivate === true || inputs.isPrivate === 'true',
                    scm: String(inputs.scm ?? 'git'),
                };
                const data = await bb('POST', `/repositories/${workspace}/${name.toLowerCase().replace(/\s+/g, '-')}`, body);
                return { output: { slug: data.slug ?? '', name: data.name ?? name } };
            }

            case 'listBranches': {
                const repoSlug = String(inputs.repoSlug ?? '').trim();
                if (!repoSlug) throw new Error('repoSlug is required.');
                const data = await bb('GET', `/repositories/${workspace}/${repoSlug}/refs/branches`);
                const branches = data.values ?? [];
                return { output: { branches } };
            }

            case 'createBranch': {
                const repoSlug = String(inputs.repoSlug ?? '').trim();
                const branchName = String(inputs.branchName ?? '').trim();
                const targetHash = String(inputs.targetHash ?? '').trim();
                if (!repoSlug || !branchName || !targetHash) throw new Error('repoSlug, branchName, and targetHash are required.');
                const data = await bb('POST', `/repositories/${workspace}/${repoSlug}/refs/branches`, {
                    name: branchName,
                    target: { hash: targetHash },
                });
                return { output: { name: data.name ?? branchName } };
            }

            case 'listPullRequests': {
                const repoSlug = String(inputs.repoSlug ?? '').trim();
                if (!repoSlug) throw new Error('repoSlug is required.');
                const params = new URLSearchParams();
                if (inputs.state) params.set('state', String(inputs.state).toUpperCase());
                const data = await bb('GET', `/repositories/${workspace}/${repoSlug}/pullrequests?${params.toString()}`);
                const prs = data.values ?? [];
                return { output: { prs } };
            }

            case 'createPullRequest': {
                const repoSlug = String(inputs.repoSlug ?? '').trim();
                const title = String(inputs.title ?? '').trim();
                const sourceBranch = String(inputs.sourceBranch ?? '').trim();
                const destBranch = String(inputs.destBranch ?? '').trim();
                if (!repoSlug || !title || !sourceBranch || !destBranch) throw new Error('repoSlug, title, sourceBranch, and destBranch are required.');
                const body: Record<string, any> = {
                    title,
                    source: { branch: { name: sourceBranch } },
                    destination: { branch: { name: destBranch } },
                };
                if (inputs.description) body.description = String(inputs.description);
                const data = await bb('POST', `/repositories/${workspace}/${repoSlug}/pullrequests`, body);
                return { output: { id: String(data.id ?? ''), title: data.title ?? title } };
            }

            case 'getPullRequest': {
                const repoSlug = String(inputs.repoSlug ?? '').trim();
                const prId = String(inputs.prId ?? '').trim();
                if (!repoSlug || !prId) throw new Error('repoSlug and prId are required.');
                const data = await bb('GET', `/repositories/${workspace}/${repoSlug}/pullrequests/${prId}`);
                return {
                    output: {
                        id: String(data.id ?? prId),
                        title: data.title ?? '',
                        state: data.state ?? '',
                    },
                };
            }

            case 'mergePullRequest': {
                const repoSlug = String(inputs.repoSlug ?? '').trim();
                const prId = String(inputs.prId ?? '').trim();
                if (!repoSlug || !prId) throw new Error('repoSlug and prId are required.');
                const body: Record<string, any> = {};
                if (inputs.message) body.message = String(inputs.message);
                const data = await bb('POST', `/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/merge`, body);
                return { output: { state: data.state ?? 'MERGED' } };
            }

            case 'listCommits': {
                const repoSlug = String(inputs.repoSlug ?? '').trim();
                if (!repoSlug) throw new Error('repoSlug is required.');
                const params = new URLSearchParams();
                if (inputs.branch) params.set('include', String(inputs.branch));
                const data = await bb('GET', `/repositories/${workspace}/${repoSlug}/commits?${params.toString()}`);
                const commits = data.values ?? [];
                return { output: { commits } };
            }

            case 'createIssue': {
                const repoSlug = String(inputs.repoSlug ?? '').trim();
                const title = String(inputs.title ?? '').trim();
                if (!repoSlug || !title) throw new Error('repoSlug and title are required.');
                const body: Record<string, any> = { title };
                if (inputs.content) body.content = { raw: String(inputs.content) };
                const data = await bb('POST', `/repositories/${workspace}/${repoSlug}/issues`, body);
                return { output: { id: String(data.id ?? ''), title: data.title ?? title } };
            }

            case 'listIssues': {
                const repoSlug = String(inputs.repoSlug ?? '').trim();
                if (!repoSlug) throw new Error('repoSlug is required.');
                const data = await bb('GET', `/repositories/${workspace}/${repoSlug}/issues`);
                const issues = data.values ?? [];
                return { output: { issues } };
            }

            case 'addComment': {
                const repoSlug = String(inputs.repoSlug ?? '').trim();
                const prId = String(inputs.prId ?? '').trim();
                const content = String(inputs.content ?? '').trim();
                if (!repoSlug || !prId || !content) throw new Error('repoSlug, prId, and content are required.');
                const data = await bb('POST', `/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/comments`, {
                    content: { raw: content },
                });
                return { output: { id: String(data.id ?? '') } };
            }

            case 'getPipelineStatus': {
                const repoSlug = String(inputs.repoSlug ?? '').trim();
                if (!repoSlug) throw new Error('repoSlug is required.');
                const data = await bb('GET', `/repositories/${workspace}/${repoSlug}/pipelines/`);
                const pipelines = data.values ?? [];
                return { output: { pipelines } };
            }

            default:
                return { error: `Bitbucket action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Bitbucket action failed.' };
    }
}
