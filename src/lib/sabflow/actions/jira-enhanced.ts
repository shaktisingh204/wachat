'use server';

export async function executeJiraEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    const base64 = Buffer.from(inputs.email + ':' + inputs.apiToken).toString('base64');
    const baseUrl = `https://${inputs.domain}.atlassian.net/rest/api/3`;
    const headers: Record<string, string> = {
        'Authorization': `Basic ${base64}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'listProjects': {
                const res = await fetch(`${baseUrl}/project/search?maxResults=${inputs.maxResults || 50}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errorMessages?.join(', ') || 'Failed to list projects' };
                return { output: data };
            }
            case 'getProject': {
                const res = await fetch(`${baseUrl}/project/${inputs.projectKey}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errorMessages?.join(', ') || 'Failed to get project' };
                return { output: data };
            }
            case 'createProject': {
                const body = {
                    key: inputs.projectKey,
                    name: inputs.name,
                    projectTypeKey: inputs.projectTypeKey || 'software',
                    leadAccountId: inputs.leadAccountId,
                    description: inputs.description || '',
                };
                const res = await fetch(`${baseUrl}/project`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.errorMessages?.join(', ') || 'Failed to create project' };
                return { output: data };
            }
            case 'listIssues': {
                const jql = inputs.jql || `project = "${inputs.projectKey}"`;
                const res = await fetch(`${baseUrl}/search?jql=${encodeURIComponent(jql)}&maxResults=${inputs.maxResults || 50}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errorMessages?.join(', ') || 'Failed to list issues' };
                return { output: data };
            }
            case 'getIssue': {
                const res = await fetch(`${baseUrl}/issue/${inputs.issueKey}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errorMessages?.join(', ') || 'Failed to get issue' };
                return { output: data };
            }
            case 'createIssue': {
                const body = {
                    fields: {
                        project: { key: inputs.projectKey },
                        summary: inputs.summary,
                        description: inputs.description ? { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: inputs.description }] }] } : undefined,
                        issuetype: { name: inputs.issueType || 'Task' },
                        priority: inputs.priority ? { name: inputs.priority } : undefined,
                        assignee: inputs.assigneeAccountId ? { accountId: inputs.assigneeAccountId } : undefined,
                    },
                };
                const res = await fetch(`${baseUrl}/issue`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.errorMessages?.join(', ') || 'Failed to create issue' };
                return { output: data };
            }
            case 'updateIssue': {
                const body = { fields: inputs.fields || {} };
                const res = await fetch(`${baseUrl}/issue/${inputs.issueKey}`, { method: 'PUT', headers, body: JSON.stringify(body) });
                if (res.status === 204) return { output: { success: true, issueKey: inputs.issueKey } };
                const data = await res.json();
                if (!res.ok) return { error: data.errorMessages?.join(', ') || 'Failed to update issue' };
                return { output: data };
            }
            case 'deleteIssue': {
                const res = await fetch(`${baseUrl}/issue/${inputs.issueKey}`, { method: 'DELETE', headers });
                if (res.status === 204) return { output: { success: true, issueKey: inputs.issueKey } };
                const data = await res.json();
                if (!res.ok) return { error: data.errorMessages?.join(', ') || 'Failed to delete issue' };
                return { output: data };
            }
            case 'transitionIssue': {
                const body = { transition: { id: inputs.transitionId } };
                const res = await fetch(`${baseUrl}/issue/${inputs.issueKey}/transitions`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (res.status === 204) return { output: { success: true, issueKey: inputs.issueKey } };
                const data = await res.json();
                if (!res.ok) return { error: data.errorMessages?.join(', ') || 'Failed to transition issue' };
                return { output: data };
            }
            case 'addComment': {
                const body = {
                    body: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: inputs.comment }] }] },
                };
                const res = await fetch(`${baseUrl}/issue/${inputs.issueKey}/comment`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.errorMessages?.join(', ') || 'Failed to add comment' };
                return { output: data };
            }
            case 'listComments': {
                const res = await fetch(`${baseUrl}/issue/${inputs.issueKey}/comment`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errorMessages?.join(', ') || 'Failed to list comments' };
                return { output: data };
            }
            case 'addAttachment': {
                const formData = new FormData();
                const blob = new Blob([inputs.fileContent], { type: inputs.mimeType || 'application/octet-stream' });
                formData.append('file', blob, inputs.fileName || 'attachment');
                const attachHeaders = {
                    'Authorization': `Basic ${base64}`,
                    'X-Atlassian-Token': 'no-check',
                };
                const res = await fetch(`${baseUrl}/issue/${inputs.issueKey}/attachments`, { method: 'POST', headers: attachHeaders, body: formData });
                const data = await res.json();
                if (!res.ok) return { error: data.errorMessages?.join(', ') || 'Failed to add attachment' };
                return { output: data };
            }
            case 'listSprints': {
                const boardId = inputs.boardId;
                const res = await fetch(`https://${inputs.domain}.atlassian.net/rest/agile/1.0/board/${boardId}/sprint?maxResults=${inputs.maxResults || 50}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errorMessages?.join(', ') || 'Failed to list sprints' };
                return { output: data };
            }
            case 'createSprint': {
                const body = {
                    name: inputs.name,
                    originBoardId: inputs.boardId,
                    startDate: inputs.startDate,
                    endDate: inputs.endDate,
                    goal: inputs.goal || '',
                };
                const res = await fetch(`https://${inputs.domain}.atlassian.net/rest/agile/1.0/sprint`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.errorMessages?.join(', ') || 'Failed to create sprint' };
                return { output: data };
            }
            case 'searchIssues': {
                const body = {
                    jql: inputs.jql,
                    maxResults: inputs.maxResults || 50,
                    startAt: inputs.startAt || 0,
                    fields: inputs.fields || ['summary', 'status', 'assignee', 'priority'],
                };
                const res = await fetch(`${baseUrl}/search`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.errorMessages?.join(', ') || 'Failed to search issues' };
                return { output: data };
            }
            default:
                return { error: `Unknown Jira Enhanced action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Jira Enhanced action error: ${err.message}`);
        return { error: err.message || 'Jira Enhanced action failed' };
    }
}
