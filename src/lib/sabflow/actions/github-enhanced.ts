'use server';

export async function executeGitHubEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const token = String(inputs.token ?? '').trim();
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
        };
        const base = 'https://api.github.com';

        switch (actionName) {
            case 'listRepos': {
                const owner = String(inputs.owner ?? '').trim();
                const url = owner
                    ? `${base}/users/${encodeURIComponent(owner)}/repos?per_page=${inputs.perPage ?? 30}&page=${inputs.page ?? 1}`
                    : `${base}/user/repos?per_page=${inputs.perPage ?? 30}&page=${inputs.page ?? 1}`;
                const res = await fetch(url, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `GitHub API error: ${res.status}`);
                return { output: { repos: data } };
            }
            case 'getRepo': {
                const owner = String(inputs.owner ?? '').trim();
                const repo = String(inputs.repo ?? '').trim();
                const res = await fetch(`${base}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `GitHub API error: ${res.status}`);
                return { output: { repo: data } };
            }
            case 'createRepo': {
                const body: Record<string, any> = {
                    name: String(inputs.name ?? '').trim(),
                    description: inputs.description ?? '',
                    private: inputs.private ?? false,
                    auto_init: inputs.autoInit ?? false,
                };
                const res = await fetch(`${base}/user/repos`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `GitHub API error: ${res.status}`);
                return { output: { repo: data } };
            }
            case 'listIssues': {
                const owner = String(inputs.owner ?? '').trim();
                const repo = String(inputs.repo ?? '').trim();
                const state = inputs.state ?? 'open';
                const res = await fetch(
                    `${base}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues?state=${state}&per_page=${inputs.perPage ?? 30}&page=${inputs.page ?? 1}`,
                    { headers }
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `GitHub API error: ${res.status}`);
                return { output: { issues: data } };
            }
            case 'getIssue': {
                const owner = String(inputs.owner ?? '').trim();
                const repo = String(inputs.repo ?? '').trim();
                const issueNumber = Number(inputs.issueNumber);
                const res = await fetch(
                    `${base}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNumber}`,
                    { headers }
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `GitHub API error: ${res.status}`);
                return { output: { issue: data } };
            }
            case 'createIssue': {
                const owner = String(inputs.owner ?? '').trim();
                const repo = String(inputs.repo ?? '').trim();
                const body: Record<string, any> = {
                    title: String(inputs.title ?? '').trim(),
                    body: inputs.body ?? '',
                    labels: inputs.labels ?? [],
                    assignees: inputs.assignees ?? [],
                };
                const res = await fetch(
                    `${base}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`,
                    { method: 'POST', headers, body: JSON.stringify(body) }
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `GitHub API error: ${res.status}`);
                return { output: { issue: data } };
            }
            case 'updateIssue': {
                const owner = String(inputs.owner ?? '').trim();
                const repo = String(inputs.repo ?? '').trim();
                const issueNumber = Number(inputs.issueNumber);
                const body: Record<string, any> = {};
                if (inputs.title !== undefined) body.title = inputs.title;
                if (inputs.body !== undefined) body.body = inputs.body;
                if (inputs.state !== undefined) body.state = inputs.state;
                if (inputs.labels !== undefined) body.labels = inputs.labels;
                if (inputs.assignees !== undefined) body.assignees = inputs.assignees;
                const res = await fetch(
                    `${base}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNumber}`,
                    { method: 'PATCH', headers, body: JSON.stringify(body) }
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `GitHub API error: ${res.status}`);
                return { output: { issue: data } };
            }
            case 'closeIssue': {
                const owner = String(inputs.owner ?? '').trim();
                const repo = String(inputs.repo ?? '').trim();
                const issueNumber = Number(inputs.issueNumber);
                const res = await fetch(
                    `${base}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNumber}`,
                    { method: 'PATCH', headers, body: JSON.stringify({ state: 'closed' }) }
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `GitHub API error: ${res.status}`);
                return { output: { issue: data } };
            }
            case 'listPRs': {
                const owner = String(inputs.owner ?? '').trim();
                const repo = String(inputs.repo ?? '').trim();
                const state = inputs.state ?? 'open';
                const res = await fetch(
                    `${base}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?state=${state}&per_page=${inputs.perPage ?? 30}&page=${inputs.page ?? 1}`,
                    { headers }
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `GitHub API error: ${res.status}`);
                return { output: { pullRequests: data } };
            }
            case 'getPR': {
                const owner = String(inputs.owner ?? '').trim();
                const repo = String(inputs.repo ?? '').trim();
                const pullNumber = Number(inputs.pullNumber);
                const res = await fetch(
                    `${base}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${pullNumber}`,
                    { headers }
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `GitHub API error: ${res.status}`);
                return { output: { pullRequest: data } };
            }
            case 'createPR': {
                const owner = String(inputs.owner ?? '').trim();
                const repo = String(inputs.repo ?? '').trim();
                const body: Record<string, any> = {
                    title: String(inputs.title ?? '').trim(),
                    head: String(inputs.head ?? '').trim(),
                    base: String(inputs.base ?? '').trim(),
                    body: inputs.body ?? '',
                    draft: inputs.draft ?? false,
                };
                const res = await fetch(
                    `${base}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`,
                    { method: 'POST', headers, body: JSON.stringify(body) }
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `GitHub API error: ${res.status}`);
                return { output: { pullRequest: data } };
            }
            case 'mergePR': {
                const owner = String(inputs.owner ?? '').trim();
                const repo = String(inputs.repo ?? '').trim();
                const pullNumber = Number(inputs.pullNumber);
                const body: Record<string, any> = {
                    merge_method: inputs.mergeMethod ?? 'merge',
                };
                if (inputs.commitTitle) body.commit_title = inputs.commitTitle;
                if (inputs.commitMessage) body.commit_message = inputs.commitMessage;
                const res = await fetch(
                    `${base}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${pullNumber}/merge`,
                    { method: 'PUT', headers, body: JSON.stringify(body) }
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `GitHub API error: ${res.status}`);
                return { output: { result: data } };
            }
            case 'createRelease': {
                const owner = String(inputs.owner ?? '').trim();
                const repo = String(inputs.repo ?? '').trim();
                const body: Record<string, any> = {
                    tag_name: String(inputs.tagName ?? '').trim(),
                    name: inputs.name ?? inputs.tagName ?? '',
                    body: inputs.body ?? '',
                    draft: inputs.draft ?? false,
                    prerelease: inputs.prerelease ?? false,
                    target_commitish: inputs.targetCommitish ?? 'main',
                };
                const res = await fetch(
                    `${base}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases`,
                    { method: 'POST', headers, body: JSON.stringify(body) }
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `GitHub API error: ${res.status}`);
                return { output: { release: data } };
            }
            case 'listBranches': {
                const owner = String(inputs.owner ?? '').trim();
                const repo = String(inputs.repo ?? '').trim();
                const res = await fetch(
                    `${base}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=${inputs.perPage ?? 30}&page=${inputs.page ?? 1}`,
                    { headers }
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `GitHub API error: ${res.status}`);
                return { output: { branches: data } };
            }
            case 'createBranch': {
                const owner = String(inputs.owner ?? '').trim();
                const repo = String(inputs.repo ?? '').trim();
                // First get the SHA of the base branch/ref
                const refRes = await fetch(
                    `${base}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/ref/heads/${encodeURIComponent(String(inputs.baseBranch ?? 'main'))}`,
                    { headers }
                );
                const refData = await refRes.json();
                if (!refRes.ok) throw new Error(refData?.message || `GitHub API error: ${refRes.status}`);
                const sha = refData?.object?.sha;
                const res = await fetch(
                    `${base}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/refs`,
                    {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ ref: `refs/heads/${String(inputs.branchName ?? '').trim()}`, sha }),
                    }
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `GitHub API error: ${res.status}`);
                return { output: { branch: data } };
            }
            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
