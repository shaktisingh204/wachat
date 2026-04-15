'use server';

export async function executePlaneAction(actionName: string, inputs: any, user: any, logger: any) {
    const base = 'https://api.plane.so/api/v1';
    const headers = {
        'Content-Type': 'application/json',
        'X-Api-Key': inputs.apiKey,
    };

    try {
        switch (actionName) {
            case 'listWorkspaces': {
                const res = await fetch(`${base}/workspaces/`, { headers });
                const data = await res.json();
                return { output: { workspaces: data.results ?? data } };
            }
            case 'getWorkspace': {
                const res = await fetch(`${base}/workspaces/${inputs.workspaceSlug}/`, { headers });
                const data = await res.json();
                return { output: { workspace: data } };
            }
            case 'listProjects': {
                const res = await fetch(`${base}/workspaces/${inputs.workspaceSlug}/projects/`, { headers });
                const data = await res.json();
                return { output: { projects: data.results ?? data } };
            }
            case 'getProject': {
                const res = await fetch(`${base}/workspaces/${inputs.workspaceSlug}/projects/${inputs.projectId}/`, { headers });
                const data = await res.json();
                return { output: { project: data } };
            }
            case 'createProject': {
                const body: any = { name: inputs.name, identifier: inputs.identifier, network: inputs.network ?? 2 };
                if (inputs.description) body.description = inputs.description;
                const res = await fetch(`${base}/workspaces/${inputs.workspaceSlug}/projects/`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: { project: data } };
            }
            case 'listIssues': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                const res = await fetch(`${base}/workspaces/${inputs.workspaceSlug}/projects/${inputs.projectId}/issues/?${params}`, { headers });
                const data = await res.json();
                return { output: { issues: data.results ?? data } };
            }
            case 'getIssue': {
                const res = await fetch(`${base}/workspaces/${inputs.workspaceSlug}/projects/${inputs.projectId}/issues/${inputs.issueId}/`, { headers });
                const data = await res.json();
                return { output: { issue: data } };
            }
            case 'createIssue': {
                const body: any = { name: inputs.name };
                if (inputs.description) body.description_html = inputs.description;
                if (inputs.priority) body.priority = inputs.priority;
                if (inputs.state) body.state = inputs.state;
                if (inputs.assignees) body.assignees = inputs.assignees;
                const res = await fetch(`${base}/workspaces/${inputs.workspaceSlug}/projects/${inputs.projectId}/issues/`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: { issue: data } };
            }
            case 'updateIssue': {
                const body: any = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.description) body.description_html = inputs.description;
                if (inputs.priority) body.priority = inputs.priority;
                if (inputs.state) body.state = inputs.state;
                if (inputs.assignees) body.assignees = inputs.assignees;
                const res = await fetch(`${base}/workspaces/${inputs.workspaceSlug}/projects/${inputs.projectId}/issues/${inputs.issueId}/`, { method: 'PATCH', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: { issue: data } };
            }
            case 'deleteIssue': {
                const res = await fetch(`${base}/workspaces/${inputs.workspaceSlug}/projects/${inputs.projectId}/issues/${inputs.issueId}/`, { method: 'DELETE', headers });
                return { output: { success: res.ok, status: res.status } };
            }
            case 'listModules': {
                const res = await fetch(`${base}/workspaces/${inputs.workspaceSlug}/projects/${inputs.projectId}/modules/`, { headers });
                const data = await res.json();
                return { output: { modules: data.results ?? data } };
            }
            case 'createModule': {
                const body: any = { name: inputs.name };
                if (inputs.description) body.description = inputs.description;
                if (inputs.status) body.status = inputs.status;
                const res = await fetch(`${base}/workspaces/${inputs.workspaceSlug}/projects/${inputs.projectId}/modules/`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: { module: data } };
            }
            case 'listCycles': {
                const res = await fetch(`${base}/workspaces/${inputs.workspaceSlug}/projects/${inputs.projectId}/cycles/`, { headers });
                const data = await res.json();
                return { output: { cycles: data.results ?? data } };
            }
            case 'createCycle': {
                const body: any = { name: inputs.name };
                if (inputs.description) body.description = inputs.description;
                if (inputs.start_date) body.start_date = inputs.start_date;
                if (inputs.end_date) body.end_date = inputs.end_date;
                const res = await fetch(`${base}/workspaces/${inputs.workspaceSlug}/projects/${inputs.projectId}/cycles/`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: { cycle: data } };
            }
            case 'listStates': {
                const res = await fetch(`${base}/workspaces/${inputs.workspaceSlug}/projects/${inputs.projectId}/states/`, { headers });
                const data = await res.json();
                return { output: { states: data.results ?? data } };
            }
            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Plane action error: ${err.message}`);
        return { error: err.message };
    }
}
