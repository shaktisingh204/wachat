'use server';

export async function executeGitlabEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const baseUrl = (inputs.baseUrl || 'https://gitlab.com').replace(/\/$/, '');
        const apiBase = `${baseUrl}/api/v4`;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (inputs.token) {
            headers['PRIVATE-TOKEN'] = inputs.token;
        } else if (inputs.accessToken) {
            headers['Authorization'] = `Bearer ${inputs.accessToken}`;
        }

        switch (actionName) {
            case 'listProjects': {
                const params = new URLSearchParams();
                if (inputs.search) params.set('search', inputs.search);
                if (inputs.owned) params.set('owned', 'true');
                if (inputs.membership) params.set('membership', 'true');
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.page) params.set('page', String(inputs.page));
                const res = await fetch(`${apiBase}/projects?${params}`, { headers });
                const data = await res.json();
                return { output: { projects: data } };
            }
            case 'getProject': {
                const projectId = encodeURIComponent(inputs.projectId);
                const res = await fetch(`${apiBase}/projects/${projectId}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'createProject': {
                const res = await fetch(`${apiBase}/projects`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        name: inputs.name,
                        description: inputs.description,
                        visibility: inputs.visibility || 'private',
                        initialize_with_readme: inputs.initializeWithReadme ?? true,
                        namespace_id: inputs.namespaceId,
                    }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'listIssues': {
                const projectId = encodeURIComponent(inputs.projectId);
                const params = new URLSearchParams();
                if (inputs.state) params.set('state', inputs.state);
                if (inputs.labels) params.set('labels', inputs.labels);
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.page) params.set('page', String(inputs.page));
                const res = await fetch(`${apiBase}/projects/${projectId}/issues?${params}`, { headers });
                const data = await res.json();
                return { output: { issues: data } };
            }
            case 'createIssue': {
                const projectId = encodeURIComponent(inputs.projectId);
                const res = await fetch(`${apiBase}/projects/${projectId}/issues`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        title: inputs.title,
                        description: inputs.description,
                        labels: inputs.labels,
                        assignee_ids: inputs.assigneeIds,
                        milestone_id: inputs.milestoneId,
                        due_date: inputs.dueDate,
                    }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'updateIssue': {
                const projectId = encodeURIComponent(inputs.projectId);
                const issueIid = inputs.issueIid;
                const res = await fetch(`${apiBase}/projects/${projectId}/issues/${issueIid}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({
                        title: inputs.title,
                        description: inputs.description,
                        state_event: inputs.stateEvent,
                        labels: inputs.labels,
                        assignee_ids: inputs.assigneeIds,
                    }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'listMergeRequests': {
                const projectId = encodeURIComponent(inputs.projectId);
                const params = new URLSearchParams();
                if (inputs.state) params.set('state', inputs.state);
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.page) params.set('page', String(inputs.page));
                const res = await fetch(`${apiBase}/projects/${projectId}/merge_requests?${params}`, { headers });
                const data = await res.json();
                return { output: { mergeRequests: data } };
            }
            case 'createMergeRequest': {
                const projectId = encodeURIComponent(inputs.projectId);
                const res = await fetch(`${apiBase}/projects/${projectId}/merge_requests`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        title: inputs.title,
                        description: inputs.description,
                        source_branch: inputs.sourceBranch,
                        target_branch: inputs.targetBranch,
                        assignee_id: inputs.assigneeId,
                        reviewer_ids: inputs.reviewerIds,
                        remove_source_branch: inputs.removeSourceBranch ?? false,
                    }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'approveMR': {
                const projectId = encodeURIComponent(inputs.projectId);
                const mrIid = inputs.mrIid;
                const res = await fetch(`${apiBase}/projects/${projectId}/merge_requests/${mrIid}/approve`, {
                    method: 'POST',
                    headers,
                });
                const data = await res.json();
                return { output: data };
            }
            case 'getMR': {
                const projectId = encodeURIComponent(inputs.projectId);
                const mrIid = inputs.mrIid;
                const res = await fetch(`${apiBase}/projects/${projectId}/merge_requests/${mrIid}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'listPipelines': {
                const projectId = encodeURIComponent(inputs.projectId);
                const params = new URLSearchParams();
                if (inputs.status) params.set('status', inputs.status);
                if (inputs.ref) params.set('ref', inputs.ref);
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.page) params.set('page', String(inputs.page));
                const res = await fetch(`${apiBase}/projects/${projectId}/pipelines?${params}`, { headers });
                const data = await res.json();
                return { output: { pipelines: data } };
            }
            case 'triggerPipeline': {
                const projectId = encodeURIComponent(inputs.projectId);
                const res = await fetch(`${apiBase}/projects/${projectId}/pipeline`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        ref: inputs.ref || 'main',
                        variables: inputs.variables,
                    }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'getPipeline': {
                const projectId = encodeURIComponent(inputs.projectId);
                const pipelineId = inputs.pipelineId;
                const res = await fetch(`${apiBase}/projects/${projectId}/pipelines/${pipelineId}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'listRepositoryFiles': {
                const projectId = encodeURIComponent(inputs.projectId);
                const params = new URLSearchParams();
                if (inputs.path) params.set('path', inputs.path);
                if (inputs.ref) params.set('ref', inputs.ref || 'main');
                if (inputs.recursive) params.set('recursive', 'true');
                const res = await fetch(`${apiBase}/projects/${projectId}/repository/tree?${params}`, { headers });
                const data = await res.json();
                return { output: { files: data } };
            }
            case 'getFile': {
                const projectId = encodeURIComponent(inputs.projectId);
                const filePath = encodeURIComponent(inputs.filePath);
                const ref = inputs.ref || 'main';
                const res = await fetch(`${apiBase}/projects/${projectId}/repository/files/${filePath}?ref=${ref}`, { headers });
                const data = await res.json();
                if (data.content) {
                    data.decodedContent = Buffer.from(data.content, 'base64').toString('utf-8');
                }
                return { output: data };
            }
            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`GitLab Enhanced action error: ${err.message}`);
        return { error: err.message };
    }
}
