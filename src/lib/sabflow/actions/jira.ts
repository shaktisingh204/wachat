
'use server';

async function jiraFetch(domain: string, email: string, apiToken: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Jira] ${method} ${path}`);
    const base64Auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
    const url = `https://${domain}.atlassian.net/rest/api/3${path}`;
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
    if (res.status === 204 || res.status === 201 && !res.headers.get('content-type')?.includes('json')) {
        return {};
    }
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.errorMessages?.[0] || data?.message || `Jira API error: ${res.status}`);
    }
    return data;
}

export async function executeJiraAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const domain = String(inputs.domain ?? '').trim().replace(/\.atlassian\.net.*/, '');
        const email = String(inputs.email ?? '').trim();
        const apiToken = String(inputs.apiToken ?? '').trim();
        if (!domain || !email || !apiToken) throw new Error('domain, email, and apiToken are required.');

        const jira = (method: string, path: string, body?: any) => jiraFetch(domain, email, apiToken, method, path, body, logger);

        switch (actionName) {
            case 'createIssue': {
                const projectKey = String(inputs.projectKey ?? '').trim();
                const summary = String(inputs.summary ?? '').trim();
                const issueType = String(inputs.issueType ?? 'Task').trim();
                const description = String(inputs.description ?? '').trim();
                const priority = String(inputs.priority ?? '').trim();
                if (!projectKey || !summary) throw new Error('projectKey and summary are required.');

                const body: any = {
                    fields: {
                        project: { key: projectKey },
                        summary,
                        issuetype: { name: issueType },
                    },
                };
                if (description) {
                    body.fields.description = { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: description }] }] };
                }
                if (priority) body.fields.priority = { name: priority };

                const data = await jira('POST', '/issue', body);
                logger.log(`[Jira] Issue created: ${data.key}`);
                return { output: { id: data.id, key: data.key, url: `https://${domain}.atlassian.net/browse/${data.key}` } };
            }

            case 'getIssue': {
                const issueKey = String(inputs.issueKey ?? '').trim();
                if (!issueKey) throw new Error('issueKey is required.');
                const data = await jira('GET', `/issue/${issueKey}`);
                return {
                    output: {
                        id: data.id,
                        key: data.key,
                        summary: data.fields?.summary ?? '',
                        status: data.fields?.status?.name ?? '',
                        assignee: data.fields?.assignee?.displayName ?? '',
                        priority: data.fields?.priority?.name ?? '',
                    },
                };
            }

            case 'updateIssue': {
                const issueKey = String(inputs.issueKey ?? '').trim();
                const summary = String(inputs.summary ?? '').trim();
                const description = String(inputs.description ?? '').trim();
                if (!issueKey) throw new Error('issueKey is required.');

                const fields: any = {};
                if (summary) fields.summary = summary;
                if (description) {
                    fields.description = { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: description }] }] };
                }
                await jira('PUT', `/issue/${issueKey}`, { fields });
                return { output: { updated: 'true', key: issueKey } };
            }

            case 'transitionIssue': {
                const issueKey = String(inputs.issueKey ?? '').trim();
                const transitionName = String(inputs.transitionName ?? '').trim();
                if (!issueKey || !transitionName) throw new Error('issueKey and transitionName are required.');

                const transitions = await jira('GET', `/issue/${issueKey}/transitions`);
                const transition = (transitions.transitions ?? []).find((t: any) => t.name.toLowerCase() === transitionName.toLowerCase());
                if (!transition) throw new Error(`Transition "${transitionName}" not found.`);
                await jira('POST', `/issue/${issueKey}/transitions`, { transition: { id: transition.id } });
                return { output: { transitioned: 'true', status: transitionName } };
            }

            case 'addComment': {
                const issueKey = String(inputs.issueKey ?? '').trim();
                const comment = String(inputs.comment ?? '').trim();
                if (!issueKey || !comment) throw new Error('issueKey and comment are required.');
                const body = { body: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: comment }] }] } };
                const data = await jira('POST', `/issue/${issueKey}/comment`, body);
                return { output: { commentId: data.id, author: data.author?.displayName ?? '' } };
            }

            case 'assignIssue': {
                const issueKey = String(inputs.issueKey ?? '').trim();
                const accountId = String(inputs.accountId ?? '').trim();
                if (!issueKey) throw new Error('issueKey is required.');
                await jira('PUT', `/issue/${issueKey}/assignee`, { accountId: accountId || null });
                return { output: { assigned: 'true' } };
            }

            case 'searchIssues': {
                const jql = String(inputs.jql ?? '').trim();
                const maxResults = Number(inputs.maxResults ?? 50);
                if (!jql) throw new Error('jql is required.');
                const data = await jira('POST', '/issue/search', { jql, maxResults, fields: ['summary', 'status', 'assignee', 'priority'] });
                return { output: { issues: data.issues ?? [], total: data.total ?? 0 } };
            }

            case 'getProjects': {
                const data = await jira('GET', '/project');
                return { output: { projects: data ?? [], count: (data ?? []).length } };
            }

            case 'createProject': {
                const name = String(inputs.name ?? '').trim();
                const key = String(inputs.key ?? '').trim();
                const projectTypeKey = String(inputs.projectTypeKey ?? 'software').trim();
                const leadAccountId = String(inputs.leadAccountId ?? '').trim();
                if (!name || !key || !leadAccountId) throw new Error('name, key, and leadAccountId are required.');
                const data = await jira('POST', '/project', { name, key, projectTypeKey, leadAccountId });
                return { output: { id: String(data.id), key: data.key, name: data.name } };
            }

            case 'deleteIssue': {
                const issueKey = String(inputs.issueKey ?? '').trim();
                if (!issueKey) throw new Error('issueKey is required.');
                await jira('DELETE', `/issue/${issueKey}`);
                return { output: { deleted: 'true', key: issueKey } };
            }

            default:
                return { error: `Jira action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Jira action failed.' };
    }
}
