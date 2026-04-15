
'use server';

const GITHUB_BASE = 'https://api.github.com';

async function githubFetch(token: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[GitHub] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${GITHUB_BASE}${path}`, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || `GitHub API error: ${res.status}`);
    }
    return data;
}

export async function executeGithubAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const token = String(inputs.token ?? '').trim();
        if (!token) throw new Error('token is required.');
        const gh = (method: string, path: string, body?: any) => githubFetch(token, method, path, body, logger);

        switch (actionName) {
            case 'createIssue': {
                const owner = String(inputs.owner ?? '').trim();
                const repo = String(inputs.repo ?? '').trim();
                const title = String(inputs.title ?? '').trim();
                const body = String(inputs.body ?? '').trim();
                const labels = inputs.labels;
                if (!owner || !repo || !title) throw new Error('owner, repo, and title are required.');
                const labelArr = Array.isArray(labels) ? labels : (typeof labels === 'string' && labels ? labels.split(',').map((l: string) => l.trim()) : []);
                const data = await gh('POST', `/repos/${owner}/${repo}/issues`, { title, body: body || undefined, labels: labelArr });
                return { output: { id: String(data.number), url: data.html_url, title: data.title } };
            }

            case 'getIssue': {
                const owner = String(inputs.owner ?? '').trim();
                const repo = String(inputs.repo ?? '').trim();
                const issueNumber = String(inputs.issueNumber ?? '').trim();
                if (!owner || !repo || !issueNumber) throw new Error('owner, repo, and issueNumber are required.');
                const data = await gh('GET', `/repos/${owner}/${repo}/issues/${issueNumber}`);
                return { output: { id: String(data.number), title: data.title, state: data.state, url: data.html_url, body: data.body ?? '' } };
            }

            case 'closeIssue': {
                const owner = String(inputs.owner ?? '').trim();
                const repo = String(inputs.repo ?? '').trim();
                const issueNumber = String(inputs.issueNumber ?? '').trim();
                if (!owner || !repo || !issueNumber) throw new Error('owner, repo, and issueNumber are required.');
                const data = await gh('PATCH', `/repos/${owner}/${repo}/issues/${issueNumber}`, { state: 'closed' });
                return { output: { state: data.state, url: data.html_url } };
            }

            case 'addIssueComment': {
                const owner = String(inputs.owner ?? '').trim();
                const repo = String(inputs.repo ?? '').trim();
                const issueNumber = String(inputs.issueNumber ?? '').trim();
                const body = String(inputs.body ?? '').trim();
                if (!owner || !repo || !issueNumber || !body) throw new Error('owner, repo, issueNumber, and body are required.');
                const data = await gh('POST', `/repos/${owner}/${repo}/issues/${issueNumber}/comments`, { body });
                return { output: { id: String(data.id), url: data.html_url } };
            }

            case 'createPullRequest': {
                const owner = String(inputs.owner ?? '').trim();
                const repo = String(inputs.repo ?? '').trim();
                const title = String(inputs.title ?? '').trim();
                const head = String(inputs.head ?? '').trim();
                const base = String(inputs.base ?? '').trim();
                const body = String(inputs.body ?? '').trim();
                if (!owner || !repo || !title || !head || !base) throw new Error('owner, repo, title, head, and base are required.');
                const data = await gh('POST', `/repos/${owner}/${repo}/pulls`, { title, head, base, body: body || undefined });
                return { output: { id: String(data.number), url: data.html_url, state: data.state } };
            }

            case 'mergePullRequest': {
                const owner = String(inputs.owner ?? '').trim();
                const repo = String(inputs.repo ?? '').trim();
                const prNumber = String(inputs.prNumber ?? '').trim();
                if (!owner || !repo || !prNumber) throw new Error('owner, repo, and prNumber are required.');
                const data = await gh('PUT', `/repos/${owner}/${repo}/pulls/${prNumber}/merge`, { merge_method: 'merge' });
                return { output: { merged: String(data.merged ?? false), sha: data.sha ?? '' } };
            }

            case 'createRelease': {
                const owner = String(inputs.owner ?? '').trim();
                const repo = String(inputs.repo ?? '').trim();
                const tagName = String(inputs.tagName ?? '').trim();
                const name = String(inputs.name ?? '').trim();
                const body = String(inputs.body ?? '').trim();
                const draft = inputs.draft === true || inputs.draft === 'true';
                if (!owner || !repo || !tagName) throw new Error('owner, repo, and tagName are required.');
                const data = await gh('POST', `/repos/${owner}/${repo}/releases`, { tag_name: tagName, name: name || tagName, body: body || undefined, draft });
                return { output: { id: String(data.id), url: data.html_url, tagName: data.tag_name } };
            }

            case 'getRepo': {
                const owner = String(inputs.owner ?? '').trim();
                const repo = String(inputs.repo ?? '').trim();
                if (!owner || !repo) throw new Error('owner and repo are required.');
                const data = await gh('GET', `/repos/${owner}/${repo}`);
                return { output: { id: String(data.id), fullName: data.full_name, url: data.html_url, description: data.description ?? '', stars: String(data.stargazers_count), forks: String(data.forks_count), openIssues: String(data.open_issues_count) } };
            }

            case 'listBranches': {
                const owner = String(inputs.owner ?? '').trim();
                const repo = String(inputs.repo ?? '').trim();
                if (!owner || !repo) throw new Error('owner and repo are required.');
                const data = await gh('GET', `/repos/${owner}/${repo}/branches?per_page=100`);
                return { output: { branches: (data ?? []).map((b: any) => b.name), count: (data ?? []).length } };
            }

            case 'createFile': {
                const owner = String(inputs.owner ?? '').trim();
                const repo = String(inputs.repo ?? '').trim();
                const path = String(inputs.path ?? '').trim();
                const message = String(inputs.message ?? '').trim();
                const content = String(inputs.content ?? '').trim();
                const branch = String(inputs.branch ?? 'main').trim();
                if (!owner || !repo || !path || !message || !content) throw new Error('owner, repo, path, message, and content are required.');
                const encoded = Buffer.from(content).toString('base64');
                const data = await gh('PUT', `/repos/${owner}/${repo}/contents/${path}`, { message, content: encoded, branch });
                return { output: { path: data.content?.path ?? path, sha: data.content?.sha ?? '', url: data.content?.html_url ?? '' } };
            }

            case 'searchRepositories': {
                const query = String(inputs.query ?? '').trim();
                const perPage = Number(inputs.perPage ?? 10);
                if (!query) throw new Error('query is required.');
                const data = await gh('GET', `/search/repositories?q=${encodeURIComponent(query)}&per_page=${perPage}`);
                return { output: { repos: data.items ?? [], total: data.total_count ?? 0 } };
            }

            case 'triggerWorkflow': {
                const owner = String(inputs.owner ?? '').trim();
                const repo = String(inputs.repo ?? '').trim();
                const workflowId = String(inputs.workflowId ?? '').trim();
                const ref = String(inputs.ref ?? 'main').trim();
                if (!owner || !repo || !workflowId) throw new Error('owner, repo, and workflowId are required.');
                await gh('POST', `/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`, { ref });
                return { output: { triggered: 'true' } };
            }

            default:
                return { error: `GitHub action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'GitHub action failed.' };
    }
}
